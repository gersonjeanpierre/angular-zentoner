-- =====================================================
-- QUERIES ÚTILES PARA SISTEMA DE CAJA MULTI-TIENDA
-- =====================================================

-- =====================================================
-- 1. MONITOREO DE SESIONES
-- =====================================================

-- Ver todas las sesiones activas
SELECT * FROM sales.active_sessions_by_shop;

-- Ver sesiones activas con más detalle
SELECT 
  s.id,
  s.session_number,
  sh.name as shop_name,
  p.first_name || ' ' || p.last_name as cashier_name,
  s.session_type,
  s.opened_at,
  EXTRACT(EPOCH FROM (NOW() - s.opened_at)) / 3600 as hours_open,
  s.opening_balance,
  s.total_orders,
  s.total_payments
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.id
LEFT JOIN hr.employees e ON s.cashier_id = e.id
LEFT JOIN core.persons p ON e.person_id = p.id
WHERE s.status = 'ABIERTO'
ORDER BY s.opened_at DESC;

-- Ver últimas 10 sesiones cerradas
SELECT 
  s.id,
  s.session_number,
  sh.name as shop_name,
  p.first_name || ' ' || p.last_name as cashier_name,
  s.session_type,
  s.opened_at,
  s.closed_at,
  EXTRACT(EPOCH FROM (s.closed_at - s.opened_at)) / 3600 as session_hours,
  s.opening_balance,
  s.closing_balance,
  s.expected_balance,
  s.difference,
  CASE 
    WHEN s.difference > 0 THEN 'SOBRANTE'
    WHEN s.difference < 0 THEN 'FALTANTE'
    ELSE 'CUADRADO'
  END as balance_status,
  s.total_orders,
  s.cash_total + s.card_total + s.transfer_total + s.digital_wallet_total + s.other_total as total_collected
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.id
LEFT JOIN hr.employees e ON s.cashier_id = e.id
LEFT JOIN core.persons p ON e.person_id = p.id
WHERE s.status = 'CERRADO'
ORDER BY s.closed_at DESC
LIMIT 10;

-- =====================================================
-- 2. ANÁLISIS DE GASTOS
-- =====================================================

-- Gastos de una sesión específica
SELECT * FROM sales.get_session_expenses('SESSION_UUID_HERE');

-- Total de gastos por categoría en todas las sesiones
SELECT 
  category,
  COUNT(*) as total_expenses,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM sales.cash_expenses
GROUP BY category
ORDER BY total_amount DESC;

-- Gastos por tienda y categoría (últimos 30 días)
SELECT 
  sh.name as shop_name,
  ce.category,
  COUNT(*) as expense_count,
  SUM(ce.amount) as total_amount
FROM sales.cash_expenses ce
JOIN core.shops sh ON ce.shop_id = sh.id
WHERE ce.created_at >= NOW() - INTERVAL '30 days'
GROUP BY sh.name, ce.category
ORDER BY sh.name, total_amount DESC;

-- Gastos más grandes del mes
SELECT 
  ce.id,
  sh.name as shop_name,
  ce.amount,
  ce.category,
  ce.description,
  ce.receipt_number,
  p.first_name || ' ' || p.last_name as authorized_by,
  ce.created_at
FROM sales.cash_expenses ce
JOIN core.shops sh ON ce.shop_id = sh.id
LEFT JOIN hr.employees e ON ce.authorized_by_id = e.id
LEFT JOIN core.persons p ON e.person_id = p.id
WHERE ce.created_at >= DATE_TRUNC('month', NOW())
ORDER BY ce.amount DESC
LIMIT 20;

-- =====================================================
-- 3. ANÁLISIS DE PAGOS
-- =====================================================

-- Sumatorias por método de pago (última sesión cerrada)
SELECT 
  s.session_number,
  sh.name as shop_name,
  s.cash_total,
  s.card_total,
  s.transfer_total,
  s.digital_wallet_total,
  s.other_total,
  s.cash_total + s.card_total + s.transfer_total + s.digital_wallet_total + s.other_total as total
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.id
WHERE s.status = 'CERRADO'
ORDER BY s.closed_at DESC
LIMIT 1;

-- Detalle de pagos por método en una sesión
SELECT 
  payment_method,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM sales.payments
WHERE cash_register_session_id = 'SESSION_UUID_HERE'
  AND deleted_at IS NULL
GROUP BY payment_method
ORDER BY total_amount DESC;

-- Pagos más grandes de la sesión
SELECT 
  p.id,
  o.order_number,
  p.amount,
  p.payment_method,
  p.payment_date,
  p.transaction_reference,
  COALESCE(per.first_name || ' ' || per.last_name, 'Sin registrar') as received_by
