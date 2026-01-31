-- ============================================================================
-- Script de Validación: Control de Acceso Multi-Tienda en Sistema de Caja
-- ============================================================================
-- Este script verifica que las sesiones de caja estén correctamente aisladas
-- por tienda y que no existan cruces de datos entre diferentes shops.

-- ----------------------------------------------------------------------------
-- 1. Vista general de sesiones activas por tienda
-- ----------------------------------------------------------------------------
SELECT 
  s.id as session_id,
  s.session_number,
  sh.id as shop_id,
  sh.name as shop_name,
  e.id as cashier_id,
  e.first_name || ' ' || e.last_name as cashier_name,
  s.status,
  s.session_type,
  s.opened_at,
  s.opening_balance,
  CASE 
    WHEN s.status = 'ABIERTO' THEN 
      EXTRACT(EPOCH FROM (NOW() - s.opened_at)) / 3600
    ELSE NULL
  END as hours_open
FROM sales.cash_register_sessions s
JOIN core.shops sh ON sh.id = s.shop_id
JOIN hr.employees e ON e.id = s.cashier_id
WHERE s.status = 'ABIERTO'
ORDER BY s.opened_at DESC;

-- ✅ ESPERADO: Máximo una sesión ABIERTA por shop_id

-- ----------------------------------------------------------------------------
-- 2. Verificar que no hay múltiples sesiones abiertas en la misma tienda
-- ----------------------------------------------------------------------------
SELECT 
  shop_id,
  COUNT(*) as sesiones_abiertas,
  STRING_AGG(cashier_id::text, ', ') as cashiers
FROM sales.cash_register_sessions
WHERE status = 'ABIERTO'
GROUP BY shop_id
HAVING COUNT(*) > 1;

-- ✅ ESPERADO: 0 filas (ninguna tienda debe tener más de una sesión abierta)

-- ----------------------------------------------------------------------------
-- 3. Historial de sesiones de los últimos 7 días por tienda
-- ----------------------------------------------------------------------------
SELECT 
  sh.name as tienda,
  DATE(s.opened_at) as fecha,
  COUNT(*) as total_sesiones,
  SUM(CASE WHEN s.status = 'CERRADO' THEN 1 ELSE 0 END) as cerradas,
  SUM(CASE WHEN s.status = 'ABIERTO' THEN 1 ELSE 0 END) as abiertas,
  COUNT(DISTINCT s.cashier_id) as cajeros_distintos
FROM sales.cash_register_sessions s
JOIN core.shops sh ON sh.id = s.shop_id
WHERE s.opened_at >= NOW() - INTERVAL '7 days'
GROUP BY sh.name, DATE(s.opened_at)
ORDER BY fecha DESC, sh.name;

-- ✅ ESPERADO: Cada tienda debe tener máximo 1 sesión ABIERTA por fecha

-- ----------------------------------------------------------------------------
-- 4. Verificar órdenes asociadas a sesiones correctas
-- ----------------------------------------------------------------------------
SELECT 
  o.id as order_id,
  o.order_number,
  o.shop_id as order_shop_id,
  sh.name as order_shop_name,
  p.cash_register_session_id,
  s.shop_id as session_shop_id,
  s2.name as session_shop_name,
  CASE 
    WHEN o.shop_id = s.shop_id THEN '✅ OK'
    ELSE '❌ ERROR: Shop mismatch'
  END as validacion
FROM sales.orders o
JOIN sales.payments p ON p.order_id = o.id
JOIN sales.cash_register_sessions s ON s.id = p.cash_register_session_id
JOIN core.shops sh ON sh.id = o.shop_id
JOIN core.shops s2 ON s2.id = s.shop_id
WHERE p.created_at >= NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC
LIMIT 100;

-- ✅ ESPERADO: Todos deben mostrar '✅ OK' (shop de orden = shop de sesión)

