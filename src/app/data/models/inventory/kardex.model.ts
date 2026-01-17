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

// Roll Tracking (seguimiento de rollos individuales)
export interface RollTrackingFormModel {
  item_id: string;
  roll_code: string;
  current_quantity: number | string;
}

export interface RollTrackingPayload {
  id: string;
  item_id: string;
  roll_code: string;
  current_quantity: number;
  status: 'full' | 'in_use' | 'depleted' | 'scrapped';
}

export interface RollTrackingView {
  id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  roll_code: string;
  current_quantity: number;
  status: 'full' | 'in_use' | 'depleted' | 'scrapped';
  created_at: string;
  updated_at: string;
}

// Kardex (registro contable de movimientos)
export interface KardexFormModel {
  movement_type_id: number | string;
  movement_reason_id: number | string;
  item_id: string;
  roll_id: string;
  quantity: number | string;
  notes: string;
}

export interface KardexPayload {
  id: string;
  movement_type_id: number;
  movement_reason_id: number;
  item_id: string;
  roll_id?: string | null;
  quantity: number;
  previous_balance: number;
  subsequent_balance: number;
  notes?: string | null;
  created_by?: string | null;
}

export interface KardexView {
  id: string;
  movement_type_id: number;
  movement_type_name?: string;
  movement_reason_id: number;
  movement_reason_name?: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  roll_id?: string | null;
  roll_code?: string | null;
  quantity: number;
  previous_balance: number;
  subsequent_balance: number;
  notes?: string | null;
  created_at: string;
  created_by?: string | null;
}

// Consumption Logs (registro técnico de producción)
export interface ConsumptionLogFormModel {
  machine_id: string;
  job_name: string;
  customer_quantity: number | string;
  calibration_waste: number | string;
  error_waste: number | string;
  width_used_mm: number | string;
  length_used_mm: number | string;
  operator_id: string;
  order_detail_id: string;
}

export interface ConsumptionLogPayload {
  id: string;
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

// Kardex Consumption (relación entre kardex y consumption logs)
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
  consumption_log_id: string;
  used_quantity: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Balance de Kardex (para reportes)
export interface KardexBalance {
  item_id: string;
  item_name: string;
  item_sku: string;
  current_stock: number;
  last_movement_date?: string;
  unit_type: string;
}

// Producción completa (para formulario integrado)
export interface ProductionFormModel {
  movement_type_id: number | string;
  movement_reason_id: number | string;
  roll_id: string;
  machine_id: string;
  operator_id: string;
  job_name: string;
  order_detail_id: string;
  customer_quantity: number | string;
  calibration_waste: number | string;
  error_waste: number | string;
  width_used_mm: number | string;
  length_used_mm: number | string;
  notes: string;
}
