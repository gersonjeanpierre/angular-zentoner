---
applyTo: 'src/app/core/services/**'
description: Patrón estándar para servicios con caché usando Dexie y Supabase
---

# Service Pattern - Angular con Supabase y Dexie

## Estructura Base del Servicio

Todo servicio que maneje datos debe seguir este patrón para mantener consistencia y optimización.

### 1. Imports Requeridos

```typescript
import { Injectable, inject } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import { dexieDB } from '@core/dexie/db';
import { from, Observable } from 'rxjs';
import { liveQuery } from 'dexie';
import camelcaseKeys from 'camelcase-keys';
```

### 2. Estructura del Servicio

```typescript
@Injectable({ providedIn: 'root' })
export class EntityService {
  // SIEMPRE usar "supabase" (readonly) - NO "supabaseClient"
  private readonly supabase = inject(Supabase).client;

  // Observable reactivo conectado a Dexie
  public dataEntities$: Observable<EntityView[]> = from(
    liveQuery(() => dexieDB.entities.toArray()),
  );

  // Métodos del servicio...
}
```

## Métodos Estándar Requeridos

### 1. fetchEntitiesFromSupabase()

Carga datos desde Supabase y los almacena en Dexie.

```typescript
/**
 * Carga todas las entidades activas desde Supabase y las almacena en Dexie.
 */
async fetchEntitiesFromSupabase(): Promise<void> {
  try {
    const { data, error } = await this.supabase
      .schema('schema_name')
      .from('table_name')
      .select('*')
      .is('deleted_at', null); // Filtrar registros activos

    if (error) {
      console.error('Error al obtener las entidades:', error);
      throw error;
    }

    if (data) {
      const entities = camelcaseKeys(data, { deep: true }) as EntityView[];
      await dexieDB.entities.bulkPut(entities);
      console.log(`[EntityService] ${entities.length} entidades almacenadas en Dexie`);
    }
  } catch (error) {
    console.error('Error en fetchEntitiesFromSupabase:', error);
    throw error;
  }
}
```

### 2. ensureEntitiesLoaded()

Verifica el caché y solo carga si es necesario.

```typescript
/**
 * Asegura que las entidades estén cargadas en Dexie.
 * Solo hace fetch si Dexie está vacío (primera vez después de autenticación).
 */
async ensureEntitiesLoaded(): Promise<void> {
  const count = await dexieDB.entities.count();
  if (count === 0) {
    console.log('[EntityService] Cargando entidades desde Supabase (primera vez)');
    await this.fetchEntitiesFromSupabase();
  } else {
    console.log('[EntityService] Usando caché de Dexie (', count, 'entidades)');
  }
}
```

### 3. getEntities() - Con Optimización Inteligente

Usa Dexie para consultas simples, Supabase para filtros complejos.

```typescript
async getEntities(params: GetEntitiesParams = {}): Promise<GetEntitiesResponse> {
  const { status = 'ACTIVE', search, page = 1, pageSize = 20, ...filters } = params;

  // Si hay filtros complejos o búsqueda, usar Supabase directamente
  const hasComplexFilters = search || status !== 'ACTIVE' || Object.keys(filters).length > 0;

  if (hasComplexFilters) {
    return this.getEntitiesFromSupabase(params);
  }

  // Para listados simples, usar Dexie (instantáneo)
  const allEntities = await dexieDB.entities.toArray();
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginatedData = allEntities.slice(from, to);

  return {
    data: paginatedData,
    count: allEntities.length,
    page,
    pageSize,
    totalPages: Math.ceil(allEntities.length / pageSize),
  };
}
```

### 4. getEntitiesFromSupabase() - Método Privado

Consultas complejas con filtros en Supabase.

```typescript
private async getEntitiesFromSupabase(
  params: GetEntitiesParams
): Promise<GetEntitiesResponse> {
  const { status = 'ACTIVE', search, page = 1, pageSize = 20 } = params;

  let query = this.supabase
    .schema('schema_name')
    .from('view_or_table')
    .select('*', { count: 'exact', head: false });

  // Filtros dinámicos
  if (status === 'ACTIVE') {
    query = query.is('deleted_at', null);
  }

  if (search && search.trim()) {
    const searchTerm = search.trim();
    query = query.or(`field1.ilike.%${searchTerm}%,field2.ilike.%${searchTerm}%`);
  }

  // Paginación
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  const entities = camelcaseKeys(data || [], { deep: true }) as EntityView[];

  return {
    data: entities,
    count: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}
```

### 5. getEntityById() - Con Caché

Busca primero en caché, luego en Supabase.

```typescript
async getEntityById(entityId: string): Promise<EntityView> {
  // Intentar primero desde Dexie
  const cachedEntity = await dexieDB.entities.get(entityId);
  if (cachedEntity) {
    console.log('[EntityService] Entidad obtenida desde caché');
    return cachedEntity;
  }

  // Si no está en caché, consultar Supabase
  const { data, error } = await this.supabase
    .schema('schema_name')
    .from('view_or_table')
    .select('*')
    .eq('id', entityId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Entidad no encontrada');

  const entity = camelcaseKeys(data, { deep: true }) as EntityView;

  // Guardar en caché para futuras consultas
  await dexieDB.entities.put(entity);

  return entity;
}
```

### 6. updateEntity() - Sincroniza Caché

Actualiza en Supabase y sincroniza con Dexie.

