import { Injectable, inject, signal } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import {
  CashRegisterSession,
  OpenSessionPayload,
  OpenSessionResponse,
  CloseSessionPayload,
  CloseSessionResponse,
} from '@data/models/sales/cash-register.model';

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  private supabaseClient = inject(Supabase).client;

  /**
   * Signal para la sesión activa actual
   */
  currentSession = signal<CashRegisterSession | null>(null);

  /**
   * Abrir una nueva sesión de caja registradora
   * Llama a la función RPC open_cash_register_session
   */
  async openSession(payload: OpenSessionPayload): Promise<OpenSessionResponse> {
    const { data, error } = await this.supabaseClient.rpc('open_cash_register_session', {
      p_shop_id: payload.shop_id,
      p_cashier_id: payload.cashier_id,
      p_opening_balance: payload.opening_balance,
      p_session_type: payload.session_type || 'PARCIAL',
      p_opening_notes: payload.opening_notes || null,
    });

    if (error) {
      console.error('Error al abrir sesión de caja:', error);
      throw error;
    }

    const response = data as OpenSessionResponse;

    // Cargar la sesión completa después de abrirla
    await this.loadCurrentSession(response.session_id);

    return response;
  }

  /**
   * Cerrar una sesión de caja registradora
   * Llama a la función RPC close_cash_register_session
   */
  async closeSession(payload: CloseSessionPayload): Promise<CloseSessionResponse> {
    const { data, error } = await this.supabaseClient.rpc('close_cash_register_session', {
      p_session_id: payload.session_id,
      p_closing_balance: payload.closing_balance,
      p_closing_notes: payload.closing_notes || null,
    });

    if (error) {
      console.error('Error al cerrar sesión de caja:', error);
      throw error;
    }

    // Limpiar sesión actual
    this.currentSession.set(null);

    return data as CloseSessionResponse;
  }

  /**
   * Cargar sesión actual del cajero
   * Si se proporciona sessionId, carga esa sesión específica
   * Si no, busca la sesión ABIERTA del cajero actual
   */
  async loadCurrentSession(sessionId?: string): Promise<void> {
    let query = this.supabaseClient
      .schema('sales')
      .from('cash_register_sessions')
      .select('*')
      .eq('status', 'ABIERTO');

    if (sessionId) {
      query = query.eq('id', sessionId);
    }

    query = query.order('opened_at', { ascending: false }).limit(1);

    const { data, error } = await query.single();

    if (error) {
      // PGRST116 = no rows found (no hay sesión abierta)
      if (error.code === 'PGRST116') {
        this.currentSession.set(null);
        return;
      }
      console.error('Error al cargar sesión actual:', error);
      throw error;
    }

    this.currentSession.set(data as CashRegisterSession);
  }

  /**
   * Obtener resumen de una sesión
   * Llama a la función RPC get_session_summary
   */
  async getSessionSummary(sessionId: string): Promise<CloseSessionResponse> {
    const { data, error } = await this.supabaseClient.rpc('get_session_summary', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('Error al obtener resumen de sesión:', error);
      throw error;
    }

    return data as CloseSessionResponse;
  }

  /**
   * Obtener todas las sesiones con filtros
   */
  async getSessions(params: {
    shopId?: string;
    cashierId?: string;
    status?: 'ABIERTO' | 'CERRADO';
    sessionType?: 'PARCIAL' | 'FINAL';
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CashRegisterSession[]> {
    let query = this.supabaseClient.schema('sales').from('cash_register_sessions').select('*');

    if (params.shopId) {
      query = query.eq('shop_id', params.shopId);
    }

    if (params.cashierId) {
      query = query.eq('cashier_id', params.cashierId);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.sessionType) {
      query = query.eq('session_type', params.sessionType);
    }

    if (params.dateFrom) {
      query = query.gte('opened_at', params.dateFrom);
    }

    if (params.dateTo) {
      query = query.lte('opened_at', params.dateTo);
    }

    query = query.order('opened_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener sesiones:', error);
      throw error;
    }

    return (data as CashRegisterSession[]) || [];
  }

  /**
   * Verificar si hay una sesión abierta
   */
  async hasOpenSession(cashierId?: string): Promise<boolean> {
    let query = this.supabaseClient
      .schema('sales')
      .from('cash_register_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ABIERTO');

    if (cashierId) {
      query = query.eq('cashier_id', cashierId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error al verificar sesión abierta:', error);
      return false;
    }

    return (count || 0) > 0;
  }
}
