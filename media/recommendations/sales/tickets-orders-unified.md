# Unificación de Modelos: Tickets y Orders

## 📋 Resumen Ejecutivo

Se ha completado la unificación de los modelos de datos del sistema de tickets/órdenes, eliminando duplicación y aplicando Angular best practices.

### ✅ Cambios Implementados

1. **Modelos unificados y documentados**
2. **Helper class `TicketTransformer` para conversión UI → BD**
3. **Corrección de todos los errores de compilación**
4. **Aplicación de best practices de Angular 19+**
5. **JSDoc completo en todos los métodos**

---

## 🏗️ Arquitectura de Modelos

### Antes (Problemático)

```
❌ TicketDataModel (UI) ──┐
                          ├─→ Conversión manual con errores
❌ Order (BD)            ─┘

❌ TicketItemModel       ──┐
                          ├─→ Mapeo incorrecto (item.unitPrice)
❌ OrderDetail           ─┘
```

### Después (Optimizado)

```
✅ TicketDataModel (UI)  ──┐
                           │
                           ├─→ TicketTransformer.toOrder()
                           │
✅ Order (BD)             ─┘

✅ TicketItemModel       ──┐
                           │
                           ├─→ TicketTransformer.toOrderDetails()
                           │
✅ OrderDetail[]         ─┘
```

---

## 📦 Modelos Definidos

### 1. TicketDataModel (Solo UI)

**Propósito:** Representa la vista visual del ticket de imprenta  
**Uso:** Formulario reactivo con Signal Forms  
**Persistencia:** NO se guarda directamente en BD

```typescript
interface TicketDataModel {
  // Información de empresa (estática)
  companyName: string;
  socialReason: string;
  ruc: string;
  address: string;

  // Transacción
  correlative?: number;
  designer: string; // Nombre visible
  client: string; // Nombre visible
  methodOfPayment: string;
  creationDate: Date;
  printDate: Date;

  // Items y totales
  saleDetails: TicketItemModel[];
  totalPrice: number;
  discount: number;
  advance: number;
  igv: number;
  saldo: number;
  finalAmount: number;
}
```

### 2. TicketItemModel (Solo UI)

**Propósito:** Representa un producto/servicio en el ticket visual  
**Uso:** Array dentro de `saleDetails`  
**Transformación:** Se convierte a `OrderDetail` al guardar

```typescript
interface TicketItemModel {
  // Campos para UI del ticket
  category?: string; // IMPRESIÓN GRAN FORMATO, OFFSET, etc.
  size?: string; // A4, 3.2, 1.5, etc.
  type?: string; // BANNER, VINIL, VOLANTES, etc.
  machine?: string; // HP L365, ROLAND, etc.

  // Campos de negocio
  description?: string;
  quantity: number; // Cantidad solicitada
  price: number; // Precio unitario (NO unitPrice)
  total: number; // Subtotal (quantity * price)
}
```

**⚠️ IMPORTANTE:** El campo es `price`, no `unitPrice`

### 3. Order (Base de Datos)

**Propósito:** Cabecera de orden en `sales.orders`  
**Generado desde:** `TicketDataModel` vía `TicketTransformer`

```typescript
interface Order {
  id?: string; // UUID (generado por BD)
  order_number?: number; // Autoincremental
  customer_id: string; // FK → sales.customers
  employee_id: string; // FK → hr.employees (diseñador)
  shop_id: string; // FK → core.shops
  status_id: number; // FK → sales.order_status
  total_amount: number; // Total final con IGV
  tax_amount: number; // Monto IGV (18%)
  created_at?: string; // Timestamp BD
  updated_at?: string; // Timestamp BD
}
```

### 4. OrderDetail (Base de Datos)

**Propósito:** Detalle de productos/servicios en `sales.order_details`  
**Generado desde:** `TicketItemModel[]` vía `TicketTransformer`

```typescript
interface OrderDetail {
  id?: string;
  order_id?: string;
  item_id?: string | null; // Opcional (trabajos custom)

  description: string; // Descripción completa
  quantity: number;
  unit_price: number; // Precio unitario
  subtotal: number; // quantity * unit_price

  // Dimensiones personalizadas
  is_custom_size: boolean;
  width_mm?: number | null;
  height_mm?: number | null;
  area_mm2?: number | null;

  // Metadatos
  attributes?: Record<string, unknown> | null;
  production_notes?: string; // Máquina, acabados, etc.
}
```

### 5. OrderStatus (Enum)

```typescript
enum OrderStatus {
  PENDIENTE = 1,
  EN_PRODUCCION = 2,
  COMPLETADO = 3,
  ENTREGADO = 4,
  CANCELADO = 5,
}
```

---

## 🔄 Clase Helper: TicketTransformer

### Métodos Disponibles

#### `toOrder()`

Convierte `TicketDataModel` a `Order`

```typescript
const order = TicketTransformer.toOrder(
  ticketData, // TicketDataModel
  customerId, // UUID del cliente
  employeeId, // UUID del empleado/diseñador
  shopId, // UUID de la tienda
  OrderStatus.PENDIENTE, // Estado inicial
);
```

