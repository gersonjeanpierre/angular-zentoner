-- ======================================================================
-- RPC FUNCTIONS FOR SALES
-- Remote Procedure Calls for POS operations
-- ======================================================================

-- ======================================================================
-- CUSTOMER MANAGEMENT
-- ======================================================================

CREATE OR REPLACE FUNCTION sales.create_customer(
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_person_type core.person_type_enum,
  p_legal_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_ruc TEXT DEFAULT NULL,
  p_ce TEXT DEFAULT NULL,
  p_customer_code TEXT DEFAULT NULL,
  p_customer_type_code TEXT DEFAULT NULL,
  p_notes JSONB DEFAULT '{}'::JSONB
) RETURNS UUID 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_user_id UUID := auth.uid();
BEGIN
  IF p_dni IS NOT NULL AND p_ce IS NOT NULL THEN 
    RAISE EXCEPTION 'DATA_VALIDATION_ERROR: No se puede proporcionar ambos DNI y CE al mismo tiempo.';
  END IF;
  
  IF v_user_id IS NULL THEN 
    RAISE EXCEPTION 'AUTHENTICATION_ERROR: Usuario no autenticado.';
  END IF;
  
  INSERT INTO core.persons (
    id, first_name, last_name, legal_name, email, phone, 
    dni, ruc, ce, person_type, created_by_id
  ) VALUES (
    p_user_id, p_first_name, p_last_name, p_legal_name, p_email, p_phone,
    p_dni, p_ruc, p_ce, p_person_type, v_user_id
  );
  
  INSERT INTO sales.customers (
    id, customer_code, customer_type_code, notes, created_by_id
  ) VALUES (
    p_user_id, p_customer_code, p_customer_type_code, p_notes, v_user_id
  );
  
  INSERT INTO core.audit_logs (
    action, actor_id, target_table, target_id, status, payload
  ) VALUES (
    'create_customer', v_user_id, 'sales.customers', p_user_id, 'SUCCESS',
    jsonb_build_object('customer_code', p_customer_code, 'customer_type_code', p_customer_type_code)
  );
  
  RETURN p_user_id;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO core.audit_logs (
      action, actor_id, target_table, target_id, status, payload
    ) VALUES (
      'create_customer', v_user_id, 'sales.customers', p_user_id, 'FAILURE',
      jsonb_build_object('error_message', SQLERRM)
    );
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION sales.update_customer(
  p_customer_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_legal_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_ruc TEXT DEFAULT NULL,
  p_ce TEXT DEFAULT NULL,
  p_customer_code TEXT DEFAULT NULL,
  p_customer_type_code TEXT DEFAULT NULL,
  p_notes JSONB DEFAULT NULL
) RETURNS VOID 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_user_id UUID := auth.uid();
BEGIN
  IF p_dni IS NOT NULL AND p_ce IS NOT NULL THEN 
    RAISE EXCEPTION 'DATA_VALIDATION_ERROR: No se puede proporcionar ambos DNI y CE al mismo tiempo.';
  END IF;
  
  IF v_user_id IS NULL THEN 
    RAISE EXCEPTION 'AUTHENTICATION_ERROR: Usuario no autenticado.';
  END IF;
  
  IF NOT auth_management.is_employee(v_user_id) THEN 
    RAISE EXCEPTION 'PERMISSION_DENIED: Only active employees can manage customers.';
  END IF;
  
  UPDATE core.persons
  SET 
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    legal_name = COALESCE(p_legal_name, legal_name),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    dni = COALESCE(p_dni, dni),
    ruc = COALESCE(p_ruc, ruc),
    ce = COALESCE(p_ce, ce),
    updated_by_id = v_user_id,
    updated_at = NOW()
  WHERE id = p_customer_id;
  
  UPDATE sales.customers
  SET 
    customer_code = COALESCE(p_customer_code, customer_code),
    customer_type_code = COALESCE(p_customer_type_code, customer_type_code),
    notes = COALESCE(p_notes, notes),
    updated_by_id = v_user_id,
    updated_at = NOW()
  WHERE id = p_customer_id;
  
  INSERT INTO core.audit_logs (
    action, actor_id, target_table, target_id, status, payload
  ) VALUES (
    'update_customer', v_user_id, 'sales.customers', p_customer_id, 'SUCCESS',
    jsonb_build_object('customer_code', p_customer_code, 'customer_type_code', p_customer_type_code)
  );
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO core.audit_logs (
      action, actor_id, target_table, target_id, status, payload
    ) VALUES (
      'update_customer', v_user_id, 'sales.customers', p_customer_id, 'FAILURE',
      jsonb_build_object('error_message', SQLERRM)
    );
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION sales.soft_delete_customer(p_customer_id UUID) 
RETURNS VOID 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT auth_management.is_employee(v_user_id) THEN 
    RAISE EXCEPTION 'PERMISSION_DENIED: Only active employees can manage customer deletion.';
  END IF;
  
  UPDATE core.persons
  SET deleted_at = NOW(), deleted_by_id = v_user_id, updated_by_id = v_user_id
  WHERE id = p_customer_id;
  
  UPDATE sales.customers
  SET deleted_at = NOW(), deleted_by_id = v_user_id
  WHERE id = p_customer_id;
  
  INSERT INTO core.audit_logs (
    action, actor_id, target_table, target_id, status, payload
  ) VALUES (
    'soft_delete', v_user_id, 'sales.customers', p_customer_id, 'SUCCESS',
    jsonb_build_object('reason', 'soft deleted by employee')
  );
