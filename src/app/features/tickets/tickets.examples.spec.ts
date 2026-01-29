/**
 * Ejemplos de Uso - Pruebas Unitarias para Órdenes
 *
 * Este archivo contiene ejemplos prácticos de cómo usar las pruebas
 * y cómo implementar nuevas pruebas siguiendo los patrones establecidos.
 */

import { describe, it, expect } from 'vitest';
import {
  OrderFormModel,
  OrderItemModel,
  OrderItemValidator,
  OrderTransformer,
} from '@data/models/tickets';

// =====================================================================
// EJEMPLO 1: Validar un Item Individual
// =====================================================================

describe('Ejemplo: Validar Item Individual', () => {
  it('debería validar un item completo de banner', () => {
    // 1. Crear un item de prueba
    const bannerItem: OrderItemModel = {
      category: 'Banner',
      size: 'A4',
      type: 'Full Color',
      machine: 'HP Latex',
      description: 'Banner promocional para evento',
      quantity: 10,
      price: 15.5,
      total: 155.0,
    };

    // 2. Validar el item
    const validation = OrderItemValidator.validate(bannerItem);

    // 3. Verificar resultados
    expect(validation.isComplete).toBe(true);
    expect(validation.hasCategory).toBe(true);
    expect(validation.hasSize).toBe(true);
    expect(validation.hasValidQuantity).toBe(true);
    expect(validation.hasValidPrice).toBe(true);
  });
});

// =====================================================================
// EJEMPLO 2: Calcular Totales de una Orden
// =====================================================================

describe('Ejemplo: Calcular Totales de Orden', () => {
  it('debería calcular correctamente todos los totales financieros', () => {
    // 1. Definir items de la orden
    const items: OrderItemModel[] = [
      {
        category: 'Banner',
        size: 'A4',
        quantity: 5,
        price: 20,
        total: 100, // 5 × 20
      },
      {
        category: 'Lona',
        size: 'A3',
        quantity: 3,
        price: 30,
        total: 90, // 3 × 30
      },
    ];

    // 2. Calcular total_price (suma de subtotales)
    const totalPrice = items.reduce((sum, item) => sum + item.total, 0);
    expect(totalPrice).toBe(190); // 100 + 90

    // 3. Aplicar descuento
    const discount = 10;

    // 4. Calcular IGV (18%)
    const igv = (totalPrice - discount) * 0.18;
    expect(igv).toBeCloseTo(32.4, 2); // (190 - 10) × 0.18

    // 5. Calcular monto final
    const finalAmount = totalPrice - discount + igv;
    expect(finalAmount).toBeCloseTo(212.4, 2); // 190 - 10 + 32.4

    // 6. Aplicar adelanto
    const advance = 100;

    // 7. Calcular saldo pendiente
    const remainingBalance = finalAmount - advance;
    expect(remainingBalance).toBeCloseTo(112.4, 2); // 212.4 - 100

    // 8. Determinar estado de pago
    const paymentStatus = remainingBalance <= 0 ? 'PAGADO' : advance > 0 ? 'PARCIAL' : 'PENDIENTE';
    expect(paymentStatus).toBe('PARCIAL');
  });
});

// =====================================================================
// EJEMPLO 3: Transformar Modelo UI a BD
// =====================================================================