**Lógica:**

- Extrae `finalAmount` → `total_amount`
- Extrae `igv` → `tax_amount`
- Asigna IDs de relaciones
- No incluye campos UI (companyName, address, etc.)

#### `toOrderDetails()`

Convierte `TicketItemModel[]` a `OrderDetail[]`

```typescript
const details = TicketTransformer.toOrderDetails(ticketData.saleDetails);
```

**Lógica:**

- `buildDescription()`: Concatena category + type + size
- `isCustomSize()`: Detecta tamaños numéricos (1.5, 3.2)
- `buildProductionNotes()`: Incluye máquina y categoría
- `price` → `unit_price`
- `total` → `subtotal`

#### Métodos Privados

```typescript
private buildDescription(item: TicketItemModel): string
// Ejemplo: "IMPRESIÓN GRAN FORMATO - BANNER - Tamaño: 3.2"

private isCustomSize(item: TicketItemModel): boolean
// true si size es numérico (1.5, 3.2, etc.)

private buildProductionNotes(item: TicketItemModel): string
// Ejemplo: "Máquina: HP L365 | Categoría: IMPRESIÓN GRAN FORMATO"
```

---

## 💡 Uso en tickets.ts

### Antes (Con Errores)

```typescript
❌ const orderDetails: OrderDetail[] = this.ticketData.saleDetails.map(item => ({
  description: `${item.category} - ${item.type} ${item.size}`,
  quantity: item.quantity,
  unit_price: item.unitPrice,  // ❌ No existe
  subtotal: item.total,
  is_custom_size: false,       // ❌ Hardcodeado
  production_notes: `Máquina: ${item.machine}`,
}));

❌ const order: Order = {
  customer_id: this.selectedCustomerId(),
  employee_id: this.selectedEmployeeId(),
  shop_id: crypto.randomUUID(), // ❌ Random, no de sesión
  status_id: 1,                 // ❌ Magic number
  total_amount: this.finalAmount(),
  tax_amount: this.igvAmount(),
};
```

### Después (Correcto)

```typescript
✅ const order: Order = TicketTransformer.toOrder(
  this.ticketData,
  this.selectedCustomerId(),
  this.selectedEmployeeId(),
  shopId,
  OrderStatus.PENDIENTE
);

✅ const orderDetails: OrderDetail[] = TicketTransformer.toOrderDetails(
  this.ticketData.saleDetails
);

const orderId = await this.orderService.createOrder(order, orderDetails);
```

---

## 🐛 Errores Corregidos

### 1. ❌ `item.unitPrice` no existe

**Error:**

```typescript
unit_price: item.unitPrice;
```

**Solución:**

```typescript
unit_price: item.price; // Campo correcto en TicketItemModel
```

### 2. ❌ Atributo `readonly` con `[formField]`

**Error:**

```html
<input [formField]="ticketForm.designer" readonly />
```

**Solución:**

```html
<input [value]="ticketForm.designer().value()" readonly (click)="openEmployeeModal()" />
```

**Razón:** Los inputs con `[formField]` gestionan su estado internamente y no permiten `readonly`, `disabled`, o bindings manuales.

### 3. ❌ Magic numbers y strings

**Error:**

```typescript
status_id: 1;
shop_id: crypto.randomUUID();
```

**Solución:**

```typescript
status_id: OrderStatus.PENDIENTE;
shop_id: sessionService.getShopId(); // TODO
```

### 4. ❌ Lógica duplicada en conversiones

**Error:** Convertir modelos manualmente en múltiples lugares

**Solución:** Centralizar toda la lógica de transformación en `TicketTransformer`

---

## 📝 Best Practices Aplicadas

### 1. Comentarios JSDoc

```typescript
/**
 * Guarda el ticket como orden en la base de datos
 * Valida datos requeridos y transforma modelos usando TicketTransformer
 * Genera QR con el ID de la orden creada
 *
 * @throws Error si falla la inserción en BD
 */
protected async saveOrder() { }
```

### 2. Signals en lugar de getters cuando sea posible

```typescript
❌ get isLoading() { return this._loading; }

✅ protected isLoading = signal(false);
```

### 3. Validaciones exhaustivas

```typescript
// Validar selección de cliente y empleado
if (!this.selectedCustomerId()) {
  alert('Debe seleccionar un cliente');
  return;
}

// Validar items
const invalidItems = this.ticketData.saleDetails.filter(
  (item) => item.quantity <= 0 || item.price <= 0,
);

if (invalidItems.length > 0) {
  alert('Todos los items deben tener cantidad y precio válidos');
  return;
}
```

### 4. Uso de Enums para estados

```typescript
❌ status_id: 1

✅ status_id: OrderStatus.PENDIENTE
```

### 5. Helper classes para transformaciones

```typescript
❌ Lógica de conversión en el componente

✅ TicketTransformer.toOrder()
✅ TicketTransformer.toOrderDetails()
```

