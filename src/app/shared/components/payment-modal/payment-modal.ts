import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  input,
} from '@angular/core';
import { form, FormField, required, min } from '@angular/forms/signals';
import { PaymentService } from '@core/services/payment-service';
import { CashRegisterService } from '@core/services/cash-register-service';
import { Order } from '@data/models/tickets/order-model';
import { PaymentMethod, RegisterPaymentPayload } from '@data/models/sales/payment.model';

interface PaymentFormModel {
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference: string;
  notes: string;
}

@Component({
  selector: 'app-payment-modal',
  templateUrl: './payment-modal.html',
  imports: [FormField],
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
  protected error = signal<string | null>(null);
  protected success = signal(false);

  // Form Model
  protected formModel = signal<PaymentFormModel>({
    amount: 0,
    payment_method: 'EFECTIVO',
    transaction_reference: '',
    notes: '',
  });

  // Form Instance
  protected paymentForm = form(this.formModel, (schema) => {
    required(schema.amount, { message: 'El monto es requerido' });
    min(schema.amount, 0.01, { message: 'El monto debe ser mayor a 0' });
    required(schema.payment_method, { message: 'Seleccione un método de pago' });
  });

  // Computed
  protected maxPayableAmount = computed(() => this.order().remaining_balance || 0);

  protected isAmountValid = computed(() => {
    const amount = this.paymentForm.amount().value();
    return amount > 0 && amount <= this.maxPayableAmount();
  });

  protected isFormValid = computed(() => {
    return (
      !this.paymentForm.amount().invalid() &&
      !this.paymentForm.payment_method().invalid() &&
      this.isAmountValid()
    );
  });

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

    if (this.paymentForm.amount().invalid() || this.paymentForm.payment_method().invalid()) {
      return;
    }

    if (!this.isAmountValid()) {
      this.error.set('El monto excede el saldo pendiente');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.formModel();
      const currentSession = this.cashRegisterService.currentSession();

      const payload: RegisterPaymentPayload = {
        order_id: this.order().id!,
        amount: formData.amount,
        payment_method: formData.payment_method,
        cash_register_session_id: currentSession?.id,
        transaction_reference: formData.transaction_reference || undefined,
        notes: formData.notes || undefined,
      };

      await this.paymentService.registerPayment(payload);

      this.success.set(true);
      this.paymentRegistered.emit();

      // Reset form y cerrar modal después de 1 segundo
      setTimeout(() => {
        this.success.set(false);
        this.resetForm();
        this.handleClose();
      }, 1000);
    } catch (err: any) {
      this.error.set(err.message || 'Error al registrar el pago');
    } finally {
      this.loading.set(false);
    }
  }

  protected fillMaxAmount() {
    this.paymentForm.amount().value.set(this.maxPayableAmount());
  }

  protected handleClose() {
    this.resetForm();
    this.error.set(null);
    this.success.set(false);
    this.onClose.emit();
  }

  private resetForm() {
    this.formModel.set({
      amount: 0,
      payment_method: 'EFECTIVO',
      transaction_reference: '',
      notes: '',
    });
  }
}
