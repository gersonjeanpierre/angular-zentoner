# Historial de Sesiones de Caja

**Fecha de Implementación:** 2026-01-31  
**Versión:** 1.0.0  
**Estado:** ✅ Implementado y Operativo

---

## 📋 Descripción

El módulo **Historial de Sesiones** proporciona una interfaz completa para que los cajeros puedan consultar todas sus sesiones de caja pasadas y actuales, filtradas automáticamente por su usuario y tienda asignada.

---

## 🎯 Características Principales

### 1. **Visualización de Sesiones**

- Lista completa de todas las sesiones del cajero
- Información resumida de cada sesión
- Indicadores visuales de estado (Abierta/Cerrada)
- Badges para identificar tipo de sesión (Parcial/Final)

### 2. **Filtros Avanzados**

- **Por Estado:** Todas / Abiertas / Cerradas
- **Por Tipo:** Todos / Parcial / Final
- **Por Rango de Fechas:** Fecha desde / Fecha hasta
- Botón de limpieza rápida de filtros

### 3. **Estadísticas en Tiempo Real**

- Total de sesiones encontradas
- Número de sesiones abiertas
- Número de sesiones cerradas

### 4. **Modal de Detalle**

- Resumen completo de la sesión seleccionada
- Separación clara de Caja Chica y Efectivo de Ventas
- Desglose de métodos de pago
- Estadísticas de órdenes
- Notas de apertura y cierre
- Solo lectura (sin edición ni eliminación)

### 5. **UI Responsive**

- Diseño mobile-first
- Adaptable a tablets y desktop
- Botón flotante de recarga en móviles
- Grid flexible para diferentes tamaños de pantalla

---

## 🗂️ Estructura de Archivos

```
src/app/features/cashier/session-history/
├── session-history.ts        # Componente TypeScript
└── session-history.html      # Template HTML
```

---

## 🔧 Componente TypeScript

### Archivo: `session-history.ts`

#### Imports y Dependencias

```typescript
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import {
  CashRegisterSession,
  SessionDashboard,
  SessionStatus,
  SessionType,
} from '@data/models/sales/cash-register.model';
```

#### State Signals

```typescript
// Datos principales
protected sessions = signal<CashRegisterSession[]>([]);
protected loading = signal(false);
protected error = signal<string | null>(null);
protected currentUserId = signal<string | null>(null);
protected currentShopId = signal<string | null>(null);

// Filtros
protected statusFilter = signal<SessionStatus | 'ALL'>('ALL');
protected typeFilter = signal<SessionType | 'ALL'>('ALL');
protected dateFromFilter = signal<string>('');
protected dateToFilter = signal<string>('');

// Modal
protected selectedSession = signal<CashRegisterSession | null>(null);
protected selectedSessionDashboard = signal<SessionDashboard | null>(null);
protected loadingModal = signal(false);
protected showModal = signal(false);
```

#### Computed Signals

```typescript
// Sesiones filtradas según los criterios seleccionados
protected filteredSessions = computed(() => {
  let filtered = this.sessions();

  const status = this.statusFilter();
  if (status !== 'ALL') {
    filtered = filtered.filter((s) => s.status === status);
  }

  const type = this.typeFilter();
  if (type !== 'ALL') {
    filtered = filtered.filter((s) => s.sessionType === type);
  }

  const dateFrom = this.dateFromFilter();
  if (dateFrom) {
    filtered = filtered.filter((s) => s.openedAt >= dateFrom);
  }

  const dateTo = this.dateToFilter();
  if (dateTo) {
    filtered = filtered.filter((s) => s.openedAt <= dateTo + 'T23:59:59');
  }

  return filtered;
});

// Estadísticas
protected totalSessions = computed(() => this.filteredSessions().length);
protected openSessions = computed(
  () => this.filteredSessions().filter((s) => s.status === 'ABIERTO').length
);
protected closedSessions = computed(
  () => this.filteredSessions().filter((s) => s.status === 'CERRADO').length
);
```

#### Métodos Principales

**Inicialización:**

```typescript
async ngOnInit() {
  await this.loadUserData();    // Carga usuario y shopId
  await this.loadSessions();    // Carga sesiones del cajero
}
```

**Carga de Sesiones:**

```typescript
protected async loadSessions() {
  const sessions = await this.cashRegisterService.getSessions({
    shopId: shopId,
    cashierId: userId,
  });
  this.sessions.set(sessions);
}
```

**Abrir Modal de Detalle:**

