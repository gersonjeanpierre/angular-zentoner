# Flujos de Negocio - Sistema Zentoner

## 1. Flujo de Ventas (POS)

### 1.1 Crear Nueva Orden

```
START
  ├─> Validar usuario autenticado
  ├─> Seleccionar/Crear cliente
  │   └─> RPC: sales.create_customer()
  ├─> Crear orden
  │   └─> INSERT INTO sales.orders
  ├─> Agregar items a la orden
  │   └─> INSERT INTO sales.order_details (múltiples)
  ├─> Calcular totales (total_price, igv, final_amount)
  └─> Estado inicial: PENDIENTE (payment_status)
END
```

### 1.2 Registrar Pago (Parcial o Completo)

```
START
  ├─> Obtener sesión de caja activa
  ├─> Validar monto <= remaining_balance
  ├─> RPC: sales.register_payment()
  │   ├─> INSERT INTO sales.payments
  │   ├─> UPDATE sales.orders
  │   │   ├─> advance += amount
  │   │   ├─> remaining_balance -= amount
  │   │   └─> payment_status = CALCULATE()
  │   │       ├─> 'PAGADO' si remaining_balance = 0
  │   │       ├─> 'PARCIAL' si advance > 0
  │   │       └─> 'PENDIENTE' caso contrario
  │   └─> RETURN payment_info
  └─> Actualizar dashboard de caja
END
```

### 1.3 Sesión de Caja (Corte)

```
ABRIR SESIÓN
  ├─> RPC: sales.open_cash_register_session()
  ├─> Validar: no hay sesión abierta del mismo cajero
  ├─> INSERT INTO sales.cash_register_sessions
  │   ├─> opening_balance (efectivo inicial)
  │   ├─> status = 'ABIERTO'
  │   └─> session_type = 'PARCIAL' | 'FINAL'
  └─> RETURN session_id

REGISTRAR VENTA
  └─> Vincular payment con session_id

CERRAR SESIÓN
  ├─> RPC: sales.close_cash_register_session()
  ├─> Calcular totales por método de pago
  │   ├─> cash_total (EFECTIVO)
  │   ├─> card_total (TARJETA_*)
  │   ├─> transfer_total (TRANSFERENCIA)
  │   ├─> digital_wallet_total (YAPE + PLIN)
  │   └─> other_total (OTROS)
  ├─> Calcular balance esperado
  │   └─> expected_balance = opening_balance + cash_total
  ├─> Calcular diferencia
  │   └─> difference = closing_balance - expected_balance
  ├─> UPDATE sales.cash_register_sessions
  │   ├─> status = 'CERRADO'
  │   ├─> closed_at = NOW()
  │   └─> [todos los totales calculados]
  └─> RETURN resumen completo
```

## 2. Flujo de Inventario (Kardex)

### 2.1 Compra de Material

```
START
  ├─> Validar usuario: is_universal_manager()
  ├─> Crear/Seleccionar item
  │   └─> INSERT INTO inventory.items (si no existe)
  ├─> RPC: inventory.register_purchase()
  │   ├─> Generar código único de rollo
  │   ├─> INSERT INTO inventory.roll_tracking
  │   │   ├─> roll_code = 'ROLL-20260130-001'
  │   │   ├─> current_quantity = length_m del item
  │   │   └─> status = 'full'
  │   └─> INSERT INTO inventory.kardex
  │       ├─> movement_type_id = 1 (ENTRADA)
  │       ├─> movement_reason_id = 1 (COMPRA)
  │       ├─> quantity = current_quantity
  │       ├─> previous_balance = 0
  │       └─> subsequent_balance = current_quantity
  └─> RETURN {rollId, kardexId}
END
```

### 2.2 Consumo en Producción

```
START
  ├─> Crear job de producción
  │   └─> INSERT INTO production.jobs
  ├─> Seleccionar rollo a consumir
  │   └─> SELECT FROM inventory.roll_tracking WHERE status != 'depleted'
  ├─> Validar: current_quantity >= cantidad_a_consumir
  ├─> Registrar consumo técnico
  │   └─> INSERT INTO inventory.consumption_logs
  │       ├─> customer_quantity (lo que va al cliente)
  │       ├─> calibration_waste (merma técnica)
  │       ├─> error_waste (daño operativo)
  │       └─> width_used_mm, length_used_mm
  ├─> Calcular total_used
  │   └─> total_used = customer_quantity + calibration_waste + error_waste
  ├─> Actualizar rollo
  │   └─> UPDATE inventory.roll_tracking
  │       ├─> current_quantity -= total_used
  │       └─> status = CASE
  │           ├─> 'depleted' si current_quantity = 0
  │           ├─> 'in_use' si < original
  │           └─> 'full' caso contrario
  ├─> Registrar movimiento en kardex
  │   └─> INSERT INTO inventory.kardex
  │       ├─> movement_type_id = 2 (SALIDA)
  │       ├─> movement_reason_id = 3 (PRODUCCION)
  │       ├─> quantity = total_used
  │       ├─> previous_balance = stock_anterior
  │       └─> subsequent_balance = stock_anterior - total_used
  └─> Vincular consumo con kardex
      └─> INSERT INTO inventory.kardex_consumption
          ├─> kardex_id
          ├─> consumption_log_id
          └─> used_quantity = total_used
END
```

### 2.3 Ajuste Manual de Inventario

```
START
  ├─> Validar usuario: is_universal_manager()
  ├─> Obtener stock actual
  │   └─> SELECT FROM inventory.get_current_stock(item_id)
  ├─> Determinar diferencia
  │   └─> difference = stock_fisico - stock_sistema
  ├─> Registrar ajuste
  │   └─> INSERT INTO inventory.kardex
  │       ├─> movement_type_id = 3 (AJUSTE)
  │       ├─> movement_reason_id = 7 (AJUSTE_MANUAL)
  │       ├─> quantity = ABS(difference)
  │       ├─> previous_balance = stock_sistema
  │       └─> subsequent_balance = stock_fisico
  └─> Documentar razón
      └─> notes = "Ajuste por conteo físico"
END
```

