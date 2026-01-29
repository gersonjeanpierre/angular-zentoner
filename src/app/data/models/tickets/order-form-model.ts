import { OrderItemModel } from './order-item-model';
import { Order, OrderDetail } from './order-model';

/**
 * Modelo de formulario para crear/editar órdenes (SOLO UI)
 *
 * Este modelo representa el estado del formulario en la interfaz.
 * NO se persiste directamente en la base de datos.
 *
 * Transformación: OrderFormModel → Order + OrderDetail[]
 *
 * @see Order - Modelo de base de datos
 * @see OrderDetail - Detalles de la orden en BD
 */
export interface OrderFormModel {
  // === Información de la Empresa (Estática) ===
  companyName: string;
  socialReason: string;
  ruc: string;
  address: string;

  // === Referencias (IDs se setean al guardar) ===
  id?: string;
  orderNumber?: number;
  employeeName: string; // Nombre visible del diseñador/vendedor
  customerName: string; // Nombre visible del cliente

  // === Fechas ===
  createdAt: Date;
  printDate: Date;

  // === Items de la Orden ===
  items: OrderItemModel[];

  // === Totales Calculados ===
  // Estos valores deben coincidir exactamente con el schema SQL
  totalPrice: number; // total_price: Suma de subtotales
  discount: number; // discount: Descuento aplicado
  igv: number; // igv: Impuesto calculado (18%)
  finalAmount: number; // final_amount: total_price - discount + igv
  advance: number; // advance: Anticipo/adelanto
  remainingBalance: number; // remaining_balance: final_amount - advance
}

/**
 * Transformer para convertir entre modelo UI y modelos de BD
 *
 * Sigue estrictamente el schema SQL de sales.orders y sales.order_details
 */
export class OrderTransformer {
  /**
   * Convierte OrderFormModel a Order para inserción en BD
   *
   * @param form - Modelo del formulario UI
   * @param customerId - UUID del cliente (obtenido de search)
   * @param employeeId - UUID del empleado (obtenido de search o auth)
   * @param shopId - UUID de la tienda (obtenido de auth)
   * @param statusId - ID del estado (default: 1 = PENDIENTE)
   * @returns Order - Objeto listo para INSERT
   */
  static toOrder(
    form: OrderFormModel,
    customerId: string,
    employeeId: string,
    shopId: string,
    statusId: number = 1,
  ): Order {
    return {
      // Referencias
      customer_id: customerId,
      employee_id: employeeId,
      shop_id: shopId,
      status_id: statusId,

      // Campos financieros (según 05_SALES.sql)
      total_price: form.totalPrice,
      discount: form.discount,
      igv: form.igv,
      final_amount: form.finalAmount,

      // Control de pagos
      advance: form.advance,
      remaining_balance: form.remainingBalance,
      payment_status: this.calculatePaymentStatus(form.finalAmount, form.advance),
    };
  }

  /**
   * Convierte OrderItemModel[] a OrderDetail[] para inserción en BD
   *
   * @param items - Items del formulario
   * @returns OrderDetail[] - Array listo para INSERT en sales.order_details
   */
  static toOrderDetails(items: OrderItemModel[]): OrderDetail[] {
    return items.map((item) => ({
      // item_id es opcional (puede ser null para items custom)
      item_id: undefined,

      // Descripción legible
      description: this.buildDescription(item),

      // Cantidades y precios
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.total,

      // Metadata de producción
      is_custom_size: this.isCustomSize(item),
      width_mm: this.extractWidth(item),
      height_mm: this.extractHeight(item),
      area_mm2: this.calculateArea(item),

      // Notas de producción
      production_notes: this.buildProductionNotes(item),

      // Atributos adicionales (JSON)
      attributes: this.buildAttributes(item),
    }));
  }

  // ========================================
  // Métodos Privados
  // ========================================

  /**
   * Calcula el payment_status según lógica del backend
   *
   * @see 05_SALES.sql - Constraint chk_payment_status
   */
  private static calculatePaymentStatus(
    finalAmount: number,
    advance: number,
  ): 'PENDIENTE' | 'PARCIAL' | 'PAGADO' {
    const remaining = finalAmount - advance;

    if (remaining <= 0) return 'PAGADO';
    if (advance > 0) return 'PARCIAL';
    return 'PENDIENTE';
  }

  /**
   * Construye descripción legible del item
   */
  private static buildDescription(item: OrderItemModel): string {
    const parts: string[] = [];

    if (item.category) parts.push(item.category);
    if (item.type) parts.push(item.type);
    if (item.size) parts.push(`Tamaño: ${item.size}`);
    if (item.description) parts.push(item.description);

    return parts.length > 0 ? parts.join(' - ') : 'Sin descripción';
  }

  /**
   * Determina si el item tiene tamaño personalizado
   */
  private static isCustomSize(item: OrderItemModel): boolean {
    // Si size es un número, es personalizado
    if (!item.size) return false;
    return !isNaN(parseFloat(item.size));
  }

  /**
   * Extrae ancho en mm (si es tamaño personalizado)
   */
  private static extractWidth(item: OrderItemModel): number | undefined {
    // Implementar según lógica de negocio
    return undefined;
  }

  /**
   * Extrae alto en mm (si es tamaño personalizado)
   */
  private static extractHeight(item: OrderItemModel): number | undefined {
    // Implementar según lógica de negocio
    return undefined;
  }

  /**
   * Calcula área en mm² (si es tamaño personalizado)
   */
  private static calculateArea(item: OrderItemModel): number | undefined {
    const width = this.extractWidth(item);
    const height = this.extractHeight(item);

    if (width && height) {
      return width * height;
    }

    return undefined;
  }

  /**
   * Construye notas de producción
   */
  private static buildProductionNotes(item: OrderItemModel): string {
    const notes: string[] = [];

    if (item.machine) {
      notes.push(`Máquina: ${item.machine}`);
    }

    if (item.category) {
      notes.push(`Categoría: ${item.category}`);
    }

    return notes.length > 0 ? notes.join(' | ') : '';
  }

  /**
   * Construye objeto JSON de atributos adicionales
   */
  private static buildAttributes(item: OrderItemModel): Record<string, unknown> | undefined {
    const attrs: Record<string, unknown> = {};

    if (item.category) attrs['category'] = item.category;
    if (item.type) attrs['type'] = item.type;
    if (item.size) attrs['size'] = item.size;
    if (item.machine) attrs['machine'] = item.machine;

    return Object.keys(attrs).length > 0 ? attrs : undefined;
  }
}
