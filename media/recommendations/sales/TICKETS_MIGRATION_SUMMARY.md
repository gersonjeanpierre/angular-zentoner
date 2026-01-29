# 📋 Resumen de Migración: Tickets Component → Nuevo Schema POS

## ✅ Estado: Completado

Fecha: 2024
Autor: GitHub Copilot

---

## 🎯 Objetivo

Adaptar el componente de tickets existente para trabajar con el nuevo schema de base de datos POS que incluye:

- Campos financieros detallados (total_price, discount, igv, final_amount)
- Sistema de pagos parciales (advance, remaining_balance, payment_status)
- Tabla separada para pagos (sales.payments)
- Gestión de sesiones de caja (sales.cash_register_sessions)

## 📝 Cambios Realizados

### 1. Modelo de Base de Datos: `Order` Interface

**Archivo:** `src/app/data/models/tickets/order-model.ts`

#### Campos Agregados:

```typescript
export interface Order {
  // ... campos existentes ...

  // Nuevos campos financieros POS
  total_price: number; // Suma de subtotales
  discount: number; // Descuento aplicado
  igv: number; // IGV calculado (18%)
  final_amount: number; // Total final

  // Control de pagos
  advance: number; // Anticipo/adelanto
  remaining_balance: number; // Saldo pendiente
  payment_status: PaymentStatus; // PENDIENTE | PARCIAL | PAGADO
  fully_paid_at?: string; // Timestamp cuando se pagó completamente
}

export type PaymentStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
export type OrderStatusType =
  | 'PENDIENTE'
  | 'EN_PRODUCCION'
  | 'COMPLETADO'
  | 'ENTREGADO'
  | 'CANCELADO';
```

#### Campos Deprecados (Removidos):

- ❌ `total_amount` → Reemplazado por `total_price`
- ❌ `tax_amount` → Reemplazado por `igv`

---

### 2. Transformer: `TicketTransformer.toOrder()`

**Archivo:** `src/app/data/models/tickets/ticket-data-model.ts`

#### Antes:

```typescript
static toOrder(ticket: TicketDataModel, ...): Order {
  return {
    total_amount: ticket.totalPrice,  // ❌ Campo deprecado
    tax_amount: ticket.igv,           // ❌ Campo deprecado
  };
}
```

#### Después:

```typescript
static toOrder(ticket: TicketDataModel, ...): Order {
  return {
    // Campos financieros según nuevo schema POS
    total_price: ticket.totalPrice,
    discount: ticket.discount,
    igv: ticket.igv,
    final_amount: ticket.finalAmount,

    // Control de pagos
    advance: ticket.advance,
    remaining_balance: ticket.saldo,
    payment_status: 'PENDIENTE', // Default al crear orden
  };
}
```

---

### 3. Modelo UI: `TicketDataModel`

**Archivo:** `src/app/data/models/tickets/ticket-data-model.ts`

#### Campo Removido:

```typescript
interface TicketDataModel {
  // ❌ REMOVIDO: methodOfPayment: string;
  // Los pagos ahora se gestionan en sales.payments
  // Cada pago tiene su propio método de pago
}
```

#### Documentación Agregada:

```typescript
// Totales calculados (sincronizados con nuevo schema POS)
totalPrice: number; // Suma de subtotales de items
discount: number; // Descuento aplicado
advance: number; // Anticipo/Adelanto
igv: number; // IGV calculado
saldo: number; // remaining_balance (final_amount - advance)
finalAmount: number; // Monto final con IGV y descuento
```

---

### 4. Componente: `tickets.ts`

**Archivo:** `src/app/features/tickets/tickets.ts`

#### Cambios en Computed Properties:

```typescript
// ✅ CORREGIDO: IGV ahora se calcula sobre (totalPrice - discount)
protected igvAmount = computed(() => {
  if (!this.includeIGV()) return 0;

  const model = this.ticketForm;
  const totalPrice = model.totalPrice().value();
  const discount = model.discount().value();

  return (totalPrice - discount) * 0.18;
});

// ✅ CORREGIDO: finalAmount YA NO resta el anticipo
protected finalAmount = computed(() => {
  const model = this.ticketForm;
  const totalPrice = model.totalPrice().value();
  const discount = model.discount().value();
  const igv = this.igvAmount();

  return totalPrice - discount + igv;
});

// ✅ CORREGIDO: saldoAmount representa remaining_balance
protected saldoAmount = computed(() => {
  const model = this.ticketForm;
  const finalAmount = this.finalAmount();
  const advance = model.advance().value();

  return finalAmount - advance;
});
```

#### Elementos Removidos:

- ❌ `methodsPayment: string[]` constante
- ❌ `openModalForMethodPayment()` método
- ❌ Modal target para `methodOfPayment`
- ❌ Import de `METHOD_PAYMENT`

#### Modelo Inicial Actualizado:

```typescript
ticketModel = signal<TicketDataModel>({
  companyName: 'LASER COLOR VELOZ',
  address: 'JR. ORBEGOSO 243 PISO 1 STAND 243',
  socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
  ruc: '20607873411',
  correlative: 777,
  designer: '',
  customer: '',
  // ❌ REMOVIDO: methodOfPayment: 'YAPE',
  creationDate: new Date(),
  saleDetails: [],
  totalPrice: 0,
  advance: 0,
  discount: 0,
  igv: 0,
  saldo: 0,
  finalAmount: 0,
  printDate: new Date(),
});
```

---

### 5. Template HTML: `tickets.html`

**Archivo:** `src/app/features/tickets/tickets.html`

#### Sección Removida:

```html
<!-- ❌ REMOVIDO: Método de Pago -->
<!-- 
<div class="form-control w-full mb-4">
  <fieldset class="fieldset">
    <legend class="fieldset-legend text-lg">Método de Pago</legend>
    <label class="input input-neutral cursor-pointer">
      <span class="icon-[streamline-ultimate--self-payment-touch-euro-bold] h-7 w-7"></span>
      <input
        type="text"
        class="grow cursor-pointer"
        placeholder="Seleccionar método de pago"
        readonly
        [value]="ticketForm.methodOfPayment().value()"
        (focus)="openModalForMethodPayment()"
        (click)="openModalForMethodPayment()"
        autocomplete="off"
      />
    </label>
  </fieldset>
</div>
-->

<!-- La UI permanece igual, solo se removió la sección de método de pago -->
```

---

### 6. Servicio: `OrderService`

**Archivo:** `src/app/core/services/order-service.ts`

#### Método `createOrder()` Actualizado:

```typescript
async createOrder(order: Order, details: OrderDetail[]): Promise<string> {
  const orderId = crypto.randomUUID();

  const { error: orderError } = await this.supabaseClient
    .schema('sales')
    .from('orders')
    .insert({
      id: orderId,
      customer_id: order.customer_id,
      employee_id: order.employee_id,
      shop_id: order.shop_id,
      status_id: order.status_id || 1,

      // ✅ Nuevos campos POS
      total_price: order.total_price,
      discount: order.discount || 0,
      igv: order.igv || 0,
      final_amount: order.final_amount,
      advance: order.advance || 0,
      remaining_balance: order.remaining_balance,
      payment_status: order.payment_status || 'PENDIENTE',
    });

  // ... resto del código
}
```

#### Método `updateOrder()` Actualizado:

```typescript
async updateOrder(orderId: string, order: Partial<Order>): Promise<void> {
  const { error } = await this.supabaseClient
    .schema('sales')
    .from('orders')
    .update({
      customer_id: order.customer_id,
      employee_id: order.employee_id,
      shop_id: order.shop_id,
      status_id: order.status_id,

      // ✅ Nuevos campos POS
      total_price: order.total_price,
      discount: order.discount,
      igv: order.igv,
      final_amount: order.final_amount,
      advance: order.advance,
      remaining_balance: order.remaining_balance,
      payment_status: order.payment_status,
    })
    .eq('id', orderId);
}
```

---

## 🧮 Fórmulas Financieras Implementadas

### Backend (PostgreSQL)

Según schema en `05_SALES.sql`:

```sql
-- 1. Precio Total (suma de subtotales)
total_price = SUM(order_details.subtotal)

-- 2. Monto Final
final_amount = total_price - discount + igv

-- 3. Saldo Pendiente
remaining_balance = final_amount - advance

-- 4. Estado de Pago
payment_status =
  CASE
    WHEN remaining_balance = 0 THEN 'PAGADO'
    WHEN advance > 0 THEN 'PARCIAL'
    ELSE 'PENDIENTE'
  END
```

### Frontend (Angular Computed Signals)

Implementado en `tickets.ts`:

```typescript
// 1. IGV (18% sobre monto con descuento)
igvAmount = computed(() => {
  if (!this.includeIGV()) return 0;
  const totalPrice = this.ticketForm.totalPrice().value();
  const discount = this.ticketForm.discount().value();
  return (totalPrice - discount) * 0.18;
});

// 2. Monto Final
finalAmount = computed(() => {
  const totalPrice = this.ticketForm.totalPrice().value();
  const discount = this.ticketForm.discount().value();
  const igv = this.igvAmount();
  return totalPrice - discount + igv;
});

// 3. Saldo (remaining_balance)
saldoAmount = computed(() => {
  const finalAmount = this.finalAmount();
  const advance = this.ticketForm.advance().value();
  return finalAmount - advance;
});
```

---

## ✅ Validaciones y Errores Corregidos

### Compilación TypeScript

- ✅ Sin errores en `order-model.ts`
- ✅ Sin errores en `ticket-data-model.ts`
- ✅ Sin errores en `tickets.ts`
- ✅ Sin errores en `order-service.ts`
- ✅ Sin errores en `tickets.html`

### Type Safety

