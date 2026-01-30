import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '@core/services/order-service';
import { PaymentService } from '@core/services/payment-service';
import { CashRegisterService } from '@core/services/cash-register-service';
import { Order } from '@data/models/tickets/order-model';
import { PaymentView } from '@data/models/sales/payment.model';
import { CommonModule } from '@angular/common';
import { PaymentModal } from '@shared/components/payment-modal/payment-modal';

@Component({
  selector: 'app-daily-sales',
  imports: [CommonModule, PaymentModal],
  templateUrl: './daily-sales.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DailySales {
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private cashRegisterService = inject(CashRegisterService);
  private router = inject(Router);

  protected orders = signal<Order[]>([]);
  protected payments = signal<PaymentView[]>([]);
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  protected currentSession = this.cashRegisterService.currentSession;
  protected selectedOrder = signal<Order | null>(null);
  protected showPaymentModal = signal(false);

  // Filters
  protected filterPaymentStatus = signal<string>('ALL');

  // Computed
  protected filteredOrders = computed(() => {
    const orders = this.orders();
    const filter = this.filterPaymentStatus();

    if (filter === 'ALL') return orders;
    return orders.filter((order) => order.payment_status === filter);
  });

  protected totalOrders = computed(() => this.orders().length);
  protected totalSales = computed(() => {
    return this.orders().reduce((sum, order) => sum + order.final_amount, 0);
  });

  protected totalPaid = computed(() => {
    return this.orders().reduce((sum, order) => sum + (order.advance || 0), 0);
  });

  protected totalPending = computed(() => {
    return this.orders().reduce((sum, order) => sum + (order.remaining_balance || 0), 0);
  });

  protected pendingOrdersCount = computed(() => {
    return this.orders().filter((o) => o.payment_status === 'PENDIENTE').length;
  });

  protected partialOrdersCount = computed(() => {
    return this.orders().filter((o) => o.payment_status === 'PARCIAL').length;
  });

  protected paidOrdersCount = computed(() => {
    return this.orders().filter((o) => o.payment_status === 'PAGADO').length;
  });

  async ngOnInit() {
    await this.loadCurrentSession();
    await this.loadDailySales();
  }

  private async loadCurrentSession() {
    try {
      await this.cashRegisterService.loadCurrentSession();
      const session = this.currentSession();

      if (!session) {
        this.error.set('No hay sesión activa. Abre una sesión para ver las ventas.');
      }
    } catch (error) {
      console.error('Error al cargar sesión:', error);
    }
  }

  private async loadDailySales() {
    try {
      this.loading.set(true);
      this.error.set(null);

      const session = this.currentSession();

      // Obtener desde la apertura de la sesión hasta ahora
      const startDate = new Date(session!.openedAt);
      const endDate = new Date();

      console.log('[DailySales] Cargando ventas desde apertura de sesión:', {
        session: session?.id,
        shopId: session?.shopId,
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
      });

      // Obtener órdenes desde la apertura de la sesión
      const response = await this.orderService.getOrders({
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        shopId: session?.shopId,
      });

      console.log('[DailySales] Órdenes cargadas:', response);

      this.orders.set(response.data);

      // Obtener pagos de la sesión actual
      if (session) {
        const sessionPayments = await this.paymentService.getSessionPayments(session.id);
        this.payments.set(sessionPayments as PaymentView[]);
      }
    } catch (err: any) {
      console.error('Error al cargar ventas del día:', err);
      this.error.set(err.message || 'Error al cargar las ventas');
    } finally {
      this.loading.set(false);
    }
  }

  protected setFilter(status: string) {
    this.filterPaymentStatus.set(status);
  }

  protected openPaymentModal(order: Order) {
    if (order.payment_status === 'PAGADO') {
      return;
    }
    this.selectedOrder.set(order);
    this.showPaymentModal.set(true);
  }

  protected closePaymentModal() {
    this.showPaymentModal.set(false);
    this.selectedOrder.set(null);
  }

  protected async handlePaymentRegistered() {
    await this.loadDailySales();
  }

  protected viewOrder(orderId: string) {
    this.router.navigate(['/ventas/ver', orderId]);
  }

  protected goToDashboard() {
    this.router.navigate(['/caja/dashboard']);
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getPaymentStatusBadge(status: string): string {
    const badges: Record<string, string> = {
      PENDIENTE: 'badge-warning',
      PARCIAL: 'badge-info',
      PAGADO: 'badge-success',
    };
    return badges[status] || 'badge-ghost';
  }

  protected getPaymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      PARCIAL: 'Parcial',
      PAGADO: 'Pagado',
    };
    return labels[status] || status;
  }
}
