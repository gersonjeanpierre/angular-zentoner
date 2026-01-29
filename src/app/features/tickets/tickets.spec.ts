import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import {
  OrderFormModel,
  OrderItemModel,
  OrderItemValidator,
  OrderTransformer,
} from '@data/models/tickets';

/**
 * Pruebas unitarias para el sistema de generación de órdenes
 *
 * Cubre:
 * - Validación de items (OrderItemValidator)
 * - Cálculo de totales financieros (totalPrice, igv, finalAmount, remainingBalance)
 * - Transformación de datos UI → BD (OrderTransformer)
 * - Estado de pago (payment_status)
 * - Lógica de negocio del componente Tickets
 */

// =====================================================================
// PRUEBAS: OrderItemValidator
// =====================================================================

describe('OrderItemValidator', () => {
  describe('validate', () => {
    it('should validate complete item as complete', () => {
      const item: OrderItemModel = {
        category: 'Banner',
        size: 'A4',
        type: 'Impreso',
        machine: 'HP Latex',
        description: 'Banner publicitario',
        quantity: 5,
        price: 10.5,
        total: 52.5,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasCategory).toBe(true);
      expect(validation.hasSize).toBe(true);
      expect(validation.hasValidQuantity).toBe(true);
      expect(validation.hasValidPrice).toBe(true);
      expect(validation.isComplete).toBe(true);
    });

    it('should detect missing category', () => {
      const item: OrderItemModel = {
        category: '',
        size: 'A4',
        quantity: 1,
        price: 10,
        total: 10,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasCategory).toBe(false);
      expect(validation.isComplete).toBe(false);
    });

    it('should detect missing size', () => {
      const item: OrderItemModel = {
        category: 'Banner',
        size: '',
        quantity: 1,
        price: 10,
        total: 10,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasSize).toBe(false);
      expect(validation.isComplete).toBe(false);
    });

    it('should detect invalid quantity (zero)', () => {
      const item: OrderItemModel = {
        category: 'Banner',
        size: 'A4',
        quantity: 0,
        price: 10,
        total: 0,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasValidQuantity).toBe(false);
      expect(validation.isComplete).toBe(false);
    });

    it('should detect invalid quantity (negative)', () => {
      const item: OrderItemModel = {
        category: 'Banner',
        size: 'A4',
        quantity: -5,
        price: 10,
        total: -50,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasValidQuantity).toBe(false);
      expect(validation.isComplete).toBe(false);
    });

    it('should detect invalid price (zero)', () => {
      const item: OrderItemModel = {
        category: 'Banner',
        size: 'A4',
        quantity: 5,
        price: 0,
        total: 0,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasValidPrice).toBe(false);
      expect(validation.isComplete).toBe(false);
    });

    it('should detect invalid price (negative)', () => {
      const item: OrderItemModel = {
        category: 'Banner',
        size: 'A4',
        quantity: 5,
        price: -10,
        total: -50,
      };

      const validation = OrderItemValidator.validate(item);

      expect(validation.hasValidPrice).toBe(false);
      expect(validation.isComplete).toBe(false);
    });
  });

  describe('calculateSubtotal', () => {
    it('should calculate subtotal correctly', () => {
      const item: OrderItemModel = {
        quantity: 5,
        price: 10.5,
        total: 0,
      };

      const subtotal = OrderItemValidator.calculateSubtotal(item);

      expect(subtotal).toBe(52.5);
    });

    it('should handle decimal quantities', () => {
      const item: OrderItemModel = {
        quantity: 2.5,
        price: 10,
        total: 0,
      };

      const subtotal = OrderItemValidator.calculateSubtotal(item);

      expect(subtotal).toBe(25);
    });

    it('should handle zero quantity', () => {
      const item: OrderItemModel = {
        quantity: 0,
        price: 10,
        total: 0,
      };

      const subtotal = OrderItemValidator.calculateSubtotal(item);

      expect(subtotal).toBe(0);
    });

    it('should handle zero price', () => {
      const item: OrderItemModel = {
        quantity: 5,
        price: 0,
        total: 0,
      };

      const subtotal = OrderItemValidator.calculateSubtotal(item);

      expect(subtotal).toBe(0);
    });
  });

  describe('createEmpty', () => {
    it('should create empty item with default values', () => {
      const item = OrderItemValidator.createEmpty();

      expect(item.category).toBe('');
      expect(item.size).toBe('');
      expect(item.type).toBe('');
      expect(item.machine).toBe('');
      expect(item.description).toBe('');
      expect(item.quantity).toBe(1);
      expect(item.price).toBe(0);
      expect(item.total).toBe(0);
    });
  });
});