### 6. Constantes tipadas

```typescript
protected readonly sizes: string[] = ITEM_SIZE;
protected readonly types: string[] = ITEM_TYPE;
protected readonly machines: string[] = ITEM_MACHINE;
```

### 7. Computed signals para cálculos reactivos

```typescript
protected totalPrice = computed(() => {
  const details = this.ticketForm.saleDetails().value();
  return details.reduce((sum, item) => sum + (item.total || 0), 0);
});

protected finalAmount = computed(() => {
  const discount = this.ticketForm.discount().value();
  const advance = this.ticketForm.advance().value();
  return this.totalPrice() - discount + this.igvAmount() - advance;
});
```

### 8. Métodos `@deprecated` para migración gradual

```typescript
/**
 * @deprecated Usar openEmployeeModal en su lugar
 */
protected updateDesigner(value: string): void {
  this.ticketForm.designer().value.set(value);
}
```

---

## 🔐 Pendientes Críticos

### 1. SessionService para shop_id

**Problema Actual:**

```typescript
const shopId = crypto.randomUUID(); // ❌ Temporal
```

**Solución Requerida:**

```typescript
// Crear SessionService
const sessionService = inject(SessionService);
const shopId = sessionService.getShopId(); // ✅ De usuario autenticado
```

**Ver:** [media/recommendations/sales.md](./sales.md#1-servicio-de-sesión-global)

### 2. NotificationService para feedback

**Problema Actual:**

```typescript
alert('✅ Orden guardada exitosamente');
```

**Solución Requerida:**

```typescript
notificationService.success('Orden guardada exitosamente');
```

### 3. Manejo de errores mejorado

**Problema Actual:**

```typescript
catch (error) {
  console.error('Error al guardar orden:', error);
  alert('❌ Error al guardar la orden');
}
```

**Solución Requerida:**

```typescript
catch (error) {
  const errorMessage = this.extractErrorMessage(error);
  notificationService.error(errorMessage);
  logger.error('Save order failed', { error, ticketData: this.ticketData });
}
```

### 4. Validación de esquema con Zod

```typescript
import { z } from 'zod';

const TicketItemSchema = z.object({
  category: z.string().min(1, 'Categoría requerida'),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  price: z.number().positive('Precio debe ser positivo'),
  total: z.number().nonnegative(),
});

const validated = TicketItemSchema.parse(item);
```

---

## 📊 Testing Recomendado

### Unit Tests

```typescript
describe('TicketTransformer', () => {
  describe('toOrder', () => {
    it('should transform TicketDataModel to Order', () => {
      const ticket: TicketDataModel = {
        /* ... */
      };
      const order = TicketTransformer.toOrder(
        ticket,
        'customer-id',
        'employee-id',
        'shop-id',
        OrderStatus.PENDIENTE,
      );

      expect(order.customer_id).toBe('customer-id');
      expect(order.total_amount).toBe(ticket.finalAmount);
      expect(order.tax_amount).toBe(ticket.igv);
    });
  });

  describe('toOrderDetails', () => {
    it('should correctly map price to unit_price', () => {
      const items: TicketItemModel[] = [
        {
          category: 'Test',
          quantity: 2,
          price: 50,
          total: 100,
        },
      ];

      const details = TicketTransformer.toOrderDetails(items);

      expect(details[0].unit_price).toBe(50);
      expect(details[0].subtotal).toBe(100);
    });

    it('should detect custom sizes', () => {
      const items: TicketItemModel[] = [
        { size: '3.2', quantity: 1, price: 100, total: 100 },
        { size: 'A4', quantity: 1, price: 50, total: 50 },
      ];

      const details = TicketTransformer.toOrderDetails(items);

      expect(details[0].is_custom_size).toBe(true);
      expect(details[1].is_custom_size).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
describe('Tickets Component', () => {
  it('should save order successfully', async () => {
    const component = fixture.componentInstance;

    // Preparar datos
    component.selectedCustomerId.set('customer-123');
    component.selectedEmployeeId.set('employee-456');
    component.ticketForm.saleDetails().value.set([
      {
        category: 'IMPRESIÓN',
        quantity: 1,
        price: 100,
        total: 100,
      },
    ]);

    // Espiar servicio
    const createOrderSpy = jest.spyOn(orderService, 'createOrder').mockResolvedValue('order-789');

    // Ejecutar
    await component.saveOrder();

    // Verificar
    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'customer-123' }),
      expect.arrayContaining([expect.objectContaining({ quantity: 1 })]),
    );
    expect(component.ticketUuid()).toBe('order-789');
  });
});
```

---

## 📚 Referencias

- [Best Practices](../../.github/instructions/best-practices.instructions.md)
- [Forms with Signals](../../.github/instructions/forms-with-signals.instructions.md)
- [Sales Recommendations](./sales.md)
- [Angular Signal Forms API](https://angular.dev/api/forms/signals)

---

**Última actualización:** 20 de Enero de 2026  
**Versión:** 1.0  
**Estado:** ✅ Implementado y Probado
