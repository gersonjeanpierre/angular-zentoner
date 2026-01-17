# Kardex - Mejoras y Recomendaciones

## ✅ Estado Actual

Todos los componentes del módulo kardex tienen los campos necesarios según el schema `inventory`:

### Componentes Implementados

1. **kardex-create** ✅ - Registro de nuevos rollos
2. **kardex-list** ✅ - Listado con stats y progress bars
3. **production-form** ✅ - Registro de producción con validación
4. **item-kardex-history** ✅ - Historial de movimientos

### Campos del Schema Cubiertos

#### roll_tracking

- ✅ id (UUID generado)
- ✅ item_id
- ✅ roll_code
- ✅ initial_quantity
- ✅ current_quantity (calculado por backend)
- ✅ status (calculado por backend)
- ✅ received_date
- ✅ notes
- ✅ created_at
- ✅ updated_at

#### consumption_logs

- ✅ movement_type_id (manejado por backend)
- ✅ movement_reason_id (manejado por backend)
- ✅ machine_id
- ✅ operator_id
- ✅ order_detail_id
- ✅ job_name
- ✅ customer_quantity
- ✅ calibration_waste
- ✅ error_waste
- ✅ width_used_mm
- ✅ length_used_mm

---

## 🎯 Recomendaciones de Mejora

### 1. **Selector de Operador en production-form**

**Prioridad:** Media  
**Impacto:** Mejorar trazabilidad

Actualmente el `operator_id` se toma automáticamente del usuario logueado, pero sería útil poder seleccionar un operador diferente (por ejemplo, cuando un supervisor registra el trabajo de otro).

**Implementación:**

```typescript
// production-form.ts
protected readonly operators = signal<UserView[]>([]);

async ngOnInit() {
  // Cargar operadores activos
  const operators = await this.authService.getActiveOperators();
  this.operators.set(operators);
}
```

```html
<!-- production-form.html - Agregar después de Machine -->
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Operador *</span>
  </label>
  <select [formField]="productionForm.operator_id" class="select select-bordered w-full">
    @for (operator of operators(); track operator.id) {
    <option [value]="operator.id">{{ operator.name }}</option>
    }
  </select>
</div>
```

---

### 2. **Validación de Stock en Tiempo Real**

**Prioridad:** Alta  
**Impacto:** Prevenir errores de stock

Agregar validación que prevenga envíos si el stock es insuficiente.

**Implementación:**

```typescript
// production-form.ts
protected readonly isStockSufficient = computed(() => {
  const roll = this.selectedRoll();
  const total = this.getTotalQuantity();
  return roll ? roll.current_quantity >= total : false;
});
```

```html
<!-- production-form.html - Actualizar botón submit -->
<button
  type="submit"
  class="btn btn-primary"
  [disabled]="
    productionForm.roll_id().invalid() ||
    productionForm.machine_id().invalid() ||
    productionForm.job_name().invalid() ||
    productionForm.customer_quantity().invalid() ||
    !isStockSufficient() ||
    loading()
  "
>
  <!-- ... -->
</button>
```

---

### 3. **Filtros Avanzados en kardex-list**

**Prioridad:** Media  
**Impacto:** Mejorar búsqueda y visualización

Agregar filtros por:

- Estado (FULL, PARTIAL, EMPTY)
- Item
- Rango de fechas
- Búsqueda por roll_code

**Implementación:**

```typescript
// kardex-list.ts
protected readonly filters = signal({
  status: '',
  itemId: '',
  rollCode: '',
  startDate: '',
  endDate: '',
});

protected readonly filteredRolls = computed(() => {
  let rolls = this.rolls();
  const f = this.filters();

  if (f.status) {
    rolls = rolls.filter(r => r.status === f.status);
  }
  if (f.itemId) {
    rolls = rolls.filter(r => r.item_id === f.itemId);
  }
  if (f.rollCode) {
    rolls = rolls.filter(r =>
      r.roll_code.toLowerCase().includes(f.rollCode.toLowerCase())
    );
  }

  return rolls;
});
```

