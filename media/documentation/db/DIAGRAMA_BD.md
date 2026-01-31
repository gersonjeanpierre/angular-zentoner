# Diagrama de Base de Datos - Sistema Zentoner

## Esquema Completo

```
┌────────────────────────────────────────────────────────────────────┐
│                         CORE SCHEMA                                │
│                                                                    │
│  ┌──────────────┐       ┌──────────────┐      ┌──────────────┐  │
│  │   shops      │       │   persons    │      │ audit_logs   │  │
│  │──────────────│       │──────────────│      │──────────────│  │
│  │ id (PK)      │       │ id (PK)      │      │ id (PK)      │  │
│  │ name         │       │ first_name   │      │ action       │  │
│  │ address      │       │ last_name    │      │ actor_id     │  │
│  │ email        │       │ email        │      │ target_table │  │
│  │ phone        │       │ phone        │      │ target_id    │  │
│  │ company_data │       │ dni/ruc/ce   │      │ status       │  │
│  └──────┬───────┘       │ person_type  │      │ payload      │  │
│         │               │ deleted_at   │      │ created_at   │  │
│         │               └──────┬───────┘      └──────────────┘  │
└─────────┼──────────────────────┼────────────────────────────────┘
          │                      │
          │                      │
┌─────────▼──────────────────────▼──────────────────────────────────┐
│                         HR SCHEMA                                  │
│                                                                    │
│  ┌──────────────┐     ┌───────────────┐     ┌─────────────────┐ │
│  │  employees   │     │     roles     │     │employee_statuses│ │
│  │──────────────│     │───────────────│     │─────────────────│ │
│  │ id (FK)      │───┐ │ id (PK)       │     │ id (PK)         │ │
│  │ shop_id (FK) ├───┼─┤ name          │     │ code            │ │
│  │ code         │   │ │ description   │     │ name            │ │
│  │ auth_email   │   │ └───────────────┘     │ is_active       │ │
│  │ hire_date    │   │                       └─────────────────┘ │
│  │ salary       │   │ ┌─────────────────┐                       │
│  │ status_id(FK)│   └─┤ employee_roles  │                       │
│  └──────────────┘     │─────────────────│                       │
│                       │ employee_id (FK)│                       │
│                       │ role_id (FK)    │                       │
│                       └─────────────────┘                       │
└────────────────────────────────────────────────────────────────────┘
                               │
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        SALES SCHEMA                                 │
│                                                                     │
│  ┌─────────────┐     ┌──────────────┐      ┌──────────────────┐  │
│  │  customers  │     │   orders     │      │  order_details   │  │
│  │─────────────│     │──────────────│      │──────────────────│  │
│  │ id (FK)     │◄────┤ id (PK)      │◄─────┤ id (PK)          │  │
│  │ code        │     │ order_number │      │ order_id (FK)    │  │
│  │ type_code   │     │ customer_id  │      │ item_id (FK)     │  │
│  │ notes       │     │ employee_id  │      │ description      │  │
│  └─────────────┘     │ shop_id (FK) │      │ quantity         │  │
│                      │ status_id(FK)│      │ unit_price       │  │
│  ┌──────────────┐   │ total_price  │      │ subtotal         │  │
│  │order_status  │   │ discount     │      │ width/height_mm  │  │
│  │──────────────│   │ igv          │      │ attributes       │  │
│  │ id (PK)      │◄──┤ final_amount │      └──────────────────┘  │
│  │ name         │   │ advance      │                             │
│  │ description  │   │ remaining    │                             │
│  └──────────────┘   │ payment_st.  │                             │
│                     │ fully_paid_at│                             │
│                     └──────┬───────┘                             │
│                            │                                      │
│  ┌──────────────────────┐ │    ┌─────────────────────────┐      │
│  │cash_register_sessions│ │    │       payments          │      │
│  │──────────────────────│ │    │─────────────────────────│      │
│  │ id (PK)              │◄┼────┤ id (PK)                 │      │
│  │ shop_id (FK)         │ │    │ order_id (FK)           │      │
│  │ cashier_id (FK)      │ │    │ session_id (FK)         │      │
│  │ session_number       │ │    │ amount                  │      │
│  │ session_type         │ │    │ payment_method          │      │
│  │ opened_at            │ │    │ transaction_reference   │      │
│  │ closed_at            │ │    │ received_by_id (FK)     │      │
│  │ opening_balance      │ │    │ payment_date            │      │
│  │ closing_balance      │ │    └─────────────────────────┘      │
│  │ expected_balance     │ │                                      │
│  │ difference           │ │    ┌─────────────────────────┐      │
│  │ cash_total           │ │    │    cash_expenses        │      │
│  │ card_total           │ │    │─────────────────────────│      │
│  │ transfer_total       │ │    │ id (PK)                 │      │
│  │ digital_wallet_total │ └────┤ session_id (FK)         │      │
│  │ other_total          │      │ shop_id (FK)            │      │
│  │ total_orders         │      │ amount                  │      │
│  │ total_payments       │      │ category                │      │
│  │ status               │      │ description             │      │
│  └──────────────────────┘      │ receipt_number          │      │
│                                │ authorized_by_id (FK)   │      │
│                                └─────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                                       │
                                       │
┌──────────────────────────────────────▼──────────────────────────────┐
│                      INVENTORY SCHEMA                               │
│                                                                     │
│  ┌─────────────┐     ┌───────────────┐       ┌───────────────┐   │
│  │ categories  │     │     items     │       │   machines    │   │
│  │─────────────│     │───────────────│       │───────────────│   │
│  │ id (PK)     │◄────┤ id (PK)       │       │ id (PK)       │   │
│  │ parent_id   │     │ category_id   │       │ shop_id (FK)  │   │
│  │ name        │     │ supply_type   │       │ name          │   │
│  │ slug        │     │ unit_type     │       │ model         │   │
│  │ description │     │ name          │       │ metadata      │   │
│  │ sort_order  │     │ sku           │       │ is_active     │   │
│  │ is_active   │     │ brand         │       └───────────────┘   │
│  └─────────────┘     │ price_ref     │                            │
│                      │ size_name     │                            │
│                      │ weight_gsm    │                            │
│                      │ finish        │                            │
│                      │ width/height  │                            │
│                      │ length_m      │                            │
│                      │ color_code    │                            │
│                      │ volume_ml     │                            │
│                      │ thickness_mm  │                            │
│                      │ metadata      │                            │
│                      │ is_active     │                            │
│                      └───────┬───────┘                            │
│                              │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                  KARDEX SYSTEM                              │  │
│  │                                                             │  │
│  │  ┌───────────────┐   ┌────────────────┐   ┌────────────┐ │  │
│  │  │movement_type  │   │movement_reason │   │roll_tracking│ │  │
│  │  │───────────────│   │────────────────│   │────────────│ │  │
│  │  │ id (PK)       │   │ id (PK)        │   │ id (PK)    │ │  │
│  │  │ name          │   │ name           │   │ item_id    │◄┼──┤
│  │  │ description   │   │ description    │   │ roll_code  │ │  │
│  │  └───────┬───────┘   └───────┬────────┘   │ current_qty│ │  │
│  │          │                   │             │ status     │ │  │
│  │          │    ┌──────────────▼─────────────┴────────────┘ │  │
│  │          │    │            kardex                          │  │
│  │          │    │────────────────────────────────────────────│ │
│  │          └────┤ id (PK)                                    │ │
│  │               │ item_id (FK)                               │ │
│  │               │ roll_id (FK)                               │ │
│  │               │ movement_type_id (FK)                      │ │
│  │               │ movement_reason_id (FK)                    │ │
│  │               │ quantity                                   │ │
│  │               │ previous_balance                           │ │
│  │               │ subsequent_balance                         │ │
│  │               │ notes                                      │ │
│  │               │ created_by (FK)                            │ │
│  │               │ created_at                                 │ │
│  │               └──────┬──────────────────────────────┬──────┘ │
│  │                      │                              │        │
│  │               ┌──────▼─────────────┐   ┌───────────▼──────┐ │
│  │               │ consumption_logs   │   │kardex_consumption│ │
│  │               │────────────────────│   │──────────────────│ │
│  │               │ id (PK)            │◄──┤ id (PK)          │ │
│  │               │ machine_id (FK)    │   │ kardex_id (FK)   │ │
│  │               │ operator_id (FK)   │   │ consumption_id   │ │
│  │               │ order_detail_id    │   │ used_quantity    │ │
│  │               │ job_name           │   │ notes            │ │
│  │               │ customer_qty       │   └──────────────────┘ │
│  │               │ calibration_waste  │                        │
│  │               │ error_waste        │                        │
│  │               │ width/length_used  │                        │
│  │               └────────────────────┘                        │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      PRODUCTION SCHEMA                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                        jobs                                  │  │
│  │─────────────────────────────────────────────────────────────│  │
│  │ id (PK)                                                      │  │
│  │ order_detail_id (FK) ───► sales.order_details                │  │
│  │ machine_id (FK) ─────────► inventory.machines                │  │
│  │ employee_id (FK) ────────► hr.employees                      │  │
│  │ started_at                                                   │  │
│  │ finished_at                                                  │  │
│  │ created_at                                                   │  │
│  │ updated_at                                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                   AUTH_MANAGEMENT (Functions Only)                   │
│                                                                      │
│  • is_employee(user_id)         → BOOLEAN                           │
│  • is_super_admin(user_id)      → BOOLEAN                           │
│  • is_creator(user_id)          → BOOLEAN                           │
│  • can_manage_hr(user_id)       → BOOLEAN                           │
│  • is_universal_manager(user_id)→ BOOLEAN                           │
└──────────────────────────────────────────────────────────────────────┘
```

