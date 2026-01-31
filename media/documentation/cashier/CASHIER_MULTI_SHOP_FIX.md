# Corrección de Control de Acceso Multi-Tienda en Sistema de Caja

## Problema Identificado

El sistema de caja presentaba un **problema crítico de control de acceso** cuando múltiples cajeros operaban en diferentes tiendas:

### Escenarios:

1. ✅ **CORRECTO**: CAJERO A con sesión abierta en `shopId X` → CAJERO B intenta entrar a `shopId X` → Acceso denegado
2. ❌ **INCORRECTO**: CAJERO A con sesión abierta en `shopId X` → CAJERO B entra a `shopId Y` → Veía la sesión del CAJERO A (cruce de datos entre tiendas)

### Causa Raíz

El método `loadCurrentSession()` **NO filtraba por `shop_id`**, solo buscaba cualquier sesión con estado `ABIERTO` sin importar la tienda.

```typescript
// ❌ ANTES: No filtraba por tienda
async loadCurrentSession(sessionId?: string): Promise<void> {
  let query = this.supabase
    .from('cash_register_sessions')
    .select('*')
    .eq('status', 'ABIERTO'); // Solo filtraba por estado
}
```

## Solución Implementada

### 1. Modificación de `loadCurrentSession`

Se convirtió `shopId` en un **parámetro obligatorio** para garantizar el filtrado por tienda:

```typescript
// ✅ DESPUÉS: Filtra obligatoriamente por tienda
async loadCurrentSession(shopId: string, sessionId?: string): Promise<void> {
  let query = this.supabase
    .from('cash_register_sessions')
    .select('*')
    .eq('shop_id', shopId)      // Filtro por tienda
    .eq('status', 'ABIERTO');   // Filtro por estado
}
```

### 2. Actualización de `checkDashboardAccess`

Clarificación de las reglas de acceso con comentarios descriptivos:

```typescript
/**
 * REGLAS:
 * 1. Si NO hay sesión abierta en el shop -> PUEDE ACCEDER (para abrir nueva sesión)
 * 2. Si HAY sesión Y es del mismo cajero -> PUEDE ACCEDER (su propia sesión)
 * 3. Si HAY sesión Y es de otro cajero -> NO PUEDE ACCEDER (sesión ocupada)
 */
```

### 3. Actualización de Componentes

Todos los componentes que cargan sesiones ahora pasan el `shopId` del usuario:

- ✅ `cash-register-dashboard.ts`
- ✅ `cash-register-open.ts`
- ✅ `cash-register-close.ts`
- ✅ `daily-sales.ts`
- ✅ `cash-expenses.ts`

```typescript
// Patrón aplicado en todos los componentes
private async loadSession() {
  const user = await this.authService.getUserProfileData();
  if (!user || !user.shopId) {
    // Manejo de error
    return;
  }

  await this.cashRegisterService.loadCurrentSession(user.shopId);
}
```

### 4. Ajuste en `openSession`

Se actualiza para pasar el `shopId` al cargar la sesión después de abrirla:

```typescript
await this.loadCurrentSession(payload.shopId, response.sessionId);
```

### 5. Mejora en `hasOpenSession`

Se agregó soporte para filtrar opcionalmente por `shopId`:

```typescript
async hasOpenSession(cashierId?: string, shopId?: string): Promise<boolean>
```

## Validación de la Solución

### Diagrama de Flujo de Control de Acceso

```
┌─────────────────────────────────────────────────────────────────┐
│                  CAJERO intenta acceder a /caja                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                   ┌─────────────────────┐
                   │  cashierRoleGuard   │
                   │  getUserProfileData │
                   └─────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            │                                 │
            ▼                                 ▼
    ┌───────────────┐              ┌──────────────────┐
    │ NO tiene rol  │              │  Tiene role_id=5 │
    │   CAJERO      │              │     (CASHIER)    │
    └───────┬───────┘              └────────┬─────────┘
            │                               │
            ▼                               ▼
    ┌───────────────┐              ┌──────────────────┐
    │ DENEGADO      │              │ checkDashboard   │
    │ → /dashboard  │              │ Access(userId,   │
    └───────────────┘              │    shopId)       │
                                   └────────┬─────────┘
                                            │
                   ┌────────────────────────┼────────────────────────┐
                   │                        │                        │
                   ▼                        ▼                        ▼
        ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
        │ getOpenSession   │    │ getOpenSession   │    │ getOpenSession   │
        │ ByShop(shopId)   │    │ ByShop(shopId)   │    │ ByShop(shopId)   │
        │                  │    │                  │    │                  │
        │ NO encuentra     │    │ Encuentra sesión │    │ Encuentra sesión │
        │ sesión abierta   │    │ del MISMO cajero│    │ de OTRO cajero   │
        └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
                 │                       │                        │
                 ▼                       ▼                        ▼
        ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
        │ ✅ PERMITIDO     │    │ ✅ PERMITIDO     │    │ ❌ DENEGADO      │
        │                  │    │                  │    │                  │
        │ Puede abrir      │    │ Accede a su      │    │ → /caja/acceso-  │
        │ nueva sesión     │    │ propia sesión    │    │    denegado      │
        └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Flujo Correcto Post-Corrección

#### Escenario 1: Mismo Shop, Diferente Cajero

```
CAJERO A → shopId: TIENDA_001 → Sesión ABIERTA
CAJERO B → shopId: TIENDA_001 → checkDashboardAccess()
  → getOpenSessionByShop(TIENDA_001)
  → Encuentra sesión de CAJERO A
  → openSession.cashierId !== userId (CAJERO B)
  → ❌ ACCESO DENEGADO
