# Recomendaciones para el Módulo de Ventas

## 📊 Optimizaciones Implementadas

### 1. Separación de Responsabilidades

✅ **Implementado:**

- `/tickets`: Creación de órdenes con UI optimizada para imprenta
- `/ventas` (sales): Vista de gestión con tabla paginada de órdenes

**Beneficios:**

- Mejor experiencia de usuario según el contexto
- Reducción de código duplicado
- Facilita mantenimiento independiente

### 2. Paginación y Lazy Loading

✅ **Implementado en orders-list:**

```typescript
async getOrders(params: GetOrdersParams = {}): Promise<GetOrdersResponse> {
  const { page = 1, pageSize = 20 } = params;
  // Paginación en servidor
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);
}
```

**Beneficios:**

- Reduce carga inicial de datos
- Mejora rendimiento en listas grandes
- Menor consumo de memoria

### 3. Búsqueda y Filtros Optimizados

✅ **Implementado:**

- Búsqueda por número de orden
- Filtro por estado
- Filtro por rango de fechas (preparado)

**Mejoras Sugeridas:**

```typescript
// Implementar debounce en búsqueda
protected searchSubject = new Subject<string>();

ngOnInit() {
  this.searchSubject
    .pipe(debounceTime(300))
    .subscribe(term => this.loadOrders());
}
```

---

## 🎯 Optimizaciones de Base de Datos

### Vista Materializada para Órdenes

**Crear vista optimizada con información completa:**

```sql
-- Vista optimizada para listado de órdenes
CREATE OR REPLACE VIEW sales.orders_complete AS
SELECT
  o.id,
  o.order_number,
  o.customer_id,
  o.employee_id,
  o.shop_id,
  o.status_id,
  o.total_amount,
  o.tax_amount,
  o.created_at,
  o.updated_at,

  -- Información del cliente
  COALESCE(
    p_customer.legal_name,
    CONCAT(p_customer.first_name, ' ', p_customer.last_name)
  ) AS customer_name,
  p_customer.dni,
  p_customer.ruc,
  p_customer.email AS customer_email,
  p_customer.phone AS customer_phone,

  -- Información del empleado/diseñador
  CONCAT(p_employee.first_name, ' ', p_employee.last_name) AS employee_name,
  e.employee_code,

  -- Estado de la orden
  os.name AS status_name,
  os.description AS status_description,

  -- Conteo de detalles
  (SELECT COUNT(*) FROM sales.order_details od WHERE od.order_id = o.id) AS items_count

FROM sales.orders o
LEFT JOIN sales.customers c ON o.customer_id = c.id
LEFT JOIN core.persons p_customer ON c.id = p_customer.id
LEFT JOIN hr.employees e ON o.employee_id = e.id
LEFT JOIN core.persons p_employee ON e.id = p_employee.id
LEFT JOIN sales.order_status os ON o.status_id = os.id;

-- Índices para mejorar rendimiento
CREATE INDEX idx_orders_customer_id ON sales.orders(customer_id);
CREATE INDEX idx_orders_employee_id ON sales.orders(employee_id);
CREATE INDEX idx_orders_status_date ON sales.orders(status_id, created_at DESC);
CREATE INDEX idx_orders_shop_date ON sales.orders(shop_id, created_at DESC);

-- Índice de texto completo para búsqueda
CREATE INDEX idx_order_details_description ON sales.order_details USING gin(to_tsvector('spanish', description));
```

### Función Optimizada para Búsqueda