FROM sales.payments p
JOIN sales.orders o ON p.order_id = o.id
LEFT JOIN hr.employees e ON p.received_by_id = e.id
LEFT JOIN core.persons per ON e.person_id = per.id
WHERE p.cash_register_session_id = 'SESSION_UUID_HERE'
  AND p.deleted_at IS NULL
ORDER BY p.amount DESC
LIMIT 10;

-- =====================================================
-- 4. ANÁLISIS DE ÓRDENES
-- =====================================================

-- Órdenes de la sesión actual por estado
SELECT 
  o.payment_status,
  COUNT(*) as order_count,
  SUM(o.final_amount) as total_sales,
  SUM(o.advance) as total_collected,
  SUM(o.remaining_balance) as total_pending
FROM sales.orders o
JOIN sales.payments p ON p.order_id = o.id
WHERE p.cash_register_session_id = 'SESSION_UUID_HERE'
GROUP BY o.payment_status
ORDER BY 
  CASE o.payment_status
    WHEN 'PENDIENTE' THEN 1
    WHEN 'PARCIAL' THEN 2
    WHEN 'PAGADO' THEN 3
  END;

-- Correlativo de órdenes por tienda (verificar secuencia)
SELECT 
  id,
  order_number,
  shop_id,
  customer_id,
  final_amount,
  payment_status,
  created_at
FROM sales.orders
WHERE shop_id = 'SHOP_UUID_HERE'
ORDER BY created_at DESC
LIMIT 50;

-- Órdenes con pagos en una sesión específica
SELECT DISTINCT
  o.id,
  o.order_number,
  COALESCE(p.first_name || ' ' || p.last_name, p.legal_name, 'Anónimo') as customer_name,
  o.final_amount,
  o.advance,
  o.remaining_balance,
  o.payment_status,
  COUNT(pay.id) as payment_count
FROM sales.orders o
JOIN sales.payments pay ON pay.order_id = o.id
LEFT JOIN sales.customers c ON o.customer_id = c.id
LEFT JOIN core.persons p ON c.person_id = p.id
WHERE pay.cash_register_session_id = 'SESSION_UUID_HERE'
  AND pay.deleted_at IS NULL
GROUP BY o.id, o.order_number, p.first_name, p.last_name, p.legal_name, 
         o.final_amount, o.advance, o.remaining_balance, o.payment_status
ORDER BY o.order_number DESC;

-- =====================================================
-- 5. DASHBOARD COMPLETO
-- =====================================================

-- Obtener dashboard de una sesión (JSON)
SELECT * FROM sales.get_session_dashboard('SESSION_UUID_HERE');

-- Dashboard desglosado en formato legible
WITH session_data AS (
  SELECT * FROM sales.cash_register_sessions WHERE id = 'SESSION_UUID_HERE'
),
payment_summary AS (
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'EFECTIVO' THEN amount ELSE 0 END), 0) as efectivo,
    COALESCE(SUM(CASE WHEN payment_method = 'YAPE' THEN amount ELSE 0 END), 0) as yape,
    COALESCE(SUM(CASE WHEN payment_method IN ('TARJETA_DEBITO', 'TARJETA_CREDITO') THEN amount ELSE 0 END), 0) as tarjetas,
    COALESCE(SUM(CASE WHEN payment_method IN ('TRANSFERENCIA', 'DEPOSITO') THEN amount ELSE 0 END), 0) as transferencias,
    COUNT(*) as total_payments
  FROM sales.payments
  WHERE cash_register_session_id = 'SESSION_UUID_HERE'
    AND deleted_at IS NULL
),
expense_summary AS (
  SELECT 
    COALESCE(SUM(amount), 0) as total_expenses
  FROM sales.cash_expenses
  WHERE cash_register_session_id = 'SESSION_UUID_HERE'
)
SELECT 
  s.session_number,
  s.session_type,
  s.status,
  s.opening_balance,
  p.efectivo as cash_in,
  e.total_expenses as cash_out,
  s.opening_balance + p.efectivo - e.total_expenses as expected_balance,
  s.closing_balance,
  s.closing_balance - (s.opening_balance + p.efectivo - e.total_expenses) as difference,
  p.efectivo,
  p.yape,
  p.tarjetas,
  p.transferencias,
  p.total_payments,
  e.total_expenses,
  s.total_orders
FROM session_data s
CROSS JOIN payment_summary p
CROSS JOIN expense_summary e;

