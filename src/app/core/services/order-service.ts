import { Injectable, inject } from '@angular/core';
import { Order, OrderDetail } from '@data/models/tickets/order-model';
import { Supabase } from '@core/supabase/supabase';

export interface GetOrdersParams {
  statusId?: number;
  customerId?: string;
  employeeId?: string;
  shopId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface GetOrdersResponse {
  data: Order[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrderWithDetails extends Order {
  details: OrderDetail[];
  customerName?: string;
  employeeName?: string;
  statusName?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private supabaseClient = inject(Supabase).client;

  /**
   * Crear una nueva orden con sus detalles
   */
  async createOrder(order: Order, details: OrderDetail[]): Promise<string> {
    // Generar UUID para la orden
    const orderId = crypto.randomUUID();

    // Insertar la orden
    const { error: orderError } = await this.supabaseClient
      .schema('sales')
      .from('orders')
      .insert({
        id: orderId,
        customer_id: order.customer_id,
        employee_id: order.employee_id,
        shop_id: order.shop_id,
        status_id: order.status_id || 1,
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
      });

    if (orderError) {
      console.error('Error al crear orden:', orderError);
      throw orderError;
    }

    // Insertar los detalles
    if (details.length > 0) {
      const detailsToInsert = details.map((detail) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        item_id: detail.item_id,
        description: detail.description,
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        subtotal: detail.subtotal,
        is_custom_size: detail.is_custom_size,
        width_mm: detail.width_mm,
        height_mm: detail.height_mm,
        area_mm2: detail.area_mm2,
        attributes: detail.attributes,
        production_notes: detail.production_notes,
      }));

      const { error: detailsError } = await this.supabaseClient
        .schema('sales')
        .from('order_details')
        .insert(detailsToInsert);

      if (detailsError) {
        console.error('Error al crear detalles de orden:', detailsError);
        throw detailsError;
      }
    }

    return orderId;
  }

  /**
   * Obtener órdenes con filtros y paginación
   */
  async getOrders(params: GetOrdersParams = {}): Promise<GetOrdersResponse> {
    const {
      statusId,
      customerId,
      employeeId,
      shopId,
      search,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
    } = params;

    let query = this.supabaseClient
      .schema('sales')
      .from('orders')
      .select('*', { count: 'exact', head: false });

    // Filtros
    if (statusId) {
      query = query.eq('status_id', statusId);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    // Búsqueda por número de orden
    if (search && search.trim()) {
      const searchNum = parseInt(search.trim());
      if (!isNaN(searchNum)) {
        query = query.eq('order_number', searchNum);
      }
    }

    // Filtro por rango de fechas
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Ordenar por fecha de creación (más recientes primero)
    query = query.order('created_at', { ascending: false });

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener órdenes:', error);
      throw error;
    }

    return {
      data: data || [],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Obtener una orden con sus detalles
   */
  async getOrderById(orderId: string): Promise<OrderWithDetails | null> {
    // Obtener la orden
    const { data: order, error: orderError } = await this.supabaseClient
      .schema('sales')
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error al obtener orden:', orderError);
      throw orderError;
    }

    if (!order) return null;

    // Obtener los detalles
    const { data: details, error: detailsError } = await this.supabaseClient
      .schema('sales')
      .from('order_details')
      .select('*')
      .eq('order_id', orderId);

    if (detailsError) {
      console.error('Error al obtener detalles de orden:', detailsError);
      throw detailsError;
    }

    return {
      ...order,
      details: details || [],
    };
  }

  /**
   * Actualizar el estado de una orden
   */
  async updateOrderStatus(orderId: string, statusId: number): Promise<void> {
    const { error } = await this.supabaseClient
      .schema('sales')
      .from('orders')
      .update({ status_id: statusId })
      .eq('id', orderId);

    if (error) {
      console.error('Error al actualizar estado de orden:', error);
      throw error;
    }
  }

  /**
   * Actualizar una orden completa
   */
  async updateOrder(orderId: string, order: Partial<Order>): Promise<void> {
    const { error } = await this.supabaseClient
      .schema('sales')
      .from('orders')
      .update({
        customer_id: order.customer_id,
        employee_id: order.employee_id,
        shop_id: order.shop_id,
        status_id: order.status_id,
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error al actualizar orden:', error);
      throw error;
    }
  }

  /**
   * Eliminar una orden (soft delete si existe el campo)
   */
  async deleteOrder(orderId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .schema('sales')
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error('Error al eliminar orden:', error);
      throw error;
    }
  }

  /**
   * Obtener estados de orden disponibles
   */
  async getOrderStatuses() {
    const { data, error } = await this.supabaseClient
      .schema('sales')
      .from('order_status')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al obtener estados de orden:', error);
      throw error;
    }

    return data || [];
  }
}