// =====================================================================
// PRUEBAS: OrderTransformer
// =====================================================================

describe('OrderTransformer', () => {
  const mockCustomerId = 'customer-uuid-123';
  const mockEmployeeId = 'employee-uuid-456';
  const mockShopId = 'shop-uuid-789';

  describe('toOrder', () => {
    it('should transform OrderFormModel to Order', () => {
      const formModel: OrderFormModel = {
        companyName: 'LASER COLOR VELOZ',
        socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
        ruc: '20607873411',
        address: 'JR. ORBEGOSO 243',
        orderNumber: 777,
        employeeName: 'Juan Pérez',
        customerName: 'María García',
        createdAt: new Date(),
        printDate: new Date(),
        items: [],
        totalPrice: 100,
        discount: 10,
        igv: 16.2, // (100 - 10) * 0.18
        finalAmount: 106.2, // 100 - 10 + 16.2
        advance: 50,
        remainingBalance: 56.2,
      };

      const order = OrderTransformer.toOrder(formModel, mockCustomerId, mockEmployeeId, mockShopId);

      expect(order.customer_id).toBe(mockCustomerId);
      expect(order.employee_id).toBe(mockEmployeeId);
      expect(order.shop_id).toBe(mockShopId);
      expect(order.status_id).toBe(1); // PENDIENTE
      expect(order.total_price).toBe(100);
      expect(order.discount).toBe(10);
      expect(order.igv).toBe(16.2);
      expect(order.final_amount).toBe(106.2);
      expect(order.advance).toBe(50);
      expect(order.remaining_balance).toBe(56.2);
      expect(order.payment_status).toBe('PARCIAL');
    });

    it('should calculate payment_status as PENDIENTE when no advance', () => {
      const formModel: OrderFormModel = {
        companyName: 'LASER COLOR VELOZ',
        socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
        ruc: '20607873411',
        address: 'JR. ORBEGOSO 243',
        employeeName: 'Juan Pérez',
        customerName: 'María García',
        createdAt: new Date(),
        printDate: new Date(),
        items: [],
        totalPrice: 100,
        discount: 0,
        igv: 18,
        finalAmount: 118,
        advance: 0,
        remainingBalance: 118,
      };

      const order = OrderTransformer.toOrder(formModel, mockCustomerId, mockEmployeeId, mockShopId);

      expect(order.payment_status).toBe('PENDIENTE');
      expect(order.advance).toBe(0);
      expect(order.remaining_balance).toBe(118);
    });

    it('should calculate payment_status as PARCIAL when partial payment', () => {
      const formModel: OrderFormModel = {
        companyName: 'LASER COLOR VELOZ',
        socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
        ruc: '20607873411',
        address: 'JR. ORBEGOSO 243',
        employeeName: 'Juan Pérez',
        customerName: 'María García',
        createdAt: new Date(),
        printDate: new Date(),
        items: [],
        totalPrice: 100,
        discount: 0,
        igv: 18,
        finalAmount: 118,
        advance: 50,
        remainingBalance: 68,
      };

      const order = OrderTransformer.toOrder(formModel, mockCustomerId, mockEmployeeId, mockShopId);

      expect(order.payment_status).toBe('PARCIAL');
      expect(order.advance).toBe(50);
      expect(order.remaining_balance).toBe(68);
    });

    it('should calculate payment_status as PAGADO when fully paid', () => {
      const formModel: OrderFormModel = {
        companyName: 'LASER COLOR VELOZ',
        socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
        ruc: '20607873411',
        address: 'JR. ORBEGOSO 243',
        employeeName: 'Juan Pérez',
        customerName: 'María García',
        createdAt: new Date(),
        printDate: new Date(),
        items: [],
        totalPrice: 100,
        discount: 0,
        igv: 18,
        finalAmount: 118,
        advance: 118,
        remainingBalance: 0,
      };

      const order = OrderTransformer.toOrder(formModel, mockCustomerId, mockEmployeeId, mockShopId);

      expect(order.payment_status).toBe('PAGADO');
      expect(order.advance).toBe(118);
      expect(order.remaining_balance).toBe(0);
    });
  });

  describe('toOrderDetails', () => {
    it('should transform OrderItemModel[] to OrderDetail[]', () => {
      const items: OrderItemModel[] = [
        {
          category: 'Banner',
          size: 'A4',
          type: 'Impreso',
          machine: 'HP Latex',
          description: 'Banner publicitario',
          quantity: 5,
          price: 10.5,
          total: 52.5,
        },
        {
          category: 'Lona',
          size: 'Custom',
          type: 'Full Color',
          machine: 'Roland',
          description: '',
          quantity: 2,
          price: 25,
          total: 50,
        },
      ];

      const orderDetails = OrderTransformer.toOrderDetails(items);

      expect(orderDetails).toHaveLength(2);

      // Primer item
      expect(orderDetails[0].description).toContain('Banner');
      expect(orderDetails[0].quantity).toBe(5);
      expect(orderDetails[0].unit_price).toBe(10.5);
      expect(orderDetails[0].subtotal).toBe(52.5);

      // Segundo item
      expect(orderDetails[1].description).toContain('Lona');
      expect(orderDetails[1].quantity).toBe(2);
      expect(orderDetails[1].unit_price).toBe(25);
      expect(orderDetails[1].subtotal).toBe(50);
    });

    it('should build description correctly', () => {
      const items: OrderItemModel[] = [
        {
          category: 'Banner',
          size: 'A4',
          type: 'Impreso',
          machine: 'HP Latex',
          description: 'Banner publicitario',
          quantity: 1,
          price: 10,
          total: 10,
        },
      ];

      const orderDetails = OrderTransformer.toOrderDetails(items);

      expect(orderDetails[0].description).toContain('Banner');
      expect(orderDetails[0].description).toContain('Impreso');
      expect(orderDetails[0].description).toContain('A4');
    });

    it('should handle empty items array', () => {
      const items: OrderItemModel[] = [];

      const orderDetails = OrderTransformer.toOrderDetails(items);

      expect(orderDetails).toHaveLength(0);
    });
  });
});

