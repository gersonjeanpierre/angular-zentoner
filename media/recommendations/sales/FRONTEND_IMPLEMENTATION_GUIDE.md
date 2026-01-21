# 🎨 Guía de Implementación Frontend - Sistema POS

## 📋 Tabla de Contenidos

1. [Modelos TypeScript](#modelos-typescript)
2. [Servicios Angular](#servicios-angular)
3. [Componentes](#componentes)
4. [Formularios con Signal Forms](#formularios)
5. [Rutas](#rutas)
6. [Ejemplos de UI con DaisyUI](#ejemplos-ui)

---

## 🏗️ Modelos TypeScript

### 1. Crear archivo: `src/app/data/models/sales/order.model.ts`

```typescript
// Enums
export type PaymentStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
export type OrderStatus = 'PENDIENTE' | 'EN_PRODUCCION' | 'COMPLETADO' | 'ENTREGADO' | 'CANCELADO';

// Order Model
export interface Order {
  id: string;
  shop_id: string;
  customer_id: string | null;
  employee_id: string;
  order_number: number;
  status_id: number;

  // Campos financieros
  total_price: number;
  discount: number;
  igv: number;
  final_amount: number;
  advance: number;
  remaining_balance: number;

  // Estado de pago
  payment_status: PaymentStatus;
  fully_paid_at: string | null;

  created_at: string;
  updated_at: string;
}

// Extended Order con relaciones
export interface OrderView extends Order {
  customer_name: string;
  employee_name: string;
  order_status_name: string;
  last_payment_date: string | null;
  days_pending?: number;
}

// Para crear orden
export interface CreateOrderPayload {
  shop_id: string;
  customer_id: string | null;
  employee_id: string;
  total_price: number;
  discount: number;
  igv: number;
  final_amount: number;
  order_details: CreateOrderDetailPayload[];
}

export interface CreateOrderDetailPayload {
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  is_custom_size?: boolean;
  width_mm?: number;
  height_mm?: number;
  area_mm2?: number;
  attributes?: Record<string, any>;
  production_notes?: string;
}
```

### 2. Crear archivo: `src/app/data/models/sales/payment.model.ts`

```typescript
export type PaymentMethod =
  | 'EFECTIVO'
  | 'TARJETA_DEBITO'
  | 'TARJETA_CREDITO'
  | 'TRANSFERENCIA'
  | 'YAPE'
  | 'PLIN'
  | 'OTRO';

export interface Payment {
  id: string;
  order_id: string;
  cash_register_session_id: string | null;

  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;

  transaction_reference: string | null;
  notes: string | null;

  received_by_id: string | null;
  created_at: string;
  updated_at: string;
}

// Extended con relaciones
export interface PaymentView extends Payment {
  received_by_name: string;
  session_number: number | null;
  session_type: string | null;
}

// Para registrar pago
export interface RegisterPaymentPayload {
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  cash_register_session_id?: string;
  transaction_reference?: string;
  notes?: string;
  received_by_id?: string;
}

// Respuesta de register_payment
export interface RegisterPaymentResponse {
  success: boolean;
  payment_id: string;
  order_id: string;
  amount_paid: number;
  new_advance: number;
  new_remaining_balance: number;
  payment_status: PaymentStatus;
  fully_paid: boolean;
}
```

### 3. Crear archivo: `src/app/data/models/sales/cash-register.model.ts`

```typescript
export type SessionType = 'PARCIAL' | 'FINAL';
export type SessionStatus = 'ABIERTO' | 'CERRADO';

export interface CashRegisterSession {
  id: string;
  shop_id: string;
  cashier_id: string;

  session_number: number;
  session_type: SessionType;

  opened_at: string;
  closed_at: string | null;

  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;

  cash_total: number;
  card_total: number;
  transfer_total: number;
  digital_wallet_total: number;
  other_total: number;

  total_orders: number;
  total_payments: number;

  status: SessionStatus;

  opening_notes: string | null;
  closing_notes: string | null;

  created_at: string;
  updated_at: string;
}

// Para abrir sesión
export interface OpenSessionPayload {
  shop_id: string;
  cashier_id: string;
  opening_balance: number;
  session_type?: SessionType;
  opening_notes?: string;
}

// Respuesta de open_session
export interface OpenSessionResponse {
  success: boolean;
  session_id: string;
  opened_at: string;
  opening_balance: number;
}

// Para cerrar sesión
export interface CloseSessionPayload {
  session_id: string;
  closing_balance: number;
  closing_notes?: string;
}

// Respuesta de close_session
export interface CloseSessionResponse {
  success: boolean;
  session_id: string;
  closed_at: string;
  opening_balance: number;
  closing_balance: number;
  expected_balance: number;
  difference: number;
  cash_total: number;
  card_total: number;
  transfer_total: number;
  digital_wallet_total: number;
  other_total: number;
  total_payments: number;
  total_orders: number;
}
```

---

## 🔧 Servicios Angular

### 1. Extender: `src/app/core/services/order-service.ts`

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { supabase } from '../supabase/supabase';
import type { CreateOrderPayload, Order, OrderView } from '@/app/data/models/sales/order.model';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly supabase = supabase;

  // Obtener resumen de ventas del día
  async getDailySalesSummary(date: string, shopId?: string): Promise<OrderView[]> {
    const { data, error } = await this.supabase.rpc('get_daily_sales_summary', {
      p_date: date,
      p_shop_id: shopId || null,
    });

    if (error) throw error;
    return data as OrderView[];
  }

  // Obtener órdenes pendientes de pago
  async getPendingPaymentOrders(shopId?: string): Promise<OrderView[]> {
    const { data, error } = await this.supabase.rpc('get_pending_payment_orders', {
      p_shop_id: shopId || null,
    });

    if (error) throw error;
    return data as OrderView[];
  }

  // Crear orden con detalles
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    // 1. Insertar orden
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert({
        id: crypto.randomUUID(),
        shop_id: payload.shop_id,
        customer_id: payload.customer_id,
        employee_id: payload.employee_id,
        total_price: payload.total_price,
        discount: payload.discount,
        igv: payload.igv,
        final_amount: payload.final_amount,
        remaining_balance: payload.final_amount, // inicialmente = final_amount
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Insertar detalles
    const orderDetails = payload.order_details.map((detail) => ({
      id: crypto.randomUUID(),
      order_id: order.id,
      ...detail,
    }));

    const { error: detailsError } = await this.supabase.from('order_details').insert(orderDetails);

    if (detailsError) throw detailsError;

    return order;
  }

  // Actualizar estado de orden
  async updateOrderStatus(orderId: string, statusId: number): Promise<void> {
    const { error } = await this.supabase
      .from('orders')
      .update({ status_id: statusId })
      .eq('id', orderId);

    if (error) throw error;
  }

  // Obtener orden por ID con detalles
  async getOrderById(orderId: string): Promise<Order> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_details(*)')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  }
}
```

### 2. Crear: `src/app/core/services/payment-service.ts`

```typescript
import { inject, Injectable } from '@angular/core';
import { supabase } from '../supabase/supabase';
import type {
  Payment,
  PaymentView,
  RegisterPaymentPayload,
  RegisterPaymentResponse,
} from '@/app/data/models/sales/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly supabase = supabase;

  // Registrar pago
  async registerPayment(payload: RegisterPaymentPayload): Promise<RegisterPaymentResponse> {
    const { data, error } = await this.supabase.rpc('register_payment', {
      p_order_id: payload.order_id,
      p_amount: payload.amount,
      p_payment_method: payload.payment_method,
      p_cash_register_session_id: payload.cash_register_session_id || null,
      p_transaction_reference: payload.transaction_reference || null,
      p_notes: payload.notes || null,
      p_received_by_id: payload.received_by_id || null,
    });

    if (error) throw error;
    return data as RegisterPaymentResponse;
  }

  // Obtener historial de pagos de una orden
  async getOrderPaymentHistory(orderId: string): Promise<PaymentView[]> {
    const { data, error } = await this.supabase.rpc('get_order_payment_history', {
      p_order_id: orderId,
    });

    if (error) throw error;
    return data as PaymentView[];
  }

  // Obtener pagos de una sesión
  async getSessionPayments(sessionId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('cash_register_session_id', sessionId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data;
  }
}
```

### 3. Crear: `src/app/core/services/cash-register-service.ts`

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { supabase } from '../supabase/supabase';
import type {
  CashRegisterSession,
  OpenSessionPayload,
  OpenSessionResponse,
  CloseSessionPayload,
  CloseSessionResponse,
} from '@/app/data/models/sales/cash-register.model';

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  private readonly supabase = supabase;

  // Signal para la sesión activa
  currentSession = signal<CashRegisterSession | null>(null);

  // Abrir sesión
  async openSession(payload: OpenSessionPayload): Promise<OpenSessionResponse> {
    const { data, error } = await this.supabase.rpc('open_cash_register_session', {
      p_shop_id: payload.shop_id,
      p_cashier_id: payload.cashier_id,
      p_opening_balance: payload.opening_balance,
      p_session_type: payload.session_type || 'PARCIAL',
      p_opening_notes: payload.opening_notes || null,
    });

    if (error) throw error;

    // Cargar la sesión completa
    await this.loadCurrentSession(data.session_id);

    return data as OpenSessionResponse;
  }

  // Cerrar sesión
  async closeSession(payload: CloseSessionPayload): Promise<CloseSessionResponse> {
    const { data, error } = await this.supabase.rpc('close_cash_register_session', {
      p_session_id: payload.session_id,
      p_closing_balance: payload.closing_balance,
      p_closing_notes: payload.closing_notes || null,
    });

    if (error) throw error;

    // Limpiar sesión actual
    this.currentSession.set(null);

    return data as CloseSessionResponse;
  }

  // Cargar sesión actual del cajero
  async loadCurrentSession(sessionId?: string): Promise<void> {
    let query = this.supabase.from('cash_register_sessions').select('*').eq('status', 'ABIERTO');

    if (sessionId) {
      query = query.eq('id', sessionId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      throw error;
    }

    this.currentSession.set(data || null);
  }

  // Obtener sesión por ID
  async getSessionById(sessionId: string): Promise<CashRegisterSession> {
    const { data, error } = await this.supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data;
  }

  // Obtener historial de sesiones
  async getSessionHistory(shopId?: string, limit = 20): Promise<CashRegisterSession[]> {
    let query = this.supabase
      .from('cash_register_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }
}
```

---

## 🎨 Componentes

### 1. Cash Register Dashboard

**Ubicación:** `src/app/features/sales/cash-register-dashboard/`

```typescript
// cash-register-dashboard.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CashRegisterService } from '@/app/core/services/cash-register-service';
import { AuthService } from '@/app/core/services/auth-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cash-register-dashboard',
  templateUrl: './cash-register-dashboard.html',
  styleUrl: './cash-register-dashboard.css',
})
export class CashRegisterDashboardComponent implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private router = inject(Router);

  protected currentSession = this.cashRegisterService.currentSession;
  protected isSessionActive = computed(() => this.currentSession() !== null);

  protected loading = signal(false);
  protected error = signal<string | null>(null);

  async ngOnInit() {
    await this.loadSession();
  }

  private async loadSession() {
    try {
      this.loading.set(true);
      await this.cashRegisterService.loadCurrentSession();
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async openSession(data: any) {
    try {
      this.loading.set(true);
      await this.cashRegisterService.openSession({
        shop_id: data.shop_id,
        cashier_id: this.authService.currentUser()!.id,
        opening_balance: data.opening_balance,
        session_type: data.session_type,
        opening_notes: data.opening_notes,
      });

      this.router.navigate(['/ventas/punto-venta']);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected navigateToClose() {
    this.router.navigate(['/ventas/cerrar-caja']);
  }

  protected navigateToDailySales() {
    this.router.navigate(['/ventas/dia']);
  }
}
```

```html
<!-- cash-register-dashboard.html -->
<div class="p-6 max-w-4xl mx-auto">
  <h1 class="text-3xl font-bold mb-6">Caja Registradora</h1>

  @if (loading()) {
  <div class="flex justify-center items-center h-64">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
  } @else if (error()) {
  <div class="alert alert-error">
    <span>{{ error() }}</span>
  </div>
  } @else { @if (isSessionActive()) {
  <!-- Sesión Activa -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">
        <span class="badge badge-success">SESIÓN ABIERTA</span>
        Sesión #{{ currentSession()!.session_number }}
      </h2>

      <div class="grid grid-cols-2 gap-4 mt-4">
        <div class="stat bg-base-100 rounded-box">
          <div class="stat-title">Balance Inicial</div>
          <div class="stat-value text-primary">S/ {{ currentSession()!.opening_balance }}</div>
        </div>

        <div class="stat bg-base-100 rounded-box">
          <div class="stat-title">Tipo de Sesión</div>
          <div class="stat-value text-2xl">{{ currentSession()!.session_type }}</div>
        </div>

        <div class="stat bg-base-100 rounded-box">
          <div class="stat-title">Abierto Desde</div>
          <div class="stat-value text-sm">{{ currentSession()!.opened_at | date: 'short' }}</div>
        </div>

        <div class="stat bg-base-100 rounded-box">
          <div class="stat-title">Tiempo Transcurrido</div>
          <div class="stat-value text-2xl">
            <!-- Calcular duración -->
            4h 30m
          </div>
        </div>
      </div>

      <div class="card-actions justify-end mt-6">
        <button class="btn btn-primary" (click)="navigateToDailySales()">Ver Ventas del Día</button>
        <button class="btn btn-warning" (click)="navigateToClose()">Cerrar Caja</button>
      </div>
    </div>
  </div>
  } @else {
  <!-- No hay sesión activa -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">No hay sesión activa</h2>
      <p>Abre una nueva sesión para comenzar a registrar ventas.</p>

      <app-open-session-form (sessionOpened)="openSession($event)" />
    </div>
  </div>
  } }
</div>
```

### 2. Payment Form Component

**Ubicación:** `src/app/features/sales/payment-form/`

```typescript
// payment-form.ts
import { Component, input, output, inject, signal, computed } from '@angular/core';
import { FormField, form, required, min } from '@angular/forms/signals';
import { PaymentService } from '@/app/core/services/payment-service';
import { CashRegisterService } from '@/app/core/services/cash-register-service';
import type { PaymentMethod, RegisterPaymentPayload } from '@/app/data/models/sales/payment.model';
import type { OrderView } from '@/app/data/models/sales/order.model';

interface PaymentFormModel {
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference: string;
  notes: string;
}

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.html',
  imports: [FormField],
})
export class PaymentFormComponent {
  private paymentService = inject(PaymentService);
  private cashRegisterService = inject(CashRegisterService);

  // Inputs
  readonly order = input.required<OrderView>();

  // Outputs
  readonly paymentRegistered = output<void>();

  // State
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);

  // Form
  protected formModel = signal<PaymentFormModel>({
    amount: 0,
    payment_method: 'EFECTIVO',
    transaction_reference: '',
    notes: '',
  });

  protected paymentForm = form(this.formModel, (schema) => {
    required(schema.amount, { message: 'El monto es requerido' });
    min(schema.amount, 0.01, { message: 'El monto debe ser mayor a 0' });
    required(schema.payment_method, { message: 'Seleccione un método de pago' });
  });

  // Computed
  protected maxPayableAmount = computed(() => this.order().remaining_balance);
  protected isAmountValid = computed(() => {
    const amount = this.paymentForm.amount().value();
    return amount > 0 && amount <= this.maxPayableAmount();
  });

  // Métodos de pago disponibles
  protected paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TARJETA_DEBITO', label: 'Tarjeta de Débito' },
    { value: 'TARJETA_CREDITO', label: 'Tarjeta de Crédito' },
    { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
    { value: 'YAPE', label: 'Yape' },
    { value: 'PLIN', label: 'Plin' },
    { value: 'OTRO', label: 'Otro' },
  ];

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (this.paymentForm.invalid()) {
      return;
    }

    if (!this.isAmountValid()) {
      this.error.set('El monto excede el saldo pendiente');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.formModel();
      const currentSession = this.cashRegisterService.currentSession();

      const payload: RegisterPaymentPayload = {
        order_id: this.order().id,
        amount: formData.amount,
        payment_method: formData.payment_method,
        cash_register_session_id: currentSession?.id,
        transaction_reference: formData.transaction_reference || undefined,
        notes: formData.notes || undefined,
      };

      await this.paymentService.registerPayment(payload);

      this.success.set(true);
      this.paymentRegistered.emit();

      // Reset form
      setTimeout(() => {
        this.success.set(false);
        this.formModel.set({
          amount: 0,
          payment_method: 'EFECTIVO',
          transaction_reference: '',
          notes: '',
        });
      }, 2000);
    } catch (err: any) {
      this.error.set(err.message || 'Error al registrar el pago');
    } finally {
      this.loading.set(false);
    }
  }

  protected fillMaxAmount() {
    this.paymentForm.amount().value.set(this.maxPayableAmount());
  }
}
```

```html
<!-- payment-form.html -->
<form (submit)="onSubmit($event)" class="flex flex-col gap-4">
  <h3 class="text-xl font-bold">Registrar Pago</h3>

  <!-- Info de la orden -->
  <div class="stats shadow bg-base-200">
    <div class="stat">
      <div class="stat-title">Orden #{{ order().order_number }}</div>
      <div class="stat-value text-2xl">S/ {{ order().final_amount }}</div>
      <div class="stat-desc">Total de la orden</div>
    </div>
    <div class="stat">
      <div class="stat-title">Pagado</div>
      <div class="stat-value text-success text-2xl">S/ {{ order().advance }}</div>
    </div>
    <div class="stat">
      <div class="stat-title">Pendiente</div>
      <div class="stat-value text-warning text-2xl">S/ {{ order().remaining_balance }}</div>
    </div>
  </div>

  <!-- Monto -->
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text">Monto a Pagar *</span>
      <button type="button" class="btn btn-xs btn-ghost" (click)="fillMaxAmount()">
        Pagar todo
      </button>
    </label>
    <input
      type="number"
      step="0.01"
      [formField]="paymentForm.amount"
      class="input input-bordered w-full"
      [class.input-error]="paymentForm.amount().touched() && paymentForm.amount().invalid()"
      placeholder="0.00"
    />
    @if (paymentForm.amount().touched() && paymentForm.amount().invalid()) {
    <div class="label">
      @for (error of paymentForm.amount().errors(); track error) {
      <span class="label-text-alt text-error">{{ error.message }}</span>
      }
    </div>
    }
  </div>

  <!-- Método de pago -->
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text">Método de Pago *</span>
    </label>
    <select [formField]="paymentForm.payment_method" class="select select-bordered">
      @for (method of paymentMethods; track method.value) {
      <option [value]="method.value">{{ method.label }}</option>
      }
    </select>
  </div>

  <!-- Referencia de transacción -->
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text">Referencia de Transacción</span>
    </label>
    <input
      type="text"
      [formField]="paymentForm.transaction_reference"
      class="input input-bordered w-full"
      placeholder="Número de operación, voucher, etc."
    />
  </div>

  <!-- Notas -->
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text">Notas</span>
    </label>
    <textarea
      [formField]="paymentForm.notes"
      class="textarea textarea-bordered"
      rows="2"
      placeholder="Información adicional..."
    ></textarea>
  </div>

  <!-- Errores -->
  @if (error()) {
  <div class="alert alert-error">
    <span>{{ error() }}</span>
  </div>
  }

  <!-- Éxito -->
  @if (success()) {
  <div class="alert alert-success">
    <span>✓ Pago registrado exitosamente</span>
  </div>
  }

  <!-- Botones -->
  <div class="flex gap-2 justify-end">
    <button
      type="submit"
      class="btn btn-primary"
      [disabled]="loading() || paymentForm.invalid() || !isAmountValid()"
    >
      @if (loading()) {
      <span class="loading loading-spinner"></span>
      } Registrar Pago
    </button>
  </div>
</form>
```

### 3. Daily Sales View

**Ubicación:** `src/app/features/sales/daily-sales-view/`

```typescript
// daily-sales-view.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { OrderService } from '@/app/core/services/order-service';
import { CashRegisterService } from '@/app/core/services/cash-register-service';
import type { OrderView } from '@/app/data/models/sales/order.model';

@Component({
  selector: 'app-daily-sales-view',
  templateUrl: './daily-sales-view.html',
})
export class DailySalesViewComponent implements OnInit {
  private orderService = inject(OrderService);
  private cashRegisterService = inject(CashRegisterService);

  protected orders = signal<OrderView[]>([]);
  protected selectedOrder = signal<OrderView | null>(null);
  protected showPaymentModal = signal(false);

  protected loading = signal(false);
  protected error = signal<string | null>(null);

  // Filtros
  protected filterPaymentStatus = signal<string>('ALL');

  // Computed
  protected filteredOrders = computed(() => {
    const status = this.filterPaymentStatus();
    if (status === 'ALL') return this.orders();
    return this.orders().filter((o) => o.payment_status === status);
  });

  protected totalSales = computed(() =>
    this.filteredOrders().reduce((sum, o) => sum + o.final_amount, 0),
  );

  protected totalPaid = computed(() =>
    this.filteredOrders().reduce((sum, o) => sum + o.advance, 0),
  );

  protected totalPending = computed(() =>
    this.filteredOrders().reduce((sum, o) => sum + o.remaining_balance, 0),
  );

  async ngOnInit() {
    await this.loadOrders();
  }

  private async loadOrders() {
    try {
      this.loading.set(true);
      const today = new Date().toISOString().split('T')[0];
      const data = await this.orderService.getDailySalesSummary(today);
      this.orders.set(data);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected openPaymentModal(order: OrderView) {
    this.selectedOrder.set(order);
    this.showPaymentModal.set(true);
  }

  protected closePaymentModal() {
    this.showPaymentModal.set(false);
    this.selectedOrder.set(null);
  }

  protected async onPaymentRegistered() {
    this.closePaymentModal();
    await this.loadOrders();
  }

  protected getPaymentStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PAGADO':
        return 'badge-success';
      case 'PARCIAL':
        return 'badge-warning';
      case 'PENDIENTE':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  }
}
```

```html
<!-- daily-sales-view.html -->
<div class="p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">Ventas del Día</h1>
    <button class="btn btn-primary" routerLink="/ventas/orden/nueva">Nueva Orden</button>
  </div>

  <!-- Resumen -->
  <div class="stats shadow mb-6 w-full">
    <div class="stat">
      <div class="stat-title">Total Ventas</div>
      <div class="stat-value text-primary">S/ {{ totalSales() | number: '1.2-2' }}</div>
      <div class="stat-desc">{{ filteredOrders().length }} órdenes</div>
    </div>
    <div class="stat">
      <div class="stat-title">Total Pagado</div>
      <div class="stat-value text-success">S/ {{ totalPaid() | number: '1.2-2' }}</div>
    </div>
    <div class="stat">
      <div class="stat-title">Total Pendiente</div>
      <div class="stat-value text-warning">S/ {{ totalPending() | number: '1.2-2' }}</div>
    </div>
  </div>

  <!-- Filtros -->
  <div class="flex gap-2 mb-4">
    <button
      class="btn btn-sm"
      [class.btn-active]="filterPaymentStatus() === 'ALL'"
      (click)="filterPaymentStatus.set('ALL')"
    >
      Todas
    </button>
    <button
      class="btn btn-sm"
      [class.btn-active]="filterPaymentStatus() === 'PENDIENTE'"
      (click)="filterPaymentStatus.set('PENDIENTE')"
    >
      Pendientes
    </button>
    <button
      class="btn btn-sm"
      [class.btn-active]="filterPaymentStatus() === 'PARCIAL'"
      (click)="filterPaymentStatus.set('PARCIAL')"
    >
      Parciales
    </button>
    <button
      class="btn btn-sm"
      [class.btn-active]="filterPaymentStatus() === 'PAGADO'"
      (click)="filterPaymentStatus.set('PAGADO')"
    >
      Pagadas
    </button>
  </div>

  <!-- Tabla de órdenes -->
  @if (loading()) {
  <div class="flex justify-center items-center h-64">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
  } @else if (error()) {
  <div class="alert alert-error">
    <span>{{ error() }}</span>
  </div>
  } @else {
  <div class="overflow-x-auto">
    <table class="table table-zebra">
      <thead>
        <tr>
          <th>Orden #</th>
          <th>Cliente</th>
          <th>Total</th>
          <th>Pagado</th>
          <th>Pendiente</th>
          <th>Estado Pago</th>
          <th>Estado Orden</th>
          <th>Hora</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        @for (order of filteredOrders(); track order.id) {
        <tr>
          <td class="font-bold">{{ order.order_number }}</td>
          <td>{{ order.customer_name }}</td>
          <td>S/ {{ order.final_amount | number: '1.2-2' }}</td>
          <td class="text-success">S/ {{ order.advance | number: '1.2-2' }}</td>
          <td class="text-warning">S/ {{ order.remaining_balance | number: '1.2-2' }}</td>
          <td>
            <span class="badge" [ngClass]="getPaymentStatusBadgeClass(order.payment_status)">
              {{ order.payment_status }}
            </span>
          </td>
          <td>
            <span class="badge badge-ghost">{{ order.order_status_name }}</span>
          </td>
          <td>{{ order.created_at | date: 'shortTime' }}</td>
          <td>
            <div class="flex gap-2">
              @if (order.payment_status !== 'PAGADO') {
              <button class="btn btn-xs btn-primary" (click)="openPaymentModal(order)">
                Pagar
              </button>
              }
              <button class="btn btn-xs btn-ghost" [routerLink]="['/ventas/orden', order.id]">
                Ver
              </button>
            </div>
          </td>
        </tr>
        } @empty {
        <tr>
          <td colspan="9" class="text-center py-8">No hay órdenes para mostrar</td>
        </tr>
        }
      </tbody>
    </table>
  </div>
  }

  <!-- Modal de Pago -->
  @if (showPaymentModal() && selectedOrder()) {
  <dialog class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        (click)="closePaymentModal()"
      >
        ✕
      </button>

      <app-payment-form [order]="selectedOrder()!" (paymentRegistered)="onPaymentRegistered()" />
    </div>
    <form method="dialog" class="modal-backdrop" (click)="closePaymentModal()">
      <button>close</button>
    </form>
  </dialog>
  }
</div>
```

---

## 🗺️ Rutas

### Actualizar: `src/app/features/sales/sales.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const salesRoutes: Routes = [
  {
    path: '',
    redirectTo: 'punto-venta',
    pathMatch: 'full',
  },
  {
    path: 'caja',
    loadComponent: () =>
      import('./cash-register-dashboard/cash-register-dashboard').then(
        (m) => m.CashRegisterDashboardComponent,
      ),
  },
  {
    path: 'cerrar-caja',
    loadComponent: () =>
      import('./close-cash-register/close-cash-register').then((m) => m.CloseCashRegisterComponent),
  },
  {
    path: 'punto-venta',
    loadComponent: () =>
      import('./daily-sales-view/daily-sales-view').then((m) => m.DailySalesViewComponent),
  },
  {
    path: 'pendientes',
    loadComponent: () =>
      import('./pending-payments-list/pending-payments-list').then(
        (m) => m.PendingPaymentsListComponent,
      ),
  },
  {
    path: 'orden/nueva',
    loadComponent: () => import('./order-create/order-create').then((m) => m.OrderCreateComponent),
  },
  {
    path: 'orden/:id',
    loadComponent: () => import('./order-view/order-view').then((m) => m.OrderViewComponent),
  },
];
```

---

## ✅ Checklist de Implementación Frontend

- [ ] Crear modelos TypeScript (order, payment, cash-register)
- [ ] Crear/actualizar servicios (OrderService, PaymentService, CashRegisterService)
- [ ] Implementar CashRegisterDashboardComponent
- [ ] Implementar PaymentFormComponent
- [ ] Implementar DailySalesViewComponent
- [ ] Implementar PendingPaymentsListComponent
- [ ] Implementar CloseCashRegisterComponent
- [ ] Configurar rutas
- [ ] Agregar navegación en sidebar
- [ ] Tests unitarios
- [ ] Validar flujo completo E2E

---

## 🎨 Paleta de Colores (DaisyUI)

```css
/* Estados de Pago */
.badge-success /* PAGADO */
.badge-warning /* PARCIAL */
.badge-error   /* PENDIENTE */

/* Estados de Orden */
.badge-ghost   /* Estado genérico */
.badge-info    /* EN_PRODUCCION */
.badge-success /* COMPLETADO, ENTREGADO */
.badge-error   /* CANCELADO */
```

---

**Autor:** GitHub Copilot  
**Fecha:** 2026-01-20
