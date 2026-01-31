import { Injectable, inject } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import {
  Payment,
  PaymentView,
  RegisterPaymentPayload,
  RegisterPaymentResponse,
} from '@data/models/sales/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private supabaseClient = inject(Supabase).client;

  /**
   * Registrar un pago para una orden
   * Llama a la función RPC register_payment
   */
  async registerPayment(payload: RegisterPaymentPayload): Promise<RegisterPaymentResponse> {
    const { data, error } = await this.supabaseClient.schema('sales').rpc('register_payment', {
      p_order_id: payload.order_id,
      p_amount: payload.amount,
      p_payment_method: payload.payment_method,
      p_cash_register_session_id: payload.cash_register_session_id,
      p_transaction_reference: payload.transaction_reference || null,
      p_notes: payload.notes || null,
      p_received_by_id: payload.received_by_id || null,
    });

    if (error) {
      console.error('Error al registrar pago:', error);
      throw error;
    }

    return data as RegisterPaymentResponse;
  }

  /**
   * Obtener historial de pagos de una orden
   * Llama a la función RPC get_order_payment_history
   */
  async getOrderPaymentHistory(orderId: string): Promise<PaymentView[]> {
    const { data, error } = await this.supabaseClient
      .schema('sales')
      .rpc('get_order_payment_history', {
        p_order_id: orderId,
      });

    if (error) {
      console.error('Error al obtener historial de pagos:', error);
      throw error;
    }

    return (data as PaymentView[]) || [];
  }

  /**
   * Obtener pagos de una sesión de caja registradora
   */
  async getSessionPayments(sessionId: string): Promise<Payment[]> {
    const { data, error } = await this.supabaseClient
      .schema('sales')
      .from('payments')
      .select('*')
      .eq('cash_register_session_id', sessionId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error al obtener pagos de sesión:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Obtener todos los pagos con filtros
   */
  async getPayments(params: {
    orderId?: string;
    sessionId?: string;
    paymentMethod?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Payment[]> {
    let query = this.supabaseClient.schema('sales').from('payments').select('*');

    if (params.orderId) {
      query = query.eq('order_id', params.orderId);
    }

    if (params.sessionId) {
      query = query.eq('cash_register_session_id', params.sessionId);
    }

    if (params.paymentMethod) {
      query = query.eq('payment_method', params.paymentMethod);
    }

    if (params.dateFrom) {
      query = query.gte('payment_date', params.dateFrom);
    }

    if (params.dateTo) {
      query = query.lte('payment_date', params.dateTo);
    }

    query = query.order('payment_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener pagos:', error);
      throw error;
    }

    return data || [];
  }
}
