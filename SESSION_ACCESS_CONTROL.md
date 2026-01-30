# Control de Acceso a Sesiones de Caja - Documentación

## 📋 Resumen

Sistema de validación de acceso al dashboard de caja que implementa reglas estrictas para prevenir conflictos entre cajeros y garantizar la integridad de las sesiones en un entorno multi-tienda.

## 🎯 Reglas de Negocio

### Regla 1: Una Sesión Activa por Tienda

- Solo puede existir **UNA sesión abierta** por tienda (`shop_id`) en cualquier momento
- Una sesión es "abierta" cuando `closed_at IS NULL`

### Regla 2: Validación de Cajero

- El sistema valida que el cajero que intenta acceder sea el propietario de la sesión activa
- Se compara `cashier_id` de la sesión con el `employee_id` del usuario actual

### Regla 3: Aislamiento entre Tiendas

- Los cajeros solo pueden ver/gestionar sesiones de su propia tienda
- Cada usuario tiene asignado un `shop_id` en su perfil

### Regla 4: Rechazo de Acceso Concurrente

- Si un cajero intenta acceder al dashboard cuando OTRO cajero tiene la sesión abierta → **ACCESO DENEGADO**
- Si un cajero intenta abrir una segunda sesión en la misma tienda → **OPERACIÓN BLOQUEADA**

## 🔧 Implementación Técnica

### 1. Base de Datos

#### Tabla: `cash_register_sessions`

```sql
CREATE TABLE sales.cash_register_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES core.shops(shop_id),
  cashier_id UUID NOT NULL REFERENCES hr.employees(employee_id),
  session_number INTEGER NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('PARCIAL', 'FINAL')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Constraint: Una sesión abierta por tienda
  CONSTRAINT unique_open_session_per_shop
    EXCLUDE USING gist (shop_id WITH =)
    WHERE (closed_at IS NULL)
);
```

**Constraint Clave:** `unique_open_session_per_shop`

- Usa un índice GiST para garantizar que no haya dos sesiones con `closed_at IS NULL` para el mismo `shop_id`
- **Nivel de protección:** Base de datos (no puede ser evadido por lógica de aplicación)

### 2. Backend - Supabase RPC

#### Función: `get_open_session_by_shop`

```sql
CREATE OR REPLACE FUNCTION sales.get_open_session_by_shop(p_shop_id UUID)
RETURNS TABLE (
  session_id UUID,
  shop_id UUID,
  cashier_id UUID,
  session_number INTEGER,
  session_type TEXT,
  opened_at TIMESTAMPTZ,
  opening_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.session_id,
    s.shop_id,
    s.cashier_id,
    s.session_number,
    s.session_type,
    s.opened_at,
    s.opening_balance
  FROM sales.cash_register_sessions s
  WHERE s.shop_id = p_shop_id
    AND s.closed_at IS NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Propósito:** Obtener la sesión abierta de una tienda específica

#### Función: `check_dashboard_access`

```sql
CREATE OR REPLACE FUNCTION sales.check_dashboard_access(
  p_user_id UUID,
  p_shop_id UUID
)
RETURNS TABLE (
  can_access BOOLEAN,
  reason TEXT,
  session_id UUID,
  session_number INTEGER
) AS $$
DECLARE
  v_employee_id UUID;
  v_open_session RECORD;
BEGIN
  -- 1. Obtener employee_id del user_id
  SELECT employee_id INTO v_employee_id
  FROM hr.employees
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Usuario no tiene empleado asociado'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- 2. Verificar si hay sesión abierta en el shop
  SELECT * INTO v_open_session
  FROM sales.cash_register_sessions
  WHERE shop_id = p_shop_id
    AND closed_at IS NULL
  LIMIT 1;

  -- 3. No hay sesión abierta
  IF v_open_session IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No hay sesión abierta en esta tienda'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- 4. Validar si la sesión pertenece al cajero actual
  IF v_open_session.cashier_id = v_employee_id THEN
    RETURN QUERY SELECT TRUE, 'Acceso permitido'::TEXT, v_open_session.session_id, v_open_session.session_number;
  ELSE
    RETURN QUERY SELECT FALSE, 'Otro cajero tiene la sesión activa'::TEXT, v_open_session.session_id, v_open_session.session_number;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Propósito:** Validar si un usuario puede acceder al dashboard de caja

**Flujo de Validación:**