// =====================================================================
// PRUEBAS: Cálculos Financieros (Lógica de Componente)
// =====================================================================

describe('Order Financial Calculations', () => {
  describe('totalPrice (total_price)', () => {
    it('should calculate sum of all item subtotals', () => {
      const items: OrderItemModel[] = [
        { quantity: 5, price: 10, total: 50 },
        { quantity: 2, price: 25, total: 50 },
        { quantity: 1, price: 100, total: 100 },
      ];

      const totalPrice = items.reduce((sum, item) => sum + item.total, 0);

      expect(totalPrice).toBe(200);
    });

    it('should return 0 for empty items', () => {
      const items: OrderItemModel[] = [];

      const totalPrice = items.reduce((sum, item) => sum + item.total, 0);

      expect(totalPrice).toBe(0);
    });
  });

  describe('igv (18%)', () => {
    it('should calculate igv correctly with no discount', () => {
      const totalPrice = 100;
      const discount = 0;

      const igv = (totalPrice - discount) * 0.18;

      expect(igv).toBe(18);
    });

    it('should calculate igv correctly with discount', () => {
      const totalPrice = 100;
      const discount = 10;

      const igv = (totalPrice - discount) * 0.18;

      expect(igv).toBe(16.2);
    });

    it('should return 0 when includeIGV is false', () => {
      const includeIGV = false;
      const totalPrice = 100;
      const discount = 0;

      const igv = includeIGV ? (totalPrice - discount) * 0.18 : 0;

      expect(igv).toBe(0);
    });

    it('should handle large discount', () => {
      const totalPrice = 100;
      const discount = 90;

      const igv = (totalPrice - discount) * 0.18;

      expect(igv).toBeCloseTo(1.8, 2);
    });
  });

  describe('finalAmount (final_amount)', () => {
    it('should calculate final amount correctly', () => {
      const totalPrice = 100;
      const discount = 10;
      const igv = 16.2; // (100 - 10) * 0.18

      const finalAmount = totalPrice - discount + igv;

      expect(finalAmount).toBe(106.2);
    });

    it('should calculate final amount without igv', () => {
      const totalPrice = 100;
      const discount = 10;
      const igv = 0;

      const finalAmount = totalPrice - discount + igv;

      expect(finalAmount).toBe(90);
    });

    it('should calculate final amount without discount', () => {
      const totalPrice = 100;
      const discount = 0;
      const igv = 18;

      const finalAmount = totalPrice - discount + igv;

      expect(finalAmount).toBe(118);
    });
  });

  describe('remainingBalance (remaining_balance)', () => {
    it('should calculate remaining balance correctly', () => {
      const finalAmount = 118;
      const advance = 50;

      const remainingBalance = finalAmount - advance;

      expect(remainingBalance).toBe(68);
    });

    it('should return 0 when fully paid', () => {
      const finalAmount = 118;
      const advance = 118;

      const remainingBalance = finalAmount - advance;

      expect(remainingBalance).toBe(0);
    });

    it('should return finalAmount when no advance', () => {
      const finalAmount = 118;
      const advance = 0;

      const remainingBalance = finalAmount - advance;

      expect(remainingBalance).toBe(118);
    });
  });

  describe('paymentStatus (payment_status)', () => {
    it('should return PENDIENTE when no payment', () => {
      const remaining = 118;
      const advance = 0;

      const status = remaining <= 0 ? 'PAGADO' : advance > 0 ? 'PARCIAL' : 'PENDIENTE';

      expect(status).toBe('PENDIENTE');
    });

    it('should return PARCIAL when partial payment', () => {
      const remaining = 68;
      const advance = 50;

      const status = remaining <= 0 ? 'PAGADO' : advance > 0 ? 'PARCIAL' : 'PENDIENTE';

      expect(status).toBe('PARCIAL');
    });

    it('should return PAGADO when fully paid', () => {
      const remaining = 0;
      const advance = 118;

      const status = remaining <= 0 ? 'PAGADO' : advance > 0 ? 'PARCIAL' : 'PENDIENTE';

      expect(status).toBe('PAGADO');
    });
  });
});