## Relaciones Principales

### 1:N Relationships

```
core.shops       ──1:N──> hr.employees
core.shops       ──1:N──> sales.orders
core.shops       ──1:N──> inventory.machines
core.persons     ──1:N──> hr.employees (id)
core.persons     ──1:N──> sales.customers (id)
hr.employees     ──1:N──> sales.orders
inventory.items  ──1:N──> inventory.roll_tracking
inventory.items  ──1:N──> inventory.kardex
sales.orders     ──1:N──> sales.order_details
sales.orders     ──1:N──> sales.payments
```

### N:M Relationships

```
hr.employees ←──N:M──→ hr.roles
  (through hr.employee_roles)

inventory.kardex ←──N:M──→ inventory.consumption_logs
  (through inventory.kardex_consumption)
```

## Llaves Foráneas Críticas

```sql
-- Core
persons.created_by_id        → auth.users.id
persons.updated_by_id        → auth.users.id
persons.deleted_by_id        → auth.users.id

-- HR
employees.id                 → persons.id (1:1)
employees.shop_id            → shops.id
employees.status_id          → employee_statuses.id
employee_roles.employee_id   → employees.id
employee_roles.role_id       → roles.id

-- Sales
customers.id                 → persons.id (1:1)
orders.shop_id               → shops.id
orders.customer_id           → customers.id
orders.employee_id           → employees.id
orders.status_id             → order_status.id
order_details.order_id       → orders.id
order_details.item_id        → inventory.items.id
payments.order_id            → orders.id
payments.session_id          → cash_register_sessions.id
payments.received_by_id      → employees.id
cash_expenses.session_id     → cash_register_sessions.id

-- Inventory & Kardex
items.category_id            → categories.id
machines.shop_id             → shops.id
roll_tracking.item_id        → items.id
kardex.item_id               → items.id
kardex.roll_id               → roll_tracking.id
kardex.movement_type_id      → movement_type.id
kardex.movement_reason_id    → movement_reason.id
consumption_logs.machine_id  → machines.id
consumption_logs.operator_id → auth.users.id
kardex_consumption.kardex_id → kardex.id
kardex_consumption.consumption_id → consumption_logs.id

-- Production
jobs.order_detail_id         → order_details.id
jobs.machine_id              → machines.id
jobs.employee_id             → employees.id
```

## Índices Importantes

```sql
-- Performance crítico
idx_kardex_item_id            ON inventory.kardex(item_id)
idx_kardex_created_at         ON inventory.kardex(created_at)
idx_orders_payment_status     ON sales.orders(payment_status)
idx_payments_order            ON sales.payments(order_id)
idx_payments_session          ON sales.payments(cash_register_session_id)
idx_cash_sessions_status      ON sales.cash_register_sessions(status)
idx_core_persons_deleted_at   ON core.persons(deleted_at)
```

## Constraints Principales

```sql
-- Checks importantes
chk_payment_status            payment_status IN ('PENDIENTE','PARCIAL','PAGADO')
chk_session_status            status IN ('ABIERTO','CERRADO')
chk_advance                   advance <= final_amount
chk_remaining_balance         remaining_balance >= 0
chk_current_quantity          current_quantity >= 0
chk_quantity_positive         quantity > 0
chk_persons_dni_or_ce         (dni XOR ce) OR (both NULL)
```