-- ----------------------------------------------------------------------------
-- 5. Función de prueba: Simular checkDashboardAccess
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sales.test_check_dashboard_access(
  p_user_id UUID,
  p_shop_id UUID
)
RETURNS TABLE (
  can_access BOOLEAN,
  reason TEXT,
  session_id UUID,
  session_cashier_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE
      -- Caso 1: No hay sesión abierta -> Puede acceder
      WHEN open_session.id IS NULL THEN TRUE
      -- Caso 2: Hay sesión del mismo cajero -> Puede acceder
      WHEN open_session.cashier_id = p_user_id THEN TRUE
      -- Caso 3: Hay sesión de otro cajero -> No puede acceder
      ELSE FALSE
    END as can_access,
    CASE
      WHEN open_session.id IS NULL THEN 'No hay sesión abierta. Puede abrir una nueva.'
      WHEN open_session.cashier_id = p_user_id THEN 'Sesión activa del cajero actual.'
      ELSE 'Ya hay una sesión abierta por otro cajero en esta tienda.'
    END as reason,
    open_session.id as session_id,
    open_session.cashier_id as session_cashier_id
  FROM (
    SELECT id, cashier_id
    FROM sales.cash_register_sessions
    WHERE shop_id = p_shop_id
      AND status = 'ABIERTO'
    ORDER BY opened_at DESC
    LIMIT 1
  ) open_session;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 6. Casos de prueba para validar la lógica
-- ----------------------------------------------------------------------------

-- Prueba 1: Usuario intenta acceder a tienda sin sesión abierta
-- ✅ ESPERADO: can_access = TRUE
SELECT * FROM sales.test_check_dashboard_access(
  '00000000-0000-0000-0000-000000000001'::uuid,  -- user_id cualquiera
  (SELECT id FROM core.shops WHERE NOT EXISTS (
    SELECT 1 FROM sales.cash_register_sessions 
    WHERE shop_id = core.shops.id AND status = 'ABIERTO'
  ) LIMIT 1)  -- Una tienda sin sesión abierta
);

-- Prueba 2: Usuario intenta acceder a tienda donde YA tiene sesión abierta
-- ✅ ESPERADO: can_access = TRUE, session_cashier_id = user_id
DO $$
DECLARE
  v_user_id UUID;
  v_shop_id UUID;
BEGIN
  -- Buscar un cajero con sesión activa
  SELECT cashier_id, shop_id 
  INTO v_user_id, v_shop_id
  FROM sales.cash_register_sessions 
  WHERE status = 'ABIERTO' 
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Prueba 2: Usuario % en Shop %', v_user_id, v_shop_id;
    PERFORM * FROM sales.test_check_dashboard_access(v_user_id, v_shop_id);
  ELSE
    RAISE NOTICE 'No hay sesiones abiertas para probar';
  END IF;
END $$;

-- Prueba 3: Usuario diferente intenta acceder a tienda con sesión de otro
-- ❌ ESPERADO: can_access = FALSE
DO $$
DECLARE
  v_active_user_id UUID;
  v_other_user_id UUID;
  v_shop_id UUID;
BEGIN
  -- Buscar una sesión activa
  SELECT cashier_id, shop_id 
  INTO v_active_user_id, v_shop_id
  FROM sales.cash_register_sessions 
  WHERE status = 'ABIERTO' 
  LIMIT 1;
  
  -- Buscar otro empleado diferente
  SELECT id INTO v_other_user_id
  FROM hr.employees 
  WHERE id != v_active_user_id 
  LIMIT 1;
  
  IF v_active_user_id IS NOT NULL AND v_other_user_id IS NOT NULL THEN
    RAISE NOTICE 'Prueba 3: Usuario % intenta acceder a sesión de % en Shop %', 
                  v_other_user_id, v_active_user_id, v_shop_id;
    PERFORM * FROM sales.test_check_dashboard_access(v_other_user_id, v_shop_id);
  ELSE
    RAISE NOTICE 'No hay datos suficientes para probar';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Consulta de auditoría: Detectar posibles inconsistencias
-- ----------------------------------------------------------------------------

-- 7.1 Pagos sin sesión de caja
SELECT 
  p.id as payment_id,
  p.order_id,
  o.shop_id as order_shop,
  p.cash_register_session_id
FROM sales.payments p
JOIN sales.orders o ON o.id = p.order_id
WHERE p.cash_register_session_id IS NULL
  AND p.created_at >= NOW() - INTERVAL '30 days';

-- ✅ ESPERADO: 0 filas (todos los pagos deben tener sesión)

-- 7.2 Sesiones sin cerrar por más de 24 horas
SELECT 
  s.id,
  s.session_number,
  sh.name as shop,
  e.first_name || ' ' || e.last_name as cajero,
  s.opened_at,
  EXTRACT(EPOCH FROM (NOW() - s.opened_at)) / 3600 as horas_abierta
FROM sales.cash_register_sessions s
JOIN core.shops sh ON sh.id = s.shop_id
JOIN hr.employees e ON e.id = s.cashier_id
WHERE s.status = 'ABIERTO'
  AND s.opened_at < NOW() - INTERVAL '24 hours';

-- ⚠️ ALERTA: Investigar sesiones abiertas por más de 24 horas

-- ----------------------------------------------------------------------------
-- 8. Limpiar función de prueba (opcional)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS sales.test_check_dashboard_access(UUID, UUID);

-- ============================================================================
-- FIN DEL SCRIPT DE VALIDACIÓN
-- ============================================================================
