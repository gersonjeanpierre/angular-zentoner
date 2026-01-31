-- ============================================================================
-- MEJORAS AL SISTEMA DE CAJA REGISTRADORA
-- ============================================================================
-- Fecha: 2026-01-31
-- Descripción: Separación de flujos de caja chica y efectivo de ventas
-- ============================================================================

-- ============================================================================
-- FUNCIÓN MEJORADA: close_cash_register_session
-- ============================================================================
-- Cambios principales:
-- 1. El efectivo de ventas NO se suma a la caja chica
-- 2. La caja chica solo se calcula: opening_balance - gastos
-- 3. El efectivo de ventas se registra separadamente (va a caja fuerte)
-- ============================================================================

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

-- ============================================================================
-- FUNCIÓN MEJORADA: get_session_dashboard
-- ============================================================================

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

-- ============================================================================
-- ACTUALIZAR ALIAS
-- ============================================================================

CREATE OR REPLACE FUNCTION sales.get_session_summary(p_session_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT sales.get_session_dashboard(p_session_id);
$$;

COMMENT ON FUNCTION sales.get_session_summary IS 'Alias de get_session_dashboard para compatibilidad con código existente';
