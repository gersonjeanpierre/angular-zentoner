-- ======================================================================
-- K A R D E X   D E   I N V E N T A R I O
-- ======================================================================
DROP TABLE IF EXISTS inventory.kardex CASCADE;
DROP TABLE IF EXISTS inventory.consumption_logs CASCADE;
DROP TABLE IF EXISTS inventory.kardex_consumption CASCADE;
DROP TABLE IF EXISTS inventory.movement_type CASCADE;
DROP TABLE IF EXISTS inventory.movement_reason CASCADE;
DROP TABLE IF EXISTS inventory.roll_tracking CASCADE;

CREATE TABLE IF NOT EXISTS inventory.movement_type (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.movement_type
ADD CONSTRAINT chk_movement_type_name_length CHECK (
    name IS NULL
    OR char_length(name) <= 50
),
ADD CONSTRAINT chk_movement_type_description_length CHECK (
    description IS NULL
    OR char_length(description) <= 200
);

CREATE TRIGGER trg_movement_type_set_updated_at
  BEFORE UPDATE ON inventory.movement_type
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE inventory.movement_type ENABLE ROW LEVEL SECURITY;
-- SEED DATA PARA MOVEMENT TYPES
INSERT INTO
    inventory.movement_type (name, description)
VALUES (
        'ENTRADA',
        'Ingreso de inventario al almacén'
    ),
    (
        'SALIDA',
        'Salida de inventario del almacén'
    ),
    (
        'AJUSTE',
        'Corrección manual o ajuste de inventario'
    );

-- ======================================================================

CREATE TABLE IF NOT EXISTS inventory.movement_reason (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.movement_reason
ADD CONSTRAINT chk_movement_reason_name_length CHECK (
    name IS NULL
    OR char_length(name) <= 50
),
ADD CONSTRAINT chk_movement_reason_description_length CHECK (
    description IS NULL
    OR char_length(description) <= 150
);

CREATE TRIGGER trg_movement_reason_set_updated_at
  BEFORE UPDATE ON inventory.movement_reason
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE inventory.movement_reason ENABLE ROW LEVEL SECURITY;
-- SEED DATA PARA MOVEMENT REASONS
INSERT INTO
    inventory.movement_reason (name, description)
VALUES (
        'COMPRA',
        'Entrada por factura de proveedor'
    ),
    (
        'VENTA',
        'Salida por despacho al cliente'
    ),
    (
        'PRODUCCION',
        'Salida por consumo en máquina'
    ),
    (
        'MERMA_TECNICA',
        'Desperdicio por inicio de impresión/calibración'
    ),
    (
        'DAÑO_OPERATIVO',
        'Se malogró el material por atascamiento o error humano'
    ),
    (
        'DEVOLUCION',
        'El cliente devolvió o nosotros devolvemos al proveedor'
    ),
    (
        'INVENTARIO_INICIAL',
        'Carga inicial del sistema'
    ),
    (
        'AJUSTE_MANUAL',
        'Corrección manual por auditoría o conteo físico'
    ),
    (
        'TRASLADO',
        'Movimiento entre almacenes o sucursales'
    ),
    (
        'OTRO',
        'Otros motivos no listados'
    );

CREATE TABLE IF NOT EXISTS inventory.roll_tracking (
    id UUID PRIMARY KEY,
    item_id UUID REFERENCES inventory.items (id) NOT NULL,
    roll_code TEXT UNIQUE NOT NULL, -- Codigo que se pegara al rollo fisico
    -- initial_quantity DECIMAL(12, 3) NOT NULL,
    current_quantity DECIMAL(12, 3) NOT NULL,
    status TEXT CHECK (status IN ('full', 'in_use', 'depleted', 'scrapped')) DEFAULT 'full',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.roll_tracking
ADD CONSTRAINT chk_roll_code_length CHECK (
    char_length(roll_code) <= 50
),
ADD CONSTRAINT chk_current_quantity_nonnegative CHECK (current_quantity >= 0);

ALTER TABLE inventory.roll_tracking ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS inventory.kardex (
    id UUID PRIMARY KEY,
    item_id UUID REFERENCES inventory.items (id) NOT NULL,
    roll_id UUID REFERENCES inventory.roll_tracking (id),
    movement_type_id SMALLINT REFERENCES inventory.movement_type (id) NOT NULL,
    movement_reason_id SMALLINT REFERENCES inventory.movement_reason (id) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL, -- Cantidad del movimiento
    previous_balance DECIMAL(12,3) NOT NULL, -- Stock antes
    subsequent_balance DECIMAL(12,3) NOT NULL, -- Stock después
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users (id) -- Quién realizó la acción
);

ALTER TABLE inventory.kardex
ADD CONSTRAINT chk_batch_code_length CHECK (
    roll_id IS NULL
    OR char_length(roll_id::TEXT) <= 50
),
ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
ADD CONSTRAINT chk_previous_balance_nonnegative CHECK (previous_balance >= 0),
ADD CONSTRAINT chk_subsequent_balance_nonnegative CHECK (subsequent_balance >= 0),
ADD CONSTRAINT chk_notes_length CHECK (
    notes IS NULL
    OR char_length(notes) <= 250
);

CREATE INDEX idx_kardex_item_id ON inventory.kardex (item_id);

CREATE INDEX idx_kardex_created_at ON inventory.kardex (created_at);

ALTER TABLE inventory.kardex ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS inventory.consumption_logs (
    id UUID PRIMARY KEY,
    movement_type_id SMALLINT REFERENCES inventory.movement_type (id) NOT NULL,
    movement_reason_id SMALLINT REFERENCES inventory.movement_reason (id) NOT NULL,
    machine_id UUID REFERENCES inventory.machines (id),
    operator_id UUID REFERENCES auth.users (id),
    order_detail_id UUID REFERENCES sales.order_details (id),
    job_name TEXT,
    customer_quantity DECIMAL,
    calibration_waste DECIMAL, -- encendido/limpieza
    error_waste DECIMAL, -- atascos/errores
    width_used_mm INT,
    length_used_mm INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.consumption_logs
ADD CONSTRAINT chk_job_name_length CHECK (
    job_name IS NULL
    OR char_length(job_name) <= 150
),
ADD CONSTRAINT chk_customer_quantity_nonnegative CHECK (
    customer_quantity IS NULL
    OR customer_quantity >= 0
),
ADD CONSTRAINT chk_calibration_waste_nonnegative CHECK (
    calibration_waste IS NULL
    OR calibration_waste >= 0
),
ADD CONSTRAINT chk_error_waste_nonnegative CHECK (
    error_waste IS NULL
    OR error_waste >= 0
),
ADD CONSTRAINT chk_width_used_mm_nonnegative CHECK (
    width_used_mm IS NULL
    OR width_used_mm >= 0
),
ADD CONSTRAINT chk_length_used_mm_nonnegative CHECK (
    length_used_mm IS NULL
    OR length_used_mm >= 0
);

ALTER TABLE inventory.consumption_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS inventory.kardex_consumption (
    id UUID PRIMARY KEY,
    kardex_id UUID REFERENCES inventory.kardex (id) ON DELETE CASCADE,
    consumption_log_id UUID REFERENCES inventory.consumption_logs (id) ON DELETE CASCADE,
    used_quantity DECIMAL(12, 3) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kardex_consumption_kardex_id ON inventory.kardex_consumption (kardex_id);

CREATE INDEX idx_kardex_consumption_log_id ON inventory.kardex_consumption (consumption_log_id);

ALTER TABLE inventory.kardex_consumption
ADD CONSTRAINT chk_used_quantity_positive CHECK (used_quantity > 0),
ADD CONSTRAINT chk_notes_length CHECK (
    notes IS NULL
    OR char_length(notes) <= 250
);

ALTER TABLE inventory.kardex_consumption ENABLE ROW LEVEL SECURITY;



-- ======================================================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ======================================================================
CREATE TRIGGER trg_kardex_set_updated_at
  BEFORE UPDATE ON inventory.kardex
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_consumption_logs_set_updated_at
  BEFORE UPDATE ON inventory.consumption_logs
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_kardex_consumption_set_updated_at
  BEFORE UPDATE ON inventory.kardex_consumption
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_roll_tracking_set_updated_at
  BEFORE UPDATE ON inventory.roll_tracking
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

--- para kardex
DROP POLICY IF EXISTS "authenticated_can_select_movement_reason" ON inventory.movement_reason;
CREATE POLICY "authenticated_can_select_movement_reason" ON inventory.movement_reason FOR
SELECT TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_select_movement_type" ON inventory.movement_type;
CREATE POLICY "authenticated_can_select_movement_type" ON inventory.movement_type FOR
SELECT TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_select_kardex" ON inventory.kardex;
CREATE POLICY "authenticated_can_select_kardex" ON inventory.kardex FOR
SELECT TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_insert_kardex_movement" ON inventory.kardex;
CREATE POLICY "authenticated_can_insert_kardex_movement" ON inventory.kardex FOR INSERT TO authenticated
WITH
    CHECK (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_update_kardex_movement" ON inventory.kardex;
CREATE POLICY "authenticated_can_update_kardex_movement" ON inventory.kardex
FOR UPDATE
    TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    )
WITH
    CHECK (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_select_consumption_logs" ON inventory.consumption_logs;
CREATE POLICY "authenticated_can_select_consumption_logs" ON inventory.consumption_logs FOR
SELECT TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_insert_consumption_logs" ON inventory.consumption_logs;
CREATE POLICY "authenticated_can_insert_consumption_logs" ON inventory.consumption_logs FOR INSERT TO authenticated
WITH
    CHECK (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_update_consumption_logs" ON inventory.consumption_logs;
CREATE POLICY "authenticated_can_update_consumption_logs" ON inventory.consumption_logs
FOR UPDATE
    TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    )
WITH
    CHECK (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_select_kardex_consumption" ON inventory.kardex_consumption;
CREATE POLICY "authenticated_can_select_kardex_consumption" ON inventory.kardex_consumption FOR
SELECT TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_insert_kardex_consumption" ON inventory.kardex_consumption;
CREATE POLICY "authenticated_can_insert_kardex_consumption" ON inventory.kardex_consumption FOR INSERT TO authenticated
WITH
    CHECK (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_update_kardex_consumption" ON inventory.kardex_consumption;
CREATE POLICY "authenticated_can_update_kardex_consumption" ON inventory.kardex_consumption
FOR UPDATE
    TO authenticated USING (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    )
WITH
    CHECK (
        auth_management.is_universal_manager (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_select_roll_tracking" ON inventory.roll_tracking;
CREATE POLICY "authenticated_can_select_roll_tracking" ON inventory.roll_tracking FOR
SELECT TO authenticated USING  (
    auth_management.is_employee (
        (
            SELECT auth.uid ()
        )
    )
);

DROP POLICY IF EXISTS "authenticated_can_insert_roll_tracking" ON inventory.roll_tracking;
CREATE POLICY "authenticated_can_insert_roll_tracking" ON inventory.roll_tracking FOR INSERT TO authenticated 
WITH
    CHECK (
        auth_management.is_employee (
            (
                SELECT auth.uid ()
            )
        )
    );

DROP POLICY IF EXISTS "authenticated_can_update_roll_tracking" ON inventory.roll_tracking;
CREATE POLICY "authenticated_can_update_roll_tracking" ON inventory.roll_tracking
FOR UPDATE TO authenticated USING  (
    auth_management.is_employee (
        (
            SELECT auth.uid ()
        )
    )
)
WITH
    CHECK (
        auth_management.is_employee (
            (
                SELECT auth.uid ()
            )
        )
    );

-- ######################################################################
-- RPC Y FUNCIONES ADICIONALES PARA KARDEX
-- ######################################################################
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
  SELECT length_m INTO quantity_initial
  FROM inventory.items
  WHERE id = p_item_id;

  -- 1. Crear rollo
  INSERT INTO inventory.roll_tracking (id, item_id, roll_code, current_quantity, status)
  VALUES (p_roll_tracking_id, p_item_id, p_roll_code, quantity_initial, 'full')
  RETURNING id INTO v_roll_id;

  -- 2. Registrar en kardex
  INSERT INTO inventory.kardex (
    id, item_id, roll_id, movement_type_id, movement_reason_id,
    quantity, previous_balance, subsequent_balance
  )
  VALUES (
    p_kardex_id, p_item_id, v_roll_id,
    1, -- ENTRADA
    1, -- COMPRA
    quantity_initial, 0, quantity_initial
  )
  RETURNING id INTO v_kardex_id;

  RETURN json_build_object('rollId', v_roll_id, 'kardexId', v_kardex_id);
END;
$$ LANGUAGE plpgsql;












-- CREATE TABLE IF NOT EXISTS inventory.roll_tracking (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   item_id UUID REFERENCES inventory.items(id) NOT NULL,
--   roll_number TEXT NOT NULL,
--   initial_length_m DECIMAL(8,2) NOT NULL,
--   current_length_m DECIMAL(8,2) NOT NULL,
--   status TEXT CHECK (status IN ('full', 'partial', 'empty', 'scrapped')),
--   received_date DATE DEFAULT CURRENT_DATE,
--   expiration_date DATE,
--   notes TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE INDEX idx_roll_tracking_item_id ON inventory.roll_tracking(item_id);
-- CREATE INDEX idx_roll_tracking_status ON inventory.roll_tracking(status);

-- ######################################################################
-- FUNCIONES Y TRIGGERS ÚTILES PARA KARDEX
-- ######################################################################

-- ======================================================================
-- 1. FUNCIÓN PARA OBTENER STOCK ACTUAL DE UN ITEM
-- ======================================================================
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

-- Uso:
-- SELECT inventory.get_current_stock('019abc...');

-- ======================================================================
-- 2. FUNCIÓN PARA OBTENER STOCK ACTUAL DE TODOS LOS ITEMS
-- ======================================================================
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
    COALESCE(lk.subsequent_balance, 0) as current_balance,
    i.unit_type,
    lk.created_at
  FROM inventory.items i
  LEFT JOIN latest_kardex lk ON i.id = lk.item_id
  WHERE i.is_active = true
  ORDER BY i.name;
END;
$$ LANGUAGE plpgsql;

-- Uso desde Supabase:
-- const { data } = await supabase.rpc('get_current_stock')

-- ======================================================================
-- 3. TRIGGER PARA ACTUALIZAR KARDEX EN VENTAS (OPCIÓN 1)
-- ======================================================================
CREATE OR REPLACE FUNCTION inventory.update_kardex_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Obtener balance actual
  SELECT COALESCE(inventory.get_current_stock(NEW.item_id), 0)
  INTO v_current_balance;
  
  -- Calcular nuevo balance
  v_new_balance := v_current_balance - NEW.quantity;
  
  -- Validar que hay stock suficiente
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para item_id: %', NEW.item_id;
  END IF;
  
  -- Registrar movimiento en kardex
  INSERT INTO inventory.kardex (
    id,
    item_id,
    movement_type_id,
    movement_reason_id,
    quantity,
    previous_balance,
    subsequent_balance,
    unit_cost_at_moment,
    order_detail_id,
    notes,
    created_by
  ) VALUES (
    gen_random_uuid(),
    NEW.item_id,
    2, -- SALIDA
    2, -- VENTA
    NEW.quantity,
    v_current_balance,
    v_new_balance,
    NEW.unit_price, -- Asumiendo que ticket_items tiene unit_price
    NEW.ticket_id,
    'Venta automática desde POS',
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger (ajustar nombre de tabla según tu esquema)
CREATE TRIGGER trg_kardex_on_sale
  AFTER INSERT ON sales.ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION inventory.update_kardex_on_sale();

-- ======================================================================
-- 4. FUNCIÓN PARA VALIDAR STOCK ANTES DE VENTA
-- ======================================================================
CREATE OR REPLACE FUNCTION inventory.validate_stock(
  p_item_id UUID,
  p_quantity NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  v_current_balance := inventory.get_current_stock(p_item_id);
  RETURN v_current_balance >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Uso desde TypeScript:
-- const { data } = await supabase.rpc('validate_stock', {
--   p_item_id: '019abc...',
--   p_quantity: 10
-- })

-- ======================================================================
-- 5. FUNCIÓN PARA OBTENER ITEMS CON STOCK BAJO
-- ======================================================================
CREATE OR REPLACE FUNCTION inventory.get_low_stock_items(
  p_threshold NUMERIC DEFAULT 10
)
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  item_sku TEXT,
  current_balance NUMERIC,
  unit_type TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH current_stocks AS (
    SELECT * FROM inventory.get_current_stock()
  )
  SELECT
    cs.item_id,
    cs.item_name,
    cs.item_sku,
    cs.current_balance,
    cs.unit_type,
    CASE
      WHEN cs.current_balance = 0 THEN 'critical'
      WHEN cs.current_balance <= p_threshold THEN 'low'
      ELSE 'ok'
    END as status
  FROM current_stocks cs
  WHERE cs.current_balance <= p_threshold
  ORDER BY cs.current_balance ASC;
END;
$$ LANGUAGE plpgsql;

-- Uso:
-- SELECT * FROM inventory.get_low_stock_items(10);

-- ======================================================================
-- 6. FUNCIÓN PARA REPORTE DE KARDEX
-- ======================================================================
CREATE OR REPLACE FUNCTION inventory.generate_kardex_report(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_item_id UUID DEFAULT NULL
)
RETURNS TABLE (
  item_name TEXT,
  item_sku TEXT,
  total_entries NUMERIC,
  total_exits NUMERIC,
  total_adjustments NUMERIC,
  balance_start NUMERIC,
  balance_end NUMERIC,
  total_entry_cost NUMERIC,
  total_exit_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.name as item_name,
    i.sku as item_sku,
    SUM(CASE WHEN k.movement_type_id = 1 THEN k.quantity ELSE 0 END) as total_entries,
    SUM(CASE WHEN k.movement_type_id = 2 THEN k.quantity ELSE 0 END) as total_exits,
    SUM(CASE WHEN k.movement_type_id = 3 THEN k.quantity ELSE 0 END) as total_adjustments,
    (
      SELECT COALESCE(previous_balance, 0)
      FROM inventory.kardex
      WHERE item_id = i.id AND created_at >= p_start_date
      ORDER BY created_at ASC
      LIMIT 1
    ) as balance_start,
    (
      SELECT COALESCE(subsequent_balance, 0)
      FROM inventory.kardex
      WHERE item_id = i.id AND created_at <= p_end_date
      ORDER BY created_at DESC
      LIMIT 1
    ) as balance_end,
    SUM(CASE 
      WHEN k.movement_type_id = 1 
      THEN k.quantity * COALESCE(k.unit_cost_at_moment, 0) 
      ELSE 0 
    END) as total_entry_cost,
    SUM(CASE 
      WHEN k.movement_type_id = 2 
      THEN k.quantity * COALESCE(k.unit_cost_at_moment, 0) 
      ELSE 0 
    END) as total_exit_cost
  FROM inventory.items i
  LEFT JOIN inventory.kardex k ON k.item_id = i.id
    AND k.created_at BETWEEN p_start_date AND p_end_date
  WHERE i.is_active = true
    AND (p_item_id IS NULL OR i.id = p_item_id)
  GROUP BY i.id, i.name, i.sku
  HAVING COUNT(k.id) > 0
  ORDER BY i.name;
END;
$$ LANGUAGE plpgsql;

-- Uso:
-- SELECT * FROM inventory.generate_kardex_report(
--   '2024-01-01'::timestamptz,
--   '2024-12-31'::timestamptz
-- );

-- ======================================================================
-- 7. FUNCIÓN PARA CALCULAR COSTO DE MERCANCÍA VENDIDA (COGS)
-- ======================================================================
CREATE OR REPLACE FUNCTION inventory.calculate_cogs(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
  v_cogs NUMERIC;
BEGIN
  SELECT COALESCE(SUM(k.quantity * k.unit_cost_at_moment), 0)
  INTO v_cogs
  FROM inventory.kardex k
  WHERE k.movement_type_id = 2 -- SALIDA
    AND k.movement_reason_id = 2 -- VENTA
    AND k.created_at BETWEEN p_start_date AND p_end_date;
  
  RETURN v_cogs;
END;
$$ LANGUAGE plpgsql;

-- Uso:
-- SELECT inventory.calculate_cogs(
--   '2024-01-01'::timestamptz,
--   NOW()
-- );

-- ======================================================================
-- 8. FUNCIÓN PARA VALORIZACIÓN DE INVENTARIO
-- ======================================================================
CREATE OR REPLACE FUNCTION inventory.calculate_inventory_value()
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  item_sku TEXT,
  current_balance NUMERIC,
  last_unit_cost NUMERIC,
  total_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH current_stocks AS (
    SELECT * FROM inventory.get_current_stock()
  ),
  last_costs AS (
    SELECT DISTINCT ON (item_id)
      item_id,
      unit_cost_at_moment
    FROM inventory.kardex
    WHERE unit_cost_at_moment IS NOT NULL
    ORDER BY item_id, created_at DESC
  )
  SELECT
    cs.item_id,
    cs.item_name,
    cs.item_sku,
    cs.current_balance,
    COALESCE(lc.unit_cost_at_moment, 0) as last_unit_cost,
    cs.current_balance * COALESCE(lc.unit_cost_at_moment, 0) as total_value
  FROM current_stocks cs
  LEFT JOIN last_costs lc ON cs.item_id = lc.item_id
  WHERE cs.current_balance > 0
  ORDER BY total_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Uso:
-- SELECT * FROM inventory.calculate_inventory_value();

-- ======================================================================
-- 9. VISTA MATERIALIZADA PARA STOCK ACTUAL (PERFORMANCE)
-- ======================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory.mv_current_stock AS
SELECT *
FROM inventory.get_current_stock ();

-- Crear índice para búsquedas rápidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_current_stock_item_id ON inventory.mv_current_stock (item_id);

-- Función para refrescar la vista
CREATE OR REPLACE FUNCTION inventory.refresh_current_stock()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY inventory.mv_current_stock;
END;
$$ LANGUAGE plpgsql;

-- Trigger para refrescar después de insertar en kardex
CREATE OR REPLACE FUNCTION inventory.trigger_refresh_stock()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM inventory.refresh_current_stock();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_stock_on_kardex
  AFTER INSERT ON inventory.kardex
  FOR EACH STATEMENT
  EXECUTE FUNCTION inventory.trigger_refresh_stock();

-- ======================================================================
-- 10. POLÍTICAS RLS PARA KARDEX
-- ======================================================================

-- Permitir SELECT a usuarios autenticados
DROP POLICY IF EXISTS "authenticated_can_select_kardex" ON inventory.kardex;

CREATE POLICY "authenticated_can_select_kardex" ON inventory.kardex FOR
SELECT TO authenticated USING (true);

-- Permitir INSERT solo a usuarios autenticados de la misma tienda
DROP POLICY IF EXISTS "authenticated_can_insert_kardex" ON inventory.kardex;

CREATE POLICY "authenticated_can_insert_kardex" ON inventory.kardex FOR INSERT TO authenticated
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM inventory.items i
            WHERE
                i.id = kardex.item_id
        )
    );

-- Políticas para movement_type y movement_reason (solo lectura)
DROP POLICY IF EXISTS "authenticated_can_select_movement_type" ON inventory.movement_type;

CREATE POLICY "authenticated_can_select_movement_type" ON inventory.movement_type FOR
SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_can_select_movement_reason" ON inventory.movement_reason;

CREATE POLICY "authenticated_can_select_movement_reason" ON inventory.movement_reason FOR
SELECT TO authenticated USING (true);

-- ======================================================================
-- EJEMPLOS DE USO DESDE TYPESCRIPT
-- ======================================================================

/*
// 1. Obtener stock actual de todos los items
const { data, error } = await supabaseClient
.rpc('get_current_stock');

// 2. Validar stock antes de venta
const { data: hasStock } = await supabaseClient
.rpc('validate_stock', {
p_item_id: itemId,
p_quantity: quantity
});

// 3. Obtener items con stock bajo
const { data: lowStockItems } = await supabaseClient
.rpc('get_low_stock_items', { p_threshold: 10 });

// 4. Generar reporte de kardex
const { data: report } = await supabaseClient
.rpc('generate_kardex_report', {
p_start_date: '2024-01-01T00:00:00Z',
p_end_date: '2024-12-31T23:59:59Z'
});

// 5. Calcular COGS del mes
const { data: cogs } = await supabaseClient
.rpc('calculate_cogs', {
p_start_date: '2024-01-01T00:00:00Z',
p_end_date: '2024-01-31T23:59:59Z'
});

// 6. Valorización de inventario
const { data: valuation } = await supabaseClient
.rpc('calculate_inventory_value');
*/