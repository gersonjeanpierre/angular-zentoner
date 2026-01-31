# Fix: Pagos sin Sesión de Caja - Problema y Solución

## Problema Identificado

Los pagos registrados (incluyendo YAPE y otros métodos) no aparecían en el dashboard de caja registradora porque no tenían asociada una sesión de caja (`cash_register_session_id = NULL`).

### Causa Raíz

1. El campo `cash_register_session_id` en la tabla `sales.payments` es **opcional** (nullable)
2. Pagos podían registrarse sin validar si existía una sesión activa
3. La función `get_session_dashboard` solo contaba pagos con `cash_register_session_id = p_session_id`
4. Pagos sin sesión asignada quedaban "invisibles" en el dashboard

## Solución Implementada

### 1. Validación Preventiva (Frontend)

**Archivo:** [src/app/shared/components/payment-modal/payment-modal.ts](src/app/shared/components/payment-modal/payment-modal.ts)

Se agregó validación obligatoria antes de registrar cualquier pago:

```typescript
// VALIDACIÓN CRÍTICA: Verificar que exista una sesión activa
if (!currentSession || !currentSession.id) {
  this.showAlertModal(
    'Sesión de Caja Requerida',
    'No hay una sesión de caja activa. Por favor, abra una sesión de caja antes de registrar pagos.',
    'error',
  );
  this.loading.set(false);
  return;
}
```

**Beneficios:**

- ✅ Previene nuevos pagos sin sesión
- ✅ Mensaje claro al usuario sobre la necesidad de abrir sesión
- ✅ Mantiene trazabilidad completa de pagos

### 2. Consulta SQL Mejorada (Backend)

**Archivo:** [media/dbv2/09_rpc_functions.sql](media/dbv2/09_rpc_functions.sql)

Se actualizó la función `get_session_dashboard` para incluir pagos del período:

```sql
WHERE (
  -- Pagos explícitamente vinculados a esta sesión
  cash_register_session_id = p_session_id
  OR
  -- Pagos sin sesión asignada que ocurrieron durante el período de la sesión
  (
    cash_register_session_id IS NULL
    AND payment_date >= v_session.opened_at
    AND (v_session.closed_at IS NULL OR payment_date <= v_session.closed_at)
    AND EXISTS (
      SELECT 1 FROM sales.orders o
      WHERE o.id = payments.order_id
      AND o.shop_id = v_session.shop_id
    )
  )
)
```

**Beneficios:**

- ✅ Recupera pagos históricos sin sesión asignada
- ✅ Filtra correctamente por período de tiempo
- ✅ Valida que los pagos pertenezcan al mismo shop
- ✅ Mantiene compatibilidad hacia atrás

### 3. Advertencia Visual en Dashboard

**Archivos:**

- [src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.ts](src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.ts)
- [src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.html](src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.html)

Se agregó detección y alerta de pagos sin sesión:

```typescript
/**
 * Verificar si hay pagos sin sesión asignada en el período actual
 */
private async checkUnassignedPayments() {
  const session = this.currentSession();
  if (!session) return;

  try {
    const { data, error } = await this.paymentService['supabaseClient']
      .schema('sales')
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .is('cash_register_session_id', null)
      .gte('payment_date', session.openedAt);

    if (!error && data !== null) {
      this.unassignedPaymentsCount.set(data || 0);
    }
  } catch (err) {
    console.error('Error al verificar pagos sin sesión:', err);
  }
}
```

**UI Alert:**

```html
@if (unassignedPaymentsCount() > 0) {
<div class="alert alert-warning mb-6">
  <svg>...</svg>
  <div>
    <h3 class="font-bold">Pagos sin Sesión Detectados</h3>
    <div class="text-xs">
      Se encontraron {{ unassignedPaymentsCount() }} pago(s) registrado(s) sin sesión de caja. Estos
      pagos están incluidos en el dashboard pero deberían tener una sesión asignada.
    </div>
  </div>
</div>
}
```

**Beneficios:**

- ✅ Visibilidad inmediata del problema
- ✅ Informa al cajero sobre pagos anómalos
- ✅ Facilita auditorías y correcciones

## Aplicación de la Solución

### Para Aplicar los Cambios en Base de Datos

```sql
-- Ejecutar en Supabase SQL Editor:
-- Copiar y ejecutar el contenido actualizado de:
-- media/dbv2/09_rpc_functions.sql

-- Específicamente la función get_session_dashboard
```

### Testing Recomendado

1. **Escenario 1: Pago sin sesión (debe bloquearse)**
   - Cerrar sesión de caja si existe una activa
   - Intentar registrar un pago
   - Verificar que aparezca error "Sesión de Caja Requerida"

2. **Escenario 2: Pago con sesión (funcionamiento normal)**
   - Abrir sesión de caja
   - Registrar pago con cualquier método (EFECTIVO, YAPE, etc.)
   - Verificar que aparezca en el dashboard inmediatamente

3. **Escenario 3: Pagos históricos sin sesión (recuperación)**
   - Abrir sesión de caja
   - Verificar que aparezca alerta de pagos sin sesión si existen
   - Confirmar que los totales incluyan esos pagos

## Tipos de Pago Afectados

Todos los métodos de pago están sujetos a las mismas validaciones:

- ✅ EFECTIVO
- ✅ YAPE
- ✅ PLIN
- ✅ TARJETA_DEBITO
- ✅ TARJETA_CREDITO
- ✅ TRANSFERENCIA
- ✅ DEPOSITO
- ✅ DOLARES
- ✅ OTRO

## Notas Técnicas

### ¿Por qué cash_register_session_id es nullable?

El diseño permite flexibilidad para escenarios donde:

- Se registran pagos fuera de horario de atención
- Se necesita corregir/registrar pagos retroactivamente
- Sistemas legacy que no tenían concepto de sesiones

Sin embargo, **la mejor práctica** es siempre asociar pagos a sesiones para:

- 📊 Auditoría completa
- 👤 Trazabilidad del cajero
- 💰 Control de caja preciso
- 📈 Reportes confiables

### Migración de Datos Existentes

Si se desea asignar sesiones a pagos históricos, se puede ejecutar:

```sql
-- PRECAUCIÓN: Revisar antes de ejecutar
-- Asignar pagos huérfanos a la sesión más cercana del mismo shop
UPDATE sales.payments p
SET cash_register_session_id = (
  SELECT s.id
  FROM sales.cash_register_sessions s
  INNER JOIN sales.orders o ON o.shop_id = s.shop_id
  WHERE o.id = p.order_id
    AND p.payment_date >= s.opened_at
    AND (s.closed_at IS NULL OR p.payment_date <= s.closed_at)
  ORDER BY s.opened_at DESC
  LIMIT 1
)
WHERE cash_register_session_id IS NULL
  AND deleted_at IS NULL;
```

## Archivos Modificados

1. ✅ `src/app/shared/components/payment-modal/payment-modal.ts`
2. ✅ `media/dbv2/09_rpc_functions.sql`
3. ✅ `src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.ts`
4. ✅ `src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.html`

## Próximos Pasos

- [ ] Aplicar los cambios SQL en producción
- [ ] Monitorear alertas de pagos sin sesión
- [ ] Evaluar si es necesario hacer `cash_register_session_id NOT NULL` en el futuro
- [ ] Considerar agregar un reporte de auditoría de pagos sin sesión
