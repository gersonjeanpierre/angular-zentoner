# 🔄 Diagrama de Flujo - Sistema POS con Pagos Parciales

## 📊 Flujo Completo del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INICIO DE OPERACIONES                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   CASHIER llega        │
                         │   Inicia turno         │
                         └────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │  ¿Hay sesión abierta?  │
                         └────────────────────────┘
                              │              │
                          SÍ  │              │ NO
                              │              │
                    ┌─────────┘              └──────────┐
                    ▼                                   ▼
        ┌───────────────────────┐       ┌──────────────────────────┐
        │  Cerrar sesión        │       │  Abrir nueva sesión      │
        │  anterior (turno      │       │                          │
        │  pasado)              │       │  - Registrar             │
        └───────────────────────┘       │    opening_balance       │
                    │                   │  - Tipo: PARCIAL/FINAL   │
                    │                   │  - Notas de apertura     │
                    │                   └──────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                        ┌───────────────────────┐
                        │  SESIÓN ACTIVA        │
                        │  session_id generado  │
                        └───────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  EMPLOYEE     │         │  CASHIER        │         │  CASHIER        │
│  Crea Orden   │         │  Registra Pago  │         │  Gestiona       │
│               │         │                 │         │  Órdenes        │
└───────────────┘         └─────────────────┘         └─────────────────┘
```

---

## 🛒 Flujo 1: EMPLOYEE - Crear Orden

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMPLOYEE: CREAR ORDEN                              │
└─────────────────────────────────────────────────────────────────────────────┘

        1. Seleccionar cliente
                │
                ▼
        2. Agregar items/productos
           ┌─────────────────────────┐
           │  Por cada item:         │
           │  - Descripción          │
           │  - Cantidad             │
           │  - Precio unitario      │
           │  - Medidas (si aplica)  │
           │  - Subtotal calculado   │
           └─────────────────────────┘
                │
                ▼
        3. Calcular totales
           ┌───────────────────────────────────────────────┐
           │  total_price = SUM(subtotales)                │
           │  discount = aplicar descuento                 │
           │  igv = (total_price - discount) × 0.18        │
           │  final_amount = total_price - discount + igv  │
           │  remaining_balance = final_amount             │
           └───────────────────────────────────────────────┘
                │
                ▼
        4. Guardar orden
           ┌──────────────────────────────────────┐
           │  INSERT INTO sales.orders            │
           │  - shop_id                           │
           │  - customer_id                       │
           │  - employee_id                       │
           │  - Campos financieros                │
           │  - payment_status = 'PENDIENTE'      │
           │  - status_id = 1 (PENDIENTE)         │
           └──────────────────────────────────────┘
                │
                ▼
        5. Guardar detalles
           ┌──────────────────────────────────────┐
           │  INSERT INTO sales.order_details     │
           │  (para cada item)                    │
           └──────────────────────────────────────┘
                │
                ▼
           ┌──────────────────────────────────────┐
           │  ORDEN CREADA                        │
           │  order_number: #1234                 │
           │  Estado: PENDIENTE                   │
           │  Pago: PENDIENTE                     │
           └──────────────────────────────────────┘
                │
                ▼
        Notificar a CASHIER para pago
```

---

