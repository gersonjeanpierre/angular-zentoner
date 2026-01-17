import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KardexService } from '@core/services/kardex-service';
import { ItemsService } from '@core/services/items-service';
import { RollTrackingView } from '@data/models/inventory/kardex.model';
import { ItemView } from '@data/models/inventory/item.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-kardex-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './kardex-list.html',
  styleUrl: './kardex-list.css',
})
export default class KardexList implements OnInit {
  private readonly router = inject(Router);
  private readonly kardexService = inject(KardexService);
  private readonly itemsService = inject(ItemsService);
  private readonly searchSubject = new Subject<string>();

  // State signals
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rolls = signal<RollTrackingView[]>([]);
  protected readonly items = signal<ItemView[]>([]);

  // Filter signals
  protected readonly selectedItemId = signal<string>('');
  protected readonly selectedStatus = signal<string>('');
  protected readonly searchTerm = signal('');

  // Pagination signals
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);

  // Computed values
  protected readonly hasFilters = computed(() => {
    return !!(this.selectedItemId() || this.selectedStatus() || this.searchTerm());
  });

  protected readonly getAvailableCount = computed(() => {
    return this.rolls().filter((r) => r.status === 'full').length;
  });

  protected readonly getPartialCount = computed(() => {
    return this.rolls().filter((r) => r.status === 'in_use').length;
  });

  protected readonly getEmptyCount = computed(() => {
    return this.rolls().filter((r) => r.status === 'depleted').length;
  });

  async ngOnInit() {
    // Configurar debounce para búsqueda
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((searchTerm) => {
      this.searchTerm.set(searchTerm);
      this.currentPage.set(1);
      this.loadRolls();
    });

    await this.loadInitialData();
  }

  private async loadInitialData() {
    try {
      const itemsResponse = await this.itemsService.getItems({ status: 'ACTIVE', pageSize: 1000 });
      this.items.set(itemsResponse.data);
      await this.loadRolls();
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      this.error.set('Error al cargar los datos iniciales');
    }
  }

  private async loadRolls() {
    try {
      this.loading.set(true);
      this.error.set(null);

      const params: any = {
        page: this.currentPage(),
        pageSize: this.pageSize(),
      };

      if (this.selectedItemId()) {
        params.itemId = this.selectedItemId();
      }

      if (this.selectedStatus()) {
        params.status = this.selectedStatus();
      }

      const response = await this.kardexService.getRolls(params);

      // Filtrar por búsqueda local si hay término
      let filteredRolls = response.data;
      if (this.searchTerm()) {
        const term = this.searchTerm().toLowerCase();
        filteredRolls = response.data.filter(
          (roll) =>
            roll.roll_code.toLowerCase().includes(term) ||
            roll.item_name?.toLowerCase().includes(term) ||
            roll.item_sku?.toLowerCase().includes(term),
        );
      }

      this.rolls.set(filteredRolls);
      this.totalCount.set(response.count);
      this.totalPages.set(response.totalPages);
    } catch (error) {
      console.error('Error al cargar rollos:', error);
      this.error.set('Error al cargar los rollos de inventario');
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  protected onItemChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedItemId.set(select.value);
    this.currentPage.set(1);
    this.loadRolls();
  }

  protected onStatusChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value);
    this.currentPage.set(1);
    this.loadRolls();
  }

  protected clearFilters() {
    this.selectedItemId.set('');
    this.selectedStatus.set('');
    this.searchTerm.set('');
    this.currentPage.set(1);
    this.loadRolls();
  }

  protected nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadRolls();
    }
  }

  protected previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadRolls();
    }
  }

  protected goToPage(page: number) {
    this.currentPage.set(page);
    this.loadRolls();
  }

  protected navigateToNewEntry() {
    this.router.navigate(['/inventario/kardex/nuevo']);
  }

  protected viewRollHistory(rollId: string) {
    this.router.navigate(['/inventario/kardex/rollo', rollId]);
  }

  protected useRoll(rollId: string) {
    this.router.navigate(['/inventario/kardex/produccion'], {
      queryParams: { rollId },
    });
  }

  // Eliminado getPercentage() - no hay initial_quantity en el schema

  protected formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  protected getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'full':
        return 'badge-success';
      case 'in_use':
        return 'badge-warning';
      case 'depleted':
        return 'badge-error';
      case 'scrapped':
        return 'badge-ghost';
      default:
        return 'badge-ghost';
    }
  }

  protected getStatusText(status: string): string {
    switch (status) {
      case 'full':
        return 'Completo';
      case 'in_use':
        return 'En uso';
      case 'depleted':
        return 'Agotado';
      case 'scrapped':
        return 'Descartado';
      default:
        return status;
    }
  }
}
