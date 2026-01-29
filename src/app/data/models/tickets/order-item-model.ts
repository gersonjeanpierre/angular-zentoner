/**
 * Modelo de item de orden (solo UI)
 *
 * Representa un producto/servicio en el formulario de creación de orden.
 * Se transforma a OrderDetail al guardar en la base de datos.
 *
 * @see OrderDetail - Modelo de BD en sales.order_details
 */
export interface OrderItemModel {
  // === Clasificación del Producto ===
  category?: string; // Categoría de impresión (Lona, Banner, Stickers, etc.)
  size?: string; // Tamaño (A4, A3, Custom, etc.)
  type?: string; // Tipo de producto
  machine?: string; // Máquina a utilizar

  // === Campos de Negocio ===
  description?: string; // Descripción adicional del item
  quantity: number; // Cantidad de unidades
  price: number; // Precio unitario (unit_price)
  total: number; // Subtotal calculado (quantity × price)
}

/**
 * Validación de item de orden
 *
 * Helper para validar que un item tenga los datos mínimos requeridos
 */
export interface OrderItemValidation {
  hasCategory: boolean;
  hasSize: boolean;
  hasValidQuantity: boolean; // quantity > 0
  hasValidPrice: boolean; // price > 0
  isComplete: boolean; // Todos los checks en true
}

/**
 * Funciones helper para validación de items
 */
export class OrderItemValidator {
  /**
   * Valida un item de orden
   */
  static validate(item: OrderItemModel): OrderItemValidation {
    const hasCategory = Boolean(item.category && item.category.trim());
    const hasSize = Boolean(item.size && item.size.trim());
    const hasValidQuantity = item.quantity > 0;
    const hasValidPrice = item.price > 0;

    return {
      hasCategory,
      hasSize,
      hasValidQuantity,
      hasValidPrice,
      isComplete: hasCategory && hasSize && hasValidQuantity && hasValidPrice,
    };
  }

  /**
   * Calcula el subtotal de un item
   */
  static calculateSubtotal(item: OrderItemModel): number {
    return item.quantity * item.price;
  }

  /**
   * Crea un item vacío con valores por defecto
   */
  static createEmpty(): OrderItemModel {
    return {
      category: '',
      size: '',
      type: '',
      machine: '',
      description: '',
      quantity: 1,
      price: 0,
      total: 0,
    };
  }
}
