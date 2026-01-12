import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KardexService } from '@core/services/kardex-service';
import { ItemsService } from '@core/services/items-service';
import { KardexView } from '@data/models/inventory/kardex.model';
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
  protected readonly kardexEntries = signal<KardexView[]>([]);
  protected readonly items = signal<ItemView[]>([]);

  // Filter signals
  protected readonly selectedItemId = signal<string>('');
  protected readonly searchTerm = signal('');

  // Pagination signals
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);

  // Computed values
  protected readonly hasFilters = computed(() => {
    return !!(this.selectedItemId() || this.searchTerm());
  });

  async ngOnInit() {
    // Configurar debounce para búsqueda
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((searchTerm) => {
      this.searchTerm.set(searchTerm);
      this.currentPage.set(1);
      this.loadKardexEntries();
    });

    await this.loadItems();
    await this.loadKardexEntries();
  }

  private async loadItems() {
    try {
      const response = await this.itemsService.getItems({ status: 'ACTIVE', pageSize: 1000 });
      this.items.set(response.data);
    } catch (error) {
      console.error('Error al cargar items:', error);
    }
  }

  protected async loadKardexEntries() {
    try {
      this.loading.set(true);
      this.error.set(null);

      const response = await this.kardexService.getKardexEntries({
        itemId: this.selectedItemId() || undefined,
        batchCode: this.searchTerm() || undefined,
        page: this.currentPage(),
        pageSize: this.pageSize(),
      });

      this.kardexEntries.set(response.data);
      this.totalCount.set(response.count);
      this.totalPages.set(response.totalPages);
    } catch (error) {
      console.error('Error al cargar kardex:', error);
      this.error.set('Error al cargar los lotes de kardex');
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
    this.loadKardexEntries();
  }

  protected clearFilters() {
    this.selectedItemId.set('');
    this.searchTerm.set('');
    this.currentPage.set(1);
    this.loadKardexEntries();
  }

  protected nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadKardexEntries();
    }
  }

  protected previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadKardexEntries();
    }
  }

  protected goToPage(page: number) {
    this.currentPage.set(page);
    this.loadKardexEntries();
  }

  protected navigateToNewEntry() {
    this.router.navigate(['/inventario/kardex/nuevo']);
  }

  protected navigateToConsumptionLogs() {
    this.router.navigate(['/inventario/kardex/consumos']);
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getStatusBadgeClass(quantityRemaining: number | null | undefined): string {
    if (quantityRemaining === null || quantityRemaining === undefined || quantityRemaining === 0) {
      return 'badge-error';
    } else if (quantityRemaining > 0) {
      return 'badge-success';
    }
    return 'badge-ghost';
  }

  protected getStatusText(quantityRemaining: number | null | undefined): string {
    if (quantityRemaining === null || quantityRemaining === undefined || quantityRemaining === 0) {
      return 'Agotado';
    } else if (quantityRemaining > 0) {
      return 'Disponible';
    }
    return '-';
  }
}
