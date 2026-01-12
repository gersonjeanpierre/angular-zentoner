import { Component, inject, signal, OnInit, input } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KardexService } from '@core/services/kardex-service';
import { KardexView } from '@data/models/inventory/kardex.model';

@Component({
  selector: 'app-item-kardex-history',
  imports: [CommonModule],
  templateUrl: './item-kardex-history.html',
  styleUrl: './item-kardex-history.css',
})
export default class ItemKardexHistory implements OnInit {
  readonly itemId = input.required<string>();

  private readonly kardexService = inject(KardexService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly kardexHistory = signal<KardexView[]>([]);

  async ngOnInit() {
    await this.loadHistory();
  }

  private async loadHistory() {
    try {
      this.loading.set(true);
      this.error.set(null);

      const history = await this.kardexService.getItemKardexHistory(this.itemId(), 100);
      this.kardexHistory.set(history);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      this.error.set('Error al cargar el historial del item');
    } finally {
      this.loading.set(false);
    }
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

  protected goBack() {
    this.router.navigate(['/inventario/kardex']);
  }
}
