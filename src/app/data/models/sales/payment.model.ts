/**
 * Métodos de pago disponibles en el sistema
 */
export type PaymentMethod =
  | 'EFECTIVO'
  | 'YAPE'
  | 'TARJETA_DEBITO'
  | 'TARJETA_CREDITO'
  | 'TRANSFERENCIA'
  | 'DEPOSITO'
  | 'DOLARES'
  | 'OTRO';

/**
 * Estados de pago de una orden
 */
export type PaymentStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO';

/**
 * Modelo de Pago (Base de Datos)
 * Representa un registro en sales.payments
 */
export interface Payment {
  id: string;
  order_id: string;
  cash_register_session_id: string | null;

  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;

  transaction_reference: string | null;
  notes: string | null;

  received_by_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vista extendida de Pago con relaciones
 */
export interface PaymentView extends Payment {
  received_by_name: string;
  session_number: number | null;
  session_type: string | null;
}

/**
 * Payload para registrar un pago
 */
export interface RegisterPaymentPayload {
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  cash_register_session_id?: string;
  transaction_reference?: string;
  notes?: string;
  received_by_id?: string;
}

/**
 * Respuesta de la función register_payment RPC
 */
export interface RegisterPaymentResponse {
  success: boolean;
  payment_id: string;
  order_id: string;
  amount_paid: number;
  new_advance: number;
  new_remaining_balance: number;
  payment_status: PaymentStatus;
  fully_paid: boolean;
}