```typescript
protected async openSessionDetail(session: CashRegisterSession) {
  this.selectedSession.set(session);
  this.showModal.set(true);

  const dashboard = await this.cashRegisterService.getSessionDashboard(session.id);
  this.selectedSessionDashboard.set(dashboard);
}
```

**Gestión de Filtros:**

```typescript
protected setStatusFilter(status: SessionStatus | 'ALL') {
  this.statusFilter.set(status);
}

protected setTypeFilter(type: SessionType | 'ALL') {
  this.typeFilter.set(type);
}

protected setDateFromFilter(event: Event) {
  const input = event.target as HTMLInputElement;
  this.dateFromFilter.set(input.value);
}

protected setDateToFilter(event: Event) {
  const input = event.target as HTMLInputElement;
  this.dateToFilter.set(input.value);
}

protected clearFilters() {
  this.statusFilter.set('ALL');
  this.typeFilter.set('ALL');
  this.dateFromFilter.set('');
  this.dateToFilter.set('');
}
```

---

## 🎨 Template HTML

### Secciones Principales

#### 1. Header con Navegación

```html
<div class="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
  <div>
    <h1 class="text-2xl md:text-3xl font-bold">Historial de Sesiones</h1>
    <p class="text-sm md:text-base text-base-content/70">
      Registro completo de tus sesiones de caja
    </p>
  </div>
  <button class="btn btn-ghost w-full sm:w-auto" (click)="navigateBack()">
    <!-- SVG Icon -->
    Volver al Dashboard
  </button>
</div>
```

#### 2. Tarjetas de Estadísticas

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  <!-- Total Sesiones -->
  <div class="stat bg-base-200 rounded-box shadow">
    <div class="stat-figure text-primary"><!-- SVG --></div>
    <div class="stat-title">Total Sesiones</div>
    <div class="stat-value text-primary">{{ totalSessions() }}</div>
    <div class="stat-desc">Sesiones encontradas</div>
  </div>

  <!-- Sesiones Abiertas -->
  <div class="stat bg-base-200 rounded-box shadow">
    <div class="stat-figure text-success"><!-- SVG --></div>
    <div class="stat-title">Sesiones Abiertas</div>
    <div class="stat-value text-success">{{ openSessions() }}</div>
    <div class="stat-desc">Actualmente activas</div>
  </div>

  <!-- Sesiones Cerradas -->
  <div class="stat bg-base-200 rounded-box shadow">
    <div class="stat-figure text-base-content/50"><!-- SVG --></div>
    <div class="stat-title">Sesiones Cerradas</div>
    <div class="stat-value">{{ closedSessions() }}</div>
    <div class="stat-desc">Finalizadas correctamente</div>
  </div>
</div>
```

#### 3. Panel de Filtros

```html
<div class="card bg-base-200 shadow-xl mb-6">
  <div class="card-body">
    <div class="flex justify-between items-center mb-4">
      <h2 class="card-title">
        <!-- SVG Icon -->
        Filtros
      </h2>
      <button class="btn btn-sm btn-ghost" (click)="clearFilters()">
        <!-- SVG Icon -->
        Limpiar
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Select de Estado -->
      <div class="form-control">
        <label class="label"><span class="label-text">Estado</span></label>
        <select
          class="select select-bordered w-full"
          [value]="statusFilter()"
          (change)="setStatusFilter($any($event.target).value)"
        >
          <option value="ALL">Todos</option>
          <option value="ABIERTO">Abiertas</option>
          <option value="CERRADO">Cerradas</option>
        </select>
      </div>

      <!-- Select de Tipo -->
      <div class="form-control">
        <label class="label"><span class="label-text">Tipo</span></label>
        <select
          class="select select-bordered w-full"
          [value]="typeFilter()"
          (change)="setTypeFilter($any($event.target).value)"
        >
          <option value="ALL">Todos</option>
          <option value="PARCIAL">Parcial</option>
          <option value="FINAL">Final</option>
        </select>
      </div>

      <!-- Input Fecha Desde -->
      <div class="form-control">
        <label class="label"><span class="label-text">Desde</span></label>
        <input
          type="date"
          class="input input-bordered w-full"
          [value]="dateFromFilter()"
          (change)="setDateFromFilter($event)"
        />
      </div>

      <!-- Input Fecha Hasta -->
      <div class="form-control">
        <label class="label"><span class="label-text">Hasta</span></label>
        <input
          type="date"
          class="input input-bordered w-full"
          [value]="dateToFilter()"
          (change)="setDateToFilter($event)"
        />
      </div>
    </div>
  </div>
