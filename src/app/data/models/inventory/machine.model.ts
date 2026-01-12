export interface MachineFormModel {
  shop_id: string;
  name: string;
  model: string;
  metadata?: Record<string, any>;
  is_active: boolean;
}

export interface MachinePayload {
  id: string;
  shop_id: string;
  name: string;
  model?: string | null;
  metadata?: Record<string, any> | null;
  is_active?: boolean;
}

export interface MachineView {
  id: string;
  shop_id: string;
  name: string;
  model?: string | null;
  metadata?: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
