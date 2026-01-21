# 🎮 Ejemplos de Uso - Sistema POS

## 📋 Índice

1. [Configuración Inicial](#configuración-inicial)
2. [Crear una Orden](#crear-una-orden)
3. [Registrar Pagos](#registrar-pagos)
4. [Sesiones de Caja](#sesiones-de-caja)
5. [Consultas y Reportes](#consultas-y-reportes)
6. [Casos de Uso Completos](#casos-de-uso-completos)

---

## 🔧 Configuración Inicial

### 1. Aplicar Migración

```sql
-- Ejecutar el script de migración
\i media/db/06_MIGRATION_POS_PAYMENTS.sql

-- Verificar que las tablas se crearon
SELECT tablename FROM pg_tables WHERE schemaname = 'sales';
```

### 2. Verificar Funciones RPC

```sql
-- Listar funciones creadas
SELECT proname FROM pg_proc
WHERE pronamespace = 'sales'::regnamespace
AND proname LIKE '%payment%' OR proname LIKE '%session%';
```

---

## 🛒 Crear una Orden

### Ejemplo 1: Orden Simple con Pago Inmediato

```sql
-- 1. Crear la orden
INSERT INTO sales.orders (
  id, shop_id, customer_id, employee_id,
  total_price, discount, igv, final_amount, remaining_balance
) VALUES (
  gen_random_uuid(),
  '123e4567-e89b-12d3-a456-426614174000', -- shop_id
  '987fbc97-4bed-5078-9f07-9141ba07c9f3', -- customer_id
  '456e7890-e89b-12d3-a456-426614174001', -- employee_id
  250.00,    -- total_price (suma de items)
  0,         -- discount
  45.00,     -- igv (18% de 250)
  295.00,    -- final_amount (250 - 0 + 45)
  295.00     -- remaining_balance (inicialmente = final_amount)
)
RETURNING id, order_number;

-- Resultado:
--  id                                   | order_number
-- --------------------------------------+--------------
--  abc12345-e89b-12d3-a456-426614174002 | 1001
```

### Ejemplo 2: Orden con Descuento

```sql
INSERT INTO sales.orders (
  id, shop_id, customer_id, employee_id,
  total_price, discount, igv, final_amount, remaining_balance
) VALUES (
  gen_random_uuid(),
  '123e4567-e89b-12d3-a456-426614174000',
  '987fbc97-4bed-5078-9f07-9141ba07c9f3',
  '456e7890-e89b-12d3-a456-426614174001',
  500.00,    -- total_price
  50.00,     -- discount 10%
  81.00,     -- igv (18% de 450)
  531.00,    -- final_amount (500 - 50 + 81)
  531.00     -- remaining_balance
)
RETURNING id, order_number;
```

### Ejemplo 3: Agregar Detalles a la Orden

```sql
-- Insertar detalles de la orden
INSERT INTO sales.order_details (
  id, order_id, item_id, description, quantity, unit_price, subtotal
) VALUES
  (
    gen_random_uuid(),
    'abc12345-e89b-12d3-a456-426614174002', -- order_id
    'item-uuid-1',
    'Banner 13oz Impreso - 2m x 1m',
    1,      -- quantity
    150.00, -- unit_price
    150.00  -- subtotal
  ),
  (
    gen_random_uuid(),
    'abc12345-e89b-12d3-a456-426614174002',
    'item-uuid-2',
    'Lona Frontlight - 3m x 2m',
    1,
    100.00,
    100.00
  );
```

---

## 💰 Registrar Pagos

### Ejemplo 1: Pago Completo en Efectivo

```sql
-- Abrir sesión primero (ver sección siguiente)
-- Supongamos session_id = 'session-uuid-1'

SELECT sales.register_payment(
  p_order_id := 'abc12345-e89b-12d3-a456-426614174002',
  p_amount := 295.00,
  p_payment_method := 'EFECTIVO',
  p_cash_register_session_id := 'session-uuid-1',
  p_notes := 'Pago completo al contado'
);

-- Resultado:
{
  "success": true,
  "payment_id": "payment-uuid-1",
  "order_id": "abc12345-e89b-12d3-a456-426614174002",
  "amount_paid": 295.00,
  "new_advance": 295.00,
  "new_remaining_balance": 0,
  "payment_status": "PAGADO",
  "fully_paid": true
}
```

### Ejemplo 2: Adelanto del 50%

```sql
-- Cliente paga la mitad
SELECT sales.register_payment(
  p_order_id := 'order-uuid-2',
  p_amount := 265.50,  -- 50% de 531.00
  p_payment_method := 'TRANSFERENCIA',
  p_cash_register_session_id := 'session-uuid-1',
  p_transaction_reference := 'BCP-OP-12345678',
  p_notes := 'Adelanto del 50%',
  p_received_by_id := 'employee-uuid-1'
);

-- Resultado:
{
  "success": true,
  "payment_id": "payment-uuid-2",
  "order_id": "order-uuid-2",
  "amount_paid": 265.50,
  "new_advance": 265.50,
  "new_remaining_balance": 265.50,
  "payment_status": "PARCIAL",
  "fully_paid": false
}
```

### Ejemplo 3: Pago Final (días después)

```sql
-- Cliente vuelve a pagar el saldo restante
SELECT sales.register_payment(
  p_order_id := 'order-uuid-2',
  p_amount := 265.50,  -- Saldo restante
  p_payment_method := 'YAPE',
  p_cash_register_session_id := 'session-uuid-5',  -- ← Otra sesión (otro día)
  p_transaction_reference := 'YAPE-OP-987654',
  p_notes := 'Pago final',
  p_received_by_id := 'employee-uuid-1'
);

-- Resultado:
{
  "success": true,
  "payment_id": "payment-uuid-3",
  "order_id": "order-uuid-2",
  "amount_paid": 265.50,
  "new_advance": 531.00,
  "new_remaining_balance": 0,
  "payment_status": "PAGADO",
  "fully_paid": true
}
```

### Ejemplo 4: Pagos en 3 Cuotas

```sql
-- Pago 1: 30% (Lunes)
SELECT sales.register_payment(
  p_order_id := 'order-uuid-3',
  p_amount := 150.00,
  p_payment_method := 'EFECTIVO',
  p_cash_register_session_id := 'session-lunes-uuid',
  p_notes := 'Primera cuota (30%)'
);

-- Pago 2: 40% (Miércoles)
SELECT sales.register_payment(
  p_order_id := 'order-uuid-3',
  p_amount := 200.00,
  p_payment_method := 'TARJETA_DEBITO',
  p_cash_register_session_id := 'session-miercoles-uuid',
  p_notes := 'Segunda cuota (40%)'
);

-- Pago 3: 30% (Viernes)
SELECT sales.register_payment(
  p_order_id := 'order-uuid-3',
  p_amount := 150.00,
  p_payment_method := 'PLIN',
  p_cash_register_session_id := 'session-viernes-uuid',
  p_transaction_reference := 'PLIN-12345',
  p_notes := 'Pago final (30%)'
);
```

---

## 🏦 Sesiones de Caja

### Ejemplo 1: Abrir Caja (Turno Mañana)

```sql
SELECT sales.open_cash_register_session(
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000',
  p_cashier_id := 'cashier-uuid-1',
  p_opening_balance := 200.00,  -- Fondo inicial
  p_session_type := 'PARCIAL',
  p_opening_notes := 'Turno mañana - Todo en orden'
);

-- Resultado:
{
  "success": true,
  "session_id": "session-manana-uuid",
  "opened_at": "2026-01-20T08:00:00Z",
  "opening_balance": 200.00
}
```

### Ejemplo 2: Cerrar Caja (Corte Parcial)

```sql
-- Cashier cuenta el efectivo al final de su turno
SELECT sales.close_cash_register_session(
  p_session_id := 'session-manana-uuid',
  p_closing_balance := 1850.00,  -- Efectivo contado
  p_closing_notes := 'Corte parcial - Cambio de turno sin novedades'
);

-- Resultado:
{
  "success": true,
  "session_id": "session-manana-uuid",
  "closed_at": "2026-01-20T14:00:00Z",
  "opening_balance": 200.00,
  "closing_balance": 1850.00,
  "expected_balance": 1820.00,   -- 200 + efectivo de ventas
  "difference": 30.00,             -- SOBRANTE
  "cash_total": 1620.00,
  "card_total": 450.00,
  "transfer_total": 200.00,
  "digital_wallet_total": 100.00,
  "other_total": 0,
  "total_payments": 15,
  "total_orders": 8
}
```

### Ejemplo 3: Abrir Turno Tarde (con balance del anterior)

```sql
SELECT sales.open_cash_register_session(
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000',
  p_cashier_id := 'otro-cashier-uuid',
  p_opening_balance := 1850.00,  -- Balance del turno anterior
  p_session_type := 'FINAL',
  p_opening_notes := 'Turno tarde - Recibí S/ 1850 del turno mañana'
);
```

### Ejemplo 4: Cerrar Caja Final del Día

```sql
SELECT sales.close_cash_register_session(
  p_session_id := 'session-tarde-uuid',
  p_closing_balance := 2500.00,
  p_closing_notes := 'Cierre final del día - Efectivo depositado mañana'
);
```

---

## 📊 Consultas y Reportes

### Ejemplo 1: Resumen de Ventas del Día

```sql
SELECT * FROM sales.get_daily_sales_summary(
  p_date := '2026-01-20',
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000'
);

-- Resultado:
 order_id | order_number | customer_name  | total_price | advance | remaining_balance | payment_status | order_status | last_payment_date
----------+--------------+----------------+-------------+---------+-------------------+----------------+--------------+-------------------
 uuid-1   | 1001         | Juan Pérez     | 295.00      | 295.00  | 0.00              | PAGADO         | COMPLETADO   | 2026-01-20 10:30
 uuid-2   | 1002         | María López    | 531.00      | 265.50  | 265.50            | PARCIAL        | PENDIENTE    | 2026-01-20 11:00
 uuid-3   | 1003         | Pedro García   | 400.00      | 0.00    | 400.00            | PENDIENTE      | PENDIENTE    | NULL
```

### Ejemplo 2: Historial de Pagos de una Orden

```sql
SELECT * FROM sales.get_order_payment_history(
  p_order_id := 'order-uuid-3'
);

-- Resultado:
 payment_id | amount | payment_method    | payment_date         | received_by_name | session_number | session_type
------------+--------+-------------------+----------------------+------------------+----------------+--------------
 pay-uuid-3 | 150.00 | PLIN              | 2026-01-24 09:00:00  | Ana Martínez     | 110            | FINAL
 pay-uuid-2 | 200.00 | TARJETA_DEBITO    | 2026-01-22 15:00:00  | Ana Martínez     | 105            | PARCIAL
 pay-uuid-1 | 150.00 | EFECTIVO          | 2026-01-20 10:30:00  | Carlos Ruiz      | 101            | PARCIAL
```

### Ejemplo 3: Órdenes Pendientes de Pago

```sql
SELECT * FROM sales.get_pending_payment_orders(
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000'
);

-- Resultado:
 order_id | order_number | customer_name | customer_phone  | final_amount | advance | remaining_balance | days_pending
----------+--------------+---------------+-----------------+--------------+---------+-------------------+--------------
 uuid-2   | 1002         | María López   | +51 987 654 321 | 531.00       | 265.50  | 265.50            | 0
 uuid-3   | 1003         | Pedro García  | +51 912 345 678 | 400.00       | 0.00    | 400.00            | 0
 uuid-old | 995          | Luis Torres   | +51 998 765 432 | 850.00       | 300.00  | 550.00            | 7
```

### Ejemplo 4: Historial de Sesiones de Caja

```sql
SELECT
  session_number,
  session_type,
  status,
  opened_at,
  closed_at,
  opening_balance,
  closing_balance,
  difference,
  total_payments,
  total_orders
FROM sales.cash_register_sessions
WHERE shop_id = '123e4567-e89b-12d3-a456-426614174000'
  AND DATE(opened_at) = '2026-01-20'
ORDER BY opened_at ASC;

-- Resultado:
 session_number | session_type | status  | opened_at           | closed_at           | opening_balance | closing_balance | difference | total_payments | total_orders
----------------+--------------+---------+---------------------+---------------------+-----------------+-----------------+------------+----------------+--------------
 101            | PARCIAL      | CERRADO | 2026-01-20 08:00:00 | 2026-01-20 14:00:00 | 200.00          | 1850.00         | 30.00      | 15             | 8
 102            | FINAL        | CERRADO | 2026-01-20 14:00:00 | 2026-01-20 20:00:00 | 1850.00         | 2500.00         | -20.00     | 12             | 6
```

---

## 🎯 Casos de Uso Completos

### Caso 1: Flujo Completo - Orden con Pago Inmediato

```sql
-- 1. Employee crea orden
INSERT INTO sales.orders (
  id, shop_id, customer_id, employee_id,
  total_price, discount, igv, final_amount, remaining_balance
) VALUES (
  '11111111-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174000',
  '987fbc97-4bed-5078-9f07-9141ba07c9f3',
  '456e7890-e89b-12d3-a456-426614174001',
  300.00, 0, 54.00, 354.00, 354.00
);

-- 2. Cashier registra pago completo
SELECT sales.register_payment(
  p_order_id := '11111111-e89b-12d3-a456-426614174000',
  p_amount := 354.00,
  p_payment_method := 'EFECTIVO',
  p_cash_register_session_id := 'session-active-uuid'
);

-- 3. Verificar estado
SELECT
  order_number,
  payment_status,
  advance,
  remaining_balance
FROM sales.orders
WHERE id = '11111111-e89b-12d3-a456-426614174000';

-- Resultado:
-- order_number | payment_status | advance | remaining_balance
-- -------------+----------------+---------+-------------------
-- 1004         | PAGADO         | 354.00  | 0.00
```

### Caso 2: Orden con 2 Pagos en Días Diferentes

```sql
-- DÍA 1 (Lunes)
-- 1. Crear orden
INSERT INTO sales.orders (
  id, shop_id, customer_id, employee_id,
  total_price, discount, igv, final_amount, remaining_balance
) VALUES (
  '22222222-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174000',
  '987fbc97-4bed-5078-9f07-9141ba07c9f3',
  '456e7890-e89b-12d3-a456-426614174001',
  600.00, 60.00, 97.20, 637.20, 637.20
);

-- 2. Cliente paga adelanto del 40%
SELECT sales.register_payment(
  p_order_id := '22222222-e89b-12d3-a456-426614174000',
  p_amount := 250.00,
  p_payment_method := 'TRANSFERENCIA',
  p_cash_register_session_id := 'session-lunes-uuid',
  p_transaction_reference := 'BCP-OP-99887766',
  p_notes := 'Adelanto 40%'
);

-- DÍA 3 (Miércoles)
-- 3. Cliente paga el resto
SELECT sales.register_payment(
  p_order_id := '22222222-e89b-12d3-a456-426614174000',
  p_amount := 387.20,  -- Saldo restante
  p_payment_method := 'YAPE',
  p_cash_register_session_id := 'session-miercoles-uuid',
  p_transaction_reference := 'YAPE-OP-123456',
  p_notes := 'Pago final'
);

-- 4. Ver historial completo
SELECT * FROM sales.get_order_payment_history(
  p_order_id := '22222222-e89b-12d3-a456-426614174000'
);

-- Resultado:
-- payment_id | amount | payment_method | payment_date        | session_number
-- -----------+--------+----------------+---------------------+----------------
-- pay-2      | 387.20 | YAPE           | 2026-01-22 15:00:00 | 105
-- pay-1      | 250.00 | TRANSFERENCIA  | 2026-01-20 10:00:00 | 101
```

### Caso 3: Día Completo de Operaciones

```sql
-- MAÑANA (08:00)
-- 1. Abrir caja
SELECT sales.open_cash_register_session(
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000',
  p_cashier_id := 'cashier-uuid-1',
  p_opening_balance := 200.00,
  p_session_type := 'PARCIAL',
  p_opening_notes := 'Inicio de operaciones'
);
-- session_id = 'session-dia-uuid-1'

-- Durante la mañana: 5 órdenes, 3 pagos
-- ... (registros de pagos)

-- MEDIODÍA (14:00)
-- 2. Cerrar caja parcial
SELECT sales.close_cash_register_session(
  p_session_id := 'session-dia-uuid-1',
  p_closing_balance := 1500.00,
  p_closing_notes := 'Cambio de turno'
);

-- 3. Abrir turno tarde
SELECT sales.open_cash_register_session(
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000',
  p_cashier_id := 'otro-cashier-uuid',
  p_opening_balance := 1500.00,
  p_session_type := 'FINAL',
  p_opening_notes := 'Turno tarde'
);
-- session_id = 'session-dia-uuid-2'

-- Durante la tarde: 7 órdenes, 5 pagos
-- ... (registros de pagos)

-- NOCHE (20:00)
-- 4. Cerrar caja final
SELECT sales.close_cash_register_session(
  p_session_id := 'session-dia-uuid-2',
  p_closing_balance := 2800.00,
  p_closing_notes := 'Cierre del día - Todo correcto'
);

-- 5. Ver resumen del día completo
SELECT * FROM sales.get_daily_sales_summary(
  p_date := CURRENT_DATE,
  p_shop_id := '123e4567-e89b-12d3-a456-426614174000'
);
```

---

## 🧪 Tests / Validaciones

### Test 1: No permitir sobrepagos

```sql
-- Crear orden de S/ 100
INSERT INTO sales.orders (
  id, total_price, discount, igv, final_amount, remaining_balance
) VALUES (
  'test-uuid-1', 100.00, 0, 18.00, 118.00, 118.00
);

-- Intentar pagar S/ 200 (debe fallar)
SELECT sales.register_payment(
  p_order_id := 'test-uuid-1',
  p_amount := 200.00,
  p_payment_method := 'EFECTIVO'
);

-- Error esperado: "El monto 200 excede el saldo pendiente 118"
```

### Test 2: No permitir montos negativos

```sql
SELECT sales.register_payment(
  p_order_id := 'test-uuid-1',
  p_amount := -50.00,
  p_payment_method := 'EFECTIVO'
);

-- Error esperado: "El monto del pago debe ser mayor a 0"
```

### Test 3: No permitir abrir 2 sesiones del mismo cajero

```sql
-- Abrir primera sesión
SELECT sales.open_cash_register_session(
  p_shop_id := 'shop-uuid',
  p_cashier_id := 'cashier-uuid-1',
  p_opening_balance := 200.00
);

-- Intentar abrir segunda sesión (debe fallar)
SELECT sales.open_cash_register_session(
  p_shop_id := 'shop-uuid',
  p_cashier_id := 'cashier-uuid-1',
  p_opening_balance := 100.00
);

-- Error esperado: "El cajero ya tiene una sesión abierta"
```

---

## 📱 Ejemplos de Uso desde Frontend (TypeScript)

### Registrar un pago

```typescript
const { data, error } = await supabase.rpc('register_payment', {
  p_order_id: 'abc12345-...',
  p_amount: 150.0,
  p_payment_method: 'EFECTIVO',
  p_cash_register_session_id: currentSession.id,
  p_notes: 'Adelanto del cliente',
});

if (error) {
  console.error('Error:', error.message);
} else {
  console.log('Pago registrado:', data);
  // data.payment_status = 'PARCIAL' | 'PAGADO' | 'PENDIENTE'
  // data.new_remaining_balance = saldo pendiente
}
```

### Abrir sesión de caja

```typescript
const { data, error } = await supabase.rpc('open_cash_register_session', {
  p_shop_id: currentShop.id,
  p_cashier_id: currentEmployee.id,
  p_opening_balance: 200.0,
  p_session_type: 'PARCIAL',
  p_opening_notes: 'Turno mañana',
});

if (!error) {
  console.log('Sesión abierta:', data.session_id);
}
```

---

## 🎉 Conclusión

Estos ejemplos cubren los casos de uso más comunes del sistema POS. Para más información, revisar:

- **POS_SISTEMA_PAGOS_PARCIALES.md** - Documentación completa
- **POS_FLUJO_OPERACION.md** - Diagramas de flujo
- **FRONTEND_IMPLEMENTATION_GUIDE.md** - Guía de implementación

---

**Autor:** GitHub Copilot  
**Fecha:** 2026-01-20