</div>
```

#### 4. Lista de Sesiones

```html
<div class="grid grid-cols-1 gap-4">
  @for (session of filteredSessions(); track session.id) {
  <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
    <div class="card-body">
      <!-- Header con Número y Badges -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div class="flex items-center gap-3">
          <div class="avatar placeholder">
            <div class="bg-primary text-primary-content rounded-full w-12 h-12">
              <span class="text-xl">#{{ session.sessionNumber }}</span>
            </div>
          </div>
          <div>
            <h3 class="text-lg font-bold">Sesión #{{ session.sessionNumber }}</h3>
            <p class="text-sm text-base-content/70">{{ formatDateOnly(session.openedAt) }}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <span class="badge" [ngClass]="getStatusBadgeClass(session.status)">
            {{ session.status }}
          </span>
          <span class="badge" [ngClass]="getTypeBadgeClass(session.sessionType)">
            {{ session.sessionType }}
          </span>
        </div>
      </div>

      <!-- Grid de Estadísticas -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p class="text-xs text-base-content/60">Balance Inicial</p>
          <p class="text-lg font-semibold">{{ formatCurrency(session.openingBalance) }}</p>
        </div>
        <div>
          <p class="text-xs text-base-content/60">Balance Final</p>
          <p class="text-lg font-semibold">{{ formatCurrency(session.closingBalance) }}</p>
        </div>
        <div>
          <p class="text-xs text-base-content/60">Órdenes</p>
          <p class="text-lg font-semibold">{{ session.totalOrders || 0 }}</p>
        </div>
        <div>
          <p class="text-xs text-base-content/60">Duración</p>
          <p class="text-lg font-semibold">{{ getSessionDuration(session) }}</p>
        </div>
      </div>

      <!-- Footer con Detalles y Botón -->
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-4 border-t border-base-300"
      >
        <div class="text-sm text-base-content/70">
          <p><strong>Apertura:</strong> {{ formatDate(session.openedAt) }}</p>
          @if (session.closedAt) {
          <p><strong>Cierre:</strong> {{ formatDate(session.closedAt) }}</p>
          } @if (session.difference !== null) {
          <p [ngClass]="getDifferenceClass(session.difference)">
            <strong>Diferencia:</strong> {{ formatCurrency(session.difference) }}
          </p>
          }
        </div>
        <button
          class="btn btn-primary btn-sm w-full sm:w-auto"
          (click)="openSessionDetail(session)"
        >
          <!-- SVG Icon -->
          Ver Detalle
        </button>
      </div>
    </div>
  </div>
  }
</div>
```

#### 5. Modal de Detalle Completo

```html
@if (showModal()) {
<div class="modal modal-open">
  <div class="modal-box max-w-4xl">
    <!-- Modal Header -->
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-2xl">Detalle de Sesión #{{ selectedSession()!.sessionNumber }}</h3>
      <button class="btn btn-sm btn-circle btn-ghost" (click)="closeModal()">✕</button>
    </div>

    @if (loadingModal()) {
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    } @else if (selectedSessionDashboard()) {
    <div class="space-y-6">
      <!-- Sección CAJA CHICA -->
      <div class="divider">CAJA CHICA</div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Balance Inicial, Gastos, Esperado, Real -->
      </div>

      <!-- Alert de Diferencia -->
      @if (selectedSession()!.difference !== null) {
      <div class="alert" [class.alert-success|warning|error]="...">
        <!-- Diferencia de Caja Chica -->
      </div>
      }

      <!-- Sección EFECTIVO DE VENTAS -->
      <div class="divider">EFECTIVO DE VENTAS (Va a Caja Fuerte)</div>
      <div class="alert alert-info shadow">
        <!-- Efectivo Recaudado -->
      </div>

      <!-- Sección MÉTODOS DE PAGO -->
      <div class="divider">MÉTODOS DE PAGO</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <!-- Tarjetas, Transferencias, Billeteras, Otros -->
      </div>

      <!-- Sección ESTADÍSTICAS DE ÓRDENES -->
      <div class="divider">ESTADÍSTICAS DE ÓRDENES</div>
      <div class="stats stats-vertical lg:stats-horizontal shadow w-full">
        <!-- Total, Pagadas, Parciales, Pendientes -->
      </div>

      <!-- Sección NOTAS -->
      @if (selectedSession()!.openingNotes || selectedSession()!.closingNotes) {
      <div class="divider">NOTAS</div>
      <!-- Notas de Apertura y Cierre -->
      }
    </div>
    }

    <!-- Modal Actions -->
    <div class="modal-action">
      <button class="btn" (click)="closeModal()">Cerrar</button>
    </div>
  </div>
  <div class="modal-backdrop" (click)="closeModal()"></div>
</div>
}
```

---

## 🚀 Navegación

### Ruta

```
/caja/historial
```

### Configuración en `cashier.routes.ts`

```typescript
{
  path: 'historial',
  loadComponent: () => import('./session-history/session-history'),
  title: 'Historial de Sesiones',
},
```

### Enlace desde Dashboard

```typescript
protected navigateToHistory() {
  this.router.navigate(['/caja/historial']);
}
```

```html
<button class="btn btn-ghost" (click)="navigateToHistory()">
  <!-- SVG Clock Icon -->
  Historial
