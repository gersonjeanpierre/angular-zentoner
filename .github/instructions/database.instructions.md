---
applyTo: 'media/dbv2/**'
description: Reglas estrictas para mantenimiento y desarrollo de la base de datos
---

# Database Development Instructions

## PRINCIPIOS FUNDAMENTALES

### 1. **SIMPLICIDAD ANTE TODO**

- NO crear complejidad innecesaria
- NO inventar estructuras cuando las existentes funcionan
- NO duplicar funcionalidad
- Cada tabla, columna y función debe tener un propósito claro

### 2. **MANTENER NOMBRES EXISTENTES**

- NO cambiar nombres de tablas/columnas sin razón crítica
- NO refactorizar por refactorizar
- Respetar convenciones establecidas:
  - `snake_case` para todo SQL
  - Prefijos de esquema en queries cross-schema

### 3. **DOCUMENTACIÓN MÍNIMA Y CLARA**

- Comentarios solo cuando la lógica no es obvia
- NO comentar lo obvio
- Documentar decisiones de diseño importantes
- Mantener README actualizado

## ESTRUCTURA DE ARCHIVOS

### Orden de Ejecución OBLIGATORIO

```
00_master.sql                   ← Ejecutar SOLO este en producción
├── 01_core_schema.sql          ← Tablas base y utilidades
├── 02_auth_management_schema.sql  ← Funciones de autorización
├── 03_hr_schema.sql            ← Recursos humanos
├── 04_sales_schema.sql         ← Ventas y POS
├── 05_inventory_schema.sql     ← Inventario
├── 06_kardex_system.sql        ← Sistema de tracking
├── 07_production_schema.sql    ← Producción
├── 08_rls_policies.sql         ← Seguridad
├── 09_rpc_functions.sql        ← Lógica de negocio
└── 10_grants.sql               ← Permisos
```

### Reglas por Archivo

#### 01_core_schema.sql

- Contiene SOLO: shops, persons, audit_logs
- Funciones utilitarias: `set_updated_at()`, `handle_slug()`
- NO agregar más tablas aquí

#### 02_auth_management_schema.sql

- SOLO funciones de autorización
- NO tablas
- NO lógica de negocio

#### 03_hr_schema.sql

- Empleados, roles, estados
- Vista `active_employees`
- Seed data de roles y estados

#### 04_sales_schema.sql

- POS completo: customers, orders, payments, sessions
- Gastos de caja chica
- Vista `active_customers`

#### 05_inventory_schema.sql

- Categorías, items, máquinas
- Seed data de categorías jerárquicas
- NO incluir kardex aquí

#### 06_kardex_system.sql

- Sistema completo de tracking
- Movimientos, rollos, consumos
- Funciones de kardex

#### 07_production_schema.sql

- SOLO tabla `jobs`
- Mantener simple

#### 08_rls_policies.sql

- UNA policy por operación por tabla
- Nombrar descriptivamente: `{role}_can_{action}_{table}`
- NO crear policies redundantes

#### 09_rpc_functions.sql

- Funciones de negocio complejas
- SECURITY DEFINER cuando necesario
- Manejo de errores con EXCEPTION
- Auditoría en operaciones críticas

#### 10_grants.sql

- Permisos por schema
- authenticated y service_role
- DEFAULT PRIVILEGES

## REGLAS DE MODIFICACIÓN

### ANTES de Modificar

```
1. ¿Es realmente necesario?
2. ¿Afecta datos existentes?
3. ¿Necesito migración?
4. ¿Rompe el frontend?
```

### Agregar Nueva Tabla