1. Buscar `employee_id` usando `user_id`
2. Buscar sesión abierta en `shop_id`
3. Comparar `cashier_id` de la sesión con `employee_id` del usuario
4. Retornar resultado con razón y datos de sesión

### 3. Frontend - Angular Service

#### Archivo: `cash-register-service.ts`

##### Método: `getOpenSessionByShop()`

```typescript
/**
 * Obtiene la sesión abierta de una tienda específica
 */
async getOpenSessionByShop(shopId: string): Promise<CashRegisterSession | null> {
  const { data, error } = await this.supabase
    .schema('sales')
    .rpc('get_open_session_by_shop', { p_shop_id: shopId })
    .maybeSingle();

  if (error) {
    console.error('[CashRegisterService] Error al obtener sesión abierta:', error);
    throw error;
  }

  if (!data) return null;

  return camelcaseKeys(data, { deep: true }) as CashRegisterSession;
}
```

##### Método: `checkDashboardAccess()`

```typescript
/**
 * Verifica si el usuario puede acceder al dashboard de caja
 */
async checkDashboardAccess(
  userId: string,
  shopId: string
): Promise<{ canAccess: boolean; reason: string; session?: CashRegisterSession }> {
  const { data, error } = await this.supabase
    .schema('sales')
    .rpc('check_dashboard_access', {
      p_user_id: userId,
      p_shop_id: shopId,
    })
    .single();

  if (error) {
    console.error('[CashRegisterService] Error al verificar acceso:', error);
    throw error;
  }

  const result = camelcaseKeys(data, { deep: true });

  return {
    canAccess: result.canAccess,
    reason: result.reason,
    session: result.sessionId
      ? { sessionId: result.sessionId, sessionNumber: result.sessionNumber }
      : undefined,
  };
}
```

### 4. Frontend - Guard

#### Archivo: `cashier-role-guard.ts`

```typescript
export const cashierRoleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const cashRegisterService = inject(CashRegisterService);
  const router = inject(Router);

  try {
    const userData = await authService.getUserProfileData();

    // 1. Validar rol de cajero (4 o 5)
    if (userData.role_id !== 4 && userData.role_id !== 5) {
      console.warn('Acceso denegado: Usuario no es cajero');
      router.navigate(['/dashboard']);
      return false;
    }

    // 2. Validar asignación de tienda
    const shopId = await authService.getShopIdByUser();
    if (!shopId) {
      console.warn('Acceso denegado: Usuario sin tienda asignada');
      router.navigate(['/dashboard']);
      return false;
    }

    // 3. Para rutas de dashboard, validar sesión activa
    const isDashboardRoute =
      state.url === '/caja/dashboard' || state.url === '/caja' || state.url === '/caja/';

    if (isDashboardRoute) {
      const accessCheck = await cashRegisterService.checkDashboardAccess(userData.id, shopId);

      if (!accessCheck.canAccess) {
        console.warn('Acceso denegado al dashboard:', accessCheck.reason);
        router.navigate(['/caja/acceso-denegado'], {
          state: {
            reason: accessCheck.reason,
            session: accessCheck.session,
          },
        });
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error en cashierRoleGuard:', error);
    router.navigate(['/dashboard']);
    return false;
  }
};
```

**Flujo de Validación:**

1. ✅ Verificar rol de cajero (4 o 5)
2. ✅ Verificar tienda asignada
3. ✅ Si es ruta de dashboard → validar sesión activa
4. ✅ Si no puede acceder → redirigir a `/caja/acceso-denegado` con información

### 5. Frontend - Componente de Acceso Denegado

#### Archivo: `access-denied.ts`

```typescript
export default class AccessDenied implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  protected reason = signal<string>('No tienes acceso a esta sección');
  protected session = signal<CashRegisterSession | null>(null);

  ngOnInit() {
    // Obtener el estado de navegación
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;

    if (state?.reason) {
      this.reason.set(state.reason);
    }

    if (state?.session) {
      this.session.set(state.session);
    }
  }

  protected async navigateToLogin() {
    await this.authService.signOut();
    this.router.navigate(['/auth/log-in']);
  }
}
```

**Características:**

- Muestra razón del rechazo
- Muestra información de la sesión activa (si existe)
- Permite volver al inicio o cerrar sesión

### 6. Frontend - Componente de Apertura de Sesión

#### Archivo: `cash-register-open.ts`