</button>
```

---

## 🎨 Características de UI

### DaisyUI Components Utilizados

- ✅ **Stats** - Tarjetas de estadísticas
- ✅ **Card** - Contenedores de sesiones
- ✅ **Badge** - Indicadores de estado y tipo
- ✅ **Modal** - Ventana de detalle
- ✅ **Alert** - Mensajes informativos
- ✅ **Button** - Acciones y navegación
- ✅ **Form Controls** - Selectores y inputs de fecha
- ✅ **Divider** - Separadores de secciones
- ✅ **Avatar** - Placeholder con número de sesión

### Responsive Design

- **Mobile:** 1 columna, botones full-width, botón flotante de recarga
- **Tablet:** 2 columnas en grids, layout adaptado
- **Desktop:** 3-4 columnas, layout completo

### Colores Semánticos

- **Primary:** Información general y sesiones
- **Success:** Sesiones abiertas, balance cuadrado
- **Warning:** Diferencias positivas, sesiones parciales
- **Error:** Diferencias negativas, problemas
- **Info:** Balance esperado, efectivo de ventas

---

## ⚙️ Funcionalidades Técnicas

### 1. **Filtrado Reactivo**

Los filtros se aplican en tiempo real usando `computed()`:

```typescript
protected filteredSessions = computed(() => {
  let filtered = this.sessions();

  // Aplicar filtros de estado, tipo y fechas
  // Retornar lista filtrada

  return filtered;
});
```

### 2. **Estadísticas Dinámicas**

Las estadísticas se recalculan automáticamente cuando cambian los filtros:

```typescript
protected totalSessions = computed(() => this.filteredSessions().length);
protected openSessions = computed(
  () => this.filteredSessions().filter((s) => s.status === 'ABIERTO').length
);
protected closedSessions = computed(
  () => this.filteredSessions().filter((s) => s.status === 'CERRADO').length
);
```

### 3. **Carga Lazy del Dashboard**

El dashboard de la sesión solo se carga cuando el usuario abre el modal:

```typescript
protected async openSessionDetail(session: CashRegisterSession) {
  this.selectedSession.set(session);
  this.showModal.set(true);
  this.loadingModal.set(true);

  try {
    const dashboard = await this.cashRegisterService.getSessionDashboard(session.id);
    this.selectedSessionDashboard.set(dashboard);
  } catch (err: any) {
    console.error('Error al cargar detalle de sesión:', err);
  } finally {
    this.loadingModal.set(false);
  }
}
```

### 4. **Formato de Datos**

```typescript
// Moneda en Soles Peruanos
protected formatCurrency(amount: number | null): string {
  if (amount === null) return 'N/A';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
}