## 3. Flujo de Clientes

### 3.1 Crear Cliente

```
START
  ├─> Validar usuario: is_creator()
  ├─> Validar datos
  │   ├─> DNI XOR CE (no ambos)
  │   ├─> Email válido (opcional)
  │   └─> RUC válido para persona JURIDICA
  ├─> RPC: sales.create_customer()
  │   ├─> INSERT INTO core.persons
  │   │   ├─> id (UUID del auth user si aplica)
  │   │   ├─> person_type = 'NATURAL' | 'JURIDICA'
  │   │   └─> [datos personales]
  │   ├─> INSERT INTO sales.customers
  │   │   ├─> id = person.id
  │   │   ├─> customer_code (generado)
  │   │   └─> customer_type_code
  │   └─> INSERT INTO core.audit_logs
  └─> RETURN customer_id
END
```

### 3.2 Actualizar Cliente

```
START
  ├─> Validar usuario: is_employee()
  ├─> RPC: sales.update_customer()
  │   ├─> UPDATE core.persons (campos provistos)
  │   ├─> UPDATE sales.customers (campos provistos)
  │   └─> INSERT INTO core.audit_logs
  └─> RETURN success
END
```

### 3.3 Eliminar Cliente (Soft Delete)

```
START
  ├─> Validar usuario: is_employee()
  ├─> RPC: sales.soft_delete_customer()
  │   ├─> UPDATE core.persons SET deleted_at = NOW()
  │   ├─> UPDATE sales.customers SET deleted_at = NOW()
  │   └─> INSERT INTO core.audit_logs
  └─> RETURN success
END

NOTE: El cliente NO se elimina físicamente.
      Las vistas activas lo filtrarán automáticamente.
```

## 4. Flujo de Empleados (HR)

### 4.1 Crear Empleado

```
START
  ├─> Validar usuario: can_manage_hr()
  ├─> Crear persona base
  │   └─> INSERT INTO core.persons
  ├─> Vincular con employee
  │   └─> INSERT INTO hr.employees
  │       ├─> id = person.id
  │       ├─> shop_id (sucursal asignada)
  │       ├─> employee_code (generado)
  │       └─> status_id (ACTIVE por defecto)
  └─> Asignar roles
      └─> INSERT INTO hr.employee_roles
          └─> role_id IN (Cashier, Designer, Employee, etc.)
END
```

## 5. Diagrama de Interacciones

```
┌─────────────┐
│   FRONTEND  │
│  (Angular)  │
└──────┬──────┘
       │
       │ Supabase Client
       │
┌──────▼──────────────────────────────────────┐
│         SUPABASE (PostgreSQL)                │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  RLS POLICIES (Security Layer)      │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────┐  ┌──────────────────┐     │
│  │  RPC FUNCS  │  │   DIRECT QUERIES │     │
│  │  (Business  │  │   (Simple CRUD)  │     │
│  │   Logic)    │  │                  │     │
│  └──────┬──────┘  └─────────┬────────┘     │
│         │                   │               │
│  ┌──────▼───────────────────▼──────┐       │
│  │         TABLES & SCHEMAS        │       │
│  │                                  │       │
│  │  core → hr → sales → inventory  │       │
│  │         ↓                        │       │
│  │    production → kardex           │       │
│  └──────────────────────────────────┘       │
└──────────────────────────────────────────────┘
```

## 6. Flujos Críticos con Transacciones

### 6.1 Venta Completa con Stock

```sql
BEGIN;
  -- 1. Crear orden
  INSERT INTO sales.orders (...) RETURNING id INTO v_order_id;

  -- 2. Agregar detalles
  INSERT INTO sales.order_details (...);

  -- 3. Registrar pago
  PERFORM sales.register_payment(...);

  -- 4. Descontar stock (si aplica)
  PERFORM inventory.register_consumption(...);

  -- 5. Auditoría
  INSERT INTO core.audit_logs (...);
COMMIT;
```

### 6.2 Cierre de Caja

```sql
BEGIN;
  -- 1. Calcular totales
  SELECT SUM(...) INTO v_cash_total FROM sales.payments WHERE ...;

  -- 2. Actualizar sesión
  UPDATE sales.cash_register_sessions SET status = 'CERRADO', ...;

  -- 3. Registrar auditoría
  INSERT INTO core.audit_logs (...);
COMMIT;
```

## 7. Validaciones y Reglas de Negocio

### Reglas de Pago

- `amount <= remaining_balance`
- `advance + amount <= final_amount`
- Estado automático basado en saldo

### Reglas de Inventario

- Stock no puede ser negativo
- Roll code debe ser único
- `current_quantity >= 0`

### Reglas de Sesión de Caja

- Un cajero, una sesión abierta a la vez (por tienda)
- Solo puede cerrar quien abrió (o supervisor)
- `closing_balance` debe ser capturado manualmente

## 8. Optimizaciones

### Índices Críticos

```sql
-- Ya creados en los scripts
idx_kardex_item_id
idx_kardex_created_at
idx_orders_payment_status
idx_payments_order
idx_cash_sessions_status
```

### Consultas Frecuentes Optimizadas

```sql
-- Stock actual (usar función)
SELECT * FROM inventory.get_current_stock();

-- Órdenes pendientes de pago
SELECT * FROM sales.get_pending_payment_orders(shop_id);

-- Dashboard de caja
SELECT * FROM sales.cash_register_sessions WHERE status = 'ABIERTO';
```