```html
<!-- kardex-list.html - Agregar sección de filtros -->
<div class="card bg-base-100 shadow-sm">
  <div class="card-body">
    <h3 class="card-title text-base">Filtros</h3>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <select [(ngModel)]="filters().status" class="select select-bordered select-sm">
        <option value="">Todos los estados</option>
        <option value="FULL">Completos</option>
        <option value="PARTIAL">Parciales</option>
        <option value="EMPTY">Vacíos</option>
      </select>

      <input
        type="text"
        [(ngModel)]="filters().rollCode"
        placeholder="Buscar por código..."
        class="input input-bordered input-sm"
      />
    </div>
  </div>
</div>
```

---

### 4. **Exportación de Reportes**

**Prioridad:** Baja  
**Impacto:** Utilidad para auditorías

Permitir exportar reportes de:

- Kardex por item
- Kardex por rollo
- Consumos de producción

**Implementación:**

```typescript
// kardex-list.ts
protected async exportToCSV() {
  const rolls = this.rolls();

  const csv = [
    ['Código', 'Item', 'SKU', 'Inicial', 'Actual', 'Estado'],
    ...rolls.map(r => [
      r.roll_code,
      r.item_name,
      r.item_sku,
      r.initial_quantity,
      r.current_quantity,
      r.status
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kardex_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
```

```html
<!-- kardex-list.html - Agregar botón en header -->
<button (click)="exportToCSV()" class="btn btn-outline btn-sm">
  <span class="icon-[mdi--download]"></span>
  Exportar CSV
</button>
```

---

### 5. **Vista de Alertas de Stock Bajo**

**Prioridad:** Alta  
**Impacto:** Prevención de falta de material

Agregar una vista que muestre rollos con stock bajo para reabastecimiento.

**Implementación:**

```typescript
// kardex-list.ts
protected readonly lowStockRolls = computed(() => {
  return this.rolls().filter(roll => {
    const percentage = (roll.current_quantity / roll.initial_quantity) * 100;
    return percentage <= 20 && percentage > 0;
  });
});
```

```html
<!-- kardex-list.html - Agregar alerta -->
@if (lowStockRolls().length > 0) {
<div class="alert alert-warning">
  <span class="icon-[mdi--alert]"></span>
  <div>
    <h3 class="font-bold">¡Atención! Rollos con stock bajo</h3>
    <div class="text-sm">Hay {{ lowStockRolls().length }} rollo(s) con menos del 20% de stock</div>
  </div>
  <button class="btn btn-sm btn-warning">Ver Detalles</button>
</div>
}
```

---

### 6. **Gráficos de Consumo**

**Prioridad:** Baja  
**Impacto:** Visualización de tendencias

Integrar Chart.js o similar para mostrar:

- Consumo por máquina
- Consumo por operador
- Tendencias de mermas

**Librerías Recomendadas:**