```typescript
private async checkExistingSession() {
  try {
    const user = this.userData();
    if (!user) return;

    const shopId = await this.authService.getShopIdByUser();
    if (!shopId) return;

    // Verificar si ya existe una sesión abierta en este shop
    const openSession = await this.cashRegisterService.getOpenSessionByShop(shopId);

    if (openSession) {
      // Verificar si la sesión es del mismo cajero
      if (openSession.cashierId === user.id) {
        this.error.set('Ya tienes una sesión abierta. Debes cerrarla antes de abrir una nueva.');
      } else {
        this.error.set(
          `Este local ya tiene una sesión activa (Sesión #${openSession.sessionNumber}). ` +
            'Debes esperar a que el cajero actual cierre su sesión.'
        );
      }

      // Redirigir después de 3 segundos
      setTimeout(() => {
        this.router.navigate(['/caja/acceso-denegado'], {
          state: {
            reason: this.error(),
            session: openSession,
          },
        });
      }, 3000);
    }
  } catch (error) {
    console.log('No hay sesión abierta en este local');
  }
}
```

**Validaciones:**

1. ✅ Verificar si existe sesión abierta en la tienda
2. ✅ Si existe y es del mismo cajero → mostrar error "Ya tienes sesión abierta"
3. ✅ Si existe y es de otro cajero → mostrar error "Otro cajero tiene sesión activa"
4. ✅ Redirigir a acceso denegado con información completa

## 📊 Flujos de Operación

### Flujo 1: Cajero A Abre Sesión

```
1. Cajero A navega a /caja/abrir-sesion
2. Sistema valida: ¿Hay sesión abierta en shop_id X?
   → NO → Permitir abrir sesión
3. Cajero A completa formulario y abre sesión
4. Base de datos crea registro con closed_at = NULL
```

### Flujo 2: Cajero B Intenta Abrir Sesión en Misma Tienda

```
1. Cajero B navega a /caja/abrir-sesion
2. Sistema valida: ¿Hay sesión abierta en shop_id X?
   → SÍ → openSession.cashier_id = Cajero A
3. Sistema compara: openSession.cashier_id !== Cajero B
4. Mostrar error: "Este local ya tiene una sesión activa"
5. Redirigir a /caja/acceso-denegado después de 3 segundos
```

### Flujo 3: Cajero B Intenta Acceder al Dashboard

```
1. Cajero B navega a /caja/dashboard
2. cashierRoleGuard se activa
3. Guard llama a checkDashboardAccess(userId_B, shop_id_X)
4. Backend encuentra sesión abierta con cashier_id = Cajero A
5. Backend compara: employee_id_B !== cashier_id_A
6. Backend retorna: { canAccess: false, reason: "Otro cajero tiene la sesión activa" }
7. Guard redirige a /caja/acceso-denegado con información de sesión
```

### Flujo 4: Cajero A Cierra Sesión

```
1. Cajero A navega a /caja/cerrar-sesion
2. Sistema actualiza cash_register_sessions:
   → SET closed_at = now()
3. Constraint unique_open_session_per_shop se libera
4. Ahora Cajero B puede abrir una nueva sesión en shop_id X
```

## 🧪 Casos de Prueba

### Test 1: Una Sesión por Tienda

```sql
-- Intento de insertar dos sesiones abiertas en la misma tienda
INSERT INTO sales.cash_register_sessions (shop_id, cashier_id, session_number, session_type, opening_balance)
VALUES ('shop-1', 'cashier-A', 1, 'PARCIAL', 100);

-- Esto debe fallar con violación de constraint
INSERT INTO sales.cash_register_sessions (shop_id, cashier_id, session_number, session_type, opening_balance)
VALUES ('shop-1', 'cashier-B', 2, 'PARCIAL', 150);

-- Error esperado: duplicate key value violates unique constraint "unique_open_session_per_shop"
```

### Test 2: Validación de Acceso Correcto

```sql
SELECT * FROM sales.check_dashboard_access(
  'user-id-of-cashier-A',
  'shop-1'
);

-- Resultado esperado:
-- can_access: TRUE
-- reason: "Acceso permitido"
-- session_id: <id de la sesión>
-- session_number: 1
```

### Test 3: Validación de Acceso Denegado

```sql
SELECT * FROM sales.check_dashboard_access(
  'user-id-of-cashier-B',
  'shop-1'
);

-- Resultado esperado:
-- can_access: FALSE
-- reason: "Otro cajero tiene la sesión activa"
-- session_id: <id de la sesión de Cajero A>
-- session_number: 1
```

### Test 4: Apertura Después de Cierre

```sql
-- 1. Cerrar sesión de Cajero A
UPDATE sales.cash_register_sessions
SET closed_at = now()
WHERE shop_id = 'shop-1' AND closed_at IS NULL;