describe('Ejemplo: Transformar Orden UI a Base de Datos', () => {
  it('debería transformar OrderFormModel a Order y OrderDetail[]', () => {
    // 1. Crear modelo del formulario (UI)
    const formModel: OrderFormModel = {
      // Información de empresa
      companyName: 'LASER COLOR VELOZ',
      socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
      ruc: '20607873411',
      address: 'JR. ORBEGOSO 243 PISO 1 STAND 243',

      // Referencias visibles
      orderNumber: 1001,
      employeeName: 'Carlos Pérez',
      customerName: 'Ana María García',

      // Fechas
      createdAt: new Date('2026-01-28T10:00:00Z'),
      printDate: new Date('2026-01-28T10:00:00Z'),

      // Items
      items: [
        {
          category: 'Banner',
          size: 'A4',
          type: 'Full Color',
          machine: 'HP Latex',
          quantity: 5,
          price: 20,
          total: 100,
        },
      ],

      // Totales
      totalPrice: 100,
      discount: 0,
      igv: 18, // 18%
      finalAmount: 118,
      advance: 50,
      remainingBalance: 68,
    };

    // 2. IDs de referencias (obtenidos de búsqueda)
    const customerId = '123e4567-e89b-12d3-a456-426614174000';
    const employeeId = '123e4567-e89b-12d3-a456-426614174001';
    const shopId = '123e4567-e89b-12d3-a456-426614174002';

    // 3. Transformar a Order (sales.orders)
    const order = OrderTransformer.toOrder(formModel, customerId, employeeId, shopId);

    // 4. Verificar datos de orden
    expect(order.customer_id).toBe(customerId);
    expect(order.employee_id).toBe(employeeId);
    expect(order.shop_id).toBe(shopId);
    expect(order.total_price).toBe(100);
    expect(order.discount).toBe(0);
    expect(order.igv).toBe(18);
    expect(order.final_amount).toBe(118);
    expect(order.advance).toBe(50);
    expect(order.remaining_balance).toBe(68);
    expect(order.payment_status).toBe('PARCIAL');

    // 5. Transformar a OrderDetail[] (sales.order_details)
    const orderDetails = OrderTransformer.toOrderDetails(formModel.items);

    // 6. Verificar detalles de orden
    expect(orderDetails).toHaveLength(1);
    expect(orderDetails[0].quantity).toBe(5);
    expect(orderDetails[0].unit_price).toBe(20);
    expect(orderDetails[0].subtotal).toBe(100);
    expect(orderDetails[0].description).toContain('Banner');
  });
});

// =====================================================================
// EJEMPLO 4: Validar Constraints SQL
// =====================================================================

describe('Ejemplo: Validar Constraints de Base de Datos', () => {
  it('debería rechazar descuento mayor al total', () => {
    const totalPrice = 100;
    const discount = 150; // ❌ Inválido

    // Constraint: discount >= 0 AND discount <= total_price
    const isValid = discount >= 0 && discount <= totalPrice;

    expect(isValid).toBe(false);
  });

  it('debería rechazar adelanto mayor al monto final', () => {
    const finalAmount = 118;
    const advance = 200; // ❌ Inválido

    // Constraint: advance >= 0 AND advance <= final_amount
    const isValid = advance >= 0 && advance <= finalAmount;

    expect(isValid).toBe(false);
  });

  it('debería validar saldo pendiente no-negativo', () => {
    const finalAmount = 118;
    const advance = 118;

    const remainingBalance = finalAmount - advance;

    // Constraint: remaining_balance >= 0
    expect(remainingBalance).toBeGreaterThanOrEqual(0);
    expect(remainingBalance).toBe(0);
  });

  it('debería validar estados de pago permitidos', () => {
    const allowedStatuses = ['PENDIENTE', 'PARCIAL', 'PAGADO'];

    // Constraint: payment_status IN ('PENDIENTE', 'PARCIAL', 'PAGADO')
    const testStatus = 'PARCIAL';
    expect(allowedStatuses).toContain(testStatus);

    // ❌ Estado inválido
    const invalidStatus = 'PROCESANDO';
    expect(allowedStatuses).not.toContain(invalidStatus);
  });
});

// =====================================================================
// EJEMPLO 5: Flujo Completo End-to-End
// =====================================================================