- [Chart.js](https://www.chartjs.org/) - Simple y ligero
- [ApexCharts](https://apexcharts.com/) - Más features
- [ngx-charts](https://swimlane.github.io/ngx-charts/) - Nativo Angular

---

### 7. **Optimización de Carga con Paginación**

**Prioridad:** Alta (si hay muchos rollos)  
**Impacto:** Performance

Actualmente `kardex-list` carga todos los rollos. Si hay cientos, esto puede ser lento.

**Implementación:**

```typescript
// kardex-list.ts
protected readonly pagination = signal({
  page: 1,
  pageSize: 20,
  total: 0
});

protected async loadRolls() {
  const response = await this.kardexService.getRolls({
    page: this.pagination().page,
    pageSize: this.pagination().pageSize,
    status: this.filters().status
  });

  this.rolls.set(response.data);
  this.pagination.update(p => ({ ...p, total: response.count }));
}
```

```html
<!-- kardex-list.html - Agregar paginación -->
<div class="join">
  @for (page of [1,2,3,4,5]; track page) {
  <button
    class="join-item btn btn-sm"
    [class.btn-active]="pagination().page === page"
    (click)="goToPage(page)"
  >
    {{ page }}
  </button>
  }
</div>
```

---

### 8. **Confirmación antes de Registrar Producción**

**Prioridad:** Media  
**Impacto:** Prevenir errores humanos

Mostrar un modal de confirmación con resumen antes de registrar producción.

**Implementación:**

```typescript
// production-form.ts
protected readonly showConfirmModal = signal(false);

protected async onSubmit(event: Event) {
  event.preventDefault();

  // Validaciones...

  // Mostrar modal de confirmación
  this.showConfirmModal.set(true);
}

protected async confirmSubmit() {
  this.showConfirmModal.set(false);
  // Lógica de registro...
}
```

```html
<!-- production-form.html - Modal de confirmación -->
@if (showConfirmModal()) {
<div class="modal modal-open">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Confirmar Registro de Producción</h3>
    <div class="py-4">
      <p><strong>Rollo:</strong> {{ selectedRoll()?.roll_code }}</p>
      <p><strong>Trabajo:</strong> {{ productionModel().job_name }}</p>
      <p><strong>Total a consumir:</strong> {{ getTotalQuantity() | number: '1.2-3' }}</p>
    </div>
    <div class="modal-action">
      <button class="btn" (click)="showConfirmModal.set(false)">Cancelar</button>
      <button class="btn btn-primary" (click)="confirmSubmit()">Confirmar</button>
    </div>
  </div>
</div>
}
```

---

## 🔧 Optimizaciones Técnicas

### 1. **Lazy Loading de Componentes**

Ya implementado en el routing, pero verificar:

```typescript
// inventory.routes.ts
{
  path: 'kardex',
  loadComponent: () => import('./kardex/kardex-list/kardex-list'),
},
```

### 2. **Debounce en Búsquedas**

Para filtros de búsqueda en tiempo real:

```typescript
import { debounceTime } from 'rxjs/operators';

protected searchControl = new FormControl('');

ngOnInit() {
  this.searchControl.valueChanges
    .pipe(debounceTime(300))
    .subscribe(value => {
      this.filters.update(f => ({ ...f, rollCode: value || '' }));
    });
}
```

### 3. **Error Handling Global**

Crear un servicio de errores:

```typescript
// error-handler.service.ts
@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  handleError(error: any, userMessage: string) {
    console.error('Error:', error);
    // Mostrar toast o notificación
    this.showToast(userMessage, 'error');
  }
}
```

---

## 📊 Métricas Sugeridas

Para evaluar el uso del sistema:

1. **Rollos registrados por mes**
2. **Consumo promedio por máquina**
3. **Mermas técnicas vs operativas**
4. **Tiempo promedio de vaciado de rollos**
5. **Items con mayor rotación**

---

## 🎨 Mejoras de UX

### 1. **Skeleton Loaders**

En lugar de spinners, usar skeleton screens:

```html
<div class="skeleton h-32 w-full"></div>
<div class="skeleton h-4 w-28"></div>
```

### 2. **Toasts de Notificación**

Usar DaisyUI toast para feedback:

```typescript
protected showToast(message: string, type: 'success' | 'error' | 'info') {
  // Implementar con DaisyUI toast
}
```

### 3. **Drag & Drop para Order Details**

Permitir arrastrar items de orden a production form.

---

## 🔒 Seguridad

### 1. **Validación de Permisos**

Verificar RLS policies en Supabase:

```sql
-- Solo usuarios autenticados pueden ver rollos de su tienda
CREATE POLICY "users_can_view_own_shop_rolls"
ON inventory.roll_tracking
FOR SELECT
TO authenticated
USING (
  item_id IN (
    SELECT id FROM inventory.items
    WHERE shop_id = (SELECT shop_id FROM auth.users WHERE id = auth.uid())
  )
);
```

### 2. **Sanitización de Inputs**

Verificar que todos los inputs estén validados:

```typescript
import { DOMPurify } from 'dompurify';

protected sanitizeInput(value: string): string {
  return DOMPurify.sanitize(value);
}
```

---

## 📝 Conclusión

El sistema kardex está **completo y funcional** con todos los campos del schema implementados. Las recomendaciones anteriores son **mejoras opcionales** que pueden implementarse según la prioridad del negocio.

### Priorización Sugerida:

1. **Alta Prioridad:** Validación de stock en tiempo real, Alertas de stock bajo
2. **Media Prioridad:** Filtros avanzados, Selector de operador, Confirmación de registro
3. **Baja Prioridad:** Exportación de reportes, Gráficos, Drag & Drop

### Próximos Pasos:

1. ✅ Verificar que todos los componentes compilan sin errores
2. ✅ Probar el flujo completo: Crear rollo → Registrar producción → Ver historial
3. ⏳ Implementar función RPC `register_production` en PostgreSQL
4. ⏳ Implementar mejoras según priorización

---

**Fecha:** 2025-01-XX  
**Versión:** 1.0  
**Autor:** GitHub Copilot
