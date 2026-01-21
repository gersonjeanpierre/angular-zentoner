# 🏗️ Mejores Prácticas PostgreSQL para Supabase - Sistema POS

## 📋 Índice

1. [Optimizaciones Implementadas](#optimizaciones-implementadas)
2. [Índices Estratégicos](#indices-estrategicos)
3. [Funciones RPC vs Queries Directas](#funciones-rpc-vs-queries-directas)
4. [Performance y Escalabilidad](#performance-y-escalabilidad)
5. [Seguridad](#seguridad)
6. [Mantenimiento](#mantenimiento)

---

## ✅ Optimizaciones Implementadas

### 1. **Tipos de Datos Óptimos**

```sql
-- ✓ CORRECTO: NUMERIC para dinero (precisión exacta)
total_price NUMERIC(15,4)  -- Hasta 99,999,999,999.9999

-- ✗ EVITAR: FLOAT/REAL (imprecisión en decimales)
-- total_price FLOAT  -- ❌ NO usar para dinero

-- ✓ CORRECTO: TEXT con CHECK en lugar de VARCHAR
payment_method TEXT NOT NULL
CHECK (payment_method IN ('EFECTIVO', 'TARJETA_DEBITO', ...))

-- ✓ CORRECTO: SMALLINT para IDs limitados (status_id)
status_id SMALLINT  -- -32768 a 32767

-- ✓ CORRECTO: TIMESTAMPTZ para fechas (incluye timezone)
created_at TIMESTAMPTZ DEFAULT NOW()
```

**Razones:**

- `NUMERIC`: Sin pérdida de precisión en cálculos monetarios
- `TEXT`: PostgreSQL optimiza internamente, no hay diferencia con VARCHAR
- `TIMESTAMPTZ`: Maneja zonas horarias automáticamente
- `SMALLINT`: Ahorra espacio cuando el rango es limitado

---

### 2. **Constraints de Validación**

```sql
-- Validación a nivel de base de datos (CRÍTICO)
ALTER TABLE sales.orders
  ADD CONSTRAINT chk_advance CHECK (advance >= 0 AND advance <= final_amount),
  ADD CONSTRAINT chk_remaining_balance CHECK (remaining_balance >= 0),
  ADD CONSTRAINT chk_discount CHECK (discount >= 0 AND discount <= total_price);

-- Ventajas:
-- ✓ Validación garantizada incluso si el frontend falla
-- ✓ Protección contra inserts/updates directos
-- ✓ Documentación de reglas de negocio en la DB
```

---

### 3. **Triggers para Updated_at**

```sql
-- Trigger automático para updated_at
CREATE TRIGGER trg_update_orders_timestamp
  BEFORE UPDATE ON sales.orders
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

-- Función reutilizable
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Ventajas:**

- Garantiza que `updated_at` siempre se actualiza
- Código más limpio en aplicación
- Auditoría consistente

---

## 🚀 Índices Estratégicos

### Análisis de Queries Comunes

```sql
-- Query 1: Buscar órdenes del día por payment_status
SELECT * FROM sales.orders
WHERE DATE(created_at) = CURRENT_DATE
  AND payment_status = 'PARCIAL';

-- Índice óptimo:
CREATE INDEX idx_orders_created_date_payment_status
ON sales.orders (DATE(created_at), payment_status);

-- Query 2: Buscar pagos de una sesión
SELECT * FROM sales.payments
WHERE cash_register_session_id = '...';

-- Índice óptimo:
CREATE INDEX idx_payments_session
ON sales.payments (cash_register_session_id);

-- Query 3: Buscar órdenes de un cliente con saldo pendiente
SELECT * FROM sales.orders
WHERE customer_id = '...'
  AND payment_status IN ('PENDIENTE', 'PARCIAL');

-- Índice óptimo:
CREATE INDEX idx_orders_customer_status
ON sales.orders (customer_id, payment_status);
```

### Índices Parciales (Partial Indexes)

```sql
-- Solo indexar órdenes con pago pendiente/parcial
CREATE INDEX idx_orders_payment_status
ON sales.orders (payment_status)
WHERE payment_status != 'PAGADO';

-- Ventaja: Índice más pequeño = búsquedas más rápidas
-- Las órdenes pagadas (que son mayoría) no ocupan espacio en el índice
```

### Índices Compuestos (Composite Indexes)

```sql
-- Orden de columnas: MÁS SELECTIVA primero
CREATE INDEX idx_orders_order_number_status
ON sales.orders (order_number, status_id);

-- order_number es única = muy selectiva ✓
-- status_id tiene pocos valores = poco selectiva

-- Este índice sirve para:
-- 1. WHERE order_number = X AND status_id = Y
-- 2. WHERE order_number = X (solo la primera columna)

-- NO sirve para:
-- WHERE status_id = Y (segunda columna sola)
```

### Verificar Uso de Índices

```sql
-- Analizar query plan
EXPLAIN ANALYZE
SELECT * FROM sales.orders
WHERE payment_status = 'PARCIAL'
  AND DATE(created_at) = CURRENT_DATE;

-- Buscar:
-- - "Index Scan" = ✓ usa índice
-- - "Seq Scan" = ✗ escanea toda la tabla (lento)
-- - "Bitmap Index Scan" = ✓ usa índice (múltiples condiciones)
```

---

## 🔧 Funciones RPC vs Queries Directas

### ¿Cuándo usar Funciones RPC?

#### ✅ USAR RPC para:

1. **Operaciones Multi-Tabla Atómicas**

```sql
-- Registrar pago requiere actualizar 2 tablas
CREATE FUNCTION sales.register_payment(...)
RETURNS JSON AS $$
BEGIN
  -- 1. INSERT en payments
  -- 2. UPDATE en orders
  -- Todo dentro de una transacción
END;
$$ LANGUAGE plpgsql;

-- Ventajas:
-- ✓ Atomicidad garantizada (todo o nada)
-- ✓ Una sola llamada desde frontend
-- ✓ Validaciones en la DB
```

2. **Lógica de Negocio Compleja**

```sql
-- Cerrar caja: muchos cálculos
CREATE FUNCTION sales.close_cash_register_session(...)
RETURNS JSON AS $$
BEGIN
  -- Calcular totales por método de pago
  -- Calcular balance esperado
  -- Calcular diferencia
  -- Actualizar sesión
END;
$$;
```

3. **Queries con Joins Complejos**

```sql
-- Resumen con múltiples JOINS
CREATE FUNCTION sales.get_daily_sales_summary(...)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT o.*, c.name, e.name, ...
  FROM orders o
  LEFT JOIN customers c ...
  LEFT JOIN employees e ...
  WHERE ...;
END;
$$;

-- Ventajas:
-- ✓ Performance (compilado una vez)
-- ✓ Reutilización
-- ✓ Mantenimiento centralizado
```

#### ❌ NO usar RPC para:

1. **Queries Simples**

```sql
-- ✗ NO crear RPC para esto:
SELECT * FROM sales.orders WHERE id = '...';

-- ✓ Hacer desde frontend:
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .single();
```

2. **Listados con Paginación Dinámica**

```sql
-- ✗ NO usar RPC con parámetros variables
-- ✓ Usar query builder de Supabase:
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('shop_id', shopId)
  .order('created_at', { ascending: false })
  .range(0, 19);  // Paginación flexible
```

---

## 📈 Performance y Escalabilidad

### 1. **Particionamiento (Future)**

```sql
-- Cuando la tabla orders crezca mucho (>10M registros)
-- Particionar por fecha

CREATE TABLE sales.orders_2026_01 PARTITION OF sales.orders
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE sales.orders_2026_02 PARTITION OF sales.orders
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Ventajas:
-- ✓ Queries por fecha = solo escanean partición relevante
-- ✓ Eliminar datos antiguos = DROP PARTITION (instantáneo)
-- ✓ Mantenimiento más eficiente
```

### 2. **Materialized Views para Reportes**

```sql
-- Vista materializada: reporte de ventas mensuales
CREATE MATERIALIZED VIEW sales.monthly_sales_summary AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_orders,
  SUM(final_amount) AS total_sales,
  SUM(advance) AS total_collected,
  SUM(remaining_balance) AS total_pending
FROM sales.orders
GROUP BY month;

-- Crear índice en la vista
CREATE INDEX idx_monthly_sales_month
ON sales.monthly_sales_summary (month);

-- Refrescar vista (ejecutar diariamente con cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY sales.monthly_sales_summary;

-- Ventajas:
-- ✓ Reportes instantáneos (pre-calculados)
-- ✓ No impacta performance de operaciones diarias
-- ✓ Se puede refrescar en horarios de baja carga
```

### 3. **Connection Pooling (Supabase)**

```typescript
// Supabase ya maneja pooling, pero configurar límites
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
  },
  global: {
    headers: {
      'x-application-name': 'zentoner-pos',
    },
  },
});

// Límites recomendados:
// - Free tier: 60 conexiones
// - Pro tier: 200 conexiones
// - Timeout: 30 segundos
```

### 4. **Análisis de Queries Lentas**

```sql
-- Habilitar pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Ver queries más lentas
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Identificar queries que necesitan optimización
```

---

## 🔒 Seguridad

### 1. **Row Level Security (RLS)**

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE sales.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.cash_register_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Employees solo ven su shop
CREATE POLICY employee_shop_access ON sales.orders
FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM hr.employees
    WHERE user_id = auth.uid()
  )
);

-- Política: Solo cashiers pueden ver sesiones de caja
CREATE POLICY cashier_sessions ON sales.cash_register_sessions
FOR ALL
USING (
  cashier_id IN (
    SELECT id FROM hr.employees
    WHERE user_id = auth.uid()
  )
);

-- Política: Admins ven todo
CREATE POLICY admin_full_access ON sales.orders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM hr.employees
    WHERE user_id = auth.uid()
      AND role = 'ADMIN'
  )
);
```

### 2. **Funciones SECURITY DEFINER**

```sql
-- SECURITY DEFINER = ejecuta con permisos del dueño (DB)
CREATE OR REPLACE FUNCTION sales.register_payment(...)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- ← Importante
SET search_path = public
AS $$
BEGIN
  -- Validación de usuario
  IF NOT EXISTS (
    SELECT 1 FROM hr.employees
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuario no autorizado';
  END IF;

  -- Lógica de la función...
END;
$$;

-- GRANT solo a usuarios autenticados
GRANT EXECUTE ON FUNCTION sales.register_payment TO authenticated;

-- REVOKE de usuarios anónimos
REVOKE EXECUTE ON FUNCTION sales.register_payment FROM anon;
```

### 3. **SQL Injection Prevention**

```sql
-- ✓ CORRECTO: Usar parámetros ($1, $2)
CREATE FUNCTION get_order(p_order_id UUID)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM sales.orders WHERE id = p_order_id;
END;
$$;

-- ✗ INCORRECTO: Concatenar strings
-- CREATE FUNCTION get_order(p_order_id TEXT) AS $$
-- BEGIN
--   RETURN QUERY EXECUTE 'SELECT * FROM sales.orders WHERE id = ' || p_order_id;
-- END;
-- $$;  -- ❌ Vulnerable a SQL injection
```

---

## 🛠️ Mantenimiento

### 1. **VACUUM y ANALYZE**

```sql
-- Supabase hace esto automáticamente, pero verificar:

-- Ver última vez que se hizo vacuum
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'sales';

-- Vacuum manual (si es necesario)
VACUUM ANALYZE sales.orders;
VACUUM ANALYZE sales.payments;
```

### 2. **Monitoreo de Tamaño de Tablas**

```sql
-- Ver tamaño de tablas y sus índices
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'sales'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. **Backup Strategy**

```sql
-- Supabase hace backups automáticos, pero:

-- Exportar datos críticos periódicamente
COPY (
  SELECT * FROM sales.orders
  WHERE created_at >= '2026-01-01'
) TO '/tmp/orders_2026_01.csv' WITH CSV HEADER;

-- Backup de funciones y schema
pg_dump -h <host> -U <user> -d <db> --schema=sales --schema-only > schema_backup.sql
```

### 4. **Archivado de Datos Antiguos**

```sql
-- Crear tabla de archivo
CREATE TABLE sales.orders_archive (LIKE sales.orders INCLUDING ALL);

-- Mover órdenes antiguas (>2 años)
WITH moved_orders AS (
  DELETE FROM sales.orders
  WHERE created_at < NOW() - INTERVAL '2 years'
  RETURNING *
)
INSERT INTO sales.orders_archive SELECT * FROM moved_orders;

-- Liberar espacio
VACUUM FULL sales.orders;
```

---

## 📊 Métricas de Performance

### Benchmarks Esperados

| Operación                       | Tiempo Esperado | Observaciones              |
| ------------------------------- | --------------- | -------------------------- |
| `register_payment()`            | < 50ms          | Con índices correctos      |
| `get_daily_sales_summary()`     | < 100ms         | ~100 órdenes/día           |
| `close_cash_register_session()` | < 200ms         | Incluye cálculos agregados |
| Query orden por ID              | < 10ms          | Índice en PK               |
| Listado órdenes (20 items)      | < 50ms          | Con paginación             |

### Alertas

🚨 **Crear alertas para:**

- Query > 500ms
- Tabla > 10GB sin particionamiento
- Índices no usados (verificar con `pg_stat_user_indexes`)
- Conexiones > 80% del límite

---

## 🎯 Checklist Final

### Base de Datos

- [x] Tipos de datos óptimos (NUMERIC, TIMESTAMPTZ)
- [x] Constraints de validación
- [x] Triggers para updated_at
- [x] Índices estratégicos
- [x] Índices parciales donde aplique
- [x] Funciones RPC para lógica compleja
- [x] SECURITY DEFINER en funciones sensibles
- [x] Row Level Security habilitado

### Performance

- [x] EXPLAIN ANALYZE en queries críticas
- [ ] Materialized views para reportes (cuando necesario)
- [ ] Particionamiento (cuando > 10M registros)
- [ ] Monitoreo de queries lentas

### Seguridad

- [x] RLS en todas las tablas
- [x] Políticas por rol
- [x] Validación en funciones RPC
- [x] GRANT/REVOKE apropiados
- [ ] Auditoría de accesos (logs)

### Mantenimiento

- [ ] Backup automático configurado
- [ ] Estrategia de archivado
- [ ] Monitoreo de tamaño de tablas
- [ ] VACUUM automático verificado

---

## 📚 Referencias

- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Supabase Performance Best Practices](https://supabase.com/docs/guides/database/performance)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**Autor:** GitHub Copilot  
**Fecha:** 2026-01-20  
**Versión:** 1.0