-- 2. Cajero B puede abrir nueva sesión
INSERT INTO sales.cash_register_sessions (shop_id, cashier_id, session_number, session_type, opening_balance)
VALUES ('shop-1', 'cashier-B', 2, 'PARCIAL', 200);

-- Resultado esperado: Inserción exitosa ✅
```

## 🔒 Seguridad

### Nivel 1: Base de Datos (INVIOLABLE)

- **Constraint:** `unique_open_session_per_shop`
- **Garantía:** PostgreSQL rechaza cualquier intento de insertar dos sesiones abiertas en la misma tienda
- **No puede ser evadido:** Ni desde backend, ni desde frontend, ni desde SQL directo

### Nivel 2: Backend (RPC Functions)

- **Funciones:** `check_dashboard_access`, `get_open_session_by_shop`
- **SECURITY DEFINER:** Ejecuta con permisos del creador (postgres), no del usuario
- **Validación:** Compara `employee_id` del usuario con `cashier_id` de la sesión

### Nivel 3: Frontend (Guard)

- **Guard:** `cashierRoleGuard`
- **Validación:** Intercepta navegación antes de cargar componente
- **Redirección:** Envía a página de acceso denegado con razón clara

### Nivel 4: UI (Componentes)

- **cash-register-open:** Valida antes de mostrar formulario
- **access-denied:** Muestra información clara del rechazo

## 📝 Archivos Modificados

### Backend (Base de Datos)

- `media/db/08_CASH_EXPENSES_AND_IMPROVEMENTS.sql` - Constraint y funciones RPC

### Frontend (Angular)

- `src/app/core/services/cash-register-service.ts` - Métodos de validación
- `src/app/core/guards/cashier-role-guard.ts` - Guard mejorado
- `src/app/features/cashier/access-denied/` - Componente nuevo
- `src/app/features/cashier/cash-register-open/cash-register-open.ts` - Validación mejorada
- `src/app/features/cashier/cashier.routes.ts` - Ruta de acceso denegado

## 🚀 Deployment

### 1. Ejecutar Migration

```sql
-- Ejecutar en Supabase SQL Editor
\i media/db/08_CASH_EXPENSES_AND_IMPROVEMENTS.sql
```

### 2. Verificar Constraint

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'unique_open_session_per_shop';
```

### 3. Verificar Funciones RPC

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('check_dashboard_access', 'get_open_session_by_shop');
```

### 4. Compilar Frontend

```bash
npm run build
```

### 5. Probar en Desarrollo

```bash
npm run start
```

## 📚 Recursos Adicionales

- [CASHIER_FIX_SUMMARY.md](CASHIER_FIX_SUMMARY.md) - Resumen de mejoras generales
- [media/recommendations/sales/CASHIER_IMPLEMENTATION.md](media/recommendations/sales/CASHIER_IMPLEMENTATION.md) - Guía de implementación
- [PostgreSQL EXCLUDE Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION)

## ✅ Checklist de Validación

- [x] Constraint de base de datos creado
- [x] Funciones RPC implementadas
- [x] Métodos en CashRegisterService agregados
- [x] Guard mejorado con validación de sesión
- [x] Componente access-denied creado
- [x] Ruta de acceso denegado agregada
- [x] Validación en cash-register-open implementada
- [x] Documentación completa
- [ ] Pruebas unitarias
- [ ] Pruebas de integración
- [ ] Pruebas de usuario

## 🐛 Troubleshooting

### Error: "Usuario no tiene empleado asociado"

**Causa:** El `user_id` en `auth.users` no tiene registro correspondiente en `hr.employees`
**Solución:** Crear empleado con `user_id` asociado

### Error: "No hay sesión abierta en esta tienda"

**Causa:** Cajero intenta acceder al dashboard sin sesión abierta
**Solución:** Cajero debe abrir sesión primero en `/caja/abrir-sesion`

### Error: Constraint violation en inserción

**Causa:** Ya existe una sesión abierta en la tienda
**Solución:** Cerrar sesión existente antes de abrir nueva

### Warning: Guard no redirige correctamente

**Causa:** Estado del router no se preserva
**Solución:** Verificar que se usa `state` en `router.navigate()`

---

**Última actualización:** 2024
**Versión:** 1.0.0
**Autor:** GitHub Copilot (Claude Sonnet 4.5)