```

#### Escenario 2: Diferente Shop

```
CAJERO A → shopId: TIENDA_001 → Sesión ABIERTA
CAJERO B → shopId: TIENDA_002 → checkDashboardAccess()
  → getOpenSessionByShop(TIENDA_002)
  → NO encuentra sesión (filtro por shop_id)
  → ✅ ACCESO PERMITIDO (puede abrir nueva sesión)

CAJERO B → loadCurrentSession(TIENDA_002)
  → Consulta: shop_id = TIENDA_002 AND status = ABIERTO
  → NO retorna la sesión de CAJERO A (es de TIENDA_001)
  → ✅ AISLAMIENTO CORRECTO
```

## Principios Aplicados

### ✅ Single Responsibility Principle

Cada método tiene una responsabilidad clara:

- `loadCurrentSession`: Cargar sesión de UNA tienda específica
- `checkDashboardAccess`: Validar acceso para UNA tienda específica
- `getOpenSessionByShop`: Buscar sesión abierta en UNA tienda

### ✅ Explicit over Implicit

- El parámetro `shopId` es **obligatorio** en `loadCurrentSession`
- Los componentes **siempre** pasan el `shopId` del usuario autenticado
- No hay valores por defecto que puedan causar ambigüedad

### ✅ Defensive Programming

- Validación de `user.shopId` antes de cada operación
- Mensajes de error claros y descriptivos
- Logs detallados para debugging

### ✅ Declarative Code

- Comentarios descriptivos de las reglas de negocio
- Nombres de variables semánticos (`isSameCashier`)
- Flujo de control claro con early returns

## Impacto en la Base de Datos

Las consultas ahora incluyen el filtro por tienda:

```sql
-- ❌ ANTES: Riesgo de cruce de datos
SELECT * FROM sales.cash_register_sessions
WHERE status = 'ABIERTO'
ORDER BY opened_at DESC
LIMIT 1;

-- ✅ DESPUÉS: Aislamiento por tienda
SELECT * FROM sales.cash_register_sessions
WHERE shop_id = 'uuid-de-tienda'
  AND status = 'ABIERTO'
ORDER BY opened_at DESC
LIMIT 1;
```

## Testing Recomendado

### Casos de Prueba Críticos

1. **Multi-Tienda**: Dos cajeros en tiendas diferentes abren sesiones simultáneas
2. **Mismo Cajero**: Un cajero no puede abrir dos sesiones en la misma tienda
3. **Bloqueo por Tienda**: Un cajero no puede acceder a la sesión de otro en la misma tienda
4. **Cambio de Tienda**: Un cajero con sesión cerrada en Tienda A puede abrir en Tienda B

### Consultas de Validación SQL

```sql
-- Verificar sesiones por tienda
SELECT
  s.shop_id,
  sh.name as shop_name,
  s.cashier_id,
  e.first_name || ' ' || e.last_name as cashier_name,
  s.status,
  s.opened_at
FROM sales.cash_register_sessions s
JOIN core.shops sh ON sh.id = s.shop_id
JOIN hr.employees e ON e.id = s.cashier_id
WHERE s.status = 'ABIERTO'
ORDER BY s.opened_at DESC;
```

## Archivos Modificados

### Frontend (TypeScript/Angular)

- [cash-register-service.ts](src/app/core/services/cash-register-service.ts)
- [cash-register-dashboard.ts](src/app/features/cashier/cash-register-dashboard/cash-register-dashboard.ts)
- [cash-register-close.ts](src/app/features/cashier/cash-register-close/cash-register-close.ts)
- [daily-sales.ts](src/app/features/cashier/daily-sales/daily-sales.ts)
- [cash-expenses.ts](src/app/features/cashier/cash-expenses/cash-expenses.ts)

### Scripts de Validación

- [VALIDATION_CASHIER_MULTI_SHOP.sql](media/db/VALIDATION_CASHIER_MULTI_SHOP.sql) - Script completo de validación con casos de prueba

## Conclusión

La corrección implementada asegura:

✅ **Aislamiento de datos por tienda**  
✅ **Control de acceso correcto**  
✅ **Prevención de cruces de sesiones**  
✅ **Código más mantenible y declarativo**  
✅ **Logs informativos para debugging**

El sistema ahora respeta estrictamente el principio de **una sesión por tienda** y garantiza que cada cajero solo pueda ver y operar sobre las sesiones de su tienda asignada.
