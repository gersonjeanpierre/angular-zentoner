import { Injectable, inject } from '@angular/core';
import {
  KardexPayload,
  KardexView,
  KardexBalance,
  MovementType,
  MovementReason,
  ConsumptionLogPayload,
  ConsumptionLogView,
  KardexConsumptionPayload,
  KardexConsumptionView,
  RollTrackingPayload,
  RollTrackingView,
} from '@data/models/inventory/kardex.model';
import { v7 as uuidv7 } from 'uuid';
import { Supabase } from '@core/supabase/supabase';

export interface GetKardexParams {
  itemId?: string;
  rollId?: string;
  movementTypeId?: number;
  movementReasonId?: number;
  page?: number;
  pageSize?: number;
}

export interface GetKardexResponse {
  data: KardexView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GetRollsParams {
  itemId?: string;
  status?: 'FULL' | 'PARTIAL' | 'EMPTY' | 'SCRAPPED';
  page?: number;
  pageSize?: number;
}

export interface GetRollsResponse {
  data: RollTrackingView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GetConsumptionLogsParams {
  machineId?: string;
  operatorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface GetConsumptionLogsResponse {
  data: ConsumptionLogView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class KardexService {
  private supabaseClient = inject(Supabase).client;

  /**
   * Obtener tipos de movimiento (ENTRADA, SALIDA, AJUSTE)
   */
  async getMovementTypes(): Promise<MovementType[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('movement_type')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error al obtener tipos de movimiento:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Obtener razones de movimiento (COMPRA, VENTA, PRODUCCION, etc)
   */
  async getMovementReasons(): Promise<MovementReason[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('movement_reason')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error al obtener razones de movimiento:', error);
      throw error;
    }

    return data || [];
  }

  // ======================================================================
  // ROLL TRACKING OPERATIONS
  // ======================================================================

  /**
   * Registrar una compra de rollo (inserta en roll_tracking y genera kardex ENTRADA)
   */
  /**
   * Registrar compra de rollo (crea roll + entry en kardex)
   * Debe llamar a una función RPC en la BD que haga INSERT en roll_tracking y kardex atómicamente
   */
  async registerPurchase(params: {
    idKardex: string;
    itemId: string;
    rollCode: string;
  }): Promise<{ rollId: string; kardexId: string }> {
    const { data, error } = await this.supabaseClient.schema('inventory').rpc('register_purchase', {
      p_kardex_id: params.idKardex,
      p_roll_tracking_id: uuidv7(),
      p_item_id: params.itemId,
      p_roll_code: params.rollCode,
    });

    if (error) {
      console.error('Error al registrar compra de rollo:', error);
      throw error;
    }

    return data;
  }

  /**
   * Obtener rollos por item (disponibles para consumo)
   */
  async getRollsByItem(itemId: string): Promise<RollTrackingView[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('roll_tracking')
      .select(
        `
        *,
        items:item_id (
          name,
          sku
        )
      `,
      )
      .eq('item_id', itemId)
      .in('status', ['full', 'in_use'])
      .gt('current_quantity', 0)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al obtener rollos del item:', error);
      throw error;
    }

    return (
      data?.map((roll: any) => ({
        id: roll.id,
        item_id: roll.item_id,
        item_name: roll.items?.name,
        item_sku: roll.items?.sku,
        roll_code: roll.roll_code,
        current_quantity: roll.current_quantity,
        status: roll.status,
        created_at: roll.created_at,
        updated_at: roll.updated_at,
      })) || []
    );
  }

  /**
   * Obtener todos los rollos con filtros y paginación
   */
  async getRolls(params: GetRollsParams = {}): Promise<GetRollsResponse> {
    const { itemId, status, page = 1, pageSize = 20 } = params;

    let query = this.supabaseClient
      .schema('inventory')
      .from('roll_tracking')
      .select(
        `
        *,
        items:item_id (
          name,
          sku
        )
      `,
        { count: 'exact' },
      );

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener rollos:', error);
      throw error;
    }

    const mappedData: RollTrackingView[] =
      data?.map((roll: any) => ({
        id: roll.id,
        item_id: roll.item_id,
        item_name: roll.items?.name,
        item_sku: roll.items?.sku,
        roll_code: roll.roll_code,
        current_quantity: roll.current_quantity,
        status: roll.status,
        created_at: roll.created_at,
        updated_at: roll.updated_at,
      })) || [];

    const totalPages = Math.ceil((count || 0) / pageSize);

    return {
      data: mappedData,
      count: count || 0,
      page,
      pageSize,
      totalPages,
    };
  }

  // ======================================================================
  // KARDEX OPERATIONS
  // ======================================================================

  /**
   * Registrar un movimiento en kardex (manual)
   */
  async createKardexEntry(payload: KardexPayload): Promise<KardexView> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .insert(payload);

    if (error) {
      console.error('Error al registrar movimiento en kardex:', error);
      throw error;
    }

    return data!;
  }

