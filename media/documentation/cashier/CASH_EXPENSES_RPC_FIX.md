# Fix: Cash Expenses RPC Parameter Mismatch

**Fecha:** 31 de enero de 2026  
**Módulo:** Cashier - Cash Expenses  
**Tipo:** Bug Fix

## Problema

Al intentar registrar un gasto de caja chica, se producía el siguiente error:

```
Error al registrar gasto:
{
  code: 'PGRST202',
  message: 'Could not find the function sales.register_cash_expense(...) in the schema cache',
  details: 'Searched for the function sales.register_cash_expense with parameters
            p_amount, p_authorized_by_id, p_cash_register_session_id, p_category,
            p_description, p_notes, p_receipt_number but no matches were found',
  hint: 'Perhaps you meant to call the function sales.register_cash_expense(
         p_amount, p_authorized_by_id, p_category, p_description, p_notes,
         p_receipt_number, p_session_id, p_shop_id)'
}
```

## Causa Raíz

### Discrepancia entre Frontend y Base de Datos

**Firma de la función SQL** (`09_rpc_functions.sql`):

```sql
CREATE OR REPLACE FUNCTION sales.register_cash_expense(
  p_session_id UUID,           -- ✅ Nombre correcto
  p_shop_id UUID,              -- ✅ Parámetro REQUERIDO
  p_amount NUMERIC,
  p_category TEXT,
  p_description TEXT,
  p_receipt_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_authorized_by_id UUID DEFAULT NULL
) RETURNS JSON
```

**Llamada desde el servicio TypeScript** (ANTES del fix):

```typescript
await this.supabase.schema('sales').rpc('register_cash_expense', {
  p_cash_register_session_id: payload.cashRegisterSessionId, // ❌ Nombre incorrecto
  p_amount: payload.amount,
  p_category: payload.category,
  p_description: payload.description,
  p_receipt_number: payload.receiptNumber || null,
  p_notes: payload.notes || null,
  p_authorized_by_id: payload.authorizedById || null,
  // ❌ Falta p_shop_id
});
```

### Problemas Identificados

1. **Nombre de parámetro incorrecto**:
   - Frontend enviaba: `p_cash_register_session_id`
   - SQL espera: `p_session_id`

2. **Parámetro faltante**:
   - Frontend NO enviaba: `p_shop_id`
   - SQL requiere: `p_shop_id` (segundo parámetro, OBLIGATORIO)

## Solución Implementada

### 1. Actualizar Modelo TypeScript

**Archivo:** `src/app/data/models/sales/cash-register.model.ts`

```typescript
/**
 * Payload para registrar un gasto de caja chica
 */
export interface RegisterExpensePayload {
  cashRegisterSessionId: string;
  shopId: string; // ✅ Agregado: Requerido por la función SQL
  amount: number;
  category: ExpenseCategory;
  description: string;
  receiptNumber?: string;
  notes?: string;
  authorizedById?: string;
}
```

### 2. Corregir Llamada RPC en el Servicio

**Archivo:** `src/app/core/services/cash-register-service.ts`

```typescript
async registerExpense(payload: RegisterExpensePayload): Promise<RegisterExpenseResponse> {
  const { data, error } = await this.supabase.schema('sales').rpc('register_cash_expense', {
    p_session_id: payload.cashRegisterSessionId,        // ✅ Nombre correcto
    p_shop_id: payload.shopId,                          // ✅ Parámetro agregado
    p_amount: payload.amount,
    p_category: payload.category,
    p_description: payload.description,
    p_receipt_number: payload.receiptNumber || null,
    p_notes: payload.notes || null,
    p_authorized_by_id: payload.authorizedById || null,
  });

  if (error) {
    console.error('[CashRegisterService] Error al registrar gasto:', error);
    throw error;
  }

  return camelcaseKeys(data, { deep: true }) as RegisterExpenseResponse;
}
```

### 3. Actualizar Componente para Enviar shopId

**Archivo:** `src/app/features/cashier/cash-expenses/cash-expenses.ts`

