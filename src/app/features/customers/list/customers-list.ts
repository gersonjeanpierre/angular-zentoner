import {
  Component,
  inject,
  signal,
  computed,
  resource,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { CustomerService } from '@core/services/customer-service';
import { CustomerView } from '@data/models/customer/customer.model';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-customers-list',
  imports: [CommonModule, RouterModule, NgClass],
  templateUrl: './customers-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CustomersList {
  private readonly customersService = inject(CustomerService);
  private readonly router = inject(Router);

  // Filter signals
  protected readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  protected readonly customerTypeFilter = signal<
    'ALL' | 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE'
  >('ALL');
  protected readonly personTypeFilter = signal<'ALL' | 'JURIDICA' | 'NATURAL'>('ALL');
  protected readonly searchTerm = signal('');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);

  // UI state signals
  protected readonly deleteSuccess = signal(false);
  protected readonly syncing = signal(false);

  // Observable reactivo de Dexie - se actualiza automáticamente
  private readonly allCustomers = toSignal(this.customersService.dataCustomers$, {
    initialValue: [],
  });

  // Computed: filtra los datos de Dexie
  protected readonly filteredCustomers = computed(() => {
    let customers = this.allCustomers();

    // Filtro por estado
    if (this.statusFilter() === 'ACTIVE') {
      customers = customers.filter((c) => !c.customerDeletedAt && !c.personDeletedAt);
    } else if (this.statusFilter() === 'INACTIVE') {
      customers = customers.filter((c) => c.customerDeletedAt || c.personDeletedAt);
    }

    // Filtro por tipo de cliente
    if (this.customerTypeFilter() !== 'ALL') {
      customers = customers.filter((c) => c.customerTypeCode === this.customerTypeFilter());
    }

    // Filtro por tipo de persona
    if (this.personTypeFilter() !== 'ALL') {
      customers = customers.filter((c) => c.personType === this.personTypeFilter());
    }

    // Búsqueda por texto
    const search = this.searchTerm().toLowerCase();
    if (search) {
      customers = customers.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(search) ||
          c.lastName?.toLowerCase().includes(search) ||
          c.legalName?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search) ||
          c.phone?.toLowerCase().includes(search) ||
          c.dni?.includes(search) ||
          c.ruc?.includes(search) ||
          c.ce?.includes(search) ||
          c.customerCode?.toLowerCase().includes(search),
      );
    }

    return customers;
  });

  // Computed: total de registros después de filtros
  protected readonly totalCount = computed(() => this.filteredCustomers().length);

  // Computed: total de páginas
  protected readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  // Computed: datos paginados
  protected readonly customers = computed(() => {
    const filtered = this.filteredCustomers();
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return filtered.slice(start, end);
  });

  // Computed signals for UI
  protected readonly hasActiveFilters = computed(
    () =>
      this.searchTerm() !== '' ||
      this.customerTypeFilter() !== 'ALL' ||
      this.personTypeFilter() !== 'ALL',
  );

  protected readonly paginationInfo = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize() + 1;
    const end = Math.min(this.currentPage() * this.pageSize(), this.totalCount());
    return { start, end, total: this.totalCount() };
  });

  protected readonly paginationRange = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const range: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) range.push(i);
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) range.push(i);
        range.push(-1);
        range.push(total);
      } else if (current >= total - 3) {
        range.push(1);
        range.push(-1);
        for (let i = total - 4; i <= total; i++) range.push(i);
      } else {
        range.push(1);
        range.push(-1);
        for (let i = current - 1; i <= current + 1; i++) range.push(i);
        range.push(-1);
        range.push(total);
      }
    }

    return range;
  });

  // Resource para carga inicial - Reemplaza constructor async
  protected readonly loadResource = resource({
    loader: async () => {
      await this.customersService.ensureCustomersLoaded();
      return { loaded: true };
    },
  });

  // Computed para estados de UI basados en resource
  protected readonly loading = computed(() => this.loadResource.isLoading());
  protected readonly error = computed(() => this.loadResource.error()?.message ?? null);
  protected readonly showEmptyState = computed(
    () => !this.loading() && this.customers().length === 0 && !this.error(),
  );
  protected readonly showTable = computed(() => !this.loading() && this.customers().length > 0);

  protected onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  protected onStatusFilterChange(status: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  protected onCustomerTypeFilterChange(
    type: 'ALL' | 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE',
  ) {
    this.customerTypeFilter.set(type);
    this.currentPage.set(1);
  }

  protected onPersonTypeFilterChange(type: 'ALL' | 'JURIDICA' | 'NATURAL') {
    this.personTypeFilter.set(type);
    this.currentPage.set(1);
  }

  protected onPageChange(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  protected onPageSizeChange(event: Event) {
    const size = parseInt((event.target as HTMLSelectElement).value);
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  protected async onDelete(customer: CustomerView) {
    if (!confirm(`¿Seguro que deseas eliminar a ${customer.firstName} ${customer.lastName}?`))
      return;

    try {
      await this.customersService.softDeleteCustomer(customer.id);
      this.deleteSuccess.set(true);
      setTimeout(() => this.deleteSuccess.set(false), 3000);
    } catch (e: unknown) {
      console.error('[CustomersList] Error al eliminar:', e);
    }
  }

  protected onEdit(id: string) {
    this.router.navigate(['/clientes/editar', id]);
  }

  protected getFullName(customer: CustomerView): string {
    if (customer.personType === 'JURIDICA' && customer.legalName) {
      return customer.legalName;
    }
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  }

  protected getCustomerTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      NUEVO: 'NUEVO',
      FRECUENTE: 'FRECUENTE',
      IMPRENTERO_NUEVO: 'IMPRE NUEVO',
      IMPRENTERO_FRECUENTE: 'IMPRE FRECUENTE',
    };
    return labels[type] || type;
  }

  protected getPersonTypeLabel(type: string): string {
    return type === 'JURIDICA' ? 'JURIDICA' : 'NATURAL';
  }

  protected getIdentification(customer: CustomerView): string {
    if (customer.dni) return `DNI: ${customer.dni}`;
    if (customer.ruc) return `RUC: ${customer.ruc}`;
    if (customer.ce) return `CE: ${customer.ce}`;
    return '-';
  }

  /**
   * Sincronización manual: Limpia Dexie y recarga desde Supabase
   */
  protected async onSync() {
    this.syncing.set(true);
    try {
      await this.customersService.syncCustomers();
      console.log('[CustomersList] Sincronización completada');
    } catch (e: unknown) {
      console.error('[CustomersList] Error al sincronizar:', e);
    } finally {
      this.syncing.set(false);
    }
  }
}
