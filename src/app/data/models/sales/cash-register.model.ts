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
  shopId: string;
  cashierId: string;

  sessionNumber: number;
  sessionType: SessionType;

  openedAt: string;
  closedAt: string | null;

  openingBalance: number;
  closingBalance: number | null;
  expectedBalance: number | null;
  difference: number | null;

  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  digitalWalletTotal: number;
  otherTotal: number;

  totalOrders: number;
  totalPayments: number;

  status: SessionStatus;

  openingNotes: string | null;
  closingNotes: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para abrir una sesión de caja
 */
export interface OpenSessionPayload {
  shopId: string; // De metadatos localStorage
  cashierId: string; // user_id === employee_id
  openingBalance: number;
  sessionType?: SessionType;
  openingNotes?: string;
}

/**
 * Respuesta de la función open_cash_register_session RPC
 */
export interface OpenSessionResponse {
  success: boolean;
  sessionId: string;
  openedAt: string;
  openingBalance: number;
}

/**
 * Payload para cerrar una sesión de caja
 */
export interface CloseSessionPayload {
  sessionId: string;
  closingBalance: number;
  closingNotes?: string;
}

/**
 * Respuesta de la función close_cash_register_session RPC
 */
export interface CloseSessionResponse {
  success: boolean;
  sessionId: string;
  shopId: string;
  closedAt: string;
  openingBalance: number;
  closingBalance: number;
  expectedBalance: number;
  difference: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  digitalWalletTotal: number;
  otherTotal: number;
  totalExpenses: number;
  totalPayments: number;
  totalOrders: number;
}

/**
 * Categorías de gastos de caja chica
 */
export type ExpenseCategory =
  | 'OPERATIVO'
  | 'ADMINISTRATIVO'
  | 'MANTENIMIENTO'
  | 'COMPRAS_MENORES'
  | 'OTRO';

/**
 * Modelo de Gasto de Caja Chica
 */
export interface CashExpense {
  id: string;
  cashRegisterSessionId: string;
  shopId: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  receiptNumber: string | null;
  notes: string | null;
  authorizedById: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para registrar un gasto de caja chica
 */
export interface RegisterExpensePayload {
  cashRegisterSessionId: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  receiptNumber?: string;
  notes?: string;
  authorizedById?: string;
}

/**
 * Respuesta de la función register_cash_expense RPC
 */
export interface RegisterExpenseResponse {
  success: boolean;
  expenseId: string;
  amount: number;
  category: string;
  totalExpenses: number;
  availableCash: number;
}

/**
 * Vista de gasto con información del autorizador
 */
export interface ExpenseView extends CashExpense {
  authorizedByName: string;
}

/**
 * Resumen de pagos por método
 */
export interface PaymentSummary {
  efectivo: number;
  tarjetaDebito: number;
  tarjetaCredito: number;
  transferencia: number;
  deposito: number;
  yape: number;
  plin: number;
  dolares: number;
  otro: number;
  totalPayments: number;
  totalAmount: number;
}

/**
 * Resumen de gastos por categoría
 */
export interface ExpenseSummary {
  operativo: number;
  administrativo: number;
  mantenimiento: number;
  comprasMenores: number;
  otro: number;
  totalExpenses: number;
  totalAmount: number;
}

/**
 * Estadísticas de órdenes
 */
export interface OrderStats {
  totalOrders: number;
  pendiente: number;
  parcial: number;
  pagado: number;
  totalSales: number;
  totalCollected: number;
}

/**
 * Flujo de efectivo
 */
export interface CashFlow {
  openingBalance: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number;
  currentCash: number;
}

/**
 * Dashboard completo de sesión
 */
export interface SessionDashboard {
  session: CashRegisterSession;
  paymentSummary: PaymentSummary;
  expenseSummary: ExpenseSummary;
  orderStats: OrderStats;
  cashFlow: CashFlow;
  sessionDurationMinutes: number;
}
