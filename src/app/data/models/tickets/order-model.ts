/**
 * Modelo de Orden (Base de Datos)
 * Representa la cabecera de una orden en sales.orders
 * Se genera desde TicketDataModel al guardar
 */
export interface Order {
  id?: string; // UUID generado por BD
  order_number?: number; // Autoincremental generado por BD
  customer_id: string; // FK a sales.customers (requerido)
  employee_id: string; // FK a hr.employees (diseñador, requerido)
  shop_id: string; // FK a core.shops (requerido)
  status_id: number; // FK a sales.order_status (default: 1 - Pendiente)
  total_amount: number; // Total final con IGV y descuentos
  tax_amount: number; // Monto del IGV (18%)
  created_at?: string; // Timestamp generado por BD
  updated_at?: string; // Timestamp actualizado por BD
}

/**
 * Modelo de Detalle de Orden (Base de Datos)
 * Representa cada producto/servicio en sales.order_details
 * Se genera desde TicketItemModel[] al guardar
 */
export interface OrderDetail {
  id?: string; // UUID generado por BD
  order_id?: string; // FK a sales.orders (asignado al insertar)
  item_id?: string | null; // FK a inventory.items (opcional - trabajos custom)

  // Información del producto/servicio
  description: string; // Descripción completa del trabajo
  quantity: number; // Cantidad solicitada
  unit_price: number; // Precio unitario
  subtotal: number; // quantity * unit_price

  // Dimensiones personalizadas (para trabajos custom)
  is_custom_size: boolean;
  width_mm?: number | null;
  height_mm?: number | null;
  area_mm2?: number | null;

  // Metadatos adicionales
  attributes?: Record<string, unknown> | null; // JSON con atributos específicos
  production_notes?: string; // Notas para producción (máquina, acabados, etc.)
}

/**
 * Respuesta completa de orden con detalles
 * Usado en vistas y consultas JOIN
 */
export interface OrderWithDetails extends Order {
  details: OrderDetail[];
  // Información adicional de JOINs
  customerName?: string;
  employeeName?: string;
  statusName?: string;
}

/**
 * Estados de orden disponibles
 * Sincronizado con sales.order_status
 */
export enum OrderStatus {
  PENDIENTE = 1,
  EN_PRODUCCION = 2,
  COMPLETADO = 3,
  ENTREGADO = 4,
  CANCELADO = 5,
}