## 💰 Flujo 2: CASHIER - Registrar Pago

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CASHIER: REGISTRAR PAGO                             │
└─────────────────────────────────────────────────────────────────────────────┘

        1. Cliente se presenta a pagar
                │
                ▼
        2. Buscar orden
           ┌──────────────────────────────────────┐
           │  Por orden_number o cliente          │
           │  Filtrar: payment_status != 'PAGADO' │
           └──────────────────────────────────────┘
                │
                ▼
        3. Mostrar información
           ┌──────────────────────────────────────┐
           │  Orden #1234                         │
           │  Cliente: Juan Pérez                 │
           │  ─────────────────────────────────── │
           │  Total Final:    S/ 300.00           │
           │  Ya Pagado:      S/ 100.00           │
           │  PENDIENTE:      S/ 200.00           │
           └──────────────────────────────────────┘
                │
                ▼
        4. Ingresar datos de pago
           ┌──────────────────────────────────────┐
           │  Monto:              [________]      │
           │  Método:             [Efectivo ▼]    │
           │  Referencia:         [________]      │
           │  Notas:              [________]      │
           └──────────────────────────────────────┘
                │
                ▼
        5. Validar monto
           ┌──────────────────────────────────────┐
           │  ¿monto > 0?                         │
           │  ¿monto <= remaining_balance?        │
           └──────────────────────────────────────┘
                │               │
            SÍ  │               │ NO
                │               │
                ▼               ▼
           CONTINUAR      ┌────────────────┐
                │         │  Mostrar error │
                │         │  "Monto        │
                │         │   inválido"    │
                │         └────────────────┘
                │                   │
                └───────────────────┘
                          │
                          ▼
        6. Ejecutar RPC
           ┌──────────────────────────────────────┐
           │  sales.register_payment(             │
           │    p_order_id,                       │
           │    p_amount,                         │
           │    p_payment_method,                 │
           │    p_cash_register_session_id,       │
           │    ...                               │
           │  )                                   │
           └──────────────────────────────────────┘
                │
                ▼
        ┌─────────────────────────────────────────────────────────┐
        │  DENTRO DE LA FUNCIÓN register_payment():               │
        │                                                         │
        │  7a. Validaciones                                       │
        │      - Orden existe                                     │
        │      - Monto válido                                     │
        │      - No excede saldo                                  │
        │                                                         │
        │  7b. INSERT INTO sales.payments                         │
        │      - id = UUID                                        │
        │      - order_id                                         │
        │      - cash_register_session_id ← VINCULAR A SESIÓN    │
        │      - amount                                           │
        │      - payment_method                                   │
        │      - payment_date = NOW()                             │
        │                                                         │
        │  7c. UPDATE sales.orders                                │
        │      - advance += amount                                │
        │      - remaining_balance -= amount                      │
        │      - payment_status = calcular_estado()               │
        │      - fully_paid_at = (si pagado completo)             │
        │                                                         │
        │  7d. Calcular nuevo estado                              │
        │      ┌────────────────────────────────┐                 │
        │      │  IF remaining_balance = 0:     │                 │
        │      │    payment_status = 'PAGADO'   │                 │
        │      │  ELSE IF advance > 0:          │                 │
        │      │    payment_status = 'PARCIAL'  │                 │
        │      │  ELSE:                         │                 │
        │      │    payment_status = 'PENDIENTE'│                 │
        │      └────────────────────────────────┘                 │
        │                                                         │
        │  7e. RETURN JSON con resultado                          │
        └─────────────────────────────────────────────────────────┘
                │
                ▼
        8. Mostrar resultado
           ┌──────────────────────────────────────┐
           │  ✓ Pago registrado exitosamente      │
           │                                      │
           │  Monto pagado:       S/ 150.00       │
           │  Nuevo saldo:        S/ 50.00        │
           │  Estado de pago:     PARCIAL         │
           └──────────────────────────────────────┘
                │
                ▼
        9. ¿Cliente pagó todo?
                │               │
            SÍ  │               │ NO
                │               │
                ▼               ▼
        ┌──────────────┐   ┌────────────────────┐
        │  Marcar como │   │  Recordar que debe │
        │  ENTREGADO   │   │  volver a pagar    │
        │              │   │  S/ 50.00          │
        └──────────────┘   └────────────────────┘
