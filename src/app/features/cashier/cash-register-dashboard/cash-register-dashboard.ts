import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import { PaymentService } from '@core/services/payment-service';
import { CommonModule } from '@angular/common';
import { SessionDashboard } from '@data/models/sales/cash-register.model';
import { AlertModal, AlertType } from '@shared/components/alert-modal/alert-modal';

@Component({
  selector: 'app-cash-register-dashboard',
  imports: [CommonModule, AlertModal],
  templateUrl: './cash-register-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CashRegisterDashboard implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private paymentService = inject(PaymentService);
  private router = inject(Router);

  protected currentSession = this.cashRegisterService.currentSession;
  protected isSessionActive = computed(() => this.currentSession() !== null);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected userData = signal<any>(null);
  protected dashboardData = signal<SessionDashboard | null>(null);
  protected unassignedPaymentsCount = signal(0);

  // Alert Modal signals
  protected alertModalOpen = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('info');

  // Computed para acceso rápido a los datos del dashboard
  protected paymentSummary = computed(() => this.dashboardData()?.paymentSummary || null);
  protected expenseSummary = computed(() => this.dashboardData()?.expenseSummary || null);
  protected orderStats = computed(() => this.dashboardData()?.orderStats || null);
  protected cashFlow = computed(() => this.dashboardData()?.cashFlow || null);

  // Computed para fecha y hora de apertura
  protected openedDate = computed(() => {
    const session = this.currentSession();
    if (!session) return '';
    return this.formatDate(session.openedAt).split(',')[0];
  });

  protected openedTime = computed(() => {
    const session = this.currentSession();
    if (!session) return '';
    return this.formatDate(session.openedAt).split(',')[1];
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    await this.loadUserData();
    await this.loadSession();
    await this.loadDashboard();
    await this.checkUnassignedPayments();
  }

  private async loadUserData() {
    try {
      const data = await this.authService.getUserProfileData();
      this.userData.set(data);
    } catch (error) {
      console.error('Error al cargar datos de usuario:', error);
    }
  }

  private async loadSession() {
    try {
      this.loading.set(true);
      const user = this.userData();
      if (!user || !user.shopId) {
        throw new Error('No se encontró información de tienda del usuario');
      }

      // Cargar sesión filtrando por el shopId del usuario
      await this.cashRegisterService.loadCurrentSession(user.shopId);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDashboard() {
    const session = this.currentSession();
    if (!session) return;

    try {
      const dashboard = await this.cashRegisterService.getSessionDashboard(session.id);
      this.dashboardData.set(dashboard);
    } catch (err: any) {
      console.error('Error al cargar dashboard:', err);
    }
  }

  async refreshDashboard() {
    await this.loadDashboard();
    await this.checkUnassignedPayments();
  }

  /**
   * Verificar si hay pagos sin sesión asignada en el período actual
   */
  private async checkUnassignedPayments() {
    const session = this.currentSession();
    if (!session) return;

    try {
      const { count, error } = await this.paymentService['supabaseClient']
        .schema('sales')
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .is('cash_register_session_id', null)
        .gte('payment_date', session.openedAt)
        .filter(
          'payment_date',
          session.closedAt ? 'lte' : 'gte',
          session.closedAt || session.openedAt,
        );

      if (!error) {
        this.unassignedPaymentsCount.set(count || 0);
      }
    } catch (err) {
      console.error('Error al verificar pagos sin sesión:', err);
    }
  }

  protected navigateToOpen() {
    this.router.navigate(['/caja/abrir-sesion']);
  }

  protected navigateToClose() {
    this.router.navigate(['/caja/cerrar-sesion']);
  }

  protected navigateToDailySales() {
    this.router.navigate(['/caja/ventas-dia']);
  }

  protected navigateToOrders() {
    this.router.navigate(['/ventas']);
  }

  protected navigateToExpenses() {
    this.router.navigate(['/caja/gastos']);
  }

  protected navigateToHistory() {
    this.router.navigate(['/caja/historial']);
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
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

  protected getSessionDuration(): string {
    const session = this.currentSession();
    if (!session) return '0h 0m';

    const start = new Date(session.openedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  /**
   * Muestra una alerta modal
   * @param title - Título de la alerta
   * @param message - Mensaje de la alerta
   * @param type - Tipo de alerta (info, success, warning, error)
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
