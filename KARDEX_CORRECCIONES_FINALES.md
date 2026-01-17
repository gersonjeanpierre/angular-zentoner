# Kardex - Correcciones según Schema SQL Real

## 🔥 Cambios Críticos Realizados

### Problema Inicial

El código frontend estaba usando **campos inexistentes** en la base de datos y omitiendo campos **NOT NULL** obligatorios según el schema SQL.

### Fuente de Verdad

**Archivo:** `media/db/04_KARDEX.sql`  
**Principio:** El schema SQL es LA ÚNICA fuente de verdad. El frontend debe adaptarse 100% a él.

---

## 📋 Schema Real vs Código Anterior

### 1. Tabla `roll_tracking`

#### ✅ Schema Real (7 columnas):

```sql
CREATE TABLE inventory.roll_tracking (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL,
    roll_code TEXT UNIQUE NOT NULL,
    current_quantity DECIMAL(12, 3) NOT NULL,
    status TEXT CHECK (status IN ('full', 'in_use', 'depleted', 'scrapped')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ❌ Código Anterior (INCORRECTO):

```typescript
// Tenía campos que NO EXISTEN:
(-initial_quantity - // ❌ NO EXISTE
  received_date - // ❌ NO EXISTE (es created_at automático)
  notes - // ❌ NO EXISTE
  // Usaba valores incorrectos para status:
  'FULL',
  'PARTIAL',
  'EMPTY',
  'SCRAPPED'); // ❌ INCORRECTO
```

#### ✅ Código Corregido:

```typescript
export interface RollTrackingFormModel {
  item_id: string;
  roll_code: string;
  current_quantity: number | string;
}

export interface RollTrackingView {
  id: string;
  item_id: string;
  roll_code: string;
  current_quantity: number;
  status: 'full' | 'in_use' | 'depleted' | 'scrapped'; // ✅ minúsculas
  created_at: string; // ✅ automático
  updated_at: string; // ✅ automático
}
```

---

### 2. Tabla `kardex`

#### ✅ Schema Real (campos NOT NULL):

```sql
CREATE TABLE inventory.kardex (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL,
    roll_id UUID,  -- nullable
    movement_type_id SMALLINT NOT NULL,      -- ⚠️ OBLIGATORIO
    movement_reason_id SMALLINT NOT NULL,    -- ⚠️ OBLIGATORIO
    quantity DECIMAL(12,3) NOT NULL,
    previous_balance DECIMAL(12,3) NOT NULL,
    subsequent_balance DECIMAL(12,3) NOT NULL,
    notes TEXT,  -- nullable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);
```

#### ❌ Código Anterior (INCORRECTO):

```typescript
// NO incluía campos obligatorios:
-movement_type_id - // ❌ FALTABA
  movement_reason_id - // ❌ FALTABA
  // Tenía campos que NO EXISTEN:
  unit_cost_at_moment; // ❌ NO EXISTE en schema
```

#### ✅ Código Corregido:

```typescript
export interface KardexFormModel {
  movement_type_id: number | string; // ✅ AGREGADO (NOT NULL)
  movement_reason_id: number | string; // ✅ AGREGADO (NOT NULL)
  item_id: string;
  roll_id: string;
  quantity: number | string;
  notes: string;
}

