export type SupplyType =
  | 'papel'
  | 'lona'
  | 'vinilo'
  | 'rigido'
  | 'tinta'
  | 'merchandising'
  | 'repuesto'
  | 'maquina'
  | 'herramienta'
  | 'consumible'
  | 'otro';

export type UnitType = 'unidad' | 'rollo' | 'millar' | 'plancha';

export interface ItemFormModel {
  category_id: string;
  name: string;
  sku: string;
  supply_type: SupplyType;
  unit_type: UnitType;
  brand: string;
  price_reference: number | string;
  size_name: string;
  weight_gsm: number | string;
  finish: string;
  width_mm: number | string;
  height_mm: number | string;
  length_m: number | string;
  color_code: string;
  volume_ml: number | string;
  printable_width_mm: number | string;
  printable_height_mm: number | string;
  thickness_mm: number | string;
  serial_number: string;
  metadata?: Record<string, any>;
  is_active: boolean;
}

export interface ItemPayload {
  id: string;
  category_id: number;
  supply_type: SupplyType;
  unit_type: UnitType;
  name: string;
  sku: string;

  // Atributos técnicos opcionales
  brand?: string | null;
  price_reference?: number | null;
  size_name?: string | null;
  weight_gsm?: number | null;
  finish?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  length_m?: number | null;
  color_code?: string | null;
  volume_ml?: number | null;
  printable_width_mm?: number | null;
  printable_height_mm?: number | null;
  thickness_mm?: number | null;
  serial_number?: string | null;
  metadata?: Record<string, any> | null;

  is_active?: boolean;
}

export interface ItemView {
  id: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  supply_type: SupplyType;
  unit_type: UnitType;
  name: string;
  sku: string;

  brand?: string | null;
  price_reference?: number | null;

  // Atributos técnicos
  size_name?: string | null;
  weight_gsm: number | null;
  finish: string | null;
  width_mm: number | null;
  height_mm: number | null;
  length_m: number | null;
  color_code: string | null;
  volume_ml: number | null;
  printable_width_mm: number | null;
  printable_height_mm: number | null;
  thickness_mm: number | null;
  serial_number: string | null;
  metadata: Record<string, any> | null;

  // Stock (viene del kardex)
  current_stock?: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateItemPayload {
  category_id?: number;
  supply_type?: SupplyType;
  unit_type?: UnitType;
  name?: string;
  sku?: string;
  brand?: string | null;
  price_reference?: number | null;
  size_name?: string | null;
  weight_gsm?: number | null;
  finish?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  length_m?: number | null;
  color_code?: string | null;
  volume_ml?: number | null;
  printable_width_mm?: number | null;
  printable_height_mm?: number | null;
  thickness_mm?: number | null;
  serial_number?: string | null;
  metadata?: Record<string, any> | null;
  is_active?: boolean;
}

export interface selectOption {
  value: number | string;
  label: string;
}
