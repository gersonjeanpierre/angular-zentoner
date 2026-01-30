-- ###################################################################
-- # MEJORAS AL MÓDULO DE CAJA
-- # - Gastos de caja chica
-- # - Mejoras a funciones RPC existentes
-- # - Nueva función para dashboard con sumatorias
-- # - Validación multi-shop
-- ###################################################################

-- =====================================================================
-- Tabla: Gastos de Caja Chica
-- =====================================================================
CREATE TABLE IF NOT EXISTS sales.cash_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_session_id UUID NOT NULL REFERENCES sales.cash_register_sessions(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES core.shops(id),
  
  -- Información del gasto
  amount NUMERIC(15,4) NOT NULL,
  category TEXT NOT NULL,  -- OPERATIVO, ADMINISTRATIVO, MANTENIMIENTO, COMPRAS_MENORES, OTRO
  description TEXT NOT NULL,
  
  -- Metadata
  receipt_number TEXT,
  notes TEXT,
  
  -- Auditoría
  authorized_by_id UUID REFERENCES hr.employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales.cash_expenses
  ADD CONSTRAINT chk_expense_amount CHECK (amount > 0),
  ADD CONSTRAINT chk_expense_category CHECK (
    category IN ('OPERATIVO', 'ADMINISTRATIVO', 'MANTENIMIENTO', 'COMPRAS_MENORES', 'OTRO')
  ),
  ADD CONSTRAINT chk_expense_description CHECK (
    description IS NOT NULL AND char_length(description) BETWEEN 5 AND 200
  ),
  ADD CONSTRAINT chk_receipt_number CHECK (
    receipt_number IS NULL OR char_length(receipt_number) <= 50
  ),
  ADD CONSTRAINT chk_expense_notes CHECK (
    notes IS NULL OR char_length(notes) <= 500
  );

CREATE INDEX idx_cash_expenses_session ON sales.cash_expenses (cash_register_session_id);
CREATE INDEX idx_cash_expenses_shop ON sales.cash_expenses (shop_id);
CREATE INDEX idx_cash_expenses_date ON sales.cash_expenses (created_at);
CREATE INDEX idx_cash_expenses_category ON sales.cash_expenses (category);

CREATE TRIGGER trg_update_cash_expenses_timestamp
  BEFORE UPDATE ON sales.cash_expenses
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE sales.cash_expenses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE sales.cash_expenses IS 'Registro de gastos de caja chica durante sesiones de caja';
COMMENT ON COLUMN sales.cash_expenses.category IS 'Categoría del gasto: OPERATIVO, ADMINISTRATIVO, MANTENIMIENTO, COMPRAS_MENORES, OTRO';
COMMENT ON COLUMN sales.cash_expenses.amount IS 'Monto del gasto en efectivo';

-- =====================================================================
-- Función Mejorada: Abrir sesión de caja con validación multi-shop
-- =====================================================================
CREATE OR REPLACE FUNCTION sales.open_cash_register_session(
  p_shop_id UUID,
  p_cashier_id UUID,
  p_opening_balance NUMERIC DEFAULT 0,
  p_session_type TEXT DEFAULT 'PARCIAL',
  p_opening_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_open_sessions INT;
  v_shop_exists BOOLEAN;
BEGIN
  -- Validar que la tienda existe
  SELECT EXISTS (SELECT 1 FROM core.shops WHERE id = p_shop_id) INTO v_shop_exists;
  
  IF NOT v_shop_exists THEN
    RAISE EXCEPTION 'La tienda especificada no existe: %', p_shop_id;
  END IF;
  
  -- Validar que no haya sesiones abiertas para este cajero en esta tienda
  SELECT COUNT(*) INTO v_open_sessions
  FROM sales.cash_register_sessions
  WHERE cashier_id = p_cashier_id 
    AND shop_id = p_shop_id
    AND status = 'ABIERTO';
  
  IF v_open_sessions > 0 THEN
    RAISE EXCEPTION 'El cajero ya tiene una sesión abierta en esta tienda';
  END IF;
  
  -- Validar tipo de sesión
  IF p_session_type NOT IN ('PARCIAL', 'FINAL') THEN
    RAISE EXCEPTION 'Tipo de sesión inválido: %. Debe ser PARCIAL o FINAL', p_session_type;
  END IF;
  
  -- Validar balance inicial
  IF p_opening_balance < 0 THEN
    RAISE EXCEPTION 'El balance inicial no puede ser negativo';
  END IF;
  
  -- Crear la sesión
  INSERT INTO sales.cash_register_sessions (
    id, shop_id, cashier_id, session_type, opening_balance, opening_notes, status
  ) VALUES (
    gen_random_uuid(), p_shop_id, p_cashier_id, p_session_type, p_opening_balance, p_opening_notes, 'ABIERTO'
  ) RETURNING id INTO v_session_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'session_id', v_session_id,
    'shop_id', p_shop_id,
    'opened_at', NOW(),
    'opening_balance', p_opening_balance,
    'session_type', p_session_type
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al abrir sesión de caja: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION sales.open_cash_register_session IS 'Abre una nueva sesión de caja con validación multi-shop';

-- =====================================================================
-- Función Mejorada: Cerrar sesión de caja con gastos incluidos
-- =====================================================================
CREATE OR REPLACE FUNCTION sales.close_cash_register_session(
  p_session_id UUID,
  p_closing_balance NUMERIC,
  p_closing_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_cash_total NUMERIC := 0;
  v_card_total NUMERIC := 0;
  v_transfer_total NUMERIC := 0;
  v_digital_wallet_total NUMERIC := 0;
  v_other_total NUMERIC := 0;
  v_expected_balance NUMERIC;
  v_difference NUMERIC;
  v_total_payments INT;
  v_total_orders INT;
  v_total_expenses NUMERIC := 0;
BEGIN
  -- Obtener la sesión
  SELECT * INTO v_session 
  FROM sales.cash_register_sessions 
  WHERE id = p_session_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión de caja no encontrada: %', p_session_id;
  END IF;
  
  IF v_session.status = 'CERRADO' THEN
    RAISE EXCEPTION 'La sesión ya está cerrada';
  END IF;
  
  -- Calcular totales por método de pago
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'EFECTIVO' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('TARJETA_DEBITO', 'TARJETA_CREDITO') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('TRANSFERENCIA', 'DEPOSITO') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('YAPE', 'PLIN') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('DOLARES', 'OTRO') THEN amount ELSE 0 END), 0),
    COUNT(*)
  INTO 
    v_cash_total, v_card_total, v_transfer_total, v_digital_wallet_total, v_other_total, v_total_payments
  FROM sales.payments
  WHERE cash_register_session_id = p_session_id
    AND deleted_at IS NULL;
  
  -- Calcular total de gastos de caja chica
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM sales.cash_expenses
  WHERE cash_register_session_id = p_session_id;
  
  -- Calcular balance esperado (balance inicial + efectivo recibido - gastos)
  v_expected_balance := v_session.opening_balance + v_cash_total - v_total_expenses;
  v_difference := p_closing_balance - v_expected_balance;
  
  -- Contar órdenes asociadas (órdenes que tienen pagos en esta sesión)
  SELECT COUNT(DISTINCT order_id) INTO v_total_orders
  FROM sales.payments
  WHERE cash_register_session_id = p_session_id
    AND deleted_at IS NULL;
  
  -- Actualizar la sesión
  UPDATE sales.cash_register_sessions
  SET 
    status = 'CERRADO',
    closed_at = NOW(),
    closing_balance = p_closing_balance,
    expected_balance = v_expected_balance,
    difference = v_difference,
    cash_total = v_cash_total,
    card_total = v_card_total,
    transfer_total = v_transfer_total,
    digital_wallet_total = v_digital_wallet_total,
    other_total = v_other_total,
    total_orders = v_total_orders,
    total_payments = v_total_payments,
    closing_notes = p_closing_notes,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'session_id', p_session_id,
    'shop_id', v_session.shop_id,
    'closed_at', NOW(),
    'opening_balance', v_session.opening_balance,
    'closing_balance', p_closing_balance,
    'expected_balance', v_expected_balance,
    'difference', v_difference,
    'cash_total', v_cash_total,
    'card_total', v_card_total,
    'transfer_total', v_transfer_total,
    'digital_wallet_total', v_digital_wallet_total,
    'other_total', v_other_total,
    'total_expenses', v_total_expenses,
    'total_payments', v_total_payments,
    'total_orders', v_total_orders
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al cerrar sesión de caja: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION sales.close_cash_register_session IS 'Cierra una sesión de caja incluyendo gastos de caja chica en el cálculo';

-- =====================================================================
-- Función: Registrar gasto de caja chica
-- =====================================================================
CREATE OR REPLACE FUNCTION sales.register_cash_expense(
  p_cash_register_session_id UUID,
  p_amount NUMERIC,
  p_category TEXT,
  p_description TEXT,
  p_receipt_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_authorized_by_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expense_id UUID;
  v_session RECORD;
  v_total_expenses NUMERIC;
  v_available_cash NUMERIC;
BEGIN
  -- Validar que la sesión existe y está abierta
  SELECT * INTO v_session
  FROM sales.cash_register_sessions
  WHERE id = p_cash_register_session_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión de caja no encontrada: %', p_cash_register_session_id;
  END IF;
  
  IF v_session.status != 'ABIERTO' THEN
    RAISE EXCEPTION 'La sesión está cerrada, no se pueden registrar gastos';
  END IF;
  
  -- Validar categoría
  IF p_category NOT IN ('OPERATIVO', 'ADMINISTRATIVO', 'MANTENIMIENTO', 'COMPRAS_MENORES', 'OTRO') THEN
    RAISE EXCEPTION 'Categoría de gasto inválida: %', p_category;
  END IF;
  
  -- Validar monto
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del gasto debe ser mayor a 0';
  END IF;
  
  -- Calcular efectivo disponible (balance inicial + efectivo recibido - gastos existentes)
  SELECT 
    v_session.opening_balance + COALESCE(SUM(CASE WHEN pm.payment_method = 'EFECTIVO' THEN pm.amount ELSE 0 END), 0)
    - COALESCE((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = p_cash_register_session_id), 0)
  INTO v_available_cash
  FROM sales.payments pm
  WHERE pm.cash_register_session_id = p_cash_register_session_id
    AND pm.deleted_at IS NULL;
  
  -- Validar que hay suficiente efectivo
  IF p_amount > v_available_cash THEN
    RAISE EXCEPTION 'Efectivo insuficiente. Disponible: %, Solicitado: %', v_available_cash, p_amount;
  END IF;
  
  -- Insertar el gasto
  INSERT INTO sales.cash_expenses (
    id, cash_register_session_id, shop_id, amount, category, description,
    receipt_number, notes, authorized_by_id
  ) VALUES (
    gen_random_uuid(), p_cash_register_session_id, v_session.shop_id, p_amount, p_category, p_description,
    p_receipt_number, p_notes, p_authorized_by_id
  ) RETURNING id INTO v_expense_id;
  
  -- Calcular total de gastos
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM sales.cash_expenses
  WHERE cash_register_session_id = p_cash_register_session_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'expense_id', v_expense_id,
    'amount', p_amount,
    'category', p_category,
    'total_expenses', v_total_expenses,
    'available_cash', v_available_cash - p_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al registrar gasto de caja chica: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION sales.register_cash_expense IS 'Registra un gasto de caja chica validando disponibilidad de efectivo';

-- =====================================================================
-- Función: Obtener historial de gastos de una sesión
-- =====================================================================
DROP FUNCTION IF EXISTS sales.get_session_expenses(UUID) CASCADE;
CREATE OR REPLACE FUNCTION sales.get_session_expenses(
  p_session_id UUID
)
RETURNS TABLE (
  expense_id UUID,
  amount NUMERIC,
  category TEXT,
  description TEXT,
  receipt_number TEXT,
  notes TEXT,
  authorized_by_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.amount,
    e.category,
    e.description,
    e.receipt_number,
    e.notes,
    COALESCE(p.first_name || ' ' || p.last_name, 'Sin autorizar') AS authorized_by_name,
    e.created_at
  FROM sales.cash_expenses e
  LEFT JOIN hr.employees emp ON e.authorized_by_id = emp.id
  LEFT JOIN core.persons p ON emp.id = p.id
  WHERE e.cash_register_session_id = p_session_id
  ORDER BY e.created_at DESC;
END;
$$;

COMMENT ON FUNCTION sales.get_session_expenses IS 'Obtiene el historial de gastos de caja chica de una sesión';

-- =====================================================================
-- Función: Obtener dashboard completo de sesión de caja
-- =====================================================================
CREATE OR REPLACE FUNCTION sales.get_session_dashboard(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_payment_summary JSONB;
  v_expense_summary JSONB;
  v_order_stats JSONB;
  v_cash_flow JSONB;
  v_result JSON;
BEGIN
  -- Obtener información de la sesión
  SELECT * INTO v_session
  FROM sales.cash_register_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión de caja no encontrada: %', p_session_id;
  END IF;
  
  -- Resumen de pagos por método
  SELECT jsonb_build_object(
    'efectivo', COALESCE(SUM(CASE WHEN payment_method = 'EFECTIVO' THEN amount ELSE 0 END), 0),
    'tarjeta_debito', COALESCE(SUM(CASE WHEN payment_method = 'TARJETA_DEBITO' THEN amount ELSE 0 END), 0),
    'tarjeta_credito', COALESCE(SUM(CASE WHEN payment_method = 'TARJETA_CREDITO' THEN amount ELSE 0 END), 0),
    'transferencia', COALESCE(SUM(CASE WHEN payment_method = 'TRANSFERENCIA' THEN amount ELSE 0 END), 0),
    'deposito', COALESCE(SUM(CASE WHEN payment_method = 'DEPOSITO' THEN amount ELSE 0 END), 0),
    'yape', COALESCE(SUM(CASE WHEN payment_method = 'YAPE' THEN amount ELSE 0 END), 0),
    'plin', COALESCE(SUM(CASE WHEN payment_method = 'PLIN' THEN amount ELSE 0 END), 0),
    'dolares', COALESCE(SUM(CASE WHEN payment_method = 'DOLARES' THEN amount ELSE 0 END), 0),
    'otro', COALESCE(SUM(CASE WHEN payment_method = 'OTRO' THEN amount ELSE 0 END), 0),
    'total_payments', COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0)
  ) INTO v_payment_summary
  FROM sales.payments
  WHERE cash_register_session_id = p_session_id
    AND deleted_at IS NULL;
  
  -- Resumen de gastos por categoría
  SELECT jsonb_build_object(
    'operativo', COALESCE(SUM(CASE WHEN category = 'OPERATIVO' THEN amount ELSE 0 END), 0),
    'administrativo', COALESCE(SUM(CASE WHEN category = 'ADMINISTRATIVO' THEN amount ELSE 0 END), 0),
    'mantenimiento', COALESCE(SUM(CASE WHEN category = 'MANTENIMIENTO' THEN amount ELSE 0 END), 0),
    'compras_menores', COALESCE(SUM(CASE WHEN category = 'COMPRAS_MENORES' THEN amount ELSE 0 END), 0),
    'otro', COALESCE(SUM(CASE WHEN category = 'OTRO' THEN amount ELSE 0 END), 0),
    'total_expenses', COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0)
  ) INTO v_expense_summary
  FROM sales.cash_expenses
  WHERE cash_register_session_id = p_session_id;
  
  -- Estadísticas de órdenes
  SELECT jsonb_build_object(
    'total_orders', COUNT(DISTINCT p.order_id),
    'pendiente', COUNT(DISTINCT CASE WHEN o.payment_status = 'PENDIENTE' THEN p.order_id END),
    'parcial', COUNT(DISTINCT CASE WHEN o.payment_status = 'PARCIAL' THEN p.order_id END),
    'pagado', COUNT(DISTINCT CASE WHEN o.payment_status = 'PAGADO' THEN p.order_id END),
    'total_sales', COALESCE(SUM(DISTINCT o.final_amount), 0),
    'total_collected', COALESCE(SUM(p.amount), 0)
  ) INTO v_order_stats
  FROM sales.payments p
  LEFT JOIN sales.orders o ON p.order_id = o.id
  WHERE p.cash_register_session_id = p_session_id
    AND p.deleted_at IS NULL;
  
  -- Flujo de efectivo
  v_cash_flow := jsonb_build_object(
    'opening_balance', v_session.opening_balance,
    'cash_in', COALESCE((v_payment_summary->>'efectivo')::NUMERIC, 0),
    'cash_out', COALESCE((v_expense_summary->>'total_amount')::NUMERIC, 0),
    'expected_balance', v_session.opening_balance + 
                        COALESCE((v_payment_summary->>'efectivo')::NUMERIC, 0) - 
                        COALESCE((v_expense_summary->>'total_amount')::NUMERIC, 0),
    'current_cash', v_session.opening_balance + 
                    COALESCE((v_payment_summary->>'efectivo')::NUMERIC, 0) - 
                    COALESCE((v_expense_summary->>'total_amount')::NUMERIC, 0)
  );
  
  -- Construir resultado final
  v_result := json_build_object(
    'session', row_to_json(v_session),
    'payment_summary', v_payment_summary,
    'expense_summary', v_expense_summary,
    'order_stats', v_order_stats,
    'cash_flow', v_cash_flow,
    'session_duration_minutes', EXTRACT(EPOCH FROM (COALESCE(v_session.closed_at, NOW()) - v_session.opened_at)) / 60
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al obtener dashboard de sesión: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION sales.get_session_dashboard IS 'Obtiene un dashboard completo con todas las métricas de una sesión de caja';

-- =====================================================================
-- Función: Obtener resumen mejorado (alias para compatibilidad)
-- =====================================================================
CREATE OR REPLACE FUNCTION sales.get_session_summary(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN sales.get_session_dashboard(p_session_id);
END;
$$;

COMMENT ON FUNCTION sales.get_session_summary IS 'Alias de get_session_dashboard para compatibilidad con código existente';

-- =====================================================================
-- Índices adicionales para mejorar performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_payments_session_method ON sales.payments (cash_register_session_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_session_not_deleted ON sales.payments (cash_register_session_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shop_payment_status ON sales.orders (shop_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON sales.orders (shop_id, created_at);

-- =====================================================================
-- Vistas útiles
-- =====================================================================

-- Vista: Sesiones activas por tienda
CREATE OR REPLACE VIEW sales.active_sessions_by_shop AS
SELECT 
  s.id AS session_id,
  s.shop_id,
  sh.name AS shop_name,
  s.cashier_id,
  COALESCE(p.first_name || ' ' || p.last_name, 'Sin nombre') AS cashier_name,
  s.session_number,
  s.session_type,
  s.opened_at,
  s.opening_balance,
  EXTRACT(EPOCH FROM (NOW() - s.opened_at)) / 3600 AS hours_open,
  s.total_orders,
  s.total_payments
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.id
LEFT JOIN hr.employees e ON s.cashier_id = e.id
LEFT JOIN core.persons p ON e.id = p.id
WHERE s.status = 'ABIERTO'
ORDER BY s.opened_at DESC;

COMMENT ON VIEW sales.active_sessions_by_shop IS 'Vista de sesiones activas con información de tienda y cajero';

-- =====================================================================
-- Permisos (ajustar según roles del sistema)
-- =====================================================================

-- GRANT EXECUTE ON FUNCTION sales.register_cash_expense TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.get_session_expenses TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.get_session_dashboard TO authenticated;
-- GRANT SELECT ON sales.cash_expenses TO authenticated;
-- GRANT INSERT ON sales.cash_expenses TO authenticated;

COMMENT ON SCHEMA sales IS 'Esquema de ventas, caja y pagos con soporte multi-tienda';
