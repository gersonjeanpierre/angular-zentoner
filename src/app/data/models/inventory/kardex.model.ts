export interface MovementType {
  id: number;
  name: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  description: string;
  created_at: string;
}

export interface MovementReason {
  id: number;
  name:
    | 'COMPRA'
    | 'VENTA'
    | 'PRODUCCION'
    | 'MERMA_TECNICA'
    | 'DAÑO_OPERATIVO'
    | 'DEVOLUCION'
    | 'INVENTARIO_INICIAL'
    | 'AJUSTE_MANUAL'
    | 'TRASLADO'
    | 'OTRO';
  description: string;
  created_at: string;
}

// Nuevo modelo para Kardex (rollos/lotes individuales)
export interface KardexFormModel {
  item_id: string;
  batch_code: string;
  quantity_base: number | string;
  notes: string;
}

export interface KardexPayload {
  id: string;
  item_id: string;
  batch_code?: string | null;
  quantity_used?: number | null;
  quantity_remaining?: number | null;
  quantity_base: number;
  notes?: string | null;
  created_by?: string | null;
}

export interface KardexView {
  id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  batch_code?: string | null;
  quantity_used?: number | null;
  quantity_remaining?: number | null;
  quantity_base: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

// Modelo para Consumption Logs
export interface ConsumptionLogFormModel {
  movement_type_id: string;
  movement_reason_id: string;
  machine_id: string;
  order_detail_id: string;
  job_name: string;
  customer_quantity: number | string;
  calibration_waste: number | string;
  error_waste: number | string;
  width_used_mm: number | string;
  length_used_mm: number | string;
}

export interface ConsumptionLogPayload {
  id: string;
  movement_type_id: number;
  movement_reason_id: number;
  machine_id?: string | null;
  operator_id?: string | null;
  order_detail_id?: string | null;
  job_name?: string | null;
  customer_quantity?: number | null;
  calibration_waste?: number | null;
  error_waste?: number | null;
  width_used_mm?: number | null;
  length_used_mm?: number | null;
}

export interface ConsumptionLogView {
  id: string;
  movement_type_id: number;
  movement_type_name?: string;
  movement_reason_id: number;
  movement_reason_name?: string;
  machine_id?: string | null;
  machine_name?: string | null;
  operator_id?: string | null;
  operator_name?: string | null;
  order_detail_id?: string | null;
  job_name?: string | null;
  customer_quantity?: number | null;
  calibration_waste?: number | null;
  error_waste?: number | null;
  width_used_mm?: number | null;
  length_used_mm?: number | null;
  created_at: string;
  updated_at: string;
}

// Modelo para Kardex Consumption (relación entre kardex y consumption logs)
export interface KardexConsumptionPayload {
  id: string;
  kardex_id: string;
  consumption_log_id: string;
  used_quantity: number;
  notes?: string | null;
}

export interface KardexConsumptionView {
  id: string;
  kardex_id: string;
  kardex_batch_code?: string;
  consumption_log_id: string;
  used_quantity: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KardexBalance {
  item_id: string;
  item_name: string;
  item_sku: string;
  total_base: number;
  total_used: number;
  total_remaining: number;
  unit_type: string;
}