-- =====================================================
-- 6. VALIDACIÓN DE INTEGRIDAD
-- =====================================================

-- Verificar que sumatorias de pagos cuadran
SELECT 
  s.id,
  s.session_number,
  s.cash_total as stored_cash,
  COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0) as calculated_cash,
  s.cash_total - COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0) as cash_diff
FROM sales.cash_register_sessions s
LEFT JOIN sales.payments p ON p.cash_register_session_id = s.id AND p.deleted_at IS NULL
WHERE s.status = 'CERRADO'
GROUP BY s.id, s.session_number, s.cash_total
HAVING ABS(s.cash_total - COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0)) > 0.01
ORDER BY s.closed_at DESC;

-- Verificar balance esperado vs calculado
SELECT 
  s.id,
  s.session_number,
  s.opening_balance,
  s.cash_total,
  COALESCE((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = s.id), 0) as total_expenses,
  s.opening_balance + s.cash_total - COALESCE((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = s.id), 0) as calculated_expected,
  s.expected_balance as stored_expected,
  ABS(s.expected_balance - (s.opening_balance + s.cash_total - COALESCE((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = s.id), 0))) as diff
FROM sales.cash_register_sessions s
WHERE s.status = 'CERRADO'
  AND ABS(s.expected_balance - (s.opening_balance + s.cash_total - COALESCE((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = s.id), 0))) > 0.01
ORDER BY s.closed_at DESC;

-- Verificar que todas las órdenes con pagos tienen advance actualizado
SELECT 
  o.id,
  o.order_number,
  o.advance as stored_advance,
  COALESCE(SUM(p.amount), 0) as calculated_advance,
  o.advance - COALESCE(SUM(p.amount), 0) as difference
FROM sales.orders o
LEFT JOIN sales.payments p ON p.order_id = o.id AND p.deleted_at IS NULL
GROUP BY o.id, o.order_number, o.advance
HAVING ABS(o.advance - COALESCE(SUM(p.amount), 0)) > 0.01
ORDER BY o.created_at DESC;

-- =====================================================
-- 7. REPORTES GERENCIALES
-- =====================================================

-- Resumen por tienda (últimos 30 días)
SELECT 
  sh.name as shop_name,
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(DISTINCT CASE WHEN s.status = 'ABIERTO' THEN s.id END) as open_sessions,
  COUNT(DISTINCT CASE WHEN s.status = 'CERRADO' THEN s.id END) as closed_sessions,
  COALESCE(SUM(s.cash_total), 0) as total_cash,
  COALESCE(SUM(s.card_total), 0) as total_cards,
  COALESCE(SUM(s.digital_wallet_total), 0) as total_digital,
  COALESCE(SUM(s.cash_total + s.card_total + s.transfer_total + s.digital_wallet_total + s.other_total), 0) as total_collected,
  COALESCE(SUM((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = s.id)), 0) as total_expenses,
  COUNT(DISTINCT o.id) as total_orders
FROM core.shops sh
LEFT JOIN sales.cash_register_sessions s ON s.shop_id = sh.id 
  AND s.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN sales.payments p ON p.cash_register_session_id = s.id
LEFT JOIN sales.orders o ON o.id = p.order_id
GROUP BY sh.name
ORDER BY total_collected DESC;

-- Rendimiento por cajero (últimos 30 días)
SELECT 
  p.first_name || ' ' || p.last_name as cashier_name,
  COUNT(DISTINCT s.id) as sessions_worked,
  AVG(EXTRACT(EPOCH FROM (COALESCE(s.closed_at, NOW()) - s.opened_at)) / 3600) as avg_session_hours,
  SUM(s.total_orders) as total_orders,
  COALESCE(SUM(s.cash_total + s.card_total + s.transfer_total + s.digital_wallet_total + s.other_total), 0) as total_collected,
  COALESCE(SUM(s.cash_total + s.card_total + s.transfer_total + s.digital_wallet_total + s.other_total), 0) / NULLIF(COUNT(DISTINCT s.id), 0) as avg_per_session
FROM sales.cash_register_sessions s
JOIN hr.employees e ON s.cashier_id = e.id
JOIN core.persons p ON e.person_id = p.id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.first_name, p.last_name
ORDER BY total_collected DESC;

-- Métodos de pago más usados (últimos 30 días)
SELECT 
  payment_method,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_transaction,
  MIN(amount) as min_transaction,
  MAX(amount) as max_transaction,
  ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sales.payments WHERE created_at >= NOW() - INTERVAL '30 days' AND deleted_at IS NULL))::numeric, 2) as percentage
