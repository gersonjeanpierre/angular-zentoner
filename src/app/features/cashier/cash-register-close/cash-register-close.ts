import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, required, min } from '@angular/forms/signals';
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import { CloseSessionPayload, CloseSessionResponse } from '@data/models/sales/cash-register.model';
import { CommonModule } from '@angular/common';
import { AlertModal, AlertType } from '@shared/components/alert-modal/alert-modal';

interface CloseSessionFormModel {
  closingBalance: number;
  closingNotes: string;
}

@Component({
  selector: 'app-cash-register-close',
  imports: [FormField, CommonModule, AlertModal],
  templateUrl: './cash-register-close.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CashRegisterClose implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private router = inject(Router);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);
  protected sessionSummary = signal<CloseSessionResponse | null>(null);
  protected showSummary = signal(false);

  // Alert Modal signals
  protected alertModalOpen = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('info');

  // Helper para usar Math en template
  protected Math = Math;

  protected currentSession = this.cashRegisterService.currentSession;

  // Form Model
  protected formModel = signal<CloseSessionFormModel>({
    closingBalance: 0,
    closingNotes: '',
  });

  // Form Instance
  protected closeSessionForm = form(this.formModel, (schema) => {
    required(schema.closingBalance, { message: 'El balance final es requerido' });
    min(schema.closingBalance, 0, { message: 'El balance no puede ser negativo' });
  });

  // Computed
  protected isFormValid = computed(() => {
    return !this.closeSessionForm.closingBalance().invalid();
  });

  protected difference = computed(() => {
    const summary = this.sessionSummary();
    if (!summary) return 0;
    return summary.pettyCashDifference;
  });

  protected differenceClass = computed(() => {
    const diff = this.difference();
    if (diff === 0) return 'text-success';
    if (diff > 0) return 'text-info';
    return 'text-error';
  });

  ngOnInit(): void {
    this.loadCurrentSession();
  }

  private async loadCurrentSession() {
    try {
      const user = await this.authService.getUserProfileData();
      if (!user || !user.shopId) {
        this.showAlert(
          'Error de usuario',
          'No se encontró información de tienda del usuario',
          'error',
        );
        return;
      }

      await this.cashRegisterService.loadCurrentSession(user.shopId);
      const session = this.currentSession();

      if (!session) {
        this.showAlert('Sin sesión activa', 'No hay sesión activa para cerrar', 'warning');
        setTimeout(() => {
          this.router.navigate(['/caja/dashboard']);
        }, 3000);
      }
    } catch (error) {
      console.error('Error al cargar sesión:', error);
      this.showAlert('Error al cargar sesión', 'Error al cargar la sesión actual', 'error');
    }
  }

  protected async previewClose() {
    if (!this.isFormValid()) {
      return;
    }

    const session = this.currentSession();
    if (!session) {
      this.showAlert('Sin sesión activa', 'No hay sesión activa', 'warning');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const dashboard = await this.cashRegisterService.getSessionDashboard(session.id);
      const formData = this.formModel();

      // NUEVA LÓGICA: Caja chica NO incluye efectivo de ventas
      // Balance esperado de caja chica = opening_balance - gastos
      const pettyCashExpected =
        session.openingBalance - (dashboard.expenseSummary?.totalAmount ?? 0);
      const pettyCashDifference = formData.closingBalance - pettyCashExpected;

      const previewSummary: CloseSessionResponse = {
        success: true,
        sessionId: session.id,
        shopId: session.shopId,
        closedAt: new Date().toISOString(),

        // Caja Chica
        pettyCashOpening: session.openingBalance,
        pettyCashClosing: formData.closingBalance,
        pettyCashExpected: pettyCashExpected,
        pettyCashDifference: pettyCashDifference,
        totalExpenses: dashboard.expenseSummary?.totalAmount ?? 0,

        // Efectivo de Ventas (va a caja fuerte)
        cashFromSales: dashboard.paymentSummary?.efectivo ?? 0,

        // Otros métodos
        cardTotal:
          (dashboard.paymentSummary?.tarjetaDebito ?? 0) +
          (dashboard.paymentSummary?.tarjetaCredito ?? 0),
        transferTotal:
          (dashboard.paymentSummary?.transferencia ?? 0) +
          (dashboard.paymentSummary?.deposito ?? 0),
        digitalWalletTotal:
          (dashboard.paymentSummary?.yape ?? 0) + (dashboard.paymentSummary?.plin ?? 0),
        otherTotal:
          (dashboard.paymentSummary?.dolares ?? 0) + (dashboard.paymentSummary?.otro ?? 0),

        // Estadísticas
        totalPayments: dashboard.paymentSummary?.totalPayments ?? 0,
        totalOrders: dashboard.orderStats?.totalOrders ?? 0,

        // Legacy
        openingBalance: session.openingBalance,
        closingBalance: formData.closingBalance,
        expectedBalance: pettyCashExpected,
        difference: pettyCashDifference,
        cashTotal: dashboard.paymentSummary?.efectivo ?? 0,
      };

      this.sessionSummary.set(previewSummary);
      this.showSummary.set(true);
    } catch (err: any) {
      console.error('Error al obtener resumen:', err);
      this.showAlert(
        'Error al obtener resumen',
        err.message || 'Error al obtener el resumen de la sesión',
        'error',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async confirmClose() {
    const session = this.currentSession();
    if (!session) {
      this.showAlert('Sin sesión activa', 'No hay sesión activa', 'warning');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.formModel();

      const payload: CloseSessionPayload = {
        sessionId: session.id,
        closingBalance: formData.closingBalance,
        closingNotes: formData.closingNotes || undefined,
      };

      const response = await this.cashRegisterService.closeSession(payload);
      this.sessionSummary.set(response);
      this.success.set(true);

      setTimeout(() => {
        this.router.navigate(['/caja/dashboard']);
      }, 3000);
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err);
      this.showAlert(
        'Error al cerrar sesión',
        err.message || 'Error al cerrar la sesión de caja',
        'error',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel() {
    this.router.navigate(['/caja/dashboard']);
  }

  protected backToForm() {
    this.showSummary.set(false);
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
