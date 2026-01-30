# Consultas SQL para Testing y Debugging - Control de Sesiones

## 🔍 Consultas de Diagnóstico

### 1. Ver Todas las Sesiones Abiertas

```sql
SELECT
  s.session_id,
  s.shop_id,
  sh.shop_name,
  s.cashier_id,
  e.first_name || ' ' || e.last_name AS cashier_name,
  s.session_number,
  s.session_type,
  s.opened_at,
  s.opening_balance,
  s.closed_at,
  CASE
    WHEN s.closed_at IS NULL THEN 'ABIERTA'
    ELSE 'CERRADA'
  END AS estado
FROM sales.cash_register_sessions s
LEFT JOIN core.shops sh ON s.shop_id = sh.shop_id
LEFT JOIN hr.employees e ON s.cashier_id = e.employee_id
WHERE s.closed_at IS NULL
ORDER BY s.opened_at DESC;
```

### 2. Ver Sesiones por Tienda

```sql
SELECT
  s.session_id,
  s.session_number,
  s.session_type,
  e.first_name || ' ' || e.last_name AS cajero,
  s.opened_at,
  s.closed_at,
  CASE
    WHEN s.closed_at IS NULL THEN 'ABIERTA'
    ELSE 'CERRADA'
  END AS estado
FROM sales.cash_register_sessions s
LEFT JOIN hr.employees e ON s.cashier_id = e.employee_id
WHERE s.shop_id = 'TU_SHOP_ID_AQUI'
ORDER BY s.opened_at DESC
LIMIT 10;
```

### 3. Verificar Constraint Activo

```sql
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sales.cash_register_sessions'::regclass
  AND conname = 'unique_open_session_per_shop';
```

### 4. Contar Sesiones Abiertas por Tienda

```sql
SELECT
  sh.shop_name,
  COUNT(*) AS sesiones_abiertas
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.shop_id
WHERE s.closed_at IS NULL
GROUP BY sh.shop_name
HAVING COUNT(*) > 0;
```

## 🧪 Tests Funcionales

### Test 1: Intentar Abrir Dos Sesiones en Misma Tienda

```sql
-- Paso 1: Abrir primera sesión (debe funcionar)
INSERT INTO sales.cash_register_sessions (
  shop_id,
  cashier_id,
  session_number,
  session_type,
  opening_balance
) VALUES (
  'shop-uuid-1',
  'cashier-uuid-A',
  1,
  'PARCIAL',
  100.00
);

-- Paso 2: Intentar abrir segunda sesión (debe fallar)
INSERT INTO sales.cash_register_sessions (
  shop_id,
  cashier_id,
  session_number,
  session_type,
  opening_balance
) VALUES (
  'shop-uuid-1',  -- Mismo shop_id
  'cashier-uuid-B',  -- Diferente cajero
  2,
  'PARCIAL',
  150.00
);

-- Resultado esperado: ERROR
-- duplicate key value violates unique constraint "unique_open_session_per_shop"
```

### Test 2: Validar Acceso de Cajero Correcto

```sql
-- Validar que el cajero A puede acceder (tiene la sesión abierta)
SELECT * FROM sales.check_dashboard_access(
  'user-id-cashier-A',  -- User ID del cajero A
  'shop-uuid-1'         -- Shop ID
);

-- Resultado esperado:
-- can_access: TRUE
-- reason: "Acceso permitido"
-- session_id: <UUID de la sesión>
-- session_number: 1
```

### Test 3: Validar Acceso Denegado a Cajero B

```sql
-- Validar que el cajero B NO puede acceder (otro cajero tiene sesión)
SELECT * FROM sales.check_dashboard_access(
  'user-id-cashier-B',  -- User ID del cajero B
  'shop-uuid-1'         -- Mismo shop ID
);

-- Resultado esperado:
-- can_access: FALSE
-- reason: "Otro cajero tiene la sesión activa"
-- session_id: <UUID de la sesión de Cajero A>
-- session_number: 1
```

### Test 4: Cerrar Sesión y Permitir Nueva

```sql
-- Paso 1: Cerrar sesión de Cajero A
UPDATE sales.cash_register_sessions
SET
  closed_at = now(),
  closing_balance = 500.00,
  closing_notes = 'Cierre de prueba'
WHERE shop_id = 'shop-uuid-1'
  AND closed_at IS NULL;

-- Paso 2: Verificar que no hay sesión abierta
SELECT * FROM sales.get_open_session_by_shop('shop-uuid-1');
-- Resultado esperado: 0 filas

-- Paso 3: Cajero B ahora puede abrir sesión
INSERT INTO sales.cash_register_sessions (
  shop_id,
  cashier_id,
  session_number,
  session_type,
  opening_balance
) VALUES (
  'shop-uuid-1',
  'cashier-uuid-B',
  2,
  'PARCIAL',
  200.00
);
-- Resultado esperado: Inserción exitosa ✅
```