```typescript
const payload: RegisterExpensePayload = {
  cashRegisterSessionId: session.id,
  shopId: session.shopId, // ✅ Agregado desde la sesión actual
  amount: formData.amount,
  category: formData.category,
  description: formData.description,
  receiptNumber: formData.receiptNumber || undefined,
  notes: formData.notes || undefined,
  authorizedById: session.cashierId,
};

const response = await this.cashRegisterService.registerExpense(payload);
```

## Validación de la Solución

### Antes (Error)

```
❌ PGRST202: Could not find the function in the schema cache
```

### Después (Éxito)

```typescript
✅ Response: {
  success: true,
  expenseId: "uuid-v7",
  amount: 50.00,
  category: "OPERATIVO",
  totalExpenses: 150.00,
  availableCash: 350.00
}
```

## Lecciones Aprendidas

### 1. Consistencia de Nombres

- Siempre usar los mismos nombres de parámetros entre frontend y backend
- Seguir la convención SQL: `p_` prefix para parámetros de funciones RPC

### 2. Validación de Parámetros

- Verificar que TODOS los parámetros requeridos se envíen
- Los parámetros con `DEFAULT NULL` en SQL son opcionales
- Los parámetros sin `DEFAULT` son OBLIGATORIOS

### 3. Documentación de APIs

- Mantener documentada la firma de las funciones RPC
- Incluir ejemplos de uso en comentarios
- Validar contra el schema antes de deployment

## Prevención Futura

### Checklist para Funciones RPC

- [ ] Verificar firma de la función en SQL
- [ ] Crear interface TypeScript con TODOS los parámetros
- [ ] Usar los nombres EXACTOS de parámetros (con prefijo `p_`)
- [ ] Incluir parámetros opcionales con `DEFAULT` en SQL
- [ ] Marcar parámetros opcionales con `?` en TypeScript
- [ ] Probar con datos reales antes de commit
- [ ] Documentar en `/media/documentation`

### Herramientas Recomendadas

1. **Type Safety**: Generar tipos TypeScript desde el schema de Supabase
2. **Tests**: Unit tests para validar payloads antes de enviar
3. **Lint Rules**: Validar que los nombres de parámetros coincidan

## Archivos Modificados

1. ✅ `src/app/data/models/sales/cash-register.model.ts`
2. ✅ `src/app/core/services/cash-register-service.ts`
3. ✅ `src/app/features/cashier/cash-expenses/cash-expenses.ts`
4. ✅ `media/documentation/cashier/CASH_EXPENSES_RPC_FIX.md` (este archivo)

## Referencias

- **Función SQL:** `media/db/09_rpc_functions.sql` (líneas 440-477)
- **Service Pattern:** `.github/instructions/service-pattern.instructions.md`
- **Supabase RPC Docs:** https://supabase.com/docs/reference/javascript/rpc

## Testing

### Caso de Prueba 1: Registro de Gasto Operativo

```typescript
const payload = {
  cashRegisterSessionId: 'session-uuid',
  shopId: 'shop-uuid',
  amount: 50.0,
  category: 'OPERATIVO',
  description: 'Compra de papel bond',
  receiptNumber: 'B001-00123',
  notes: 'Urgente para producción',
  authorizedById: 'employee-uuid',
};

const result = await cashRegisterService.registerExpense(payload);
// ✅ Expected: result.success === true
```

### Caso de Prueba 2: Registro Sin Campos Opcionales

```typescript
const payload = {
  cashRegisterSessionId: 'session-uuid',
  shopId: 'shop-uuid',
  amount: 25.0,
  category: 'ADMINISTRATIVO',
  description: 'Tinta para impresora',
  // receiptNumber, notes, authorizedById son opcionales
};

const result = await cashRegisterService.registerExpense(payload);
// ✅ Expected: result.success === true
```

## Estado

- ✅ **Implementado**
- ✅ **Probado**
- ✅ **Documentado**
- ⏳ **Pending Deployment**
