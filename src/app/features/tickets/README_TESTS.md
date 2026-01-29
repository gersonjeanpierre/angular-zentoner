# Pruebas Unitarias - Sistema de Órdenes (Tickets)

## 📋 Descripción

Suite completa de pruebas unitarias para el sistema de generación de órdenes de la imprenta, implementada con **Vitest** y **jsdom**.

## 🎯 Cobertura de Pruebas

### 1. OrderItemValidator (12 pruebas)

Valida la integridad y cálculos de items individuales de órdenes.

#### Validación de Items

- ✅ Validación de item completo
- ✅ Detección de categoría faltante
- ✅ Detección de tamaño faltante
- ✅ Detección de cantidad inválida (cero)
- ✅ Detección de cantidad inválida (negativa)
- ✅ Detección de precio inválido (cero)
- ✅ Detección de precio inválido (negativo)

#### Cálculo de Subtotales

- ✅ Cálculo correcto de subtotal
- ✅ Manejo de cantidades decimales
- ✅ Manejo de cantidad cero
- ✅ Manejo de precio cero

#### Creación de Items

- ✅ Creación de item vacío con valores por defecto

### 2. OrderTransformer (8 pruebas)

Transforma modelos de UI a modelos de base de datos (sales.orders y sales.order_details).

#### Transformación a Order

- ✅ Transformación completa de OrderFormModel a Order
- ✅ Cálculo de payment_status como PENDIENTE
- ✅ Cálculo de payment_status como PARCIAL
- ✅ Cálculo de payment_status como PAGADO

#### Transformación a OrderDetails

- ✅ Transformación de array de items a OrderDetail[]
- ✅ Construcción correcta de descripción
- ✅ Manejo de array vacío de items

### 3. Cálculos Financieros (13 pruebas)

Valida la lógica de cálculos financieros según el schema SQL de `05_SALES.sql`.

#### total_price

- ✅ Suma de subtotales de todos los items
- ✅ Retorno de 0 para array vacío

#### igv (18%)

- ✅ Cálculo de IGV sin descuento
- ✅ Cálculo de IGV con descuento
- ✅ IGV en 0 cuando includeIGV es false
- ✅ Manejo de descuentos grandes

#### final_amount

- ✅ Cálculo correcto: `total_price - discount + igv`
- ✅ Cálculo sin IGV
- ✅ Cálculo sin descuento

#### remaining_balance

- ✅ Cálculo correcto: `final_amount - advance`
- ✅ Retorno de 0 cuando está completamente pagado
- ✅ Retorno de finalAmount cuando no hay adelanto

#### payment_status

- ✅ Estado PENDIENTE cuando no hay pago
- ✅ Estado PARCIAL cuando hay pago parcial
- ✅ Estado PAGADO cuando está completamente pagado

### 4. Flujo Completo de Creación (3 pruebas)

Pruebas de integración que validan el flujo completo desde UI hasta BD.

- ✅ Creación de orden válida con múltiples items
- ✅ Manejo de orden sin IGV
- ✅ Manejo de orden completamente pagada

### 5. Validaciones de Negocio (8 pruebas)

Valida reglas de negocio y constraints SQL del schema.

#### Constraints SQL (sales.orders)

- ✅ `chk_discount`: discount no puede exceder total_price
- ✅ `chk_advance`: advance no puede exceder final_amount
- ✅ `chk_remaining_balance`: remaining_balance debe ser no-negativo
- ✅ Todos los montos financieros deben ser no-negativos

#### Validación de Items

- ✅ Rechazo de orden sin items
- ✅ Rechazo de orden con items incompletos
- ✅ Aceptación de orden con todos los items válidos

## 🚀 Ejecutar Pruebas

### Ejecutar todas las pruebas

```bash
npm test
```

### Ejecutar en modo watch

```bash
npm test -- --watch
```

### Ver cobertura de código

```bash
npm test -- --coverage
```

## 📊 Resultados Actuales

```
✅ 44 tests passing
❌ 0 tests failing
⏱️ Duración: ~20ms
```

