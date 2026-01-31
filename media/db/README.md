# Database Structure - Zentoner System

## Overview

Sistema de gestión para imprenta multisucursal con módulos de ventas (POS), inventario (Kardex), recursos humanos y producción.

## Directory Structure

```
media/dbv2/
├── 00_master.sql                  # Master execution script
├── 01_core_schema.sql             # Core tables (shops, persons, audit_logs)
├── 02_auth_management_schema.sql  # Authorization functions
├── 03_hr_schema.sql               # HR tables (employees, roles, statuses)
├── 04_sales_schema.sql            # Sales/POS (customers, orders, payments)
├── 05_inventory_schema.sql        # Inventory (categories, items, machines)
├── 06_kardex_system.sql           # Kardex tracking system
├── 07_production_schema.sql       # Production jobs
├── 08_rls_policies.sql            # Row Level Security policies
├── 09_rpc_functions.sql           # Remote Procedure Calls
└── 10_grants.sql                  # Permissions and grants
```

## Schemas

### 1. **core** - Base System

- `shops` - Sucursales de la imprenta
- `persons` - Datos personales (base para empleados y clientes)
- `audit_logs` - Registro de auditoría

### 2. **auth_management** - Authorization

- Functions for role checking:
  - `is_employee()`
  - `is_super_admin()`
  - `is_creator()`
  - `can_manage_hr()`
  - `is_universal_manager()`

### 3. **hr** - Human Resources

- `employee_statuses` - Estados laborales
- `roles` - Roles del sistema
- `employees` - Empleados
- `employee_roles` - Relación empleado-rol

### 4. **sales** - Point of Sale

- `customers` - Clientes
- `order_status` - Estados de órdenes
- `orders` - Órdenes de venta
- `order_details` - Detalles de órdenes
- `cash_register_sessions` - Sesiones de caja
- `payments` - Pagos
- `cash_expenses` - Gastos de caja chica

### 5. **inventory** - Inventory Management

- `categories` - Categorías jerárquicas
- `items` - Items de inventario
- `machines` - Máquinas de producción

### 6. **kardex** - Inventory Tracking

- `movement_type` - Tipos de movimiento (ENTRADA, SALIDA, AJUSTE)
- `movement_reason` - Razones de movimiento
- `roll_tracking` - Seguimiento de rollos individuales
- `kardex` - Registro de movimientos
- `consumption_logs` - Logs de consumo en producción
- `kardex_consumption` - Vinculación kardex-consumo

### 7. **production** - Manufacturing

- `jobs` - Trabajos de producción

## Installation

### Quick Start

```bash
psql -U postgres -d your_database -f 00_master.sql
```

### Manual Step-by-Step

```bash
psql -U postgres -d your_database -f 01_core_schema.sql
psql -U postgres -d your_database -f 02_auth_management_schema.sql
psql -U postgres -d your_database -f 03_hr_schema.sql
psql -U postgres -d your_database -f 04_sales_schema.sql
psql -U postgres -d your_database -f 05_inventory_schema.sql
psql -U postgres -d your_database -f 06_kardex_system.sql
psql -U postgres -d your_database -f 07_production_schema.sql
psql -U postgres -d your_database -f 08_rls_policies.sql
psql -U postgres -d your_database -f 09_rpc_functions.sql
psql -U postgres -d your_database -f 10_grants.sql
```

### For Supabase

Upload each file in order through the SQL Editor or use migrations.

## Key Features

### Security (RLS)

- Row Level Security habilitado en todas las tablas
- Policies basadas en roles
- Auditoría de operaciones críticas

### Authorization Hierarchy

```
SuperAdmin
  ├── Manager
  ├── HRManager
  ├── Accountant
  ├── Administrator
  └── Developer
      ├── Employee
      ├── Designer
      └── Cashier
```

### Kardex System

- Tracking individual de rollos con códigos únicos
- Registro de movimientos con balance anterior/posterior
- Trazabilidad de consumo en producción
- Vinculación con órdenes de venta

### POS Features

- Pagos parciales
- Múltiples métodos de pago
- Sesiones de caja (parcial/final)
- Gastos de caja chica
- Tracking completo de transacciones

## RPC Functions

### Sales

- `create_customer()` - Crear cliente
- `update_customer()` - Actualizar cliente
- `soft_delete_customer()` - Borrado lógico
- `register_payment()` - Registrar pago
- `open_cash_register_session()` - Abrir caja
- `close_cash_register_session()` - Cerrar caja
- `register_cash_expense()` - Registrar gasto

### Inventory

- `register_purchase()` - Registrar compra con rollo
- `get_current_stock()` - Obtener stock actual
- `get_current_stock(item_id)` - Stock de un item específico

## Data Flow

### Venta Completa

```
1. Crear/Seleccionar Cliente → sales.customers
2. Crear Orden → sales.orders
3. Agregar Detalles → sales.order_details
4. Registrar Pago(s) → sales.payments
5. Actualizar Estado Orden
6. Vincular con Sesión de Caja
```

### Compra de Material

```
1. Crear Item → inventory.items
2. Registrar Compra → inventory.register_purchase()
3. Crear Roll → inventory.roll_tracking
4. Registrar Kardex → inventory.kardex (ENTRADA/COMPRA)
```

### Consumo en Producción

```
1. Crear Job → production.jobs
2. Registrar Consumo → inventory.consumption_logs
3. Actualizar Roll → inventory.roll_tracking
4. Registrar Movimiento → inventory.kardex (SALIDA/PRODUCCION)
5. Vincular → inventory.kardex_consumption
```

## Best Practices

### Database Operations

- Siempre usar transacciones para operaciones multi-tabla
- Validar datos antes de insertar
- Usar RPC functions para lógica de negocio
- Aprovechar RLS para seguridad

### Frontend Integration

- Llamar RPC functions desde Supabase client
- Manejar errores adecuadamente
- Usar policies RLS para filtrar datos
- Cachear datos estáticos (categorías, roles, etc.)

### Performance

- Indexes están pre-configurados en campos clave
- Usar `SELECT DISTINCT ON` para última ocurrencia
- Materializar vistas frecuentes si es necesario
- Paginar resultados grandes

## Maintenance

### Backup

```bash
pg_dump -U postgres -d your_database -F c -f backup_$(date +%Y%m%d).dump
```

### Restore

```bash
pg_restore -U postgres -d your_database backup_20260130.dump
```

### Monitoring

```sql
-- Ver sesiones activas
SELECT * FROM pg_stat_activity WHERE datname = 'your_database';

-- Ver índices no utilizados
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Ver tablas más grandes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Support

Para soporte o reportar issues, contactar al equipo de desarrollo.

## Version

**v2.0** - Enero 2026

- Reorganización completa de schemas
- Implementación de Kardex
- Sistema POS con pagos parciales
- RLS policies mejoradas
