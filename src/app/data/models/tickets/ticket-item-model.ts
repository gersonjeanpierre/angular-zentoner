/**
 * Modelo de item de ticket (solo UI)
 * Representa un producto/servicio en el ticket visual
 * Se transforma a OrderDetail al guardar en BD
 */
export interface TicketItemModel {
  // Campos para UI del ticket
  category?: string;
  size?: string;
  type?: string;
  machine?: string;

  // Campos de negocio
  description?: string;
  quantity: number;
  price: number; // Precio unitario
  total: number; // Subtotal calculado (quantity * price)
}

/**
 * Extensión del modelo para validación de datos
 */
export interface TicketItemValidation {
  hasCategory: boolean;
  hasSize: boolean;
  hasValidQuantity: boolean;
  hasValidPrice: boolean;
}
