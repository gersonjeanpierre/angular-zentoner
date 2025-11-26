import { Injectable, inject } from '@angular/core';
import { CustomerPayload, CustomerView } from '@core/customers/customer.model';
import { Supabase } from '@core/supabase/supabase';

export interface GetCustomersParams {
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  customerType?: 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE';
  personType?: 'JURIDICA' | 'NATURAL';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateCustomerPayload {
  personType?: 'JURIDICA' | 'NATURAL';
  firstName?: string;
  lastName?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  dni?: string;
  ruc?: string;
  ce?: string;
  customerCode?: string;
  customerType?: 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE';
  notes?: any;
}

export interface GetCustomersResponse {
  data: CustomerView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private supabaseClient = inject(Supabase).client;

  async createCustomer(payload: CustomerPayload) {
    if (payload.dni && payload.ce) {
      throw new Error("No se puede tener ambos campos 'dni' y 'ce' al mismo tiempo.");
    }

    const { data, error } = await this.supabaseClient.schema('sales').rpc('create_customer', {
      p_user_id: payload.id,
      p_first_name: payload.firstName,
      p_last_name: payload.lastName,
      p_legal_name: payload.legalName,
      p_email: payload.email,
      p_phone: payload.phone,
      p_dni: payload.dni,
      p_ruc: payload.ruc,
      p_ce: payload.ce,
      p_person_type: payload.personType,
      p_customer_code: payload.customerCode,
      p_customer_type_code: payload.customerType,
      p_notes: payload.notes,
    });

    if (error) throw error;

    return data as string;
  }

  async getCustomers(params: GetCustomersParams = {}): Promise<GetCustomersResponse> {
    const { status = 'ACTIVE', customerType, personType, search, page = 1, pageSize = 20 } = params;

    let query = this.supabaseClient
      .schema('sales')
      .from('active_customers')
      .select('*', { count: 'exact', head: false });

    // Filtro por estado (deleted_at)
    if (status === 'ACTIVE') {
      query = query.is('customer_deleted_at', null).is('person_deleted_at', null);
    } else if (status === 'INACTIVE') {
      query = query.or('customer_deleted_at.not.is.null,person_deleted_at.not.is.null');
    }

    // Filtro por tipo de cliente
    if (customerType) {
      query = query.eq('customer_type_code', customerType);
    }

    // Filtro por tipo de persona
    if (personType) {
      query = query.eq('person_type', personType);
    }

    // Búsqueda por texto (nombre, email, teléfono, DNI, RUC, CE)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(
        `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,legal_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,dni.ilike.%${searchTerm}%,ruc.ilike.%${searchTerm}%,ce.ilike.%${searchTerm}%,customer_code.ilike.%${searchTerm}%`,
      );
    }

    // Ordenar por fecha de actualización (más recientes primero)
    query = query.order('customer_updated_at', { ascending: false });

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    const totalPages = count ? Math.ceil(count / pageSize) : 0;

    return {
      data: (data as any[]) || [],
      count: count || 0,
      page,
      pageSize,
      totalPages,
    };
  }

  async getCustomerById(customerId: string): Promise<CustomerView> {
    const { data, error } = await this.supabaseClient
      .schema('sales')
      .from('active_customers')
      .select('*')
      .eq('id', customerId)
      .is('customer_deleted_at', null)
      .is('person_deleted_at', null)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Cliente no encontrado');

    return data as CustomerView;
  }

  async updateCustomer(customerId: string, payload: UpdateCustomerPayload): Promise<CustomerView> {
    if (payload.dni && payload.ce) {
      throw new Error("No se puede tener ambos campos 'dni' y 'ce' al mismo tiempo.");
    }

    const { error } = await this.supabaseClient.schema('sales').rpc('update_customer', {
      p_customer_id: customerId,
      p_first_name: payload.firstName,
      p_last_name: payload.lastName,
      p_legal_name: payload.legalName,
      p_email: payload.email,
      p_phone: payload.phone,
      p_dni: payload.dni,
      p_ruc: payload.ruc,
      p_ce: payload.ce,
      p_customer_code: payload.customerCode,
      p_customer_type_code: payload.customerType,
      p_notes: payload.notes,
    });
    console.log('Update customer error:', error);
    if (error) throw error;

    // Return the updated customer
    return this.getCustomerById(customerId);
  }

  async softDeleteCustomer(customerId: string): Promise<void> {}
}