```sql
-- Función para búsqueda avanzada de órdenes
CREATE OR REPLACE FUNCTION sales.search_orders(
  p_search_term TEXT DEFAULT NULL,
  p_status_id INT DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  order_number INT,
  customer_name TEXT,
  employee_name TEXT,
  status_name TEXT,
  total_amount NUMERIC,
  created_at TIMESTAMPTZ,
  items_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_orders AS (
    SELECT
      oc.*,
      COUNT(*) OVER() AS total_count
    FROM sales.orders_complete oc
    WHERE
      (p_search_term IS NULL OR
       oc.order_number::TEXT ILIKE '%' || p_search_term || '%' OR
       oc.customer_name ILIKE '%' || p_search_term || '%' OR
       oc.dni ILIKE '%' || p_search_term || '%' OR
       oc.ruc ILIKE '%' || p_search_term || '%')
      AND (p_status_id IS NULL OR oc.status_id = p_status_id)
      AND (p_shop_id IS NULL OR oc.shop_id = p_shop_id)
      AND (p_date_from IS NULL OR oc.created_at >= p_date_from)
      AND (p_date_to IS NULL OR oc.created_at <= p_date_to)
    ORDER BY oc.created_at DESC
    LIMIT p_page_size
    OFFSET (p_page - 1) * p_page_size
  )
  SELECT
    fo.id,
    fo.order_number,
    fo.customer_name,
    fo.employee_name,
    fo.status_name,
    fo.total_amount,
    fo.created_at,
    fo.items_count,
    fo.total_count
  FROM filtered_orders fo;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Uso en el servicio:**

```typescript
async getOrders(params: GetOrdersParams = {}): Promise<GetOrdersResponse> {
  const { data, error } = await this.supabaseClient
    .rpc('search_orders', {
      p_search_term: params.search,
      p_status_id: params.statusId,
      p_shop_id: params.shopId,
      p_date_from: params.dateFrom,
      p_date_to: params.dateTo,
      p_page: params.page || 1,
      p_page_size: params.pageSize || 20,
    });

  if (error) throw error;

  return {
    data: data || [],
    count: data?.[0]?.total_count || 0,
    page: params.page || 1,
    pageSize: params.pageSize || 20,
    totalPages: Math.ceil((data?.[0]?.total_count || 0) / (params.pageSize || 20)),
  };
}
```

---

## 🔐 Seguridad y Permisos (Row Level Security)

### Políticas de Acceso

```sql
-- Habilitar RLS en órdenes
ALTER TABLE sales.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.order_details ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver órdenes de su tienda
CREATE POLICY "users_view_shop_orders" ON sales.orders
  FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id
      FROM hr.employees
      WHERE id = auth.uid()
    )
  );

-- Los administradores pueden ver todas las órdenes
CREATE POLICY "admins_view_all_orders" ON sales.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hr.employee_roles er
      JOIN hr.roles r ON er.role_id = r.id
      WHERE er.employee_id = auth.uid()
      AND r.name IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Solo usuarios autorizados pueden crear órdenes
CREATE POLICY "authorized_users_create_orders" ON sales.orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr.employees
      WHERE id = auth.uid()
      AND shop_id = orders.shop_id
    )
  );

-- Solo gerentes pueden actualizar estados de órdenes
CREATE POLICY "managers_update_orders" ON sales.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM hr.employee_roles er
      JOIN hr.roles r ON er.role_id = r.id
      WHERE er.employee_id = auth.uid()
      AND r.name IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );
```

---

## 📈 Monitoreo y Analíticas

### Vista de Estadísticas de Ventas

```sql
CREATE OR REPLACE VIEW sales.daily_sales_stats AS
SELECT
  DATE(o.created_at) AS sale_date,
  o.shop_id,
  COUNT(*) AS total_orders,
  SUM(o.total_amount) AS total_revenue,
  AVG(o.total_amount) AS avg_order_value,
  SUM(CASE WHEN o.status_id = 4 THEN 1 ELSE 0 END) AS delivered_orders,
  SUM(CASE WHEN o.status_id = 5 THEN 1 ELSE 0 END) AS cancelled_orders