describe('Ejemplo: Flujo E2E de Creación de Orden', () => {
  it('debería ejecutar el flujo completo desde UI hasta BD', () => {
    // ===== PASO 1: Usuario crea items en el formulario =====

    const items: OrderItemModel[] = [
      OrderItemValidator.createEmpty(), // Item vacío inicial
    ];

    // Usuario completa el primer item
    items[0] = {
      category: 'Banner',
      size: 'A4',
      type: 'Full Color',
      machine: 'HP Latex',
      description: 'Banner promocional',
      quantity: 10,
      price: 15,
      total: 0, // Se calculará
    };

    // Calcular subtotal automáticamente
    items[0].total = OrderItemValidator.calculateSubtotal(items[0]);
    expect(items[0].total).toBe(150);

    // Usuario agrega segundo item
    items.push({
      category: 'Lona',
      size: 'Custom',
      type: 'Impreso',
      machine: 'Roland',
      quantity: 2,
      price: 50,
      total: 100,
    });

    // ===== PASO 2: Validar todos los items =====

    const allItemsValid = items.every((item) => OrderItemValidator.validate(item).isComplete);
    expect(allItemsValid).toBe(true);

    // ===== PASO 3: Calcular totales =====

    const totalPrice = items.reduce((sum, item) => sum + item.total, 0);
    expect(totalPrice).toBe(250); // 150 + 100

    const discount = 10;
    const includeIGV = true;
    const igv = includeIGV ? (totalPrice - discount) * 0.18 : 0;
    const finalAmount = totalPrice - discount + igv;
    const advance = 100;
    const remainingBalance = finalAmount - advance;

    expect(igv).toBeCloseTo(43.2, 2); // (250 - 10) × 0.18
    expect(finalAmount).toBeCloseTo(283.2, 2); // 250 - 10 + 43.2
    expect(remainingBalance).toBeCloseTo(183.2, 2); // 283.2 - 100

    // ===== PASO 4: Crear modelo del formulario =====

    const formModel: OrderFormModel = {
      companyName: 'LASER COLOR VELOZ',
      socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
      ruc: '20607873411',
      address: 'JR. ORBEGOSO 243',
      employeeName: 'Juan Pérez',
      customerName: 'María García',
      createdAt: new Date(),
      printDate: new Date(),
      items,
      totalPrice,
      discount,
      igv,
      finalAmount,
      advance,
      remainingBalance,
    };

    // ===== PASO 5: Transformar a modelos de BD =====

    const order = OrderTransformer.toOrder(
      formModel,
      'customer-uuid',
      'employee-uuid',
      'shop-uuid',
    );

    const orderDetails = OrderTransformer.toOrderDetails(items);

    // ===== PASO 6: Verificar datos listos para INSERT =====

    expect(order.total_price).toBe(250);
    expect(order.final_amount).toBeCloseTo(283.2, 2);
    expect(order.payment_status).toBe('PARCIAL');
    expect(orderDetails).toHaveLength(2);

    // ✅ Datos listos para guardar en Supabase:
    // await supabase.from('orders').insert(order)
    // await supabase.from('order_details').insert(orderDetails)
  });
});

// =====================================================================
// EJEMPLO 6: Testing de Edge Cases
// =====================================================================

describe('Ejemplo: Edge Cases y Casos Límite', () => {
  it('debería manejar orden con descuento igual al total', () => {
    const totalPrice = 100;
    const discount = 100; // Descuento completo

    const igv = (totalPrice - discount) * 0.18;
    const finalAmount = totalPrice - discount + igv;

    expect(igv).toBe(0);
    expect(finalAmount).toBe(0);
  });

  it('debería manejar cantidades decimales', () => {
    const item: OrderItemModel = {
      category: 'Tela',
      size: 'Metro',
      quantity: 2.5, // Cantidad decimal
      price: 10.5,
      total: 0,
    };

    item.total = OrderItemValidator.calculateSubtotal(item);
    expect(item.total).toBe(26.25); // 2.5 × 10.50
  });

  it('debería manejar precios muy pequeños', () => {
    const item: OrderItemModel = {
      category: 'Sticker',
      size: 'Pequeño',
      quantity: 1000,
      price: 0.05, // 5 céntimos
      total: 0,
    };

    item.total = OrderItemValidator.calculateSubtotal(item);
    expect(item.total).toBe(50); // 1000 × 0.05
  });

  it('debería manejar array vacío de items', () => {
    const items: OrderItemModel[] = [];
    const totalPrice = items.reduce((sum, item) => sum + item.total, 0);

    expect(totalPrice).toBe(0);
  });
});

// =====================================================================
// PLANTILLA: Agregar Nueva Prueba
// =====================================================================

describe('Plantilla: Nueva Funcionalidad', () => {
  it('debería [descripción de lo que se prueba]', () => {
    // 1. Arrange (Preparar)
    // Crear datos de prueba, configurar mocks, etc.

    // 2. Act (Actuar)
    // Ejecutar la función/método que se está probando

    // 3. Assert (Verificar)
    // Verificar que el resultado sea el esperado

    expect(true).toBe(true);
  });
});