export interface KardexPayload {
  id: string;
  movement_type_id: number; // ✅ NOT NULL
  movement_reason_id: number; // ✅ NOT NULL
  item_id: string;
  roll_id?: string | null;
  quantity: number;
  previous_balance: number;
  subsequent_balance: number;
  notes?: string | null;
  created_by?: string | null;
}
```

---

### 3. Tabla `consumption_logs`

#### ✅ Schema Real (campos NOT NULL):

```sql
CREATE TABLE inventory.consumption_logs (
    id UUID PRIMARY KEY,
    movement_type_id SMALLINT NOT NULL,      -- ⚠️ OBLIGATORIO
    movement_reason_id SMALLINT NOT NULL,    -- ⚠️ OBLIGATORIO
    machine_id UUID,
    operator_id UUID,
    order_detail_id UUID,
    job_name TEXT,
    customer_quantity DECIMAL,
    calibration_waste DECIMAL,
    error_waste DECIMAL,
    width_used_mm INT,
    length_used_mm INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ❌ Código Anterior (INCORRECTO):

```typescript
// NO incluía campos obligatorios:
-movement_type_id - // ❌ FALTABA
  movement_reason_id; // ❌ FALTABA
```

#### ✅ Código Corregido:

```typescript
export interface ProductionFormModel {
  movement_type_id: number | string; // ✅ AGREGADO (NOT NULL)
  movement_reason_id: number | string; // ✅ AGREGADO (NOT NULL)
  roll_id: string;
  machine_id: string;
  operator_id: string;
  job_name: string;
  order_detail_id: string;
  customer_quantity: number | string;
  calibration_waste: number | string;
  error_waste: number | string;
  width_used_mm: number | string;
  length_used_mm: number | string;
  notes: string;
}
```

---

## 🔧 Archivos Modificados

### 1. Modelos (kardex.model.ts) ✅

**Cambios:**

- ✅ Eliminado `initial_quantity` de RollTrackingFormModel
- ✅ Eliminado `received_date` y `notes` de RollTrackingFormModel
- ✅ Corregido status de `'FULL'` a `'full'` (minúsculas)
- ✅ Agregado `movement_type_id` y `movement_reason_id` a KardexFormModel
- ✅ Agregado `movement_type_id` y `movement_reason_id` a ProductionFormModel
- ✅ Eliminado `unit_cost_at_moment` de todos los modelos (no existe en schema)

---

### 2. kardex-create (Formulario de Compra) ✅

**HTML:**

- ✅ Eliminado campo `initial_quantity` → ahora es `current_quantity`
- ✅ Eliminado campo `received_date` (se usa `created_at` automático)
- ✅ Eliminado campo `notes` (no existe en tabla)
- ✅ Reducido a 3 campos: `item_id`, `roll_code`, `current_quantity`

**TypeScript:**

- ✅ Actualizado modelo del form
- ✅ Actualizado validadores
- ✅ Corregido onSubmit() para llamar RPC `register_purchase`
- ✅ Eliminado import de `uuidv7` (innecesario, el backend genera el UUID)

**Función RPC esperada en BD:**

```sql
-- Esta función debe existir en PostgreSQL
CREATE OR REPLACE FUNCTION inventory.register_purchase(
  p_item_id UUID,
  p_roll_code TEXT,
  p_quantity DECIMAL
) RETURNS JSON AS $$
BEGIN
  -- 1. INSERT en roll_tracking
  -- 2. INSERT en kardex (ENTRADA/COMPRA)
  -- Retorna: {rollId, kardexId}
END;
$$ LANGUAGE plpgsql;
```

---

### 3. kardex-list (Listado de Rollos) ✅

**HTML:**

- ✅ Eliminado columna `Inicial` (no existe initial_quantity)
- ✅ Eliminado columna `Stock` con progress bar (no se puede calcular % sin inicial)
- ✅ Eliminado columna `Notas` (no existe en tabla)
- ✅ Cambiado `Fecha` de `received_date` a `created_at`
- ✅ Reducido de 10 columnas a 7 columnas

**TypeScript:**

- ✅ Eliminado método `getPercentage()` (imposible sin initial_quantity)
- ✅ Corregido status de `'FULL'/'PARTIAL'/'EMPTY'` a `'full'/'in_use'/'depleted'`
- ✅ Actualizado `getAvailableCount()`, `getPartialCount()`, `getEmptyCount()`

**Stats Cards Corregidos:**

```typescript
getAvailableCount() → status === 'full'
getPartialCount() → status === 'in_use'
getEmptyCount() → status === 'depleted'
```

---

### 4. production-form (Registro de Producción) ✅

**HTML:**

- ✅ Eliminado `Stock Inicial` de la info del rollo
- ✅ Eliminado progress bar (no se puede calcular sin initial_quantity)
- ✅ Eliminado `getPercentage()` en el template
- ✅ Reducido info del rollo a: Código + Stock Actual

**TypeScript:**

- ✅ Agregado `movement_type_id: '2'` (SALIDA) al modelo
- ✅ Agregado `movement_reason_id: '3'` (PRODUCCION) al modelo
- ✅ Agregado signals para `movementTypes` y `movementReasons`
- ✅ Eliminado computed `getPercentage()` (imposible sin initial_quantity)
- ✅ Actualizado `loadInitialData()` para cargar movement_types y movement_reasons
- ✅ Agregado validación de campos NOT NULL

**Nota:** Los campos `movement_type_id` y `movement_reason_id` están en el modelo pero NO se muestran en el form porque la función RPC `register_production` ya sabe que son SALIDA/PRODUCCION automáticamente.

---

### 5. kardex-service.ts ✅

**Método registerPurchase():**

```typescript
// ❌ Antes (INCORRECTO):
async registerPurchase(payload: RollTrackingPayload)
// Insertaba directo en roll_tracking (sin kardex)

// ✅ Ahora (CORRECTO):
async registerPurchase(params: {
  itemId: string;
  rollCode: string;
  quantity: number;
}): Promise<{ rollId: string; kardexId: string }>
// Llama a RPC que inserta en roll_tracking + kardex atómicamente
```

**Método getRollsByItem():**

- ✅ Eliminado `.order('received_date')` → ahora `.order('created_at')`
- ✅ Eliminado filtro `.in('status', ['FULL', 'PARTIAL'])` → ahora `.in('status', ['full', 'in_use'])`
- ✅ Eliminado mapeo de campos inexistentes: `initial_quantity`, `received_date`, `notes`

**Método getRolls():**

- ✅ Eliminado mapeo de campos inexistentes en el `map()`

---

## 🎯 Funciones RPC Requeridas en PostgreSQL

El frontend ahora espera estas funciones RPC en la base de datos:

### 1. register_purchase

```sql
CREATE OR REPLACE FUNCTION inventory.register_purchase(
  p_item_id UUID,
  p_roll_code TEXT,
  p_quantity DECIMAL
) RETURNS JSON AS $$
DECLARE
  v_roll_id UUID;
  v_kardex_id UUID;
BEGIN
  -- 1. Crear rollo
  INSERT INTO inventory.roll_tracking (id, item_id, roll_code, current_quantity, status)
  VALUES (gen_random_uuid(), p_item_id, p_roll_code, p_quantity, 'full')
  RETURNING id INTO v_roll_id;

  -- 2. Registrar en kardex
  INSERT INTO inventory.kardex (
    id, item_id, roll_id, movement_type_id, movement_reason_id,
    quantity, previous_balance, subsequent_balance
  )
  VALUES (
    gen_random_uuid(), p_item_id, v_roll_id,
    1, -- ENTRADA
    1, -- COMPRA
    p_quantity, 0, p_quantity
  )
  RETURNING id INTO v_kardex_id;

  RETURN json_build_object('rollId', v_roll_id, 'kardexId', v_kardex_id);
END;
$$ LANGUAGE plpgsql;
```

### 2. register_production

```sql
CREATE OR REPLACE FUNCTION inventory.register_production(
  p_roll_id UUID,
  p_machine_id UUID,
  p_operator_id UUID,
  p_job_name TEXT,
  p_order_detail_id UUID,
  p_customer_quantity DECIMAL,
  p_calibration_waste DECIMAL,
  p_error_waste DECIMAL,
  p_width_used_mm INT,
  p_length_used_mm INT,
  p_notes TEXT
) RETURNS JSON AS $$
DECLARE
  v_consumption_log_id UUID;
  v_kardex_id UUID;
  v_total_quantity DECIMAL;
BEGIN
  v_total_quantity := p_customer_quantity + COALESCE(p_calibration_waste, 0) + COALESCE(p_error_waste, 0);

  -- 1. Crear consumption_log
  INSERT INTO inventory.consumption_logs (
    id, movement_type_id, movement_reason_id, machine_id, operator_id,
    order_detail_id, job_name, customer_quantity, calibration_waste,
    error_waste, width_used_mm, length_used_mm
  )
  VALUES (
    gen_random_uuid(),
    2, -- SALIDA
    3, -- PRODUCCION
    p_machine_id, p_operator_id, p_order_detail_id, p_job_name,
    p_customer_quantity, p_calibration_waste, p_error_waste,
    p_width_used_mm, p_length_used_mm
  )
  RETURNING id INTO v_consumption_log_id;

  -- 2. Registrar en kardex (SALIDA)
  INSERT INTO inventory.kardex (...)
  RETURNING id INTO v_kardex_id;

  -- 3. Actualizar roll_tracking
  UPDATE inventory.roll_tracking
  SET current_quantity = current_quantity - v_total_quantity,
      status = CASE
        WHEN current_quantity - v_total_quantity = 0 THEN 'depleted'
        ELSE 'in_use'
      END
  WHERE id = p_roll_id;

  -- 4. Crear kardex_consumption
  INSERT INTO inventory.kardex_consumption (...)

  RETURN json_build_object('consumptionLogId', v_consumption_log_id, 'kardexId', v_kardex_id);
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ Checklist de Correcciones

### Modelos TypeScript

- [x] RollTrackingFormModel: eliminados campos inexistentes
- [x] RollTrackingView: solo campos que existen en BD
- [x] KardexFormModel: agregado movement_type_id y movement_reason_id
- [x] ProductionFormModel: agregado movement_type_id y movement_reason_id
- [x] Status values: 'full', 'in_use', 'depleted', 'scrapped' (minúsculas)
- [x] Eliminado unit_cost_at_moment (no existe en schema)

### Componentes

- [x] kardex-create: solo 3 campos (item, roll_code, quantity)
- [x] kardex-list: eliminadas columnas de campos inexistentes
- [x] kardex-list: eliminados progress bars (imposibles sin initial_quantity)
- [x] production-form: eliminada info de initial_quantity y progress bar
- [x] production-form: agregados movement_type_id/reason_id al modelo

### Servicios

- [x] registerPurchase(): ahora llama a RPC
- [x] getRollsByItem(): orden por created_at, sin campos inexistentes
- [x] getRolls(): sin campos inexistentes en el mapeo
- [x] getMovementTypes() y getMovementReasons(): ya existían ✅

### Validaciones

- [x] Todos los campos NOT NULL tienen validación `required()`
- [x] Validaciones min/max según constraints del schema

---

## 🚀 Estado Final

**Sin errores de compilación** ✅  
**100% alineado con schema SQL** ✅  
**Campos NOT NULL validados** ✅  
**Sin campos inexistentes** ✅

---

## 📝 Notas Importantes

1. **Status en minúsculas:** El schema SQL usa `'full'`, `'in_use'`, `'depleted'`, `'scrapped'` (minúsculas), NO `'FULL'`, `'PARTIAL'`, etc.

2. **Fechas automáticas:** `created_at` y `updated_at` son automáticos con `DEFAULT NOW()`. No se envían desde el frontend.

3. **Progress bars eliminados:** Sin `initial_quantity`, no se puede calcular porcentaje de disponibilidad. Solo se muestra `current_quantity`.

4. **Funciones RPC:** El frontend ahora depende de funciones RPC en PostgreSQL para operaciones atómicas que afectan múltiples tablas.

5. **Movement Types/Reasons:** El frontend los carga pero NO los expone en forms porque el backend ya sabe qué IDs usar (ENTRADA/COMPRA para purchase, SALIDA/PRODUCCION para production).

---

**Fecha:** 2026-01-16  
**Autor:** GitHub Copilot  
**Basado en:** Schema SQL `media/db/04_KARDEX.sql`