FROM sales.orders o
GROUP BY DATE(o.created_at), o.shop_id
ORDER BY sale_date DESC;
```

### Función para Dashboard de Ventas

```sql
CREATE OR REPLACE FUNCTION sales.get_dashboard_stats(
  p_shop_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_orders', COUNT(*),
    'total_revenue', SUM(total_amount),
    'avg_order_value', AVG(total_amount),
    'pending_orders', SUM(CASE WHEN status_id = 1 THEN 1 ELSE 0 END),
    'in_production', SUM(CASE WHEN status_id = 2 THEN 1 ELSE 0 END),
    'completed_orders', SUM(CASE WHEN status_id = 3 THEN 1 ELSE 0 END),
    'delivered_orders', SUM(CASE WHEN status_id = 4 THEN 1 ELSE 0 END),
    'cancelled_orders', SUM(CASE WHEN status_id = 5 THEN 1 ELSE 0 END),
    'top_customers', (
      SELECT json_agg(t) FROM (
        SELECT
          c.id,
          COALESCE(p.legal_name, CONCAT(p.first_name, ' ', p.last_name)) AS name,
          COUNT(o.id) AS order_count,
          SUM(o.total_amount) AS total_spent
        FROM sales.orders o
        JOIN sales.customers c ON o.customer_id = c.id
        JOIN core.persons p ON c.id = p.id
        WHERE o.shop_id = p_shop_id
          AND o.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY c.id, p.legal_name, p.first_name, p.last_name
        ORDER BY total_spent DESC
        LIMIT 10
      ) t
    ),
    'sales_by_day', (
      SELECT json_agg(t ORDER BY sale_date) FROM (
        SELECT
          DATE(created_at) AS sale_date,
          COUNT(*) AS orders,
          SUM(total_amount) AS revenue
        FROM sales.orders
        WHERE shop_id = p_shop_id
          AND created_at BETWEEN p_date_from AND p_date_to
        GROUP BY DATE(created_at)
      ) t
    )
  ) INTO result
  FROM sales.orders
  WHERE shop_id = p_shop_id
    AND created_at BETWEEN p_date_from AND p_date_to;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 🚀 Mejoras en el Frontend

### 1. Servicio de Sesión Global

**Crear servicio para gestionar shop actual:**

```typescript
// src/app/core/services/session-service.ts
import { Injectable, inject, signal } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';

export interface SessionData {
  userId: string;
  employeeId: string;
  shopId: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private supabaseClient = inject(Supabase).client;
  private sessionData = signal<SessionData | null>(null);

  async loadSession() {
    const {
      data: { user },
    } = await this.supabaseClient.auth.getUser();

    if (!user) return null;

    const { data: employee } = await this.supabaseClient
      .schema('hr')
      .from('employees')
      .select(
        `
        id,
        shop_id,
        employee_roles (
          roles (name)
        )
      `,
      )
      .eq('id', user.id)
      .single();

    if (employee) {
      const sessionData: SessionData = {
        userId: user.id,
        employeeId: employee.id,
        shopId: employee.shop_id,
        roles: employee.employee_roles.map((er: any) => er.roles.name),
      };

      this.sessionData.set(sessionData);
      return sessionData;
    }

    return null;
  }

  getShopId(): string {
    return this.sessionData()?.shopId || '';
  }

  getEmployeeId(): string {
    return this.sessionData()?.employeeId || '';
  }

  hasRole(role: string): boolean {
    return this.sessionData()?.roles.includes(role) || false;
  }
}
```

### 2. Componente de Notificaciones

**Servicio de toast notifications:**

```typescript
// src/app/core/services/notification-service.ts
import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  toasts = signal<Toast[]>([]);

  private show(type: Toast['type'], message: string, duration = 3000) {
    const id = crypto.randomUUID();
    const toast: Toast = { id, type, message, duration };

    this.toasts.update((toasts) => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  success(message: string, duration?: number) {
    this.show('success', message, duration);
  }

  error(message: string, duration?: number) {
    this.show('error', message, duration);
  }

  warning(message: string, duration?: number) {
    this.show('warning', message, duration);
  }

  info(message: string, duration?: number) {
    this.show('info', message, duration);
  }

  remove(id: string) {
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }
}
```