```sql
-- 1. Identificar schema correcto
-- 2. Seguir estructura:

CREATE TABLE schema.table_name (
  id UUID PRIMARY KEY,                    -- Siempre UUID
  -- Campos de negocio
  name TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Constraints
ALTER TABLE schema.table_name
ADD CONSTRAINT chk_name_length CHECK (char_length(name) <= 100);

-- 4. Índices si necesario
CREATE INDEX idx_table_field ON schema.table_name(field);

-- 5. Trigger updated_at
CREATE TRIGGER trg_table_set_updated_at
  BEFORE UPDATE ON schema.table_name
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 6. RLS
ALTER TABLE schema.table_name ENABLE ROW LEVEL SECURITY;

-- 7. Policy en 08_rls_policies.sql
CREATE POLICY "policy_name"
  ON schema.table_name FOR SELECT TO authenticated
  USING (TRUE);

-- 8. Grant en 10_grants.sql (ya cubierto por schema)
```

### Agregar Nueva Columna

```sql
-- En el archivo del schema correspondiente
ALTER TABLE schema.table_name
  ADD COLUMN new_field TEXT;

-- Si tiene constraint
ALTER TABLE schema.table_name
  ADD CONSTRAINT chk_new_field CHECK (char_length(new_field) <= 50);
```

### Crear Nueva Function RPC

```sql
-- En 09_rpc_functions.sql
CREATE OR REPLACE FUNCTION schema.function_name(
  p_param1 TYPE,
  p_param2 TYPE DEFAULT NULL
) RETURNS TYPE
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_variable TYPE;
BEGIN
  -- Validaciones
  IF condition THEN
    RAISE EXCEPTION 'Error message: %', value;
  END IF;

  -- Lógica
  -- ...

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Logging si aplica
    RAISE EXCEPTION 'Error en function_name: %', SQLERRM;
END;
$$;
```

### Crear Nueva Policy

```sql
-- En 08_rls_policies.sql
CREATE POLICY "descriptive_policy_name"
  ON schema.table_name
  FOR operation          -- SELECT | INSERT | UPDATE | DELETE
  TO role                -- authenticated | anon | service_role
  USING (condition)      -- Para SELECT, UPDATE, DELETE
  WITH CHECK (condition); -- Para INSERT, UPDATE
```

## VALIDACIONES ANTES DE COMMIT

### Checklist Obligatorio

```
□ Ejecuté master.sql en ambiente local
□ NO hay errores en consola
□ Verifiqué seed data carga correctamente
□ Probé RPC functions principales
□ Actualicé README.md si agregué features
□ NO cambié nombres de objetos existentes sin documentar
□ Mantuve la simplicidad
```

### Testing Local

```bash
# Crear DB de prueba
createdb zentoner_test

# Ejecutar master
psql -U postgres -d zentoner_test -f media/dbv2/00_master.sql

# Verificar objetos
psql -U postgres -d zentoner_test -c "\dn"  # Schemas
psql -U postgres -d zentoner_test -c "\dt sales.*"  # Tablas
psql -U postgres -d zentoner_test -c "\df sales.*"  # Functions
```

## PATRONES PROHIBIDOS

### ❌ NO HACER

```sql
-- NO crear tablas intermedias innecesarias
CREATE TABLE unnecessary_link (...);  -- ❌

-- NO usar SELECT * en functions
SELECT * FROM table;  -- ❌

-- NO hardcodear valores
WHERE status = 'active';  -- ❌ (usar variables)

-- NO nombres ambiguos
CREATE TABLE data (...);  -- ❌

-- NO triggers complejos sin razón
CREATE TRIGGER complex_trigger ...  -- ❌

-- NO funciones que hacen "todo"
CREATE FUNCTION do_everything() ...  -- ❌

-- NO duplicar constraints en tabla y function
-- Ya está en tabla constraint, no validar en function
```

### ✅ HACER

```sql
-- Nombres descriptivos
CREATE TABLE sales.customer_preferences (...);  -- ✅

-- Usar variables
DECLARE v_active_status TEXT := 'active';  -- ✅

-- SELECT específico
SELECT id, name, created_at FROM table;  -- ✅

-- Funciones enfocadas
CREATE FUNCTION sales.register_payment() ...  -- ✅

-- Constraints en tabla
ALTER TABLE ADD CONSTRAINT chk_amount CHECK (amount > 0);  -- ✅
```

## DEBUGGING

### Ver Estructura

