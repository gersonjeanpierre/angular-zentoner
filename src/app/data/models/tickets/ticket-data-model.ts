import { TicketItemModel } from './ticket-item-model';
import { Order, OrderDetail } from './order-model';

/**
 * Modelo de datos del Ticket (SOLO UI)
 * Representa la vista visual del ticket de imprenta
 * NO se guarda directamente en la BD
 * Se transforma a Order + OrderDetail[] para persistencia
 */
export interface TicketDataModel {
  // Información de la empresa (estática en UI)
  companyName: string;
  socialReason: string;
  ruc: string;
  address: string;

  // Información de la transacción (UI)
  id?: string;
  correlative?: number;
  designer: string; // Nombre visible en UI
  customer: string; // Nombre visible en UI
  creationDate: Date;
  printDate: Date;

  // Detalles de venta (UI)
  saleDetails: TicketItemModel[];

  // Totales calculados (sincronizados con nuevo schema POS)
  totalPrice: number; // Suma de subtotales de items
  discount: number; // Descuento aplicado
  advance: number; // Anticipo/Adelanto
  igv: number; // IGV calculado
  saldo: number; // remaining_balance (final_amount - advance)
  finalAmount: number; // Monto final con IGV y descuento
}

/**
 * Clase Helper para transformar Ticket UI a modelos de BD
 */
export class TicketTransformer {
  /**
   * Convierte TicketDataModel a Order para persistencia
   */
  static toOrder(
    ticket: TicketDataModel,
    customerId: string,
    employeeId: string,
    shopId: string,
    statusId: number = 1,
  ): Order {
    return {
      customer_id: customerId,
      employee_id: employeeId,
      shop_id: shopId,
      status_id: statusId,

      // Campos financieros según nuevo schema POS
      total_price: ticket.totalPrice,
      discount: ticket.discount,
      igv: ticket.igv,
      final_amount: ticket.finalAmount,

      // Control de pagos
      advance: ticket.advance,
      remaining_balance: ticket.saldo,
      payment_status: 'PENDIENTE', // Default al crear
    };
  }

  /**
   * Convierte TicketItemModel[] a OrderDetail[] para persistencia
   */
  static toOrderDetails(items: TicketItemModel[]): OrderDetail[] {
    return items.map((item) => ({
      description: this.buildDescription(item),
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.total,
      is_custom_size: this.isCustomSize(item),
      production_notes: this.buildProductionNotes(item),
      // item_id se deja como undefined (opcional)
    }));
  }

  /**
   * Construye descripción legible del item
   */
  private static buildDescription(item: TicketItemModel): string {
    const parts = [
      item.category,
      item.type,
      item.size ? `Tamaño: ${item.size}` : null,
      item.description,
    ].filter(Boolean);

    return parts.join(' - ') || 'Sin descripción';
  }

  /**
   * Determina si es tamaño personalizado
   */
  private static isCustomSize(item: TicketItemModel): boolean {
    // Tamaños personalizados son numéricos (ej: 1.5, 3.2)
    if (!item.size) return false;
    return !isNaN(parseFloat(item.size));
  }

  /**
   * Construye notas de producción
   */
  private static buildProductionNotes(item: TicketItemModel): string {
    const notes: string[] = [];

    if (item.machine) {
      notes.push(`Máquina: ${item.machine}`);
    }

    if (item.category) {
      notes.push(`Categoría: ${item.category}`);
    }

    return notes.join(' | ');
  }
}
