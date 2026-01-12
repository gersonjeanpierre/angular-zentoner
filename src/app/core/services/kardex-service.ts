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
} from '@data/models/inventory/kardex.model';
import { Supabase } from '@core/supabase/supabase';

export interface GetKardexParams {
  itemId?: string;
  batchCode?: string;
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

export interface GetConsumptionLogsParams {
  movementTypeId?: number;
  movementReasonId?: number;
  machineId?: string;
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

  /**
   * Calcular stock disponible de un item (suma de quantity_remaining de todos sus lotes)
   */
  async getAvailableStock(itemId: string): Promise<number> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .select('quantity_remaining')
      .eq('item_id', itemId);

    if (error) {
      console.error('Error al obtener stock disponible:', error);
      throw error;
    }

    const total = data?.reduce((sum, item) => sum + (item.quantity_remaining || 0), 0) || 0;
    return total;
  }

  /**
   * Registrar un nuevo lote/rollo en kardex
   */
  async createKardexEntry(payload: KardexPayload) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .insert(payload)
      .select();

    if (error) {
      console.error('Error al registrar lote en kardex:', error);
      throw error;
    }

    return data[0];
  }

  /**
   * Obtener lotes/rollos de kardex con filtros
   */
  async getKardexEntries(params: GetKardexParams = {}): Promise<GetKardexResponse> {
    const { itemId, batchCode, page = 1, pageSize = 20 } = params;

    let query = this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .select(
        `
        *,
        items:item_id (
          name,
          sku,
          unit_type
        )
      `,
        { count: 'exact' },
      );

    // Filtros
    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    if (batchCode) {
      query = query.ilike('batch_code', `%${batchCode}%`);
    }

    // Ordenar por fecha descendente
    query = query.order('created_at', { ascending: false });

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener kardex:', error);
      throw error;
    }

    // Mapear datos
    const mappedData: KardexView[] =
      data?.map((entry: any) => ({
        id: entry.id,
        item_id: entry.item_id,
        item_name: entry.items?.name,
        item_sku: entry.items?.sku,
        batch_code: entry.batch_code,
        quantity_used: entry.quantity_used,
        quantity_remaining: entry.quantity_remaining,
        quantity_base: entry.quantity_base,
        notes: entry.notes,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
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
   * Registrar un log de consumo
   */
  async createConsumptionLog(payload: ConsumptionLogPayload) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('consumption_logs')
      .insert(payload)
      .select();

    if (error) {
      console.error('Error al registrar log de consumo:', error);
      throw error;
    }

    return data[0];
  }

  /**
   * Obtener logs de consumo con filtros
   */
  async getConsumptionLogs(
    params: GetConsumptionLogsParams = {},
  ): Promise<GetConsumptionLogsResponse> {
    const {
      movementTypeId,
      movementReasonId,
      machineId,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = params;

    let query = this.supabaseClient
      .schema('inventory')
      .from('consumption_logs')
      .select(
        `
        *,
        movement_type:movement_type_id (
          name
        ),
        movement_reason:movement_reason_id (
          name
        ),
        machine:machine_id (
          name
        )
      `,
        { count: 'exact' },
      );

    // Filtros
    if (movementTypeId) {
      query = query.eq('movement_type_id', movementTypeId);
    }

    if (movementReasonId) {
      query = query.eq('movement_reason_id', movementReasonId);
    }

    if (machineId) {
      query = query.eq('machine_id', machineId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Ordenar por fecha descendente
    query = query.order('created_at', { ascending: false });

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener logs de consumo:', error);
      throw error;
    }

    // Mapear datos
    const mappedData: ConsumptionLogView[] =
      data?.map((entry: any) => ({
        id: entry.id,
        movement_type_id: entry.movement_type_id,
        movement_type_name: entry.movement_type?.name,
        movement_reason_id: entry.movement_reason_id,
        movement_reason_name: entry.movement_reason?.name,
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

  /**
   * Registrar relación entre kardex y consumption log
   */
  async createKardexConsumption(payload: KardexConsumptionPayload) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex_consumption')
      .insert(payload)
      .select();

    if (error) {
      console.error('Error al registrar kardex consumption:', error);
      throw error;
    }

    return data[0];
  }

  /**
   * Obtener consumos de un lote específico
   */
  async getKardexConsumptions(kardexId: string): Promise<KardexConsumptionView[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex_consumption')
      .select(
        `
        *,
        kardex:kardex_id (
          batch_code
        )
      `,
      )
      .eq('kardex_id', kardexId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener consumos de kardex:', error);
      throw error;
    }

    return (
      data?.map((entry: any) => ({
        id: entry.id,
        kardex_id: entry.kardex_id,
        kardex_batch_code: entry.kardex?.batch_code,
        consumption_log_id: entry.consumption_log_id,
        used_quantity: entry.used_quantity,
        notes: entry.notes,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      })) || []
    );
  }

  /**
   * Obtener balance actual de todos los items
   */
  async getItemsBalance(): Promise<KardexBalance[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .select(
        `
        item_id,
        quantity_base,
        quantity_used,
        quantity_remaining,
        items:item_id (
          name,
          sku,
          unit_type
        )
      `,
      );

    if (error) {
      console.error('Error al obtener balances:', error);
      throw error;
    }

    // Agrupar por item_id
    const balanceMap = new Map<string, KardexBalance>();

    data?.forEach((entry: any) => {
      const itemId = entry.item_id;

      if (!balanceMap.has(itemId)) {
        balanceMap.set(itemId, {
          item_id: itemId,
          item_name: entry.items?.name || '',
          item_sku: entry.items?.sku || '',
          total_base: 0,
          total_used: 0,
          total_remaining: 0,
          unit_type: entry.items?.unit_type || '',
        });
      }

      const balance = balanceMap.get(itemId)!;
      balance.total_base += entry.quantity_base || 0;
      balance.total_used += entry.quantity_used || 0;
      balance.total_remaining += entry.quantity_remaining || 0;
    });

    return Array.from(balanceMap.values());
  }

  /**
   * Obtener historial de lotes de un item específico
   */
  async getItemKardexHistory(itemId: string, limit = 50): Promise<KardexView[]> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('kardex')
      .select(
        `
        *,
        items:item_id (
          name,
          sku,
          unit_type
        )
      `,
      )
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error al obtener historial de kardex:', error);
      throw error;
    }

    return (
      data?.map((entry: any) => ({
        id: entry.id,
        item_id: entry.item_id,
        item_name: entry.items?.name,
        item_sku: entry.items?.sku,
        batch_code: entry.batch_code,
        quantity_used: entry.quantity_used,
        quantity_remaining: entry.quantity_remaining,
        quantity_base: entry.quantity_base,
        notes: entry.notes,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        created_by: entry.created_by,
      })) || []
    );
  }
}