```sql
-- Tablas de un schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'sales';

-- Columnas de tabla
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders';

-- Constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'orders';

-- Functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'sales';

-- Policies
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'sales';
```

### Ver Datos

```sql
-- Ver seed data
SELECT * FROM hr.roles;
SELECT * FROM hr.employee_statuses;
SELECT * FROM inventory.categories WHERE parent_id IS NULL;

-- Ver últimos registros
SELECT * FROM sales.orders ORDER BY created_at DESC LIMIT 5;

-- Stock actual
SELECT * FROM inventory.get_current_stock();
```

## WORKFLOW DE DESARROLLO

### 1. Nueva Feature

```
a. Identificar schema correcto
b. Diseñar tablas/campos necesarios (mínimo)
c. Escribir SQL en archivo correcto
d. Agregar RLS policies
e. Crear RPC functions si necesario
f. Actualizar grants si nuevo schema
g. Documentar en FLUJOS_NEGOCIO.md
h. Testing local
i. Commit con mensaje claro
```

### 2. Bug Fix

```
a. Identificar archivo afectado
b. Corregir SOLO el problema
c. NO refactorizar código relacionado
d. Testing del fix específico
e. Commit con mensaje "fix: descripción"
```

### 3. Optimización

```
a. Medir performance ANTES
b. Agregar índice o ajustar query
c. Medir performance DESPUÉS
d. Documentar mejora
e. Commit con métricas
```

## MENSAJES DE COMMIT

### Formato

```
<type>: <description>

[optional body]
[optional footer]
```

### Types

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `refactor:` Cambio sin afectar funcionalidad
- `docs:` Solo documentación
- `perf:` Mejora de performance
- `test:` Agregar/modificar tests

### Ejemplos

```
feat: add cash expenses table to sales schema

- Created sales.cash_expenses table
- Added RPC function register_cash_expense()
- Updated RLS policies

fix: correct payment validation in register_payment()

- Fixed amount validation logic
- Now correctly checks remaining_balance

perf: add index on kardex.created_at

- Improved query performance by 80%
- SELECT FROM kardex WHERE created_at > ... now takes 15ms vs 80ms

docs: update FLUJOS_NEGOCIO with cash expenses flow
```

## ANTI-PATTERNS COMUNES

### 1. Over-Engineering

```
❌ Crear tabla de configuración para un solo valor
✅ Usar constraint o variable

❌ Sistema complejo de versionado de datos
✅ Usar updated_at y audit_logs

❌ Múltiples niveles de abstracción
✅ Llamar directamente a la tabla o RPC
```

### 2. Premature Optimization

```
❌ Crear índices en todas las columnas
✅ Crear índices basado en queries reales

❌ Materializar todas las vistas
✅ Materializar solo las lentas y frecuentes

❌ Denormalizar todo
✅ Normalizar, optimizar después si necesario
```

### 3. Complejidad Innecesaria

```
❌ Trigger que llama function que llama otra function
✅ Lógica directa en un solo lugar

❌ 10 parameters opcionales en function
✅ Funciones específicas y enfocadas

❌ Mega-query con 15 JOINs
✅ Dividir en queries más simples o usar CTEs
```

## RECURSOS

### Consultar Siempre

1. `README.md` en dbv2/
2. `FLUJOS_NEGOCIO.md` para entender procesos
3. `DIAGRAMA_BD.md` para ver relaciones
4. PostgreSQL docs para sintaxis correcta

### NO Inventar

- NO crear convenciones nuevas
- NO cambiar estructura establecida
- NO agregar schemas nuevos sin discutir

### Preguntar Antes De

- Cambiar nombres de tablas/columnas existentes
- Agregar schema nuevo
- Cambiar estructura de RPC function usada en frontend
- Modificar RLS policies existentes

## CONCLUSIÓN

**REGLA DE ORO:** Si no estás seguro, pregunta. Si está funcionando, no lo toques. Si puedes hacerlo más simple, hazlo.

Mantén el código:

- ✅ Simple
- ✅ Directo
- ✅ Documentado (lo necesario)
- ✅ Testeable
- ✅ Consistente con el resto
