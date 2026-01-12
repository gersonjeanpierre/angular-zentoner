import { Injectable, inject } from '@angular/core';
import { MachinePayload, MachineView } from '@data/models/inventory/machine.model';
import { Supabase } from '@core/supabase/supabase';

export interface GetMachinesParams {
  shopId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class MachineService {
  private supabaseClient = inject(Supabase).client;

  /**
   * Crear una nueva máquina
   */
  async createMachine(payload: MachinePayload) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('machines')
      .insert(payload)
      .select();

    if (error) {
      console.error('Error al crear máquina:', error);
      throw error;
    }

    return data[0];
  }

  /**
   * Obtener máquinas con filtros
   */
  async getMachines(params: GetMachinesParams = {}): Promise<MachineView[]> {
    const { shopId, status = 'ACTIVE', search } = params;

    let query = this.supabaseClient.schema('inventory').from('machines').select('*');

    // Filtro por tienda
    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    // Filtro por estado
    if (status === 'ACTIVE') {
      query = query.eq('is_active', true);
    } else if (status === 'INACTIVE') {
      query = query.eq('is_active', false);
    }

    // Búsqueda por texto
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(`name.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener máquinas:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Obtener una máquina por ID
   */
  async getMachineById(id: string): Promise<MachineView | null> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('machines')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener máquina:', error);
      throw error;
    }

    return data;
  }

  /**
   * Actualizar una máquina
   */
  async updateMachine(id: string, payload: Partial<MachinePayload>) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('machines')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error al actualizar máquina:', error);
      throw error;
    }

    return data[0];
  }

  /**
   * Eliminar (desactivar) una máquina
   */
  async deleteMachine(id: string) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('machines')
      .update({ is_active: false })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error al eliminar máquina:', error);
      throw error;
    }

    return data[0];
  }
}