### Test 5: Validar Función get_open_session_by_shop

```sql
-- Debe retornar la sesión abierta si existe
SELECT * FROM sales.get_open_session_by_shop('shop-uuid-1');

-- Resultado esperado si hay sesión:
-- session_id | shop_id | cashier_id | session_number | session_type | opened_at | opening_balance

-- Resultado esperado si NO hay sesión:
-- 0 filas
```

## 🔧 Queries de Mantenimiento

### 1. Cerrar Sesión Manualmente (Admin)

```sql
-- Cerrar sesión específica por ID
UPDATE sales.cash_register_sessions
SET
  closed_at = now(),
  closing_balance = opening_balance,  -- O el balance real
  closing_notes = 'Cerrada manualmente por administrador'
WHERE session_id = 'SESSION_UUID_AQUI'
  AND closed_at IS NULL;
```

### 2. Cerrar Todas las Sesiones de un Shop (Emergencia)

```sql
-- ⚠️ Usar solo en emergencias
UPDATE sales.cash_register_sessions
SET
  closed_at = now(),
  closing_balance = opening_balance,
  closing_notes = 'Cierre de emergencia'
WHERE shop_id = 'SHOP_UUID_AQUI'
  AND closed_at IS NULL;
```

### 3. Ver Historial de Sesiones de un Cajero

```sql
SELECT
  s.session_id,
  sh.shop_name,
  s.session_number,
  s.session_type,
  s.opened_at,
  s.closed_at,
  s.opening_balance,
  s.closing_balance,
  EXTRACT(EPOCH FROM (s.closed_at - s.opened_at))/3600 AS horas_duracion,
  CASE
    WHEN s.closed_at IS NULL THEN 'ABIERTA'
    ELSE 'CERRADA'
  END AS estado
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.shop_id
WHERE s.cashier_id = 'CASHIER_UUID_AQUI'
ORDER BY s.opened_at DESC
LIMIT 20;
```

### 4. Ver Sesiones Activas con Tiempo Transcurrido

```sql
SELECT
  s.session_id,
  sh.shop_name,
  e.first_name || ' ' || e.last_name AS cajero,
  s.session_number,
  s.opened_at,
  NOW() - s.opened_at AS tiempo_abierta,
  EXTRACT(HOUR FROM (NOW() - s.opened_at)) AS horas_transcurridas
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.shop_id
JOIN hr.employees e ON s.cashier_id = e.employee_id
WHERE s.closed_at IS NULL
ORDER BY s.opened_at ASC;
```

## 🐛 Debugging

### 1. Verificar Relación Usuario → Empleado

```sql
-- Encontrar employee_id de un user_id
SELECT
  e.employee_id,
  e.first_name || ' ' || e.last_name AS nombre,
  e.user_id,
  e.shop_id,
  sh.shop_name
FROM hr.employees e
LEFT JOIN core.shops sh ON e.shop_id = sh.shop_id
WHERE e.user_id = 'USER_UUID_AQUI';

-- Si no retorna nada, el usuario no tiene empleado asociado
```

### 2. Verificar Shop Asignado a Usuario

```sql
-- Obtener shop_id del usuario desde employees
SELECT
  u.id AS user_id,
  u.email,
  e.employee_id,
  e.shop_id,
  sh.shop_name
FROM auth.users u
LEFT JOIN hr.employees e ON u.id = e.user_id
LEFT JOIN core.shops sh ON e.shop_id = sh.shop_id
WHERE u.id = 'USER_UUID_AQUI';
```

### 3. Ver Estado Completo de una Sesión

```sql
SELECT
  s.*,
  sh.shop_name,
  e.first_name || ' ' || e.last_name AS cajero_nombre,
  u.email AS cajero_email,
  CASE
    WHEN s.closed_at IS NULL THEN 'ABIERTA'
    ELSE 'CERRADA'
  END AS estado,
  EXTRACT(EPOCH FROM (COALESCE(s.closed_at, NOW()) - s.opened_at))/3600 AS horas_duracion
FROM sales.cash_register_sessions s
LEFT JOIN core.shops sh ON s.shop_id = sh.shop_id
LEFT JOIN hr.employees e ON s.cashier_id = e.employee_id
LEFT JOIN auth.users u ON e.user_id = u.id
WHERE s.session_id = 'SESSION_UUID_AQUI';
```