```typescript
async updateEntity(entityId: string, payload: UpdateEntityPayload): Promise<EntityView> {
  const { error } = await this.supabase
    .schema('schema_name')
    .rpc('update_entity_function', {
      p_entity_id: entityId,
      p_field1: payload.field1,
      // ... más parámetros
    });

  if (error) {
    console.error('Error al actualizar entidad:', error);
    throw error;
  }

  // Obtener entidad actualizada (esto también actualiza el caché)
  const updatedEntity = await this.getEntityById(entityId);

  // Actualizar el caché de Dexie
  await dexieDB.entities.put(updatedEntity);

  return updatedEntity;
}
```

## Reglas de Nombrado

### Variables y Propiedades

- ✅ `private readonly supabase` - Cliente de Supabase
- ✅ `public dataEntities$` - Observable reactivo (termina en $)
- ❌ `private supabaseClient` - NO usar
- ❌ `private readonly supabaseClient` - NO usar

### Métodos

- `fetchEntitiesFromSupabase()` - Carga desde API
- `ensureEntitiesLoaded()` - Verifica y carga si necesario
- `getEntities()` - Método público con optimización
- `getEntitiesFromSupabase()` - Método privado para consultas complejas
- `getEntityById()` - Obtener por ID con caché
- `updateEntity()` - Actualizar y sincronizar
- `createEntity()` - Crear nueva entidad

## Interfaces en Models

Las interfaces de parámetros y respuestas deben estar en `/data/models/entity/entity.model.ts`:

```typescript
// entity.model.ts
export interface EntityView {
  id: string;
  name: string;
  // ... campos de la entidad
}

export interface GetEntitiesParams {
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface GetEntitiesResponse {
  data: EntityView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UpdateEntityPayload {
  field1?: string;
  field2?: number;
  // ... campos actualizables
}
```

## Dexie Configuration

Agregar la tabla en `AppDB.ts`:

```typescript
export default class AppDB extends Dexie {
  entities!: EntityTable<EntityView, 'id'>;

  constructor() {
    super('LaserColorVelozDB');
    this.version(N).stores({
      entities: 'id, field1, field2, field3', // Índices para búsquedas rápidas
    });
  }
}
```

## Uso en Componentes

### Carga Inicial (Después de Login)

```typescript
// En el login o guard
await entityService.ensureEntitiesLoaded();
```

### Observable Reactivo

```typescript
// En el componente
protected readonly entities = toSignal(
  this.entityService.dataEntities$,
  { initialValue: [] }
);
```

### Consultas con Filtros

```typescript
// Usando resource (Angular 19+)
protected readonly entitiesResource = resource({
  request: () => this.queryParams(),
  loader: async ({ request }) => {
    return await this.entityService.getEntities(request);
  },
});

protected readonly entities = computed(() =>
  this.entitiesResource.value()?.data ?? []
);
```

## Ventajas del Patrón

### ⚡ Performance

- Listados simples son instantáneos (Dexie local)
- Filtros complejos usan Supabase
- Caché automático reduce llamadas a la API

### 🔄 Reactividad

- Observable `dataEntities$` se actualiza automáticamente
- Los componentes reaccionan a cambios en tiempo real
- Sin necesidad de `effect()` innecesarios

### 📦 Consistency

- Todos los servicios siguen el mismo patrón
- Código predecible y mantenible
- Fácil de testear y debugear

### 🚀 Escalabilidad

- Funciona offline con datos en caché
- Sincronización automática cuando hay conexión
- Optimización de red y bandwidth

## Checklist de Implementación

- [ ] Usar `private readonly supabase` (NO `supabaseClient`)
- [ ] Crear observable `dataEntities$` con `liveQuery`
- [ ] Implementar `fetchEntitiesFromSupabase()`
- [ ] Implementar `ensureEntitiesLoaded()`
- [ ] Implementar `getEntities()` con optimización inteligente
- [ ] Crear método privado `getEntitiesFromSupabase()`
- [ ] Implementar `getEntityById()` con caché
- [ ] Actualizar métodos de escritura para sincronizar caché
- [ ] Mover interfaces a `/data/models/entity/`
- [ ] Agregar tabla en `AppDB.ts` con índices apropiados
- [ ] Usar `camelcaseKeys` para convertir snake_case
- [ ] Logs descriptivos con `[ServiceName]` prefix

## Antipatrones a Evitar

❌ **NO usar `effect()` en componentes para cargar datos**

```typescript
// MAL
effect(() => {
  this.filter();
  this.loadData();
});
```

✅ **Usar `resource()` o `computed()` para reactividad**

```typescript
// BIEN
protected readonly data = resource({
  request: () => this.filter(),
  loader: async ({ request }) => await this.service.getData(request)
});
```

❌ **NO mezclar nombres de variables**

```typescript
// MAL
private supabaseClient = inject(Supabase).client;
private readonly supabase = inject(Supabase).client; // En otro servicio
```

✅ **Usar siempre `readonly supabase`**

```typescript
// BIEN
private readonly supabase = inject(Supabase).client;
```

❌ **NO duplicar interfaces en servicios**

```typescript
// MAL - en el servicio
export interface GetEntitiesParams { ... }
```

✅ **Interfaces en models**

```typescript
// BIEN - en entity.model.ts
export interface GetEntitiesParams { ... }
```

## Ejemplos de Referencia

Ver implementaciones completas en:

- [shop-service.ts](../../../src/app/core/services/shop-service.ts)
- [customer-service.ts](../../../src/app/core/services/customer-service.ts)
- [employee-service.ts](../../../src/app/core/services/employee-service.ts)
