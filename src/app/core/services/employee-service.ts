import { Injectable, inject } from '@angular/core';
import {
  EmployeeView,
  GetEmployeesParams,
  GetEmployeesResponse,
} from '@data/models/employee/employee.model';
import { Supabase } from '@core/supabase/supabase';
import { dexieDB } from '@core/dexie/db';
import { from, Observable } from 'rxjs';
import { liveQuery } from 'dexie';
import camelcaseKeys from 'camelcase-keys';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly supabase = inject(Supabase).client;
  public dataEmployees$: Observable<EmployeeView[]> = from(
    liveQuery(() => dexieDB.employees.toArray()),
  );

  /**
   * Carga todos los empleados activos desde Supabase y los almacena en Dexie.
   */
  async fetchEmployeesFromSupabase(): Promise<void> {
    try {
      const { data, error } = await this.supabase.schema('hr').from('active_employees').select('*');

      if (error) {
        console.error('Error al obtener los empleados:', error);
        throw error;
      }

      if (data) {
        const employees = camelcaseKeys(data, { deep: true }) as EmployeeView[];
        await dexieDB.employees.bulkPut(employees);
        console.log(`[EmployeeService] ${employees.length} empleados almacenados en Dexie`);
      }
    } catch (error) {
      console.error('Error en fetchEmployeesFromSupabase:', error);
      throw error;
    }
  }

  /**
   * Asegura que los empleados estén cargados en Dexie.
   * Solo hace fetch si Dexie está vacío (primera vez después de autenticación).
   */
  async ensureEmployeesLoaded(): Promise<void> {
    const count = await dexieDB.employees.count();
    if (count === 0) {
      console.log('[EmployeeService] Cargando empleados desde Supabase (primera vez)');
      await this.fetchEmployeesFromSupabase();
    } else {
      console.log('[EmployeeService] Usando caché de Dexie (', count, 'empleados)');
    }
  }

  /**
   * Obtener empleados con filtros y paginación
   */
  async getEmployees(params: GetEmployeesParams = {}): Promise<GetEmployeesResponse> {
    const { shopId, statusId, search, page = 1, pageSize = 20 } = params;

    // Si hay filtros complejos o búsqueda, usar Supabase directamente
    const hasComplexFilters = shopId || statusId || search;

    if (hasComplexFilters) {
      return this.getEmployeesFromSupabase(params);
    }

    // Para listados simples, usar Dexie
    const allEmployees = await dexieDB.employees.toArray();
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedData = allEmployees.slice(from, to);

    return {
      data: paginatedData,
      count: allEmployees.length,
      page,
      pageSize,
      totalPages: Math.ceil(allEmployees.length / pageSize),
    };
  }

  private async getEmployeesFromSupabase(
    params: GetEmployeesParams,
  ): Promise<GetEmployeesResponse> {
    const { shopId, statusId, search, page = 1, pageSize = 20 } = params;

    let query = this.supabase
      .schema('hr')
      .from('active_employees')
      .select('*', { count: 'exact', head: false });

    // Filtro por tienda
    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    // Filtro por estado
    if (statusId) {
      query = query.eq('status_id', statusId);
    }

    // Búsqueda por texto (nombre, código de empleado, email)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(
        `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,employee_code.ilike.%${searchTerm}%,auth_email.ilike.%${searchTerm}%`,
      );
    }

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener empleados:', error);
      throw error;
    }

    const employees = camelcaseKeys(data || [], { deep: true }) as EmployeeView[];

    return {
      data: employees,
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
    // Intentar primero desde Dexie
    const cachedEmployee = await dexieDB.employees.get(employeeId);
    if (cachedEmployee) {
      console.log('[EmployeeService] Empleado obtenido desde caché');
      return cachedEmployee;
    }

    // Si no está en caché, consultar Supabase
    const { data, error } = await this.supabase
      .schema('hr')
      .from('active_employees')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      console.error('Error al obtener empleado:', error);
      throw error;
    }

    if (!data) return null;

    const employee = camelcaseKeys(data, { deep: true }) as EmployeeView;

    // Guardar en caché para futuras consultas
    await dexieDB.employees.put(employee);

    return employee;
  }
}
