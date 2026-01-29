import { Injectable, inject } from '@angular/core';
import {
  CustomerPayload,
  CustomerView,
  GetCustomersParams,
  GetCustomersResponse,
  UpdateCustomerPayload,
} from '@data/models/customer/customer.model';
import { Supabase } from '@core/supabase/supabase';
import { dexieDB } from '@core/dexie/db';
import camelcaseKeys from 'camelcase-keys';
import { from, Observable } from 'rxjs';
import { liveQuery } from 'dexie';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly supabase = inject(Supabase).client;
  public dataCustomers$: Observable<CustomerView[]> = from(
    liveQuery(() => dexieDB.customers.toArray()),
  );

  /**
   * Carga todos los clientes activos desde Supabase y los almacena en Dexie.
   */
  async fetchCustomersFromSupabase(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .schema('sales')
        .from('active_customers')
        .select('*')
        .is('customer_deleted_at', null)
        .is('person_deleted_at', null);

      if (error) {
        console.error('Error al obtener los clientes:', error);
        throw error;
      }

      if (data) {
        const customers = camelcaseKeys(data, { deep: true }) as CustomerView[];
        await dexieDB.customers.bulkPut(customers);
        console.log(`[CustomerService] ${customers.length} clientes almacenados en Dexie`);
      }
    } catch (error) {
      console.error('Error en fetchCustomersFromSupabase:', error);
      throw error;
    }
  }

  /**
   * Asegura que los clientes estén cargados en Dexie.
   * Solo hace fetch si Dexie está vacío (primera vez después de autenticación).
   */
  async ensureCustomersLoaded(): Promise<void> {
    const count = await dexieDB.customers.count();
    if (count === 0) {
      console.log('[CustomerService] Cargando clientes desde Supabase (primera vez)');
      await this.fetchCustomersFromSupabase();
    } else {
      console.log('[CustomerService] Usando caché de Dexie (', count, 'clientes)');
    }
  }

  async createCustomer(payload: CustomerPayload) {
    if (payload.dni && payload.ce) {
      throw new Error("No se puede tener ambos campos 'dni' y 'ce' al mismo tiempo.");
    }

    const { data, error } = await this.supabase.schema('sales').rpc('create_customer', {
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

    // Si hay filtros complejos o búsqueda, usar Supabase directamente
    const hasComplexFilters = customerType || personType || search || status !== 'ACTIVE';

    if (hasComplexFilters) {
      return this.getCustomersFromSupabase(params);
    }

    // Para listados simples, usar Dexie
    const allCustomers = await dexieDB.customers.toArray();
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedData = allCustomers.slice(from, to);

    return {
      data: paginatedData,
      count: allCustomers.length,
      page,
      pageSize,
      totalPages: Math.ceil(allCustomers.length / pageSize),
    };
  }

  private async getCustomersFromSupabase(
    params: GetCustomersParams,
  ): Promise<GetCustomersResponse> {
    const { status = 'ACTIVE', customerType, personType, search, page = 1, pageSize = 20 } = params;

    let query = this.supabase
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
      data: (camelcaseKeys(data || [], { deep: true }) as CustomerView[]) || [],
      count: count || 0,
      page,
      pageSize,
      totalPages,
    };
  }

  async getCustomerById(customerId: string): Promise<CustomerView> {
    // Intentar primero desde Dexie
    const cachedCustomer = await dexieDB.customers.get(customerId);
    if (cachedCustomer) {
      console.log('[CustomerService] Cliente obtenido desde caché');
      return cachedCustomer;
    }

    // Si no está en caché, consultar Supabase
    const { data, error } = await this.supabase
      .schema('sales')
      .from('active_customers')
      .select('*')
      .eq('id', customerId)
      .is('customer_deleted_at', null)
      .is('person_deleted_at', null)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Cliente no encontrado');

    const customer = camelcaseKeys(data, { deep: true }) as CustomerView;

    // Guardar en caché para futuras consultas
    await dexieDB.customers.put(customer);

    return customer;
  }

  async updateCustomer(customerId: string, payload: UpdateCustomerPayload): Promise<CustomerView> {
    if (payload.dni && payload.ce) {
      throw new Error("No se puede tener ambos campos 'dni' y 'ce' al mismo tiempo.");
    }

    // Convertir undefined a null explícitamente para PostgreSQL
    const { error } = await this.supabase.schema('sales').rpc('update_customer', {
      p_customer_id: customerId,
      p_first_name: payload.firstName ?? null,
      p_last_name: payload.lastName ?? null,
      p_legal_name: payload.legalName ?? null,
      p_email: payload.email ?? null,
      p_phone: payload.phone ?? null,
      p_dni: payload.dni ?? null,
      p_ruc: payload.ruc ?? null,
      p_ce: payload.ce ?? null,
      p_customer_code: payload.customerCode ?? null,
      p_customer_type_code: payload.customerType ?? null,
      p_notes: payload.notes ?? null,
    });

    if (error) {
      console.error('[CustomerService] Error al actualizar cliente:', error);
      throw error;
    }

    // Obtener el cliente actualizado (esto también actualizará el caché)
    const updatedCustomer = await this.getCustomerById(customerId);

    // Actualizar el caché de Dexie
    await dexieDB.customers.put(updatedCustomer);

    console.log('[CustomerService] Cliente actualizado correctamente');
    return updatedCustomer;
  }

  async softDeleteCustomer(customerId: string): Promise<void> {}

  async syncCustomers(): Promise<void> {
    console.log('[CustomerService] Iniciando sincronización...');
    await dexieDB.customers.clear();
    await this.fetchCustomersFromSupabase();
    console.log('[CustomerService] Sincronización completada');
  }
}
