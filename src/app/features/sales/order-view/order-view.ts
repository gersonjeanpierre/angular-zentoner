import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService, OrderWithDetails } from '@core/services/order-service';

@Component({
  selector: 'app-order-view',
  imports: [],
  templateUrl: './order-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderView {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected order = signal<OrderWithDetails | null>(null);
  protected isLoading = signal(true);
  protected orderStatuses = signal<Array<{ id: number; name: string }>>([]);

  constructor() {
    this.loadOrder();
    this.loadOrderStatuses();
  }

  private async loadOrder() {
    const orderId = this.route.snapshot.paramMap.get('id');

    if (!orderId) {
      this.router.navigate(['/tickets']);
      return;
    }

    try {
      const order = await this.orderService.getOrderById(orderId);
      this.order.set(order);
    } catch (error) {
      console.error('Error al cargar orden:', error);
      alert('Error al cargar la orden');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async loadOrderStatuses() {
    try {
      const statuses = await this.orderService.getOrderStatuses();
      this.orderStatuses.set(statuses);
    } catch (error) {
      console.error('Error al cargar estados:', error);
    }
  }

  protected async updateStatus(newStatusId: number) {
    const order = this.order();
    if (!order?.id) return;

    try {
      await this.orderService.updateOrderStatus(order.id, newStatusId);
      this.order.set({ ...order, status_id: newStatusId });
      alert('Estado actualizado exitosamente');
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado');
    }
  }

  protected goToEdit() {
    const orderId = this.order()?.id;
    if (orderId) {
      this.router.navigate(['/tickets/editar', orderId]);
    }
  }

  protected goBack() {
    this.router.navigate(['/tickets']);
  }

  protected getStatusClass(statusId: number): string {
    const statusMap: Record<number, string> = {
      1: 'badge-warning',
      2: 'badge-info',
      3: 'badge-success',
      4: 'badge-primary',
      5: 'badge-error',
    };
    return statusMap[statusId] || 'badge-ghost';
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  }

  protected getStatusName(statusId: number): string {
    return this.orderStatuses().find((s) => s.id === statusId)?.name || 'N/A';
  }
}
