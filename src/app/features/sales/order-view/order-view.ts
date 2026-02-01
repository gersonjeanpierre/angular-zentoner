import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService, OrderWithDetails } from '@core/services/order-service';
import { PaymentService } from '@core/services/payment-service';
import { PaymentView } from '@data/models/sales/payment.model';
import { PaymentModal } from '@shared/components/payment-modal/payment-modal';
import { AlertModal, AlertType } from '@shared/components/alert-modal/alert-modal';

@Component({
  selector: 'app-order-view',
  imports: [PaymentModal, AlertModal],
  templateUrl: './order-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderView {
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected order = signal<OrderWithDetails | null>(null);
  protected isLoading = signal(true);
  protected orderStatuses = signal<Array<{ id: number; name: string }>>([]);

  // Payment state
  protected payments = signal<PaymentView[]>([]);
  protected isLoadingPayments = signal(false);
  protected showPaymentModal = signal(false);

  // Alert Modal signals
  protected alertModalOpen = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('info');

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
      await this.loadPayments(orderId);
    } catch (error) {
      console.error('Error al cargar orden:', error);
      this.showAlert('Error al cargar orden', 'Error al cargar la orden', 'error');
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
      this.showAlert('Estado actualizado', 'Estado actualizado exitosamente', 'success');
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      this.showAlert('Error al actualizar', 'Error al actualizar el estado', 'error');
    }
  }

  protected goToEdit() {
    const orderId = this.order()?.id;
    if (orderId) {
      this.router.navigate(['/ventas/editar', orderId]);
    }
  }

  protected goBack() {
    this.router.navigate(['/ventas']);
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

  protected async loadPayments(orderId: string) {
    this.isLoadingPayments.set(true);
    try {
      const paymentHistory = await this.paymentService.getOrderPaymentHistory(orderId);
      this.payments.set(paymentHistory);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
    } finally {
      this.isLoadingPayments.set(false);
    }
  }

  protected openPaymentModal() {
    this.showPaymentModal.set(true);
  }

  protected closePaymentModal() {
    this.showPaymentModal.set(false);
  }

  protected async handlePaymentRegistered() {
    const orderId = this.order()?.id;
    if (orderId) {
      // Recargar orden y pagos para actualizar los montos
      await this.loadOrder();
    }
  }

  protected getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      YAPE: 'Yape',
      TARJETA_DEBITO: 'Tarjeta de Débito',
      TARJETA_CREDITO: 'Tarjeta de Crédito',
      TRANSFERENCIA: 'Transferencia',
      DEPOSITO: 'Depósito',
      DOLARES: 'Dólares',
      OTRO: 'Otro',
    };
    return labels[method] || method;
  }

  protected getPaymentStatusBadge(status: string): string {
    const badges: Record<string, string> = {
      PENDIENTE: 'badge-warning',
      PARCIAL: 'badge-info',
      PAGADO: 'badge-success',
    };
    return badges[status] || 'badge-ghost';
  }

  /**
   * Muestra una alerta modal
   */
  private showAlert(title: string, message: string, type: AlertType = 'info'): void {
    this.alertTitle.set(title);
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.alertModalOpen.set(true);
  }

  /**
   * Cierra el modal de alerta
   */
  protected closeAlert(): void {
    this.alertModalOpen.set(false);
  }
}