  /**
   * Obtener movimientos de kardex con filtros
   */
  async getKardexEntries(params: GetKardexParams = {}): Promise<GetKardexResponse> {
    const { itemId, rollId, movementTypeId, movementReasonId, page = 1, pageSize = 20 } = params;

    let query = this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .select('*', { count: 'exact' });

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    if (rollId) {
      query = query.eq('roll_id', rollId);
    }

    if (movementTypeId) {
      query = query.eq('movement_type_id', movementTypeId);
    }

    if (movementReasonId) {
      query = query.eq('movement_reason_id', movementReasonId);
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener kardex:', error);
      throw error;
    }

    const mappedData: KardexView[] =
      data?.map((entry: any) => ({
        id: entry.id,
        movement_type_id: entry.movement_type_id,
        movement_type_name: entry.movement_type?.name,
        movement_reason_id: entry.movement_reason_id,
        movement_reason_name: entry.movement_reason?.name,
        item_id: entry.item_id,
        item_name: entry.items?.name,
        item_sku: entry.items?.sku,
        roll_id: entry.roll_id,
        roll_code: entry.roll_tracking?.roll_code,
        quantity: entry.quantity,
        unit_cost_at_moment: entry.unit_cost_at_moment,
        previous_balance: entry.previous_balance,
        subsequent_balance: entry.subsequent_balance,
        notes: entry.notes,
        created_at: entry.created_at,
        created_by: entry.created_by,
      })) || [];

    const totalPages = Math.ceil((count || 0) / pageSize);

    return {
      data: mappedData,
      count: count || 0,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Obtener stock actual usando la función RPC
   */
  async getCurrentStock(): Promise<KardexBalance[]> {
    const { data, error } = await this.supabaseClient.rpc('get_current_stock', {});

    if (error) {
      console.error('Error al obtener stock actual:', error);
      throw error;
    }

    return (
      data?.map((item: any) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        item_sku: item.item_sku,
        current_stock: item.current_balance,
        last_movement_date: item.last_movement_date,
        unit_type: item.unit_type,
      })) || []
    );
  }

  /**
   * Obtener stock actual de un item específico
   */
  async getItemCurrentStock(itemId: string): Promise<number> {
    const { data, error } = await this.supabaseClient.rpc('get_current_stock', {
      p_item_id: itemId,
    });

    if (error) {
      console.error('Error al obtener stock del item:', error);
      throw error;
    }

    return data || 0;
  }

  /**
   * Validar stock antes de consumo
   */
  async validateStock(itemId: string, quantity: number): Promise<boolean> {
    const { data, error } = await this.supabaseClient.rpc('validate_stock', {
      p_item_id: itemId,
      p_quantity: quantity,
    });

    if (error) {
      console.error('Error al validar stock:', error);
      throw error;
    }

    return data || false;
  }

  /**
   * Obtener historial de movimientos de un rollo específico
   */
  async getRollHistory(rollId: string): Promise<KardexView[]> {
    const response = await this.getKardexEntries({ rollId, pageSize: 100 });
    return response.data;
  }

  /**
   * Obtener historial de movimientos de un item
   */
  async getItemKardexHistory(itemId: string, limit = 50): Promise<KardexView[]> {
    const response = await this.getKardexEntries({ itemId, pageSize: limit });
    return response.data;
  }

  // ======================================================================
  // CONSUMPTION LOGS OPERATIONS
  // ======================================================================

