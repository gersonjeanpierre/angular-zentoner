import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  input,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { PaymentService } from '@core/services/payment-service';
import { CashRegisterService } from '@core/services/cash-register-service';
import { Order } from '@data/models/tickets/order-model';
import { PaymentMethod, RegisterPaymentPayload } from '@data/models/sales/payment.model';
import { AlertModal, AlertType } from '../alert-modal/alert-modal';

interface PaymentFormModel {
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference: string;
  notes: string;
}

@Component({
  selector: 'app-payment-modal',
  templateUrl: './payment-modal.html',
  imports: [FormField, AlertModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentModal {
  private paymentService = inject(PaymentService);
  private cashRegisterService = inject(CashRegisterService);

  // Inputs
  readonly order = input.required<Order>();
  readonly isOpen = input<boolean>(false);

  // Outputs
  readonly onClose = output<void>();
  readonly paymentRegistered = output<void>();

  // State
  protected loading = signal(false);
  protected success = signal(false);

  // Alert Modal State
  protected showAlert = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('error');

  // Computed: Saldo pendiente
  protected maxPayableAmount = computed(() => this.order().remaining_balance || 0);

  // Form Model
  protected formModel = signal<PaymentFormModel>({
    amount: 0,
    payment_method: 'EFECTIVO',
    transaction_reference: '',
    notes: '',
  });

  // Form Instance
  protected paymentForm = form(this.formModel);

  constructor() {
    // Sincronizar el monto del form con el saldo pendiente cuando se abre el modal
    effect(() => {
      if (this.isOpen()) {
        const maxAmount = this.maxPayableAmount();
        // Actualizar directamente el field del form
        this.paymentForm.amount().value.set(maxAmount);
      }
    });
  }

  // Métodos de pago disponibles
  protected paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TARJETA_DEBITO', label: 'Tarjeta de Débito' },
    { value: 'TARJETA_CREDITO', label: 'Tarjeta de Crédito' },
    { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
    { value: 'YAPE', label: 'Yape' },
    { value: 'DEPOSITO', label: 'Depósito' },
    { value: 'DOLARES', label: 'Dólares' },
    { value: 'OTRO', label: 'Otro' },
  ];

  protected async onSubmit(event: Event) {
    event.preventDefault();

    // Obtener valores actuales del form
    const amount = this.paymentForm.amount().value();
    const paymentMethod = this.paymentForm.payment_method().value();
    const transactionRef = this.paymentForm.transaction_reference().value();
    const notes = this.paymentForm.notes().value();

    // Validaciones con mensajes de alerta
    if (amount <= 0) {
      this.showAlertModal('Error de Validación', 'El monto debe ser mayor a 0', 'error');
      return;
    }

    if (amount > this.maxPayableAmount()) {
      this.showAlertModal(
        'Monto Inválido',
        `El monto excede el saldo pendiente de S/ ${this.maxPayableAmount().toFixed(2)}`,
        'error',
      );
      return;
    }

    if (!paymentMethod) {
      this.showAlertModal('Error de Validación', 'Seleccione un método de pago', 'error');
      return;
    }

    try {
      this.loading.set(true);

      const currentSession = this.cashRegisterService.currentSession();

      // VALIDACIÓN CRÍTICA: Verificar que exista una sesión activa
      if (!currentSession || !currentSession.id) {
        this.showAlertModal(
          'Sesión de Caja Requerida',
          'No hay una sesión de caja activa. Por favor, abra una sesión de caja antes de registrar pagos.',
          'error',
        );
        this.loading.set(false);
        return;
      }

      const payload: RegisterPaymentPayload = {
        order_id: this.order().id!,
        amount: amount,
        payment_method: paymentMethod,
        cash_register_session_id: currentSession.id,
        transaction_reference: transactionRef || undefined,
        notes: notes || undefined,
      };

      await this.paymentService.registerPayment(payload);

      this.success.set(true);
      this.showAlertModal('¡Éxito!', 'Pago registrado correctamente', 'success');
      this.paymentRegistered.emit();

      // Reset form y cerrar modal después de 1.5 segundos
      setTimeout(() => {
        this.success.set(false);
        this.resetForm();
        this.handleClose();
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.message || 'Error al registrar el pago';
      this.showAlertModal('Error', errorMessage, 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected fillMaxAmount() {
    const maxAmount = this.maxPayableAmount();
    this.paymentForm.amount().value.set(maxAmount);
  }

  protected handleClose() {
    this.resetForm();
    this.success.set(false);
    this.onClose.emit();
  }

  protected handleAlertClose() {
    this.showAlert.set(false);
  }

  private showAlertModal(title: string, message: string, type: AlertType) {
    this.alertTitle.set(title);
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.showAlert.set(true);
  }

  private resetForm() {
    // Resetear cada campo individualmente
    this.paymentForm.amount().value.set(this.maxPayableAmount());
    this.paymentForm.payment_method().value.set('EFECTIVO');
    this.paymentForm.transaction_reference().value.set('');
    this.paymentForm.notes().value.set('');
  }
}
