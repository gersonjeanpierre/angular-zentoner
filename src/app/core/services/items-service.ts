import { Injectable, inject } from '@angular/core';
import {
  ItemPayload,
  ItemView,
  UpdateItemPayload,
  SupplyType,
  UnitType,
} from '@data/models/inventory/item.model';
import { Supabase } from '@core/supabase/supabase';

export interface GetItemsParams {
  categoryId?: number;
  supplyType?: SupplyType;
  unitType?: UnitType;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface GetItemsResponse {
  data: ItemView[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private supabaseClient = inject(Supabase).client;

  /**
   * Crear un nuevo item en el inventario
   */
  async createItem(payload: ItemPayload) {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('items')
      .insert(payload);

    if (error) {
      console.error('Error al crear item:', error);
    }

    return data;
  }

  /**
   * Obtener items con filtros y paginación
   */
  async getItems(params: GetItemsParams = {}): Promise<GetItemsResponse> {
    const {
      categoryId,
      supplyType,
      unitType,
      status = 'ACTIVE',
      search,
      page = 1,
      pageSize = 20,
    } = params;

    let query = this.supabaseClient
      .schema('inventory')
      .from('items')
      .select('*', { count: 'exact', head: false });

    let test = await this.supabaseClient
      .schema('inventory')
      .from('items')
      .select('*', { count: 'exact', head: false });

    console.log('TEST ITEMS:', test);

    // Filtro por categoría
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    // Filtro por tipo de material
    if (supplyType) {
      query = query.eq('supply_type', supplyType);
    }

    // Filtro por unidad de medida
    if (unitType) {
      query = query.eq('unit_type', unitType);
    }

    // Filtro por estado activo/inactivo
    if (status === 'ACTIVE') {
      query = query.eq('is_active', true);
    } else if (status === 'INACTIVE') {
      query = query.eq('is_active', false);
    }

    // Búsqueda por texto (nombre o SKU)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
    }

    // Ordenar por fecha de actualización
    query = query.order('updated_at', { ascending: false });

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) console.log('Error al obtener items:', error);

    const totalPages = count ? Math.ceil(count / pageSize) : 0;

    return {
      data: (data as ItemView[]) || [],
      count: count || 0,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Obtener un item por su ID
   */
  async getItemById(itemId: string): Promise<ItemView> {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Item no encontrado');

    return data as ItemView;
  }

  /**
   * Actualizar un item existente
   */
  async updateItem(itemId: string, payload: UpdateItemPayload): Promise<ItemView> {
    const updateData: any = {};

    // Solo incluir campos que fueron enviados
    if (payload.category_id !== undefined) updateData.category_id = payload.category_id;
    if (payload.supply_type !== undefined) updateData.supply_type = payload.supply_type;
    if (payload.unit_type !== undefined) updateData.unit_type = payload.unit_type;
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.sku !== undefined) updateData.sku = payload.sku;
    if (payload.weight_gsm !== undefined) updateData.weight_gsm = payload.weight_gsm;
    if (payload.finish !== undefined) updateData.finish = payload.finish;
    if (payload.width_mm !== undefined) updateData.width_mm = payload.width_mm;
    if (payload.height_mm !== undefined) updateData.height_mm = payload.height_mm;
    if (payload.length_m !== undefined) updateData.length_m = payload.length_m;
    if (payload.color_code !== undefined) updateData.color_code = payload.color_code;
    if (payload.printable_width_mm !== undefined)
      updateData.printable_width_mm = payload.printable_width_mm;
    if (payload.printable_height_mm !== undefined)
      updateData.printable_height_mm = payload.printable_height_mm;
    if (payload.thickness_mm !== undefined) updateData.thickness_mm = payload.thickness_mm;
    if (payload.serial_number !== undefined) updateData.serial_number = payload.serial_number;
    if (payload.metadata !== undefined) updateData.metadata = payload.metadata;
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active;

    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) console.error('Error al actualizar item:', error);
    if (!data) throw new Error('Error al actualizar item');

    return data as ItemView;
  }

  /**
   * Eliminación lógica de un item (is_active = false)
   */
  async deleteItem(itemId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .schema('inventory')
      .from('items')
      .update({ is_active: false })
      .eq('id', itemId);

    if (error) throw error;
  }

  /**
   * Reactivar un item (is_active = true)
   */
  async reactivateItem(itemId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .schema('inventory')
      .from('items')
      .update({ is_active: true })
      .eq('id', itemId);

    if (error) throw error;
  }

  /**
   * Verificar si un SKU ya existe
   */
  async checkSkuExists(sku: string, excludeItemId?: string): Promise<boolean> {
    let query = this.supabaseClient.schema('inventory').from('items').select('id').eq('sku', sku);

    if (excludeItemId) {
      query = query.neq('id', excludeItemId);
    }

    const { data, error } = await query;

    if (error) console.error('Error al verificar SKU:', error);

    return (data && data.length > 0) || false;
  }
}