```

---

## 🔄 Flujo 3: Pago en Múltiples Días

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CASO: PAGO EN MÚLTIPLES DÍAS                              │
└─────────────────────────────────────────────────────────────────────────────┘

DÍA 1 (Lunes 08:00)
───────────────────
    │
    ▼
┌──────────────────────────────────────┐
│  Employee crea orden #1234           │
│  Cliente: María López                │
│  final_amount: S/ 300.00             │
│  remaining_balance: S/ 300.00        │
│  payment_status: 'PENDIENTE'         │
└──────────────────────────────────────┘
    │
    ▼

DÍA 1 (Lunes 10:30)
───────────────────
    │
    ▼
┌──────────────────────────────────────┐
│  Cliente paga adelanto               │
│                                      │
│  register_payment(                   │
│    order_id: #1234,                  │
│    amount: 100.00,                   │
│    session_id: SESSION_LUNES_1       │← SESIÓN DEL LUNES
│  )                                   │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  RESULTADO DÍA 1:                    │
│  ─────────────────────────────────── │
│  advance: S/ 100.00                  │
│  remaining_balance: S/ 200.00        │
│  payment_status: 'PARCIAL'           │
│                                      │
│  PAYMENTS:                           │
│  - payment_id: UUID-1                │
│    amount: 100.00                    │
│    payment_date: 2026-01-20 10:30    │
│    session_id: SESSION_LUNES_1       │
└──────────────────────────────────────┘
    │
    ▼

DÍA 3 (Miércoles 15:00)
───────────────────────
    │
    ▼
┌──────────────────────────────────────┐
│  Cashier busca órdenes pendientes    │
│  Encuentra orden #1234               │
│                                      │
│  Muestra:                            │
│  - Total: S/ 300.00                  │
│  - Pagado: S/ 100.00                 │
│  - Pendiente: S/ 200.00              │
│  - Último pago: Lunes 20/01 10:30    │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  Cliente paga otro adelanto          │
│                                      │
│  register_payment(                   │
│    order_id: #1234,                  │
│    amount: 120.00,                   │
│    session_id: SESSION_MIERCOLES_1   │← SESIÓN DEL MIÉRCOLES
│  )                                   │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  RESULTADO DÍA 3:                    │
│  ─────────────────────────────────── │
│  advance: S/ 220.00                  │
│  remaining_balance: S/ 80.00         │
│  payment_status: 'PARCIAL'           │
│                                      │
│  PAYMENTS:                           │
│  - payment_id: UUID-1                │
│    amount: 100.00                    │
│    payment_date: 2026-01-20 10:30    │
│    session_id: SESSION_LUNES_1       │
│  - payment_id: UUID-2                │
│    amount: 120.00                    │
│    payment_date: 2026-01-22 15:00    │
│    session_id: SESSION_MIERCOLES_1   │
└──────────────────────────────────────┘
    │
    ▼

DÍA 5 (Viernes 09:00)
─────────────────────
    │
    ▼
┌──────────────────────────────────────┐
│  Cliente paga el saldo final         │
│                                      │
│  register_payment(                   │
│    order_id: #1234,                  │
│    amount: 80.00,                    │
│    session_id: SESSION_VIERNES_1     │← SESIÓN DEL VIERNES
│  )                                   │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  RESULTADO FINAL:                    │
│  ─────────────────────────────────── │
│  advance: S/ 300.00                  │
│  remaining_balance: S/ 0.00          │
│  payment_status: 'PAGADO'            │
│  fully_paid_at: 2026-01-24 09:00     │
│                                      │
│  PAYMENTS (HISTORIAL COMPLETO):      │
│  1. 100.00 - Lunes 20/01 10:30       │
│     Sesión: #101 (LUNES)             │
│  2. 120.00 - Miércoles 22/01 15:00   │
│     Sesión: #105 (MIÉRCOLES)         │
│  3.  80.00 - Viernes 24/01 09:00     │
│     Sesión: #110 (VIERNES)           │
│                                      │
│  TOTAL PAGADO: S/ 300.00 ✓           │
└──────────────────────────────────────┘
```

---

