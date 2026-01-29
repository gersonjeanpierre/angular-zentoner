import { Injectable, inject } from '@angular/core';
import { EmployeeView } from '@data/models/employee/employee.model';
import { Supabase } from '@core/supabase/supabase';
import { from, Observable } from 'rxjs';
import { liveQuery } from 'dexie';

export interface GetEmployeesParams {
  shopId?: string;
  statusId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface GetEmployeesResponse {
  data: EmployeeView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private supabaseClient = inject(Supabase).client;
  // public dataEmployees$: Observable<EmployeeView[]> = from(
  //   liveQuery(() => )
  // )

  /**
   * Obtener empleados con filtros y paginación
   */
  async getEmployees(params: GetEmployeesParams = {}) {
    const { shopId, statusId, search, page = 1, pageSize = 20 } = params;

    // Nota: Asumiendo que existe una vista similar a active_customers
    // Si no existe, necesitarás crear una vista o hacer un JOIN manual
    let query = this.supabaseClient
      .schema('hr')
      .from('active_employees')
      .select('employee_id,first_name, last_name');

    // Filtro por tienda
    // if (shopId) {
    //   query = query.eq('shop_id', shopId);
    // }

    // Filtro por estado
    // if (statusId) {
    //   query = query.eq('status_id', statusId);
    // }

    // Búsqueda por texto (nombre, código de empleado, email)
    // if (search && search.trim()) {
    //   const searchTerm = search.trim();
    //   query = query.or(`employee_code.ilike.%${searchTerm}%,auth_email.ilike.%${searchTerm}%`);
    // }

    // Búsqueda por texto (solo first_name y last_name)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
    }

    // Ordenar por fecha de actualización
    // query = query.order('updated_at', { ascending: false });

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener empleados:', error);
      throw error;
    }
    console.log('Empleados obtenidos employee-service:', data);

    return {
      // data: transformedData,
      data,
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Obtener un empleado por ID
   */
  async getEmployeeById(employeeId: string): Promise<EmployeeView | null> {
    const { data, error } = await this.supabaseClient
      .schema('hr')
      .from('employees')
      .select(
        `
        *,
        persons:id (
          first_name,
          last_name,
          legal_name,
          email,
          phone,
          dni,
          ruc,
          ce,
          person_type
        )
      `,
      )
      .eq('id', employeeId)
      .single();

    if (error) {
      console.error('Error al obtener empleado:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      shopId: data.shop_id,
      employeeCode: data.employee_code,
      authEmail: data.auth_email,
      hireDate: data.hire_date,
      salary: data.salary,
      statusId: data.status_id,
      workNotes: data.work_notes,
      firstName: (data as any).persons?.first_name || null,
      lastName: (data as any).persons?.last_name || null,
      legalName: (data as any).persons?.legal_name || null,
      email: (data as any).persons?.email || null,
      phone: (data as any).persons?.phone || null,
      dni: (data as any).persons?.dni || null,
      ruc: (data as any).persons?.ruc || null,
      ce: (data as any).persons?.ce || null,
      personType: (data as any).persons?.person_type || 'NATURAL',
      employeeUpdatedAt: data.updated_at,
      personDeletedAt: null,
      personUpdatedAt: null,
    };
  }
}