// Fecha completa con hora
protected formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Solo fecha
protected formatDateOnly(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Duración de sesión
protected getSessionDuration(session: CashRegisterSession): string {
  if (!session.closedAt) return 'En curso';

  const start = new Date(session.openedAt);
  const end = new Date(session.closedAt);
  const diff = end.getTime() - start.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}
```

---

## 🔒 Seguridad y Permisos

### Filtrado Automático

- Las sesiones se filtran automáticamente por `cashierId` y `shopId`
- El usuario solo ve SUS propias sesiones
- No hay acceso a sesiones de otros cajeros o tiendas

### Protección de Rutas

```typescript
{
  path: '',
  canActivate: [cashierRoleGuard],
  children: [
    // ... rutas protegidas
  ],
}
```

### Solo Lectura

- No hay botones de edición
- No hay botones de eliminación
- El modal solo permite cerrar y visualizar

---

## 📊 Datos Mostrados

### Por Sesión

- Número de sesión
- Estado (Abierta/Cerrada)
- Tipo (Parcial/Final)
- Balance inicial
- Balance final
- Número de órdenes
- Duración
- Fecha y hora de apertura
- Fecha y hora de cierre
- Diferencia detectada

### En el Modal de Detalle

- **Caja Chica:**
  - Balance inicial
  - Gastos totales
  - Balance esperado
  - Balance real
  - Diferencia

- **Efectivo de Ventas:**
  - Total recaudado (va a caja fuerte)

- **Métodos de Pago:**
  - Tarjetas
  - Transferencias
  - Billeteras digitales
  - Otros

- **Estadísticas de Órdenes:**
  - Total de órdenes
  - Órdenes pagadas
  - Órdenes parciales
  - Órdenes pendientes

- **Notas:**
  - Notas de apertura
  - Notas de cierre

---

## ✅ Validaciones y Estados

### Estados de Carga

```typescript
@if (loading()) {
  <div class="flex justify-center items-center h-64">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
}
```

### Estado Vacío

```html
@else if (filteredSessions().length === 0) {
<div class="card bg-base-200 shadow-xl">
  <div class="card-body text-center py-12">
    <!-- SVG Icon -->
    <p class="text-lg font-semibold mb-2">No hay sesiones</p>
    <p class="text-base-content/70">No se encontraron sesiones con los filtros seleccionados</p>
  </div>
</div>
}
```

### Manejo de Errores

```typescript
@if (error()) {
  <div class="alert alert-error mb-6 shadow-lg">
    <!-- SVG Icon -->
    <span>{{ error() }}</span>
  </div>
}
```

---

## 🎯 Casos de Uso

### 1. Cajero Quiere Ver Todas Sus Sesiones

1. Navega a `/caja/historial`
2. Ve lista completa de sus sesiones ordenadas por fecha descendente

### 2. Cajero Busca Sesión Específica por Fecha

1. Usa filtros de fecha "Desde" y "Hasta"
2. La lista se actualiza automáticamente

### 3. Cajero Necesita Ver Detalle de Una Sesión Cerrada

1. Hace clic en "Ver Detalle" en la tarjeta de la sesión
2. Se abre modal con información completa
3. Revisa caja chica, efectivo de ventas, y métodos de pago
4. Cierra el modal

### 4. Supervisor Verifica Sesiones Abiertas

1. Filtra por estado "Abiertas"
2. Ve solo las sesiones que aún no han sido cerradas
3. Puede ver el detalle de cada una

---

## 🚀 Mejoras Futuras (Opcionales)

- [ ] Exportar historial a PDF o Excel
- [ ] Gráficos de tendencias de ventas
- [ ] Comparación entre sesiones
- [ ] Alertas de sesiones con diferencias
- [ ] Búsqueda por número de sesión
- [ ] Paginación para grandes volúmenes de datos
- [ ] Indicadores de rendimiento del cajero

---

## 📝 Notas de Desarrollo

### Mejores Prácticas Aplicadas

✅ **Standalone Components**  
✅ **Signals para reactividad**  
✅ **Computed para filtros y estadísticas**  
✅ **ChangeDetection.OnPush** para performance  
✅ **inject()** para inyección de dependencias  
✅ **Control Flow moderno** (@if, @for, @else)  
✅ **Responsive design** mobile-first  
✅ **DaisyUI components** consistentes  
✅ **Manejo de errores** robusto  
✅ **Loading states** claros

### Convenciones de Código

- **camelCase** para propiedades y métodos
- **protected** para miembros usados en templates
- **signal()** para estado mutable
- **computed()** para valores derivados
- **async/await** para operaciones asíncronas

---

## ✨ Resultado Final

### Implementación Exitosa

- ✅ Sin errores de compilación
- ✅ UI responsive y atractiva
- ✅ Filtros funcionando correctamente
- ✅ Modal de detalle completo
- ✅ Integración con servicios existentes
- ✅ Documentación completa

### Experiencia de Usuario

- 📱 **Mobile-friendly:** Funciona perfectamente en dispositivos móviles
- 🎨 **UI Consistente:** Usa los mismos componentes que el resto del módulo
- ⚡ **Performance:** Carga rápida y filtrado reactivo
- 🔍 **Búsqueda Fácil:** Filtros intuitivos y limpiar con un clic
- 📊 **Información Clara:** Estadísticas y detalles bien organizados

---

**¡Módulo de Historial de Sesiones Completado Exitosamente! 🎉**