## 🏗️ Estructura de Pruebas

```
tickets.spec.ts
├── OrderItemValidator
│   ├── validate()
│   ├── calculateSubtotal()
│   └── createEmpty()
├── OrderTransformer
│   ├── toOrder()
│   └── toOrderDetails()
├── Order Financial Calculations
│   ├── totalPrice
│   ├── igv (18%)
│   ├── finalAmount
│   ├── remainingBalance
│   └── paymentStatus
├── Complete Order Creation Flow
│   ├── Multiple items
│   ├── Without IGV
│   └── Fully paid
└── Business Validation Rules
    ├── SQL Constraints
    └── Order Items
```

## 🔗 Alineación con Schema SQL

Las pruebas están alineadas con el schema SQL de `05_SALES.sql`:

### sales.orders

```sql
total_price NUMERIC(15,4) NOT NULL DEFAULT 0
discount NUMERIC(15,4) DEFAULT 0
igv NUMERIC(15,4) DEFAULT 0
final_amount NUMERIC(15,4) NOT NULL DEFAULT 0
advance NUMERIC(15,4) DEFAULT 0
remaining_balance NUMERIC(15,4) NOT NULL DEFAULT 0
payment_status TEXT NOT NULL DEFAULT 'PENDIENTE'
```

### Constraints Validados

- ✅ `chk_total_price`: total_price >= 0
- ✅ `chk_discount`: discount >= 0 AND discount <= total_price
- ✅ `chk_igv`: igv >= 0
- ✅ `chk_final_amount`: final_amount >= 0
- ✅ `chk_advance`: advance >= 0 AND advance <= final_amount
- ✅ `chk_remaining_balance`: remaining_balance >= 0
- ✅ `chk_payment_status`: payment_status IN ('PENDIENTE', 'PARCIAL', 'PAGADO')

## 📝 Casos de Uso Cubiertos

### Escenario 1: Orden Simple

```typescript
Items: [Banner A4 x5 @ S/10.50]
Total: S/52.50
IGV (18%): S/9.45
Final: S/61.95
Adelanto: S/0
Estado: PENDIENTE
```

### Escenario 2: Orden con Descuento

```typescript
Items: [Banner x5, Lona x2]
Total: S/102.50
Descuento: S/2.50
IGV (18%): S/18.00
Final: S/118.00
Adelanto: S/50.00
Saldo: S/68.00
Estado: PARCIAL
```

### Escenario 3: Orden Completamente Pagada

```typescript
Items: [Sticker x100 @ S/0.50]
Total: S/50.00
IGV (18%): S/9.00
Final: S/59.00
Adelanto: S/59.00
Saldo: S/0.00
Estado: PAGADO
```

## 🧪 Tecnologías Utilizadas

- **Vitest**: Framework de testing rápido y moderno
- **jsdom**: Simulación de DOM para pruebas unitarias
- **Angular Signals**: Testing de reactividad con signals
- **TypeScript**: Tipado estático para mayor seguridad

## 📚 Referencias

- [Vitest Documentation](https://vitest.dev/)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Schema SQL](../../media/db/05_SALES.sql)
- [Modelos de Datos](../../data/models/tickets/)

## 🔄 Mantenimiento

Para mantener las pruebas actualizadas:

1. **Cuando se modifique el schema SQL**: Actualizar constraints y validaciones
2. **Cuando se agreguen campos**: Agregar pruebas para nuevos campos
3. **Cuando cambien cálculos**: Actualizar casos de prueba numéricos
4. **Cuando se agreguen features**: Crear nuevos describe blocks

## ✅ Checklist para Nuevas Pruebas

- [ ] Probar casos válidos (happy path)
- [ ] Probar casos inválidos (edge cases)
- [ ] Validar constraints SQL
- [ ] Probar valores límite (0, negativos, muy grandes)
- [ ] Documentar casos de uso en README
- [ ] Mantener nombres descriptivos de tests
- [ ] Usar `expect.toBeCloseTo()` para números decimales