END;
$$;

-- ======================================================================
-- PAYMENT PROCESSING
-- ======================================================================

CREATE OR REPLACE FUNCTION sales.register_payment(
  p_order_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_cash_register_session_id UUID DEFAULT NULL,
  p_transaction_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_received_by_id UUID DEFAULT NULL
) RETURNS JSON 
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ======================================================================
-- CASH REGISTER SESSIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION sales.open_cash_register_session(
  p_id UUID,
  p_shop_id UUID,
  p_cashier_id UUID,
  p_opening_balance NUMERIC DEFAULT 0,
  p_session_type TEXT DEFAULT 'PARCIAL',
  p_opening_notes TEXT DEFAULT NULL
) RETURNS JSON 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session_id UUID;
  v_open_sessions INT;
  v_shop_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM core.shops WHERE id = p_shop_id) INTO v_shop_exists;
  
  IF NOT v_shop_exists THEN
    RAISE EXCEPTION 'La tienda especificada no existe: %', p_shop_id;
  END IF;
  
  SELECT COUNT(*) INTO v_open_sessions
  FROM sales.cash_register_sessions
  WHERE cashier_id = p_cashier_id AND shop_id = p_shop_id AND status = 'ABIERTO';
  
  IF v_open_sessions > 0 THEN
    RAISE EXCEPTION 'El cajero ya tiene una sesión abierta en esta tienda';
  END IF;
  
  IF p_session_type NOT IN ('PARCIAL', 'FINAL') THEN
    RAISE EXCEPTION 'Tipo de sesión inválido: %', p_session_type;
  END IF;
  
  INSERT INTO sales.cash_register_sessions (
    id, shop_id, cashier_id, session_type, opening_balance, opening_notes, status
  ) VALUES (
    p_id, p_shop_id, p_cashier_id, p_session_type, p_opening_balance, p_opening_notes, 'ABIERTO'
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
-- =====================================================================
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
  v_cash_from_sales NUMERIC := 0;
  v_card_total NUMERIC := 0;
  v_transfer_total NUMERIC := 0;
  v_digital_wallet_total NUMERIC := 0;
  v_other_total NUMERIC := 0;
  v_petty_cash_expected NUMERIC;
  v_petty_cash_difference NUMERIC;
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
    v_cash_from_sales, v_card_total, v_transfer_total, v_digital_wallet_total, v_other_total, v_total_payments
  FROM sales.payments
  WHERE cash_register_session_id = p_session_id
    AND deleted_at IS NULL;
  
  -- Calcular total de gastos de caja chica
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM sales.cash_expenses
  WHERE cash_register_session_id = p_session_id;
  
  -- NUEVA LÓGICA: Calcular balance esperado SOLO de caja chica
  -- La caja chica NO incluye el efectivo de ventas (ese va a caja fuerte)
  -- Balance esperado de caja chica = opening_balance - gastos
  v_petty_cash_expected := v_session.opening_balance - v_total_expenses;
  v_petty_cash_difference := p_closing_balance - v_petty_cash_expected;
  
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
    expected_balance = v_petty_cash_expected,
    difference = v_petty_cash_difference,
    cash_total = v_cash_from_sales,
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
    -- Información de Caja Chica
    'petty_cash_opening', v_session.opening_balance,
    'petty_cash_closing', p_closing_balance,
    'petty_cash_expected', v_petty_cash_expected,
    'petty_cash_difference', v_petty_cash_difference,
    'total_expenses', v_total_expenses,
    -- Información de Efectivo de Ventas (va a caja fuerte)
    'cash_from_sales', v_cash_from_sales,
    -- Otros métodos de pago
    'card_total', v_card_total,
    'transfer_total', v_transfer_total,
    'digital_wallet_total', v_digital_wallet_total,
    'other_total', v_other_total,
    -- Estadísticas
    'total_payments', v_total_payments,
    'total_orders', v_total_orders,
    -- Valores legacy (para retrocompatibilidad)
    'opening_balance', v_session.opening_balance,
    'closing_balance', p_closing_balance,
    'expected_balance', v_petty_cash_expected,
    'difference', v_petty_cash_difference,
    'cash_total', v_cash_from_sales
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al cerrar sesión de caja: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION sales.close_cash_register_session IS 
'Cierra una sesión de caja separando caja chica (opening_balance - gastos) del efectivo de ventas (que va a caja fuerte)';

-- =====================================================================



CREATE OR REPLACE FUNCTION sales.register_cash_expense(
  p_session_id UUID,
  p_shop_id UUID,
  p_amount NUMERIC,
  p_category TEXT,
  p_description TEXT,
  p_receipt_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_authorized_by_id UUID DEFAULT NULL
) RETURNS JSON 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_expense_id UUID;
  v_session_open BOOLEAN;
BEGIN
  SELECT status = 'ABIERTO' INTO v_session_open
  FROM sales.cash_register_sessions WHERE id = p_session_id;
  
  IF NOT v_session_open THEN
    RAISE EXCEPTION 'La sesión de caja no está abierta';
  END IF;
  
  INSERT INTO sales.cash_expenses (
    id, cash_register_session_id, shop_id, amount, category,
    description, receipt_number, notes, authorized_by_id
  ) VALUES (
    gen_random_uuid(), p_session_id, p_shop_id, p_amount, p_category,
    p_description, p_receipt_number, p_notes, p_authorized_by_id
  ) RETURNING id INTO v_expense_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'expense_id', v_expense_id,
    'amount', p_amount,
    'category', p_category
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al registrar gasto: %', SQLERRM;
END;
$$;

-- =====================================================================
-- Función: Obtener dashboard completo de sesión de caja
-- =====================================================================
DROP FUNCTION IF EXISTS sales.get_session_dashboard(UUID);
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
  v_cash_from_sales NUMERIC;
  v_total_expenses NUMERIC;
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
  
  -- Guardar efectivo de ventas para cálculos
  v_cash_from_sales := COALESCE((v_payment_summary->>'efectivo')::NUMERIC, 0);
  
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
  
  -- Guardar total de gastos
  v_total_expenses := COALESCE((v_expense_summary->>'total_amount')::NUMERIC, 0);
  
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
  
  -- Flujo de efectivo MEJORADO
  -- NUEVA LÓGICA: Separar caja chica de efectivo de ventas
  v_cash_flow := jsonb_build_object(
    -- Caja Chica
    'petty_cash_opening', v_session.opening_balance,
    'petty_cash_expenses', v_total_expenses,
    'petty_cash_expected', v_session.opening_balance - v_total_expenses,
    -- Efectivo de Ventas (va a caja fuerte)
    'cash_from_sales', v_cash_from_sales,
    -- Legacy (para retrocompatibilidad)
    'opening_balance', v_session.opening_balance,
    'cash_in', v_cash_from_sales,
    'cash_out', v_total_expenses,
    'expected_balance', v_session.opening_balance - v_total_expenses,
    'current_cash', v_session.opening_balance - v_total_expenses
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

COMMENT ON FUNCTION sales.get_session_dashboard IS 
'Obtiene un dashboard completo de sesión con separación de caja chica y efectivo de ventas';


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
  LEFT JOIN core.persons per ON emp.id = per.id
  LEFT JOIN sales.cash_register_sessions crs ON p.cash_register_session_id = crs.id
  WHERE p.order_id = p_order_id
  ORDER BY p.payment_date DESC;
END;
$$;
