-- ======================================================================
-- KARDEX SYSTEM
-- Inventory tracking: movements, roll tracking, consumption logs
-- ======================================================================

-- ======================================================================
-- TABLES
-- ======================================================================

-- movement_type
CREATE TABLE inventory.movement_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.movement_type
ADD CONSTRAINT chk_movement_type_name_length CHECK (name IS NULL OR char_length(name) <= 50),
ADD CONSTRAINT chk_movement_type_description_length CHECK (description IS NULL OR char_length(description) <= 200);

-- movement_reason
CREATE TABLE inventory.movement_reason (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.movement_reason
ADD CONSTRAINT chk_movement_reason_name_length CHECK (name IS NULL OR char_length(name) <= 50),
ADD CONSTRAINT chk_movement_reason_description_length CHECK (description IS NULL OR char_length(description) <= 150);

-- roll_tracking
CREATE TABLE inventory.roll_tracking (
  id UUID PRIMARY KEY,
  item_id UUID REFERENCES inventory.items(id) NOT NULL,
  roll_code TEXT UNIQUE NOT NULL,
  current_quantity DECIMAL(12,3) NOT NULL,
  status TEXT CHECK (status IN ('full','in_use','depleted','scrapped')) DEFAULT 'full',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.roll_tracking
ADD CONSTRAINT chk_roll_code_length CHECK (char_length(roll_code) <= 50),
ADD CONSTRAINT chk_current_quantity_nonnegative CHECK (current_quantity >= 0);

-- kardex
CREATE TABLE inventory.kardex (
  id UUID PRIMARY KEY,
  item_id UUID REFERENCES inventory.items(id) NOT NULL,
  roll_id UUID REFERENCES inventory.roll_tracking(id),
  movement_type_id SMALLINT REFERENCES inventory.movement_type(id) NOT NULL,
  movement_reason_id SMALLINT REFERENCES inventory.movement_reason(id) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  previous_balance DECIMAL(12,3) NOT NULL,
  subsequent_balance DECIMAL(12,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE inventory.kardex
ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
ADD CONSTRAINT chk_previous_balance_nonnegative CHECK (previous_balance >= 0),
ADD CONSTRAINT chk_subsequent_balance_nonnegative CHECK (subsequent_balance >= 0),
ADD CONSTRAINT chk_notes_length CHECK (notes IS NULL OR char_length(notes) <= 250);

CREATE INDEX idx_kardex_item_id ON inventory.kardex(item_id);
CREATE INDEX idx_kardex_created_at ON inventory.kardex(created_at);

-- consumption_logs
CREATE TABLE inventory.consumption_logs (
  id UUID PRIMARY KEY,
  movement_type_id SMALLINT REFERENCES inventory.movement_type(id) NOT NULL,
  movement_reason_id SMALLINT REFERENCES inventory.movement_reason(id) NOT NULL,
  machine_id UUID REFERENCES inventory.machines(id),
  operator_id UUID REFERENCES auth.users(id),
  order_detail_id UUID REFERENCES sales.order_details(id),
  job_name TEXT,
  customer_quantity DECIMAL,
  calibration_waste DECIMAL,
  error_waste DECIMAL,
  width_used_mm INT,
  length_used_mm INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.consumption_logs
ADD CONSTRAINT chk_job_name_length CHECK (job_name IS NULL OR char_length(job_name) <= 150),
ADD CONSTRAINT chk_customer_quantity_nonnegative CHECK (customer_quantity IS NULL OR customer_quantity >= 0),
ADD CONSTRAINT chk_calibration_waste_nonnegative CHECK (calibration_waste IS NULL OR calibration_waste >= 0),
ADD CONSTRAINT chk_error_waste_nonnegative CHECK (error_waste IS NULL OR error_waste >= 0),
ADD CONSTRAINT chk_width_used_mm_nonnegative CHECK (width_used_mm IS NULL OR width_used_mm >= 0),
ADD CONSTRAINT chk_length_used_mm_nonnegative CHECK (length_used_mm IS NULL OR length_used_mm >= 0);

-- kardex_consumption (junction table)
CREATE TABLE inventory.kardex_consumption (
  id UUID PRIMARY KEY,
  kardex_id UUID REFERENCES inventory.kardex(id) ON DELETE CASCADE,
  consumption_log_id UUID REFERENCES inventory.consumption_logs(id) ON DELETE CASCADE,
  used_quantity DECIMAL(12,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kardex_consumption_kardex_id ON inventory.kardex_consumption(kardex_id);
CREATE INDEX idx_kardex_consumption_log_id ON inventory.kardex_consumption(consumption_log_id);

ALTER TABLE inventory.kardex_consumption
ADD CONSTRAINT chk_used_quantity_positive CHECK (used_quantity > 0),
ADD CONSTRAINT chk_notes_length CHECK (notes IS NULL OR char_length(notes) <= 250);

-- ======================================================================
-- TRIGGERS
-- ======================================================================

CREATE TRIGGER trg_movement_type_set_updated_at 
  BEFORE UPDATE ON inventory.movement_type 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_movement_reason_set_updated_at 
  BEFORE UPDATE ON inventory.movement_reason 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_roll_tracking_set_updated_at 
  BEFORE UPDATE ON inventory.roll_tracking 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_kardex_set_updated_at 
  BEFORE UPDATE ON inventory.kardex 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_consumption_logs_set_updated_at 
  BEFORE UPDATE ON inventory.consumption_logs 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_kardex_consumption_set_updated_at 
  BEFORE UPDATE ON inventory.kardex_consumption 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- ======================================================================
-- RLS
-- ======================================================================

ALTER TABLE inventory.movement_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.movement_reason ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.roll_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.kardex ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.kardex_consumption ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION inventory.register_purchase(
  p_kardex_id UUID,
  p_roll_tracking_id UUID,
  p_item_id UUID,
  p_roll_code TEXT
) RETURNS JSON AS $$
DECLARE
  v_roll_id UUID;
  v_kardex_id UUID;
  quantity_initial DECIMAL(10,3);
BEGIN
  SELECT length_m INTO quantity_initial FROM inventory.items WHERE id = p_item_id;
  
  INSERT INTO inventory.roll_tracking (id, item_id, roll_code, current_quantity, status)
  VALUES (p_roll_tracking_id, p_item_id, p_roll_code, quantity_initial, 'full')
  RETURNING id INTO v_roll_id;
  
  INSERT INTO inventory.kardex (
    id, item_id, roll_id, movement_type_id, movement_reason_id,
    quantity, previous_balance, subsequent_balance
  ) VALUES (
    p_kardex_id, p_item_id, v_roll_id, 1, 1,
    quantity_initial, 0, quantity_initial
  ) RETURNING id INTO v_kardex_id;
  
  RETURN json_build_object('rollId', v_roll_id, 'kardexId', v_kardex_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION inventory.get_current_stock(p_item_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT subsequent_balance INTO v_balance
  FROM inventory.kardex
  WHERE item_id = p_item_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION inventory.get_current_stock()
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  item_sku TEXT,
  current_balance NUMERIC,
  unit_type TEXT,
  last_movement_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_kardex AS (
    SELECT DISTINCT ON (k.item_id)
      k.item_id,
      k.subsequent_balance,
      k.created_at
    FROM inventory.kardex k
    ORDER BY k.item_id, k.created_at DESC
  )
  SELECT
    i.id,
    i.name,
    i.sku,
    COALESCE(lk.subsequent_balance, 0) AS current_balance,
    i.unit_type,
    lk.created_at
  FROM inventory.items i
  LEFT JOIN latest_kardex lk ON i.id = lk.item_id
  WHERE i.is_active = TRUE
  ORDER BY i.name;
END;
$$ LANGUAGE plpgsql;

-- ======================================================================
-- SEED DATA
-- ======================================================================

INSERT INTO inventory.movement_type (name, description) VALUES
('ENTRADA', 'Ingreso de inventario al almacén'),
('SALIDA', 'Salida de inventario del almacén'),
('AJUSTE', 'Corrección manual o ajuste de inventario');

INSERT INTO inventory.movement_reason (name, description) VALUES
('COMPRA', 'Entrada por factura de proveedor'),
('VENTA', 'Salida por despacho al cliente'),
('PRODUCCION', 'Salida por consumo en máquina'),
('MERMA_TECNICA', 'Desperdicio por inicio de impresión/calibración'),
('DAÑO_OPERATIVO', 'Se malogró el material por atascamiento o error humano'),
('DEVOLUCION', 'El cliente devolvió o nosotros devolvemos al proveedor'),
('INVENTARIO_INICIAL', 'Carga inicial del sistema'),
('AJUSTE_MANUAL', 'Corrección manual por auditoría o conteo físico'),
('TRASLADO', 'Movimiento entre almacenes o sucursales'),
('OTRO', 'Otros motivos no listados');