  /**
   * Registrar un log de consumo de producción
   */
  async createConsumptionLog(payload: ConsumptionLogPayload): Promise<ConsumptionLogView> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('consumption_logs')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('Error al registrar log de consumo:', error);
      throw error;
    }

    return {
      id: data.id,
      machine_id: data.machine_id,
      machine_name: data.machine?.name,
      operator_id: data.operator_id,
      order_detail_id: data.order_detail_id,
      job_name: data.job_name,
      customer_quantity: data.customer_quantity,
      calibration_waste: data.calibration_waste,
      error_waste: data.error_waste,
      width_used_mm: data.width_used_mm,
      length_used_mm: data.length_used_mm,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Obtener logs de consumo con filtros
   */
  async getConsumptionLogs(
    params: GetConsumptionLogsParams = {},
  ): Promise<GetConsumptionLogsResponse> {
    const { machineId, operatorId, startDate, endDate, page = 1, pageSize = 20 } = params;

    let query = this.supabaseClient
      .schema('inventory')
      .from('consumption_logs')
      .select(
        `
        *,
        machine:machine_id (
          name
        )
      `,
        { count: 'exact' },
      );

    if (machineId) {
      query = query.eq('machine_id', machineId);
    }

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener logs de consumo:', error);
      throw error;
    }

    const mappedData: ConsumptionLogView[] =
      data?.map((entry: any) => ({
        id: entry.id,
        machine_id: entry.machine_id,
        machine_name: entry.machine?.name,
        operator_id: entry.operator_id,
        order_detail_id: entry.order_detail_id,
        job_name: entry.job_name,
        customer_quantity: entry.customer_quantity,
        calibration_waste: entry.calibration_waste,
        error_waste: entry.error_waste,
        width_used_mm: entry.width_used_mm,
        length_used_mm: entry.length_used_mm,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      })) || [];

    const totalPages = Math.ceil((count || 0) / pageSize);

    return {
      data: mappedData,
      count: count || 0,
      page,
      pageSize,
      totalPages,
    };
  }

  // ======================================================================
  // KARDEX CONSUMPTION OPERATIONS
  // ======================================================================

  /**
   * Registrar relación entre kardex y consumption log
   */
  async createKardexConsumption(payload: KardexConsumptionPayload): Promise<KardexConsumptionView> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex_consumption')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('Error al registrar kardex consumption:', error);
      throw error;
    }

    return data;
  }

  /**
   * Obtener consumos asociados a un movimiento de kardex
   */
  async getKardexConsumptions(kardexId: string): Promise<KardexConsumptionView[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex_consumption')
      .select('*')
      .eq('kardex_id', kardexId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener consumos de kardex:', error);
      throw error;
    }

    return data || [];
  }

  // ======================================================================
  // INTEGRATED PRODUCTION FLOW
  // ======================================================================

  /**
   * Registrar producción completa (consumption log + kardex + kardex_consumption)
   * Este método debe llamar a una función RPC de base de datos que maneje
   * la transacción atómica de los tres inserts
   */
  async registerProduction(productionData: {
    rollId: string;
    machineId: string;
    operatorId?: string;
    jobName: string;
    orderDetailId?: string;
    customerQuantity: number;
    calibrationWaste: number;
    errorWaste: number;
    widthUsedMm?: number;
    lengthUsedMm?: number;
    notes?: string;
  }): Promise<{ consumptionLogId: string; kardexId: string }> {
    // Esta función debe implementarse en la base de datos como RPC
    // Por ahora, retornamos un placeholder
    const { data, error } = await this.supabaseClient.rpc('register_production', {
      p_roll_id: productionData.rollId,
      p_machine_id: productionData.machineId,
      p_operator_id: productionData.operatorId || null,
      p_job_name: productionData.jobName,
      p_order_detail_id: productionData.orderDetailId || null,
      p_customer_quantity: productionData.customerQuantity,
      p_calibration_waste: productionData.calibrationWaste,
      p_error_waste: productionData.errorWaste,
      p_width_used_mm: productionData.widthUsedMm || null,
      p_length_used_mm: productionData.lengthUsedMm || null,
      p_notes: productionData.notes || null,
    });

    if (error) {
      console.error('Error al registrar producción:', error);
      throw error;
    }

    return data;
  }
}