## 📊 Flujo 4: Reporte de Ventas del Día

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REPORTE DE VENTAS DEL DÍA                               │
└─────────────────────────────────────────────────────────────────────────────┘

        ESCENARIO: Viernes 24/01/2026
        ─────────────────────────────

        Sesión activa: SESSION_VIERNES_1
        Abierta: 08:00 AM

        ┌──────────────────────────────────────┐
        │  get_daily_sales_summary(            │
        │    p_date: '2026-01-24'              │
        │  )                                   │
        └──────────────────────────────────────┘
                │
                ▼
        ┌───────────────────────────────────────────────────────────┐
        │  ÓRDENES CREADAS HOY (24/01):                             │
        │  ───────────────────────────────────────────────────────  │
        │  1. Orden #1250 - Cliente: Pedro                          │
        │     Total: S/ 150.00                                      │
        │     Pagado: S/ 150.00                                     │
        │     Pendiente: S/ 0.00                                    │
        │     Estado: PAGADO ✓                                      │
        │                                                           │
        │  2. Orden #1251 - Cliente: Ana                            │
        │     Total: S/ 250.00                                      │
        │     Pagado: S/ 0.00                                       │
        │     Pendiente: S/ 250.00                                  │
        │     Estado: PENDIENTE                                     │
        │                                                           │
        │  3. Orden #1252 - Cliente: Luis                           │
        │     Total: S/ 400.00                                      │
        │     Pagado: S/ 200.00                                     │
        │     Pendiente: S/ 200.00                                  │
        │     Estado: PARCIAL                                       │
        └───────────────────────────────────────────────────────────┘
                │
                ▼
        ┌───────────────────────────────────────────────────────────┐
        │  PAGOS RECIBIDOS HOY (24/01):                             │
        │  ───────────────────────────────────────────────────────  │
        │  1. Orden #1234 - Pago final: S/ 80.00                    │← ORDEN DE LUNES
        │     (Orden creada el Lunes 20/01)                         │  PERO PAGO HOY
        │     Método: YAPE                                          │
        │                                                           │
        │  2. Orden #1250 - Pago completo: S/ 150.00                │
        │     (Orden creada hoy)                                    │
        │     Método: EFECTIVO                                      │
        │                                                           │
        │  3. Orden #1252 - Adelanto: S/ 200.00                     │
        │     (Orden creada hoy)                                    │
        │     Método: TARJETA                                       │
        └───────────────────────────────────────────────────────────┘
                │
                ▼
        ┌───────────────────────────────────────────────────────────┐
        │  RESUMEN DEL DÍA:                                         │
        │  ───────────────────────────────────────────────────────  │
        │  Total Vendido (órdenes hoy):    S/ 800.00                │
        │  Total Cobrado (pagos hoy):      S/ 430.00                │
        │                                                           │
        │  Desglose de cobros:                                      │
        │  - Efectivo:    S/ 150.00                                 │
        │  - Tarjeta:     S/ 200.00                                 │
        │  - YAPE:        S/ 80.00                                  │
        │  - Otro:        S/ 0.00                                   │
        │                                                           │
        │  Órdenes con saldo pendiente:    2 órdenes               │
        │  Total pendiente:                S/ 450.00                │
        └───────────────────────────────────────────────────────────┘

        🔑 CLAVE: El reporte del viernes incluye:
           ✓ Órdenes creadas el viernes
           ✓ Pagos recibidos el viernes (incluso de órdenes antiguas)
           ✓ Cada pago está vinculado a la sesión del viernes
```

---

## 🔐 Flujo 5: Cerrar Caja

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CASHIER: CERRAR CAJA                               │
└─────────────────────────────────────────────────────────────────────────────┘

        1. Cashier decide cerrar caja
           (Corte parcial o final)
                │
                ▼
        2. Contar efectivo físico
           ┌──────────────────────────────────────┐
           │  Billetes y monedas:                 │
           │  - S/ 200 (inicial)                  │
           │  + S/ 1650 (ventas del turno)        │
           │  ──────────────────────────────────  │
           │  TOTAL FÍSICO: S/ 1850.00            │
           └──────────────────────────────────────┘
                │
                ▼
        3. Ejecutar cierre
           ┌──────────────────────────────────────┐
           │  close_cash_register_session(        │
           │    session_id: 'SESSION_VIERNES_1',  │
           │    closing_balance: 1850.00,         │
           │    closing_notes: '...'              │
           │  )                                   │
           └──────────────────────────────────────┘
                │
                ▼
        ┌──────────────────────────────────────────────────────────┐
        │  DENTRO DE LA FUNCIÓN close_session():                   │
        │                                                          │
        │  4a. Calcular totales por método                         │
        │      SELECT SUM(amount)                                  │
        │      FROM payments                                       │
        │      WHERE cash_register_session_id = session_id         │
        │      GROUP BY payment_method                             │
        │                                                          │
        │  4b. Calcular balance esperado                           │
        │      expected_balance =                                  │
        │        opening_balance + cash_total                      │
        │                                                          │
        │  4c. Calcular diferencia                                 │
        │      difference =                                        │
        │        closing_balance - expected_balance                │
        │                                                          │
        │  4d. Contar órdenes y pagos                              │
        │      total_orders = COUNT(DISTINCT order_id)             │
        │      total_payments = COUNT(*)                           │
        │                                                          │
        │  4e. UPDATE cash_register_sessions                       │
        │      - status = 'CERRADO'                                │
        │      - closed_at = NOW()                                 │
        │      - closing_balance                                   │
        │      - expected_balance                                  │
        │      - difference                                        │
        │      - Totales por método                                │
        │      - Contadores                                        │
        └──────────────────────────────────────────────────────────┘
                │
                ▼
        5. Mostrar resultado
           ┌──────────────────────────────────────┐
           │  CORTE DE CAJA #110                  │
           │  Sesión Viernes 24/01/2026           │
           │  Tipo: FINAL                         │
           │  ──────────────────────────────────  │
           │  Horario:                            │
           │  - Apertura:  08:00 AM               │
           │  - Cierre:    17:00 PM               │
           │  - Duración:  9 horas                │
           │                                      │
           │  Balances:                           │
           │  - Inicial:    S/ 200.00             │
           │  - Esperado:   S/ 1820.00            │
           │  - Real:       S/ 1850.00            │
           │  - Diferencia: +S/ 30.00             │← SOBRANTE
           │                                      │
           │  Métodos de Pago:                    │
           │  - Efectivo:    S/ 1620.00           │
           │  - Tarjetas:    S/ 450.00            │
           │  - Transfer:    S/ 200.00            │
           │  - Yape/Plin:   S/ 100.00            │
           │                                      │
           │  Totales:                            │
           │  - Órdenes atendidas:  15            │
           │  - Pagos registrados:  18            │
           │  - Total cobrado:  S/ 2370.00        │
           └──────────────────────────────────────┘
                │
                ▼
        6. ¿Hay diferencia?
                │               │
        SÍ (+/-) │               │ NO
                │               │
                ▼               ▼
        ┌──────────────┐   ┌────────────────┐
        │  Registrar   │   │  Cerrar sin    │
        │  en notas    │   │  novedades     │
        │  y archivar  │   └────────────────┘
        └──────────────┘
                │
                ▼
        7. Generar reporte PDF
           (Opcional)
```

