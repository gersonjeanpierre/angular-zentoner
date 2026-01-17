import { Component, inject, signal, OnInit, input } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KardexService } from '@core/services/kardex-service';
import { KardexView, RollTrackingView } from '@data/models/inventory/kardex.model';

@Component({
  selector: 'app-item-kardex-history',
  imports: [CommonModule],
  templateUrl: './item-kardex-history.html',
  styleUrl: './item-kardex-history.css',
})
export default class ItemKardexHistory implements OnInit {
  readonly itemId = input<string>();
  readonly rollId = input<string>();

  private readonly kardexService = inject(KardexService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly kardexHistory = signal<KardexView[]>([]);
  protected readonly rollInfo = signal<RollTrackingView | null>(null);

  async ngOnInit() {
    await this.loadHistory();
  }

  private async loadHistory() {
    try {
      this.loading.set(true);
      this.error.set(null);

      // Si hay rollId, cargar historial del rollo
      if (this.rollId()) {
        const history = await this.kardexService.getRollHistory(this.rollId()!);
        this.kardexHistory.set(history);
      }
      // Si hay itemId, cargar historial del item
      else if (this.itemId()) {
        const history = await this.kardexService.getItemKardexHistory(this.itemId()!, 100);
        this.kardexHistory.set(history);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      this.error.set('Error al cargar el historial');
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

  protected getMovementTypeBadgeClass(movementTypeName: string | undefined): string {
    switch (movementTypeName) {
      case 'ENTRADA':
        return 'badge-success';
      case 'SALIDA':
        return 'badge-error';
      case 'AJUSTE':
        return 'badge-warning';
      default:
        return 'badge-ghost';
    }
  }

  protected goBack() {
    this.router.navigate(['/inventario/kardex']);
  }
}