- ✅ `PaymentStatus` type definido: `'PENDIENTE' | 'PARCIAL' | 'PAGADO'`
- ✅ `OrderStatusType` type definido
- ✅ Todos los campos opcionales correctamente tipados con `?`

### Fórmulas Matemáticas

- ✅ IGV se calcula correctamente sobre `(totalPrice - discount)`
- ✅ `finalAmount` NO resta el anticipo (se calcula solo con IGV y descuento)
- ✅ `saldoAmount` (remaining_balance) se calcula como `finalAmount - advance`

---

## 🚀 Próximos Pasos

### 1. PaymentService

**Archivo:** `src/app/core/services/payment-service.ts`

Implementar servicio para gestionar pagos usando las RPC functions:

```typescript
@Injectable({ providedIn: 'root' })
export class PaymentService {
  async registerPayment(params: {
    orderId: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
  }): Promise<void> {
    // Llamar a sales.register_payment()
  }

  async getPaymentHistory(orderId: string): Promise<Payment[]> {
    // Consultar sales.payments
  }

  async calculateRemainingBalance(orderId: string): Promise<number> {
    // Llamar a sales.get_order_balance()
  }
}
```

### 2. Componente de Registro de Pagos

**Ruta:** `src/app/features/sales/payment-register/`

Modal o página para:

- Ingresar monto de pago
- Seleccionar método de pago (EFECTIVO, YAPE, PLIN, TARJETA)
- Asociar a sesión de caja
- Validar que no exceda remaining_balance

### 3. Vista de Historial de Pagos

**Ruta:** `src/app/features/sales/payment-history/`

Componente para mostrar:

- Lista de pagos por orden
- Suma de pagos realizados
- Saldo pendiente actual
- Fechas y métodos de pago

### 4. Gestión de Caja (Cash Register)

**Ruta:** `src/app/features/sales/cash-register/`

Implementar:

- Apertura de sesión de caja (con monto inicial)
- Registro de pagos asociados a la sesión
- Cierre de sesión (con arqueo de caja)
- Reporte de movimientos de la sesión

---

## 📊 Impacto de los Cambios

### ✅ Beneficios

1. **Consistencia de Datos:** Frontend y backend usan los mismos nombres de campos
2. **Type Safety:** TypeScript detecta errores en tiempo de compilación
3. **Fórmulas Correctas:** Cálculos financieros exactos según especificación
4. **Sin Redundancia:** Campo `methodOfPayment` movido a tabla de pagos
5. **Escalabilidad:** Preparado para múltiples pagos parciales

### ⚠️ Breaking Changes

#### Para Órdenes Antiguas:

Las órdenes existentes en BD tenían `total_amount` y `tax_amount`. Opciones:

1. **Migración de Datos (Recomendado):**

   ```sql
   UPDATE sales.orders
   SET total_price = total_amount,
       igv = tax_amount,
       discount = 0,
       final_amount = total_amount,
       advance = 0,
       remaining_balance = total_amount,
       payment_status = 'PENDIENTE'
   WHERE total_price IS NULL;
   ```

2. **Compatibilidad en Queries:**

   ```typescript
   // En getOrders(), mapear campos antiguos:
   const order = await this.supabase.from('orders').select('*').single();

   return {
     ...order,
     total_price: order.total_price || order.total_amount,
     igv: order.igv || order.tax_amount,
   };
   ```

---

## 🔍 Checklist de Validación

- [x] ✅ Modelo `Order` actualizado con nuevos campos
- [x] ✅ Tipo `PaymentStatus` definido
- [x] ✅ `TicketTransformer.toOrder()` usa campos correctos
- [x] ✅ `TicketDataModel` sin campo `methodOfPayment`
- [x] ✅ Computed properties con fórmulas correctas
- [x] ✅ `OrderService.createOrder()` actualizado
- [x] ✅ `OrderService.updateOrder()` actualizado
- [x] ✅ Template HTML sin sección de método de pago
- [x] ✅ Sin errores de compilación TypeScript
- [x] ✅ Imports limpiados (sin METHOD_PAYMENT)
- [ ] 🔄 Crear `PaymentService`
- [ ] 🔄 Implementar componente de registro de pagos
- [ ] 🔄 Crear vista de historial de pagos
- [ ] 🔄 Implementar gestión de sesiones de caja

---

## 📚 Referencias

- **Schema de BD:** `media/db/05_SALES.sql`
- **RPC Functions:** `register_payment()`, `close_order()`, `get_order_balance()`
- **Documentación POS:** `media/recommendations/sales/sales.md`
- **Angular Best Practices:** `.github/instructions/best-practices.instructions.md`
- **Signal Forms Guide:** `.github/instructions/forms-with-signals.instructions.md`

---

## 👥 Contribuidores

- **Migración:** GitHub Copilot (Claude Sonnet 4.5)
- **Revisión:** Pendiente
- **Testing:** Pendiente

---

**Última actualización:** 2024
**Estado:** ✅ Completado y validado sin errores