---

## 📈 Flujo 6: Consultar Órdenes Pendientes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONSULTAR ÓRDENES PENDIENTES                            │
└─────────────────────────────────────────────────────────────────────────────┘

        Cashier busca órdenes con saldo pendiente
                │
                ▼
        ┌──────────────────────────────────────┐
        │  get_pending_payment_orders()        │
        └──────────────────────────────────────┘
                │
                ▼
        ┌───────────────────────────────────────────────────────────┐
        │  RESULTADO:                                               │
        │                                                           │
        │  1. Orden #1234 - María López                             │
        │     Total: S/ 300.00                                      │
        │     Pagado: S/ 220.00                                     │
        │     Pendiente: S/ 80.00                                   │
        │     Creada: Lunes 20/01 (4 días atrás)                    │
        │     Teléfono: +51 987 654 321                             │
        │                                                           │
        │  2. Orden #1251 - Ana Martínez                            │
        │     Total: S/ 250.00                                      │
        │     Pagado: S/ 0.00                                       │
        │     Pendiente: S/ 250.00                                  │
        │     Creada: Hoy (0 días)                                  │
        │     Teléfono: +51 912 345 678                             │
        │                                                           │
        │  3. Orden #1252 - Luis García                             │
        │     Total: S/ 400.00                                      │
        │     Pagado: S/ 200.00                                     │
        │     Pendiente: S/ 200.00                                  │
        │     Creada: Hoy (0 días)                                  │
        │     Teléfono: +51 998 765 432                             │
        └───────────────────────────────────────────────────────────┘
                │
                ▼
        Cashier puede:
        - Llamar a clientes atrasados
        - Registrar pagos cuando lleguen
        - Ver historial completo de pagos
```

---

## 🎯 Estados del Sistema

### Estados de Pago (payment_status)

```
PENDIENTE  → PARCIAL  → PAGADO
    ↓          ↓
    └─────────→ (directo si pago completo)
```

### Estados de Orden (status_id)

```
1. PENDIENTE  → 2. EN_PRODUCCION → 3. COMPLETADO → 4. ENTREGADO

                                                ↓
                                            5. CANCELADO
```

### Estados de Sesión de Caja

```
ABIERTO → CERRADO
   ↓
   └─ (no se puede reabrir)
```

---

## 🔗 Relaciones Clave

```
orders (1) ───── (N) payments
   │                   │
   │                   │
   ▼                   ▼
payment_status    cash_register_session_id
   │                   │
   │                   │
   ▼                   ▼
PENDIENTE         Permite tracking
PARCIAL           diario preciso
PAGADO
```

---

**Autor:** GitHub Copilot  
**Fecha:** 2026-01-20  
**Versión:** 1.0
