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
import { CloseSessionPayload, CloseSessionResponse } from '@data/models/sales/cash-register.model';
import { CommonModule } from '@angular/common';

interface CloseSessionFormModel {
  closing_balance: number;
  closing_notes: string;
}

@Component({
  selector: 'app-cash-register-close',
  imports: [FormField, CommonModule],
  templateUrl: './cash-register-close.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CashRegisterClose implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private router = inject(Router);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);
  protected sessionSummary = signal<CloseSessionResponse | null>(null);
  protected showSummary = signal(false);

  // Helper para usar Math en template
  protected Math = Math;

  protected currentSession = this.cashRegisterService.currentSession;

  // Form Model
  protected formModel = signal<CloseSessionFormModel>({
    closing_balance: 0,
    closing_notes: '',
  });

  // Form Instance
  protected closeSessionForm = form(this.formModel, (schema) => {
    required(schema.closing_balance, { message: 'El balance final es requerido' });
    min(schema.closing_balance, 0, { message: 'El balance no puede ser negativo' });
  });

  // Computed
  protected isFormValid = computed(() => {
    return !this.closeSessionForm.closing_balance().invalid();
  });

  protected difference = computed(() => {
    const summary = this.sessionSummary();
    if (!summary) return 0;
    return summary.closingBalance - summary.expectedBalance;
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
      await this.cashRegisterService.loadCurrentSession();
      const session = this.currentSession();

      if (!session) {
        this.error.set('No hay sesión activa para cerrar');
        setTimeout(() => {
          this.router.navigate(['/cashier/dashboard']);
        }, 3000);
      }
    } catch (error) {
      console.error('Error al cargar sesión:', error);
      this.error.set('Error al cargar la sesión actual');
    }
  }

  protected async previewClose() {
    if (!this.isFormValid()) {
      return;
    }

    const session = this.currentSession();
    if (!session) {
      this.error.set('No hay sesión activa');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const summary = await this.cashRegisterService.getSessionSummary(session.id);

      // Agregar el closing_balance del form al summary
      const formData = this.formModel();
      const summaryWithClosingBalance = {
        ...summary,
        closing_balance: formData.closing_balance,
      };

      this.sessionSummary.set(summaryWithClosingBalance);
      this.showSummary.set(true);
    } catch (err: any) {
      console.error('Error al obtener resumen:', err);
      this.error.set(err.message || 'Error al obtener el resumen de la sesión');
    } finally {
      this.loading.set(false);
    }
  }

  protected async confirmClose() {
    const session = this.currentSession();
    if (!session) {
      this.error.set('No hay sesión activa');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.formModel();

      const payload: CloseSessionPayload = {
        sessionId: session.id,
        closingBalance: formData.closing_balance,
        closingNotes: formData.closing_notes || undefined,
      };

      const response = await this.cashRegisterService.closeSession(payload);
      this.sessionSummary.set(response);
      this.success.set(true);

      setTimeout(() => {
        this.router.navigate(['/cashier/dashboard']);
      }, 3000);
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err);
      this.error.set(err.message || 'Error al cerrar la sesión de caja');
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel() {
    this.router.navigate(['/cashier/dashboard']);
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
}