FROM sales.payments
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY payment_method
ORDER BY total_amount DESC;

-- =====================================================
-- 8. DEBUGGING Y TROUBLESHOOTING
-- =====================================================

-- Ver logs de errores (si hay tabla de logs)
-- SELECT * FROM logs WHERE level = 'ERROR' ORDER BY created_at DESC LIMIT 50;

-- Sesiones con diferencias significativas (> S/. 10)
SELECT 
  s.id,
  s.session_number,
  sh.name as shop_name,
  p.first_name || ' ' || p.last_name as cashier_name,
  s.closed_at,
  s.difference,
  CASE 
    WHEN s.difference > 0 THEN 'SOBRANTE'
    WHEN s.difference < 0 THEN 'FALTANTE'
  END as type,
  s.closing_notes
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.id
LEFT JOIN hr.employees e ON s.cashier_id = e.id
LEFT JOIN core.persons p ON e.person_id = p.id
WHERE s.status = 'CERRADO'
  AND ABS(s.difference) > 10
ORDER BY ABS(s.difference) DESC;

-- Sesiones que tardaron más de 12 horas
SELECT 
  s.id,
  s.session_number,
  sh.name as shop_name,
  s.opened_at,
  s.closed_at,
  EXTRACT(EPOCH FROM (COALESCE(s.closed_at, NOW()) - s.opened_at)) / 3600 as hours,
  s.status
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.id
WHERE EXTRACT(EPOCH FROM (COALESCE(s.closed_at, NOW()) - s.opened_at)) / 3600 > 12
ORDER BY hours DESC;

-- Órdenes con estado inconsistente
SELECT 
  o.id,
  o.order_number,
  o.final_amount,
  o.advance,
  o.remaining_balance,
  o.payment_status,
  CASE 
    WHEN o.remaining_balance = 0 AND o.payment_status != 'PAGADO' THEN 'Debe estar PAGADO'
    WHEN o.remaining_balance > 0 AND o.advance = 0 AND o.payment_status != 'PENDIENTE' THEN 'Debe estar PENDIENTE'
    WHEN o.remaining_balance > 0 AND o.advance > 0 AND o.payment_status != 'PARCIAL' THEN 'Debe estar PARCIAL'
    ELSE 'OK'
  END as issue
FROM sales.orders o
WHERE (
  (o.remaining_balance = 0 AND o.payment_status != 'PAGADO') OR
  (o.remaining_balance > 0 AND o.advance = 0 AND o.payment_status != 'PENDIENTE') OR
  (o.remaining_balance > 0 AND o.advance > 0 AND o.payment_status != 'PARCIAL')
)
ORDER BY o.created_at DESC;

-- =====================================================
-- 9. LIMPIEZA Y MANTENIMIENTO
-- =====================================================

-- Ver espacio usado por tablas principales
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'sales'
ORDER BY size_bytes DESC;

-- Ver índices no utilizados (requiere pg_stat_statements)
-- SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname = 'sales';

-- =====================================================
-- 10. BACKUPS Y EXPORTACIÓN
-- =====================================================

-- Exportar resumen de sesiones cerradas del mes
COPY (
  SELECT 
    s.session_number,
    sh.name as shop_name,
    p.first_name || ' ' || p.last_name as cashier_name,
    s.opened_at,
    s.closed_at,
    s.opening_balance,
    s.closing_balance,
    s.expected_balance,
    s.difference,
    s.cash_total,
    s.card_total,
    s.transfer_total,
    s.digital_wallet_total,
    s.other_total,
    s.total_orders,
    s.total_payments
  FROM sales.cash_register_sessions s
  JOIN core.shops sh ON s.shop_id = sh.id
  LEFT JOIN hr.employees e ON s.cashier_id = e.id
  LEFT JOIN core.persons p ON e.person_id = p.id
  WHERE s.status = 'CERRADO'
    AND DATE_TRUNC('month', s.closed_at) = DATE_TRUNC('month', NOW())
  ORDER BY s.closed_at DESC
) TO '/tmp/sessions_export.csv' WITH CSV HEADER;

-- =====================================================
-- NOTAS DE USO:
-- =====================================================
-- 
-- 1. Reemplazar 'SESSION_UUID_HERE' con el UUID real de la sesión
-- 2. Reemplazar 'SHOP_UUID_HERE' con el UUID real de la tienda
-- 3. Ajustar rangos de fechas según necesidad
-- 4. Algunos queries requieren permisos especiales
-- 5. Los queries con COPY requieren permisos de escritura en filesystem
-- 
-- =====================================================
