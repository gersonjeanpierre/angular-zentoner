/**
 * Tipos de sesión de caja registradora
 */
export type SessionType = 'PARCIAL' | 'FINAL';

/**
 * Estados de sesión de caja
 */
export type SessionStatus = 'ABIERTO' | 'CERRADO';

/**
 * Modelo de Sesión de Caja Registradora (Base de Datos)
 * Representa un registro en sales.cash_register_sessions
 */
export interface CashRegisterSession {
  id: string;
  shop_id: string;
  cashier_id: string;

  session_number: number;
  session_type: SessionType;

  opened_at: string;
  closed_at: string | null;

  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;

  cash_total: number;
  card_total: number;
  transfer_total: number;
  digital_wallet_total: number;
  other_total: number;

  total_orders: number;
  total_payments: number;

  status: SessionStatus;

  opening_notes: string | null;
  closing_notes: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Payload para abrir una sesión de caja
 */
export interface OpenSessionPayload {
  shop_id: string;
  cashier_id: string;
  opening_balance: number;
  session_type?: SessionType;
  opening_notes?: string;
}

/**
 * Respuesta de la función open_cash_register_session RPC
 */
export interface OpenSessionResponse {
  success: boolean;
  session_id: string;
  opened_at: string;
  opening_balance: number;
}

/**
 * Payload para cerrar una sesión de caja
 */
export interface CloseSessionPayload {
  session_id: string;
  closing_balance: number;
  closing_notes?: string;
}

/**
 * Respuesta de la función close_cash_register_session RPC
 */
export interface CloseSessionResponse {
  success: boolean;
  session_id: string;
  closed_at: string;
  opening_balance: number;
  closing_balance: number;
  expected_balance: number;
  difference: number;
  cash_total: number;
  card_total: number;
  transfer_total: number;
  digital_wallet_total: number;
  other_total: number;
  total_payments: number;
  total_orders: number;
}