### 4. Verificar Permisos de Funciones RPC

```sql
-- Ver funciones RPC disponibles
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sales'
  AND p.proname IN ('check_dashboard_access', 'get_open_session_by_shop');
```

## 📊 Queries de Reporte

### 1. Resumen de Sesiones por Día

```sql
SELECT
  DATE(s.opened_at) AS fecha,
  COUNT(*) AS total_sesiones,
  COUNT(DISTINCT s.cashier_id) AS cajeros_unicos,
  COUNT(DISTINCT s.shop_id) AS tiendas_activas,
  SUM(s.opening_balance) AS balance_inicial_total,
  SUM(COALESCE(s.closing_balance, 0)) AS balance_final_total
FROM sales.cash_register_sessions s
WHERE s.opened_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(s.opened_at)
ORDER BY fecha DESC;
```

### 2. Sesiones por Tipo (PARCIAL vs FINAL)

```sql
SELECT
  sh.shop_name,
  s.session_type,
  COUNT(*) AS cantidad,
  AVG(EXTRACT(EPOCH FROM (s.closed_at - s.opened_at))/3600) AS promedio_horas
FROM sales.cash_register_sessions s
JOIN core.shops sh ON s.shop_id = sh.shop_id
WHERE s.opened_at >= CURRENT_DATE - INTERVAL '30 days'
  AND s.closed_at IS NOT NULL
GROUP BY sh.shop_name, s.session_type
ORDER BY sh.shop_name, s.session_type;
```

### 3. Cajeros Más Activos

```sql
SELECT
  e.first_name || ' ' || e.last_name AS cajero,
  sh.shop_name,
  COUNT(*) AS total_sesiones,
  COUNT(CASE WHEN s.closed_at IS NULL THEN 1 END) AS sesiones_abiertas,
  MAX(s.opened_at) AS ultima_sesion
FROM sales.cash_register_sessions s
JOIN hr.employees e ON s.cashier_id = e.employee_id
JOIN core.shops sh ON s.shop_id = sh.shop_id
WHERE s.opened_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY e.employee_id, e.first_name, e.last_name, sh.shop_name
ORDER BY total_sesiones DESC
LIMIT 10;
```

## 🔒 Queries de Seguridad

### 1. Detectar Intentos de Acceso No Autorizado (Logs)

```sql
-- Esta query requiere que tengas logs habilitados
-- Ejemplo conceptual (ajustar según tu sistema de logs)
SELECT
  timestamp,
  user_id,
  operation,
  details
FROM audit_logs
WHERE operation LIKE '%check_dashboard_access%'
  AND details->>'can_access' = 'false'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### 2. Verificar Integridad del Constraint

```sql
-- Verificar que no haya sesiones duplicadas abiertas (no debería pasar)
SELECT
  shop_id,
  COUNT(*) AS sesiones_abiertas
FROM sales.cash_register_sessions
WHERE closed_at IS NULL
GROUP BY shop_id
HAVING COUNT(*) > 1;

-- Resultado esperado: 0 filas
-- Si retorna filas, hay un problema crítico
```

## 💡 Tips de Performance

### 1. Índices Recomendados

```sql
-- Ver índices existentes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'cash_register_sessions'
  AND schemaname = 'sales';

-- Crear índices adicionales si no existen
CREATE INDEX IF NOT EXISTS idx_sessions_shop_open
ON sales.cash_register_sessions(shop_id)
WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_cashier_open
ON sales.cash_register_sessions(cashier_id)
WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_opened_at
ON sales.cash_register_sessions(opened_at DESC);
```

### 2. Analizar Performance de Queries

```sql
-- Usar EXPLAIN ANALYZE para ver plan de ejecución
EXPLAIN ANALYZE
SELECT * FROM sales.check_dashboard_access(
  'USER_UUID_AQUI',
  'SHOP_UUID_AQUI'
);
```

## 📝 Notas Importantes

1. **Reemplaza los UUIDs** de ejemplo con UUIDs reales de tu base de datos
2. **Protege queries de escritura** - Solo ejecutar UPDATE/DELETE en desarrollo o con backups
3. **Usa transacciones** para tests que modifican datos:
   ```sql
   BEGIN;
   -- Tus queries aquí
   ROLLBACK;  -- O COMMIT si quieres guardar cambios
   ```
4. **Documenta cambios** - Si haces modificaciones manuales, registra en logs

---

**Última actualización:** 2024
**Versión:** 1.0.0
