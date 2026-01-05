import {
  Component,
  inject,
  signal,
  OnInit,
  effect,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgClass } from '@angular/common';
import { CustomerService, GetCustomersParams } from '../../../core/services/customer-service';
import { CustomerView } from '@data/models/customer/customer.model';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import camelCase from 'camelcase-keys';

@Component({
  selector: 'app-customers-list',
  imports: [CommonModule, RouterModule, FormsModule, NgClass],
  templateUrl: './customers-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CustomersList implements OnInit {
  private readonly customersService = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly searchSubject = new Subject<string>();

  // State signals
  protected readonly customers = signal<CustomerView[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleteSuccess = signal(false);

  // Filter signals
  protected readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  protected readonly customerTypeFilter = signal<
    'ALL' | 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE'
  >('ALL');
  protected readonly personTypeFilter = signal<'ALL' | 'JURIDICA' | 'NATURAL'>('ALL');
  protected readonly searchTerm = signal('');

  // Pagination signals
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);

  // Computed signals
  protected readonly hasActiveFilters = computed(
    () =>
      this.searchTerm() !== '' ||
      this.customerTypeFilter() !== 'ALL' ||
      this.personTypeFilter() !== 'ALL',
  );

  protected readonly showEmptyState = computed(
    () => !this.loading() && this.customers().length === 0 && !this.error(),
  );

  protected readonly showTable = computed(() => !this.loading() && this.customers().length > 0);

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

  constructor() {
    // Debounce para búsqueda
    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe((term) => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadCustomers();
    });

    effect(() => {
      this.statusFilter();
      this.customerTypeFilter();
      this.personTypeFilter();
      this.currentPage();

      this.loading.set(true);
      this.loadCustomers().finally(() => this.loading.set(false));
    });
  }

  async ngOnInit() {
    await this.loadCustomers();
  }

  private async loadCustomers() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const params: GetCustomersParams = {
        status: this.statusFilter(),
        page: this.currentPage(),
        pageSize: this.pageSize(),
        search: this.searchTerm() || undefined,
      };

      if (this.customerTypeFilter() !== 'ALL') {
        params.customerType = this.customerTypeFilter() as unknown as
          | 'NUEVO'
          | 'FRECUENTE'
          | 'IMPRENTERO_NUEVO'
          | 'IMPRENTERO_FRECUENTE';
      }

      if (this.personTypeFilter() !== 'ALL') {
        params.personType = this.personTypeFilter() as unknown as 'JURIDICA' | 'NATURAL';
      }

      const response = await this.customersService.getCustomers(params);
      const camelCasedData = response.data.map((item) => camelCase(item));
      this.customers.set(camelCasedData);
      this.totalCount.set(response.count);
      this.totalPages.set(response.totalPages);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Error al cargar clientes');
      this.customers.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
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

    this.loading.set(true);
    try {
      await this.customersService.softDeleteCustomer(customer.id);
      this.deleteSuccess.set(true);
      await this.loadCustomers();
      setTimeout(() => this.deleteSuccess.set(false), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Error al eliminar cliente');
    } finally {
      this.loading.set(false);
    }
  }

  protected onEdit(id: string) {
    this.router.navigate(['/clientes/edit', id]);
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
}