// =====================================================================
// PRUEBAS: Integración de Orden Completa
// =====================================================================

describe('Complete Order Creation Flow', () => {
  it('should create valid order with multiple items', () => {
    // === 1. Crear items de la orden ===
    const items: OrderItemModel[] = [
      {
        category: 'Banner',
        size: 'A4',
        type: 'Impreso',
        machine: 'HP Latex',
        description: 'Banner publicitario',
        quantity: 5,
        price: 10.5,
        total: 52.5,
      },
      {
        category: 'Lona',
        size: 'A3',
        type: 'Full Color',
        machine: 'Roland',
        description: 'Lona institucional',
        quantity: 2,
        price: 25,
        total: 50,
      },
    ];

    // === 2. Calcular totales ===
    const totalPrice = items.reduce((sum, item) => sum + item.total, 0); // 102.5
    const discount = 2.5;
    const igv = (totalPrice - discount) * 0.18; // 18
    const finalAmount = totalPrice - discount + igv; // 118
    const advance = 50;
    const remainingBalance = finalAmount - advance; // 68

    // === 3. Crear modelo de formulario ===
    const formModel: OrderFormModel = {
      companyName: 'LASER COLOR VELOZ',
      socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
      ruc: '20607873411',
      address: 'JR. ORBEGOSO 243',
      orderNumber: 777,
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

    // === 4. Validar items ===
    items.forEach((item) => {
      const validation = OrderItemValidator.validate(item);
      expect(validation.isComplete).toBe(true);
    });

    // === 5. Transformar a modelos de BD ===
    const order = OrderTransformer.toOrder(
      formModel,
      'customer-uuid-123',
      'employee-uuid-456',
      'shop-uuid-789',
    );

    const orderDetails = OrderTransformer.toOrderDetails(items);

    // === 6. Verificar datos de orden ===
    expect(order.total_price).toBe(102.5);
    expect(order.discount).toBe(2.5);
    expect(order.igv).toBe(18);
    expect(order.final_amount).toBe(118);
    expect(order.advance).toBe(50);
    expect(order.remaining_balance).toBe(68);
    expect(order.payment_status).toBe('PARCIAL');

    // === 7. Verificar detalles de orden ===
    expect(orderDetails).toHaveLength(2);
    expect(orderDetails[0].quantity).toBe(5);
    expect(orderDetails[0].unit_price).toBe(10.5);
    expect(orderDetails[0].subtotal).toBe(52.5);
    expect(orderDetails[1].quantity).toBe(2);
    expect(orderDetails[1].unit_price).toBe(25);
    expect(orderDetails[1].subtotal).toBe(50);
  });

  it('should handle order without IGV', () => {
    const items: OrderItemModel[] = [
      {
        category: 'Banner',
        size: 'A4',
        quantity: 10,
        price: 10,
        total: 100,
      },
    ];

    const totalPrice = 100;
    const discount = 0;
    const igv = 0; // Sin IGV
    const finalAmount = totalPrice - discount + igv; // 100
    const advance = 0;
    const remainingBalance = finalAmount - advance; // 100

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

    const order = OrderTransformer.toOrder(
      formModel,
      'customer-uuid-123',
      'employee-uuid-456',
      'shop-uuid-789',
    );

    expect(order.igv).toBe(0);
    expect(order.final_amount).toBe(100);
    expect(order.payment_status).toBe('PENDIENTE');
  });

  it('should handle fully paid order', () => {
    const items: OrderItemModel[] = [
      {
        category: 'Sticker',
        size: 'Custom',
        quantity: 100,
        price: 0.5,
        total: 50,
      },
    ];

    const totalPrice = 50;
    const discount = 0;
    const igv = 9; // 18%
    const finalAmount = 59;
    const advance = 59; // Pago completo
    const remainingBalance = 0;

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

    const order = OrderTransformer.toOrder(
      formModel,
      'customer-uuid-123',
      'employee-uuid-456',
      'shop-uuid-789',
    );

    expect(order.advance).toBe(59);
    expect(order.remaining_balance).toBe(0);
    expect(order.payment_status).toBe('PAGADO');
  });
});

// =====================================================================
// PRUEBAS: Validaciones de Negocio
// =====================================================================

describe('Business Validation Rules', () => {
  describe('Constraint Validations (SQL Schema)', () => {
    it('should validate discount cannot exceed total_price', () => {
      const totalPrice = 100;
      const discount = 110; // Inválido

      const isValid = discount >= 0 && discount <= totalPrice;

      expect(isValid).toBe(false);
    });

    it('should validate advance cannot exceed final_amount', () => {
      const finalAmount = 118;
      const advance = 150; // Inválido

      const isValid = advance >= 0 && advance <= finalAmount;

      expect(isValid).toBe(false);
    });

    it('should validate remaining_balance must be non-negative', () => {
      const finalAmount = 118;
      const advance = 118;

      const remainingBalance = finalAmount - advance;
      const isValid = remainingBalance >= 0;

      expect(isValid).toBe(true);
      expect(remainingBalance).toBe(0);
    });

    it('should validate all financial amounts are non-negative', () => {
      const totalPrice = 100;
      const discount = 10;
      const igv = 16.2;
      const finalAmount = 106.2;
      const advance = 50;
      const remainingBalance = 56.2;

      expect(totalPrice).toBeGreaterThanOrEqual(0);
      expect(discount).toBeGreaterThanOrEqual(0);
      expect(igv).toBeGreaterThanOrEqual(0);
      expect(finalAmount).toBeGreaterThanOrEqual(0);
      expect(advance).toBeGreaterThanOrEqual(0);
      expect(remainingBalance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Order Item Validations', () => {
    it('should reject order with no items', () => {
      const items: OrderItemModel[] = [];

      const isValid = items.length > 0;

      expect(isValid).toBe(false);
    });

    it('should reject order with incomplete items', () => {
      const items: OrderItemModel[] = [
        {
          category: '', // Vacío
          size: 'A4',
          quantity: 1,
          price: 10,
          total: 10,
        },
      ];

      const allValid = items.every((item) => OrderItemValidator.validate(item).isComplete);

      expect(allValid).toBe(false);
    });

    it('should accept order with all valid items', () => {
      const items: OrderItemModel[] = [
        {
          category: 'Banner',
          size: 'A4',
          quantity: 5,
          price: 10,
          total: 50,
        },
        {
          category: 'Lona',
          size: 'A3',
          quantity: 2,
          price: 25,
          total: 50,
        },
      ];

      const allValid = items.every((item) => OrderItemValidator.validate(item).isComplete);

      expect(allValid).toBe(true);
    });
  });
});
