import { Injectable, inject, signal } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import camelcaseKeys from 'camelcase-keys';
import {
  CashRegisterSession,
  OpenSessionPayload,
  OpenSessionResponse,
  CloseSessionPayload,
  CloseSessionResponse,
  RegisterExpensePayload,
  RegisterExpenseResponse,
  ExpenseView,
  SessionDashboard,
} from '@data/models/sales/cash-register.model';

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  private readonly supabase = inject(Supabase).client;

  /**
   * Signal para la sesión activa actual
   */
  currentSession = signal<CashRegisterSession | null>(null);

  /**
   * Abrir una nueva sesión de caja registradora
   * Usa shopId de metadatos y userId como cashierId
   */
  async openSession(payload: OpenSessionPayload): Promise<OpenSessionResponse> {
    const { data, error } = await this.supabase.schema('sales').rpc('open_cash_register_session', {
      p_shop_id: payload.shopId,
      p_cashier_id: payload.cashierId,
      p_opening_balance: payload.openingBalance,
      p_session_type: payload.sessionType || 'PARCIAL',
      p_opening_notes: payload.openingNotes || null,
    });

    if (error) {
      console.error('[CashRegisterService] Error al abrir sesión de caja:', error);
      throw error;
    }

    const response = camelcaseKeys(data, { deep: true }) as OpenSessionResponse;

    // Cargar la sesión completa después de abrirla
    await this.loadCurrentSession(response.sessionId);

    return response;
  }

  /**
   * Cerrar una sesión de caja registradora
   * Llama a la función RPC close_cash_register_session
   */
  async closeSession(payload: CloseSessionPayload): Promise<CloseSessionResponse> {
    const { data, error } = await this.supabase.schema('sales').rpc('close_cash_register_session', {
      p_session_id: payload.sessionId,
      p_closing_balance: payload.closingBalance,
      p_closing_notes: payload.closingNotes || null,
    });

    if (error) {
      console.error('[CashRegisterService] Error al cerrar sesión de caja:', error);
      throw error;
    }

    // Limpiar sesión actual
    this.currentSession.set(null);

    return camelcaseKeys(data, { deep: true }) as CloseSessionResponse;
  }

  /**
   * Cargar sesión actual del cajero
   * Si se proporciona sessionId, carga esa sesión específica
   * Si no, busca la sesión ABIERTA del cajero actual
   */
  async loadCurrentSession(sessionId?: string): Promise<void> {
    try {
      let query = this.supabase
        .schema('sales')
        .from('cash_register_sessions')
        .select('*')
        .eq('status', 'ABIERTO');

      if (sessionId) {
        query = query.eq('id', sessionId);
      }

      query = query.order('opened_at', { ascending: false }).limit(1);

      const { data, error } = await query;

      if (error) {
        console.error('[CashRegisterService] Error al cargar sesión actual:', error);
        throw error;
      }

      // Si no hay datos, no hay sesión activa
      if (!data || data.length === 0) {
        console.log('[CashRegisterService] No hay sesión abierta');
        this.currentSession.set(null);
        return;
      }
      console.log('[CashRegisterService] Sesión abierta encontrada:', data);
      const session = camelcaseKeys(data[0], { deep: true }) as CashRegisterSession;
      this.currentSession.set(session);
      console.log('[CashRegisterService] Sesión cargada:', session.id);
    } catch (error) {
      console.error('[CashRegisterService] Error en loadCurrentSession:', error);
      this.currentSession.set(null);
    }
  }

  /**
   * Obtener resumen de una sesión
   * Llama a la función RPC get_session_summary
   */
  async getSessionSummary(sessionId: string): Promise<CloseSessionResponse> {
    const { data, error } = await this.supabase.schema('sales').rpc('get_session_summary', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('[CashRegisterService] Error al obtener resumen de sesión:', error);
      throw error;
    }

    return camelcaseKeys(data, { deep: true }) as CloseSessionResponse;
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
    let query = this.supabase.schema('sales').from('cash_register_sessions').select('*');

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
      console.error('[CashRegisterService] Error al obtener sesiones:', error);
      throw error;
    }

    return camelcaseKeys(data || [], { deep: true }) as CashRegisterSession[];
  }

  /**
   * Verificar si hay una sesión abierta
   */
  async hasOpenSession(cashierId?: string): Promise<boolean> {
    let query = this.supabase
      .schema('sales')
      .from('cash_register_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ABIERTO');

    if (cashierId) {
      query = query.eq('cashier_id', cashierId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[CashRegisterService] Error al verificar sesión abierta:', error);
      return false;
    }

    return (count || 0) > 0;
  }

  /**
   * Verificar si hay una sesión abierta en un shop específico
   * Retorna la sesión si existe, null si no
   */
  async getOpenSessionByShop(shopId: string): Promise<CashRegisterSession | null> {
    try {
      const { data, error } = await this.supabase
        .schema('sales')
        .from('cash_register_sessions')
        .select('*')
        .eq('shop_id', shopId)
        .eq('status', 'ABIERTO')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Permite 0 o 1 resultado sin error

      if (error) {
        console.error('[CashRegisterService] Error al buscar sesión abierta:', error);
        throw error;
      }

      if (!data) {
        console.log(`[CashRegisterService] No hay sesión abierta en shop: ${shopId}`);
        return null;
      }

      const session = camelcaseKeys(data, { deep: true }) as CashRegisterSession;
      console.log(`[CashRegisterService] Sesión abierta encontrada en shop ${shopId}:`, session.id);
      return session;
    } catch (error) {
      console.error('[CashRegisterService] Error en getOpenSessionByShop:', error);
      return null;
    }
  }

  /**
   * Verificar acceso al dashboard de caja
   * NOTA: employee_id === user_id (confirmado en edge function create-employee)
   * Usa SOLO shopId de metadatos para validar sesiones
   */
  async checkDashboardAccess(
    userId: string,
    shopId: string,
  ): Promise<{
    canAccess: boolean;
    reason?: string;
    session?: CashRegisterSession;
  }> {
    try {
      console.log(
        `[CashRegisterService] Verificando acceso - userId: ${userId}, shopId: ${shopId}`,
      );

      // employee_id === user_id (según edge function)
      const employeeId = userId;

      // Buscar sesión abierta en este shop
      const openSession = await this.getOpenSessionByShop(shopId);

      if (!openSession) {
        // No hay sesión abierta en este shop
        console.log(
          '[CashRegisterService] No hay sesión abierta, acceso permitido para abrir nueva',
        );
        return {
          canAccess: true,
          reason: 'No hay sesión abierta. Puede abrir una nueva sesión.',
        };
      }

      // Hay una sesión abierta, verificar si es del mismo cajero
      if (openSession.cashierId === employeeId) {
        // Es su propia sesión, puede acceder
        console.log('[CashRegisterService] Sesión pertenece al cajero actual, acceso permitido');
        return {
          canAccess: true,
          session: openSession,
        };
      } else {
        // La sesión es de otro cajero, no puede acceder
        console.warn(
          `[CashRegisterService] Sesión pertenece a otro cajero. ` +
            `Session cashier: ${openSession.cashierId}, Current user: ${employeeId}`,
        );
        return {
          canAccess: false,
          reason: 'Ya hay una sesión abierta por otro cajero en esta tienda',
          session: openSession,
        };
      }
    } catch (error) {
      console.error('[CashRegisterService] Error en checkDashboardAccess:', error);
      return {
        canAccess: false,
        reason: 'Error al verificar acceso al dashboard',
      };
    }
  }

  /**
   * Registrar un gasto de caja chica
   * Llama a la función RPC register_cash_expense
   */
  async registerExpense(payload: RegisterExpensePayload): Promise<RegisterExpenseResponse> {
    const { data, error } = await this.supabase.schema('sales').rpc('register_cash_expense', {
      p_cash_register_session_id: payload.cashRegisterSessionId,
      p_amount: payload.amount,
      p_category: payload.category,
      p_description: payload.description,
      p_receipt_number: payload.receiptNumber || null,
      p_notes: payload.notes || null,
      p_authorized_by_id: payload.authorizedById || null,
    });

    if (error) {
      console.error('[CashRegisterService] Error al registrar gasto:', error);
      throw error;
    }

    return camelcaseKeys(data, { deep: true }) as RegisterExpenseResponse;
  }

  /**
   * Obtener historial de gastos de una sesión
   * Llama a la función RPC get_session_expenses
   */
  async getSessionExpenses(sessionId: string): Promise<ExpenseView[]> {
    const { data, error } = await this.supabase.schema('sales').rpc('get_session_expenses', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('[CashRegisterService] Error al obtener gastos:', error);
      throw error;
    }

    return camelcaseKeys(data || [], { deep: true }) as ExpenseView[];
  }

  /**
   * Obtener dashboard completo de una sesión
   * Llama a la función RPC get_session_dashboard
   */
  async getSessionDashboard(sessionId: string): Promise<SessionDashboard> {
    const { data, error } = await this.supabase.schema('sales').rpc('get_session_dashboard', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('[CashRegisterService] Error al obtener dashboard:', error);
      throw error;
    }

    return camelcaseKeys(data, { deep: true }) as SessionDashboard;
  }
}