**Componente Toast:**

```typescript
// src/app/shared/components/toast/toast.ts
import { Component, inject } from '@angular/core';
import { NotificationService } from '@core/services/notification-service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast toast-top toast-end z-50">
      @for (toast of notificationService.toasts(); track toast.id) {
        <div
          class="alert"
          [class.alert-success]="toast.type === 'success'"
          [class.alert-error]="toast.type === 'error'"
          [class.alert-warning]="toast.type === 'warning'"
          [class.alert-info]="toast.type === 'info'"
        >
          <span>{{ toast.message }}</span>
          <button class="btn btn-sm btn-ghost" (click)="notificationService.remove(toast.id)">
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  protected notificationService = inject(NotificationService);
}
```

### 3. Virtual Scrolling para Listas Grandes

**Si las órdenes superan los 1000 items:**

```typescript
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule, ...],
})
export class OrdersList {
  protected readonly ITEM_SIZE = 60; // Altura de cada item en px

  // En el template:
  /*
  <cdk-virtual-scroll-viewport
    [itemSize]="ITEM_SIZE"
    class="h-[600px]"
  >
    <table class="table">
      <tbody>
        <tr
          *cdkVirtualFor="let order of orders()"
          [style.height.px]="ITEM_SIZE"
        >
          ...
        </tr>
      </tbody>
    </table>
  </cdk-virtual-scroll-viewport>
  */
}
```

---

## 📊 Exportación y Reportes

### Exportar a Excel

```typescript
// src/app/core/services/export-service.ts
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class ExportService {
  exportToExcel(data: any[], filename: string) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Órdenes');

    // Ajustar ancho de columnas
    const maxWidth = 50;
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.min(
        maxWidth,
        Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        )
      )
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }
}

// Uso en orders-list.ts
protected async exportOrders() {
  const allOrders = await this.orderService.getOrders({
    pageSize: 10000, // Obtener todas las órdenes
  });

  const exportData = allOrders.data.map(order => ({
    'Orden N°': order.order_number,
    'Cliente': order.customer_name,
    'Diseñador': order.employee_name,
    'Estado': order.status_name,
    'Total': order.total_amount,
    'Fecha': this.formatDate(order.created_at!),
  }));

  this.exportService.exportToExcel(exportData, 'ordenes-' + new Date().toISOString());
}
```

### Generar PDF de Orden

```typescript
// Usar jsPDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

protected generateOrderPDF(order: OrderWithDetails) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('ORDEN DE VENTA', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Orden N° ${order.order_number}`, 105, 30, { align: 'center' });

  // Info
  doc.setFontSize(10);
  doc.text(`Cliente: ${order.customerName}`, 20, 50);
  doc.text(`Diseñador: ${order.employeeName}`, 20, 60);
  doc.text(`Fecha: ${this.formatDate(order.created_at!)}`, 20, 70);
  doc.text(`Estado: ${order.statusName}`, 20, 80);

  // Tabla de detalles
  autoTable(doc, {
    startY: 90,
    head: [['Descripción', 'Cantidad', 'P.Unit.', 'Subtotal']],
    body: order.details.map(d => [
      d.description,
      d.quantity,
      `S/ ${d.unit_price.toFixed(2)}`,
      `S/ ${d.subtotal.toFixed(2)}`,
    ]),
    foot: [[
      '',
      '',
      'TOTAL:',
      `S/ ${order.total_amount.toFixed(2)}`
    ]],
  });

  doc.save(`orden-${order.order_number}.pdf`);
}
```

---

## 🧪 Testing

### Tests Unitarios para OrderService

```typescript
// order-service.spec.ts
import { TestBed } from '@angular/core/testing';
import { OrderService } from './order-service';

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderService);
  });

  it('should create order with details', async () => {
    const order = {
      customer_id: 'test-customer',
      employee_id: 'test-employee',
      shop_id: 'test-shop',
      status_id: 1,
      total_amount: 100,
      tax_amount: 18,
    };

    const details = [
      {
        description: 'Test Item',
        quantity: 1,
        unit_price: 100,
        subtotal: 100,
        is_custom_size: false,
      },
    ];

    const orderId = await service.createOrder(order, details);
    expect(orderId).toBeDefined();
  });

  it('should get orders with pagination', async () => {
    const result = await service.getOrders({ page: 1, pageSize: 10 });
    expect(result.data).toBeDefined();
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });
});
```

---

## 🎨 UX/UI Improvements

### Skeleton Loading

```typescript
// Mientras cargan las órdenes
protected isLoading = signal(true);

