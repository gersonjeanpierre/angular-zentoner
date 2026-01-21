-- ######################################################################
-- # MIGRACIÓN: Sistema POS con Pagos Parciales
-- # Versión: 1.0
-- # Fecha: 2026-01-20
-- # Descripción: Actualiza el sistema de ventas para soportar pagos
-- #              parciales, cortes de caja y tracking completo
-- ######################################################################

-- IMPORTANTE: Ejecutar este script en un entorno de prueba primero
-- IMPORTANTE: Hacer backup de la base de datos antes de ejecutar

BEGIN;

-- ======================================================================
-- PASO 1: Verificar que las tablas existen
-- ======================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sales' AND table_name = 'orders') THEN
    RAISE EXCEPTION 'La tabla sales.orders no existe. Ejecute primero 05_SALES.sql';
  END IF;
END $$;

-- ======================================================================
-- PASO 2: Agregar nuevas columnas a sales.orders (si no existen)
-- ======================================================================

-- Eliminar columnas antiguas que serán reemplazadas
ALTER TABLE sales.orders DROP COLUMN IF EXISTS method_of_payment CASCADE;
ALTER TABLE sales.orders DROP COLUMN IF EXISTS total_amount CASCADE;
ALTER TABLE sales.orders DROP COLUMN IF EXISTS tax_amount CASCADE;

-- Agregar nuevas columnas
ALTER TABLE sales.orders 
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igv NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS fully_paid_at TIMESTAMPTZ;
ALTER TABLE sales.orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales.orders
  ADD COLUMN IF NOT EXISTS status_id SMALLINT REFERENCES sales.order_status(id);

-- Actualizar constraints
ALTER TABLE sales.orders DROP CONSTRAINT IF EXISTS chk_total_amount;
ALTER TABLE sales.orders DROP CONSTRAINT IF EXISTS chk_tax_amount;
ALTER TABLE sales.orders DROP CONSTRAINT IF EXISTS chk_method_of_payment;

ALTER TABLE sales.orders
  ADD CONSTRAINT chk_total_price CHECK (total_price >= 0),
  ADD CONSTRAINT chk_discount CHECK (discount >= 0 AND discount <= total_price),
  ADD CONSTRAINT chk_igv CHECK (igv >= 0),
  ADD CONSTRAINT chk_final_amount CHECK (final_amount >= 0),
  ADD CONSTRAINT chk_advance CHECK (advance >= 0 AND advance <= final_amount),
  ADD CONSTRAINT chk_remaining_balance CHECK (remaining_balance >= 0),
  ADD CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDIENTE', 'PARCIAL', 'PAGADO'));

-- ======================================================================
-- PASO 3: Crear nuevos índices
-- ======================================================================

DROP INDEX IF EXISTS sales.idx_orders_payment_status;
DROP INDEX IF EXISTS sales.idx_orders_customer_status;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status 
ON sales.orders (payment_status) 
WHERE payment_status != 'PAGADO';

CREATE INDEX IF NOT EXISTS idx_orders_customer_status 
ON sales.orders (customer_id, payment_status);

-- ======================================================================
-- PASO 4: Crear tabla sales.payments
-- ======================================================================

CREATE TABLE IF NOT EXISTS sales.payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
  cash_register_session_id UUID,  -- FK se agregará después
  
  amount NUMERIC(15,4) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  transaction_reference TEXT,
  notes TEXT,
  
  received_by_id UUID REFERENCES hr.employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE sales.payments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE sales.payments
  ADD CONSTRAINT hk_payment_amount CHECK (amount > 0),
  ADD CONSTRAINT hk_payment_method CHECK (
    payment_method IN ('EFECTIVO','YAPE','TARJETA_DEBITO','TARJETA_CREDITO','TRANSFERENCIA','DEPOSITO','DOLARES','OTRO')
  ),
  ADD CONSTRAINT hk_transaction_reference CHECK (
    transaction_reference IS NULL OR char_length(transaction_reference) <= 100
  ),
  ADD CONSTRAINT hk_notes CHECK (
    notes IS NULL OR char_length(notes) <= 500
  );

