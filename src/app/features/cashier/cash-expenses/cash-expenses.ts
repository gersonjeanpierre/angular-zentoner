import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField, required, minLength, min } from '@angular/forms/signals';
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import {
  RegisterExpensePayload,
  ExpenseCategory,
  ExpenseView,
} from '@data/models/sales/cash-register.model';

interface ExpenseFormData {
  amount: number;
  category: ExpenseCategory;
  description: string;
  receiptNumber: string;
  notes: string;
}

@Component({
  selector: 'app-cash-expenses',
  imports: [CommonModule, FormField],
  templateUrl: './cash-expenses.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CashExpenses implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private router = inject(Router);

  protected currentSession = this.cashRegisterService.currentSession;
  protected expenses = signal<ExpenseView[]>([]);
  protected loading = signal(false);
  protected submitting = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal<string | null>(null);

  // Formulario de gastos con Signal Forms
  protected expenseModel = signal<ExpenseFormData>({
    amount: 0,
    category: 'OPERATIVO',
    description: '',
    receiptNumber: '',
    notes: '',
  });

  protected expenseForm = form(this.expenseModel, (schemaPath) => {
    required(schemaPath.amount, { message: 'El monto es requerido' });
    min(schemaPath.amount, 0.01, { message: 'El monto debe ser mayor a 0' });
    required(schemaPath.category, { message: 'La categoría es requerida' });
    required(schemaPath.description, { message: 'La descripción es requerida' });
    minLength(schemaPath.description, 5, {
      message: 'La descripción debe tener al menos 5 caracteres',
    });
  });

  protected categories: Array<{ value: ExpenseCategory; label: string }> = [
    { value: 'OPERATIVO', label: 'Operativo' },
    { value: 'ADMINISTRATIVO', label: 'Administrativo' },
    { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
    { value: 'COMPRAS_MENORES', label: 'Compras Menores' },
    { value: 'OTRO', label: 'Otro' },
  ];

  async ngOnInit() {
    await this.loadSession();
    await this.loadExpenses();
  }

  private async loadSession() {
    try {
      await this.cashRegisterService.loadCurrentSession();
      const session = this.currentSession();

      if (!session) {
        this.error.set('No hay sesión activa. Debes abrir una sesión para registrar gastos.');
        setTimeout(() => this.router.navigate(['/caja']), 3000);
      }
    } catch (error) {
      console.error('Error al cargar sesión:', error);
    }
  }

  private async loadExpenses() {
    const session = this.currentSession();
    if (!session) return;

    try {
      this.loading.set(true);
      const expenses = await this.cashRegisterService.getSessionExpenses(session.id);
      this.expenses.set(expenses);
    } catch (err: any) {
      console.error('Error al cargar gastos:', err);
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    const session = this.currentSession();
    if (!session) {
      this.error.set('No hay sesión activa');
      return;
    }

    // Validar formulario - verificar que NO haya errores (invalid retorna true si hay errores)
    if (this.expenseForm.amount().invalid() || this.expenseForm.description().invalid()) {
      this.error.set('Por favor, completa todos los campos requeridos correctamente');
      return;
    }

    const formData = this.expenseModel();
    const user = await this.authService.getUserProfileData();

    try {
      this.submitting.set(true);
      this.error.set(null);
      this.success.set(null);

      const payload: RegisterExpensePayload = {
        cashRegisterSessionId: session.id,
        amount: formData.amount,
        category: formData.category,
        description: formData.description,
        receiptNumber: formData.receiptNumber || undefined,
        notes: formData.notes || undefined,
        authorizedById: session.cashierId, // Usar el cajero de la sesión como autorizador
      };

      const response = await this.cashRegisterService.registerExpense(payload);

      this.success.set(
        `Gasto registrado exitosamente. Efectivo disponible: ${this.formatCurrency(response.availableCash)}`,
      );

      // Limpiar formulario
      this.expenseModel.set({
        amount: 0,
        category: 'OPERATIVO',
        description: '',
        receiptNumber: '',
        notes: '',
      });

      // Recargar lista de gastos
      await this.loadExpenses();

      // Limpiar mensaje de éxito después de 5 segundos
      setTimeout(() => this.success.set(null), 5000);
    } catch (err: any) {
      console.error('Error al registrar gasto:', err);
      this.error.set(err.message || 'Error al registrar el gasto');
    } finally {
      this.submitting.set(false);
    }
  }

  protected getTotalExpenses(): number {
    return this.expenses().reduce((sum, exp) => sum + exp.amount, 0);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getCategoryLabel(category: ExpenseCategory): string {
    return this.categories.find((c) => c.value === category)?.label || category;
  }

  protected navigateBack() {
    this.router.navigate(['/caja']);
  }
}