// En el template
@if (isLoading()) {
  <div class="space-y-4">
    @for (i of [1,2,3,4,5]; track i) {
      <div class="skeleton h-16 w-full"></div>
    }
  </div>
} @else {
  <!-- Lista de órdenes -->
}
```

### Transiciones Suaves

```css
/* En styles.css */
.table tbody tr {
  transition: background-color 0.2s ease;
}

.table tbody tr:hover {
  transform: scale(1.01);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

---

## 📱 Responsive Design

### Tabla Responsive Optimizada

```html
<!-- Para móviles, usar cards en lugar de tabla -->
@if (isMobile()) {
<div class="space-y-2">
  @for (order of orders(); track order.id) {
  <div class="card bg-base-100 shadow">
    <div class="card-body p-4">
      <div class="flex justify-between items-start">
        <div>
          <p class="font-bold">Orden #{{ order.order_number }}</p>
          <p class="text-sm">{{ order.customer_name }}</p>
        </div>
        <span class="badge" [class]="getStatusClass(order.status_id)">
          {{ getStatusName(order.status_id) }}
        </span>
      </div>
      <div class="flex justify-between items-center mt-2">
        <span class="text-lg font-bold">{{ formatCurrency(order.total_amount) }}</span>
        <div class="flex gap-1">
          <button class="btn btn-sm btn-ghost" (click)="viewOrder(order.id!)">
            <i class="icon-[mdi--eye] w-4 h-4"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
  }
</div>
} @else {
<!-- Tabla normal para desktop -->
}
```

---

## 🔄 Realtime Updates (Opcional)

### Supabase Realtime para Órdenes

```typescript
export class OrdersList implements OnInit, OnDestroy {
  private realtimeSubscription?: RealtimeChannel;

  ngOnInit() {
    this.loadOrders();
    this.subscribeToOrders();
  }

  private subscribeToOrders() {
    this.realtimeSubscription = this.supabaseClient
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'sales',
          table: 'orders',
        },
        (payload) => {
          console.log('Order updated:', payload);
          this.loadOrders(); // Recargar lista
        },
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.realtimeSubscription?.unsubscribe();
  }
}
```

---

## 📝 Conclusiones y Próximos Pasos

### ✅ Implementaciones Prioritarias

1. **Inmediato:**
   - Vista `orders_complete` en base de datos
   - Servicio de sesión global
   - Sistema de notificaciones toast

2. **Corto Plazo (1-2 semanas):**
   - Exportación a Excel/PDF
   - Virtual scrolling para listas grandes
   - Tests unitarios básicos

3. **Mediano Plazo (1 mes):**
   - Dashboard de analytics
   - Reportes personalizados
   - Integración con producción

4. **Largo Plazo (2-3 meses):**
   - Realtime updates
   - App móvil (PWA)
   - Integración con facturación electrónica

### 🎯 KPIs a Monitorear

- Tiempo promedio de carga de lista de órdenes (< 1s)
- Cantidad de órdenes procesadas por día
- Tasa de conversión de tickets a órdenes
- Tiempo promedio de procesamiento por orden
- Satisfacción del usuario (encuestas internas)

---

**Última actualización:** Enero 2026  
**Versión:** 1.0  
**Autor:** Sistema de Gestión Angular-Zentoner