-- Índices para payments
CREATE INDEX IF NOT EXISTS idx_payments_order ON sales.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON sales.payments (cash_register_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON sales.payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method ON sales.payments (payment_method);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_update_payments_timestamp ON sales.payments;
CREATE TRIGGER trg_update_payments_timestamp
  BEFORE UPDATE ON sales.payments
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

-- RLS
ALTER TABLE sales.payments ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- PASO 5: Crear tabla sales.cash_register_sessions
-- ======================================================================

CREATE TABLE IF NOT EXISTS sales.cash_register_sessions (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES core.shops(id),
  cashier_id UUID NOT NULL REFERENCES hr.employees(id),
  
  session_number INT GENERATED BY DEFAULT AS IDENTITY,
  session_type TEXT NOT NULL DEFAULT 'PARCIAL',
  
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  opening_balance NUMERIC(15,4) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(15,4),
  expected_balance NUMERIC(15,4),
  difference NUMERIC(15,4),
  
  cash_total NUMERIC(15,4) DEFAULT 0,
  card_total NUMERIC(15,4) DEFAULT 0,
  transfer_total NUMERIC(15,4) DEFAULT 0,
  digital_wallet_total NUMERIC(15,4) DEFAULT 0,
  other_total NUMERIC(15,4) DEFAULT 0,
  
  total_orders INT DEFAULT 0,
  total_payments INT DEFAULT 0,
  
  status TEXT NOT NULL DEFAULT 'ABIERTO',
  
  opening_notes TEXT,
  closing_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales.cash_register_sessions
  ADD CONSTRAINT chk_session_type CHECK (session_type IN ('PARCIAL', 'FINAL')),
  ADD CONSTRAINT chk_session_status CHECK (status IN ('ABIERTO', 'CERRADO')),
  ADD CONSTRAINT chk_opening_balance CHECK (opening_balance >= 0),
  ADD CONSTRAINT chk_closing_balance CHECK (closing_balance IS NULL OR closing_balance >= 0),
  ADD CONSTRAINT chk_expected_balance CHECK (expected_balance IS NULL OR expected_balance >= 0),
  ADD CONSTRAINT chk_closed_at_when_closed CHECK (
    (status = 'CERRADO' AND closed_at IS NOT NULL) OR
    (status = 'ABIERTO' AND closed_at IS NULL)
  ),
  ADD CONSTRAINT chk_opening_notes CHECK (
    opening_notes IS NULL OR char_length(opening_notes) <= 500
  ),
  ADD CONSTRAINT chk_closing_notes CHECK (
    closing_notes IS NULL OR char_length(closing_notes) <= 500
  );

-- Índices para cash_register_sessions
CREATE INDEX IF NOT EXISTS idx_cash_sessions_shop ON sales.cash_register_sessions (shop_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_cashier ON sales.cash_register_sessions (cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON sales.cash_register_sessions (status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_dates ON sales.cash_register_sessions (opened_at, closed_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_type ON sales.cash_register_sessions (session_type);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_update_cash_register_sessions_timestamp ON sales.cash_register_sessions;
CREATE TRIGGER trg_update_cash_register_sessions_timestamp
  BEFORE UPDATE ON sales.cash_register_sessions
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

-- RLS
ALTER TABLE sales.cash_register_sessions ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- PASO 6: Agregar FK de payments a cash_register_sessions
-- ======================================================================

ALTER TABLE sales.payments 
  DROP CONSTRAINT IF EXISTS fk_payments_session,
  ADD CONSTRAINT fk_payments_session 
    FOREIGN KEY (cash_register_session_id) 
    REFERENCES sales.cash_register_sessions(id);

-- ======================================================================
-- PASO 7: Crear funciones RPC
-- ======================================================================

-- Función: register_payment
DROP FUNCTION IF EXISTS sales.register_payment(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION sales.register_payment(
  p_order_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_cash_register_session_id UUID DEFAULT NULL,
  p_transaction_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_received_by_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_payment_id UUID;
  v_new_advance NUMERIC;
  v_new_remaining NUMERIC;
  v_new_payment_status TEXT;
BEGIN
  SELECT * INTO v_order FROM sales.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada: %', p_order_id;
  END IF;
  
  IF p_amount > v_order.remaining_balance THEN
    RAISE EXCEPTION 'El monto % excede el saldo pendiente %', p_amount, v_order.remaining_balance;
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0';
  END IF;
  
  v_new_advance := v_order.advance + p_amount;
  v_new_remaining := v_order.remaining_balance - p_amount;
  
  IF v_new_remaining = 0 THEN
    v_new_payment_status := 'PAGADO';
  ELSIF v_new_advance > 0 THEN
    v_new_payment_status := 'PARCIAL';
  ELSE
    v_new_payment_status := 'PENDIENTE';
  END IF;
  
  INSERT INTO sales.payments (
    id, order_id, cash_register_session_id, amount, payment_method,
    transaction_reference, notes, received_by_id
  ) VALUES (
    gen_random_uuid(), p_order_id, p_cash_register_session_id, p_amount, p_payment_method,
    p_transaction_reference, p_notes, p_received_by_id
  ) RETURNING id INTO v_payment_id;
  
  UPDATE sales.orders
  SET 
    advance = v_new_advance,
    remaining_balance = v_new_remaining,
    payment_status = v_new_payment_status,
    fully_paid_at = CASE WHEN v_new_payment_status = 'PAGADO' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'amount_paid', p_amount,
    'new_advance', v_new_advance,
    'new_remaining_balance', v_new_remaining,
    'payment_status', v_new_payment_status,
    'fully_paid', v_new_payment_status = 'PAGADO'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al registrar pago: %', SQLERRM;
END;
$$;

-- Función: open_cash_register_session
DROP FUNCTION IF EXISTS sales.open_cash_register_session(UUID, UUID, NUMERIC, TEXT, TEXT);
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
BEGIN
  SELECT COUNT(*) INTO v_open_sessions
  FROM sales.cash_register_sessions
  WHERE cashier_id = p_cashier_id AND status = 'ABIERTO';
  
  IF v_open_sessions > 0 THEN
    RAISE EXCEPTION 'El cajero ya tiene una sesión abierta';
  END IF;
  
  IF p_session_type NOT IN ('PARCIAL', 'FINAL') THEN
    RAISE EXCEPTION 'Tipo de sesión inválido: %', p_session_type;
  END IF;
  
  INSERT INTO sales.cash_register_sessions (
    id, shop_id, cashier_id, session_type, opening_balance, opening_notes, status
  ) VALUES (
    gen_random_uuid(), p_shop_id, p_cashier_id, p_session_type, p_opening_balance, p_opening_notes, 'ABIERTO'
  ) RETURNING id INTO v_session_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'session_id', v_session_id,
    'opened_at', NOW(),
    'opening_balance', p_opening_balance
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al abrir sesión de caja: %', SQLERRM;
END;
$$;

-- Función: close_cash_register_session
DROP FUNCTION IF EXISTS sales.close_cash_register_session(UUID, NUMERIC, TEXT);
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
BEGIN
  SELECT * INTO v_session 
  FROM sales.cash_register_sessions 
  WHERE id = p_session_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión de caja no encontrada: %', p_session_id;
  END IF;
  
  IF v_session.status = 'CERRADO' THEN
    RAISE EXCEPTION 'La sesión ya está cerrada';
  END IF;
  
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'EFECTIVO' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('TARJETA_DEBITO', 'TARJETA_CREDITO') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'TRANSFERENCIA' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('YAPE', 'PLIN') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'OTRO' THEN amount ELSE 0 END), 0),
    COUNT(*)
  INTO 
    v_cash_total, v_card_total, v_transfer_total, v_digital_wallet_total, v_other_total, v_total_payments
  FROM sales.payments
  WHERE cash_register_session_id = p_session_id;
  
  v_expected_balance := v_session.opening_balance + v_cash_total;
  v_difference := p_closing_balance - v_expected_balance;
  
  SELECT COUNT(DISTINCT order_id) INTO v_total_orders
  FROM sales.payments
  WHERE cash_register_session_id = p_session_id;
  
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
    'total_payments', v_total_payments,
    'total_orders', v_total_orders
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al cerrar sesión de caja: %', SQLERRM;
END;
$$;

-- Función: get_daily_sales_summary
DROP FUNCTION IF EXISTS sales.get_daily_sales_summary(DATE, UUID);
CREATE OR REPLACE FUNCTION sales.get_daily_sales_summary(
  p_date DATE DEFAULT CURRENT_DATE,
  p_shop_id UUID DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_number INT,
  customer_name TEXT,
  employee_name TEXT,
  total_price NUMERIC,
  discount NUMERIC,
  igv NUMERIC,
  final_amount NUMERIC,
  advance NUMERIC,
  remaining_balance NUMERIC,
  payment_status TEXT,
  order_status TEXT,
  created_at TIMESTAMPTZ,
  last_payment_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    COALESCE(p.first_name || ' ' || p.last_name, p.legal_name, 'Cliente Anónimo') AS customer_name,
    COALESCE(ep.first_name || ' ' || ep.last_name, 'Sin asignar') AS employee_name,
    o.total_price,
    o.discount,
    o.igv,
    o.final_amount,
    o.advance,
    o.remaining_balance,
    o.payment_status,
    os.name AS order_status,
    o.created_at,
    (SELECT MAX(payment_date) FROM sales.payments WHERE order_id = o.id) AS last_payment_date
  FROM sales.orders o
  LEFT JOIN sales.customers c ON o.customer_id = c.id
  LEFT JOIN core.persons p ON c.person_id = p.id
  LEFT JOIN hr.employees e ON o.employee_id = e.id
  LEFT JOIN core.persons ep ON e.person_id = ep.id
  LEFT JOIN sales.order_status os ON o.status_id = os.id
  WHERE 
    DATE(o.created_at) = p_date
    AND (p_shop_id IS NULL OR o.shop_id = p_shop_id)
  ORDER BY o.created_at DESC;
END;
$$;

-- Función: get_order_payment_history
DROP FUNCTION IF EXISTS sales.get_order_payment_history(UUID);
CREATE OR REPLACE FUNCTION sales.get_order_payment_history(
  p_order_id UUID
)
RETURNS TABLE (
  payment_id UUID,
  amount NUMERIC,
  payment_method TEXT,
  payment_date TIMESTAMPTZ,
  transaction_reference TEXT,
  notes TEXT,
  received_by_name TEXT,
  session_number INT,
  session_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.amount,
    p.payment_method,
    p.payment_date,
    p.transaction_reference,
    p.notes,
    COALESCE(per.first_name || ' ' || per.last_name, 'Sin registrar') AS received_by_name,
    crs.session_number,
    crs.session_type
  FROM sales.payments p
  LEFT JOIN hr.employees emp ON p.received_by_id = emp.id
  LEFT JOIN core.persons per ON emp.person_id = per.id
  LEFT JOIN sales.cash_register_sessions crs ON p.cash_register_session_id = crs.id
  WHERE p.order_id = p_order_id
  ORDER BY p.payment_date DESC;
END;
$$;

-- Función: get_pending_payment_orders
DROP FUNCTION IF EXISTS sales.get_pending_payment_orders(UUID);
CREATE OR REPLACE FUNCTION sales.get_pending_payment_orders(
  p_shop_id UUID DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_number INT,
  customer_name TEXT,
  customer_phone TEXT,
  final_amount NUMERIC,
  advance NUMERIC,
  remaining_balance NUMERIC,
  payment_status TEXT,
  created_at TIMESTAMPTZ,
  days_pending INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    COALESCE(p.first_name || ' ' || p.last_name, p.legal_name, 'Cliente Anónimo') AS customer_name,
    p.phone AS customer_phone,
    o.final_amount,
    o.advance,
    o.remaining_balance,
    o.payment_status,
    o.created_at,
    EXTRACT(DAY FROM (NOW() - o.created_at))::INT AS days_pending
  FROM sales.orders o
  LEFT JOIN sales.customers c ON o.customer_id = c.id
  LEFT JOIN core.persons p ON c.person_id = p.id
  WHERE 
    o.payment_status IN ('PENDIENTE', 'PARCIAL')
    AND (p_shop_id IS NULL OR o.shop_id = p_shop_id)
  ORDER BY o.created_at ASC;
END;
$$;

-- ======================================================================
-- PASO 8: Grants (ajustar según necesidad)
-- ======================================================================

-- GRANT EXECUTE ON FUNCTION sales.register_payment TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.open_cash_register_session TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.close_cash_register_session TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.get_daily_sales_summary TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.get_order_payment_history TO authenticated;
-- GRANT EXECUTE ON FUNCTION sales.get_pending_payment_orders TO authenticated;

-- ======================================================================
-- PASO 9: Migrar datos existentes (si aplica)
-- ======================================================================

-- Si ya tienes órdenes creadas, inicializar los nuevos campos
UPDATE sales.orders
SET 
  remaining_balance = final_amount,
  payment_status = 'PENDIENTE'
WHERE remaining_balance IS NULL OR remaining_balance = 0;

-- ======================================================================
-- FIN DE LA MIGRACIÓN
-- ======================================================================

COMMIT;

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✓ Migración completada exitosamente';
  RAISE NOTICE '✓ Tablas creadas: sales.payments, sales.cash_register_sessions';
  RAISE NOTICE '✓ Funciones RPC creadas: 6 funciones';
  RAISE NOTICE '✓ Índices creados para optimización';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos pasos:';
  RAISE NOTICE '1. Revisar y ajustar políticas RLS según roles';
  RAISE NOTICE '2. Configurar GRANTS según usuarios de aplicación';
  RAISE NOTICE '3. Implementar frontend según FRONTEND_IMPLEMENTATION_GUIDE.md';
END $$;
