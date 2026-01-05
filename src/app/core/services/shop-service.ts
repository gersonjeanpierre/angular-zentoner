import { inject, Injectable } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import { ShopModel } from '../../data/models/shop/shop-model';

@Injectable({
  providedIn: 'root',
})
export class ShopService {
  private readonly supabase = inject(Supabase).client;

  /**
   * Obtener los detalles de todas las tiendas.
   * @return Detalles de las tiendas o error.
   * @param filters Filtros opcionales.
   */
  async getShopDetails(filters?: Partial<ShopModel>) {
    let query = this.supabase.schema('core').from('shops').select('*');
    // Filtros dinámicos
    if (filters) {
      if (filters.id) {
        query = query.eq('id', filters.id);
      }
      if (filters.createdById) {
        query = query.eq('created_by_id', filters.createdById);
      }
      if (filters.deletedAt === null) {
        query = query.is('deleted_at', null);
      }
    }

    const { data, error } = await query;
    return {
      data: (data as ShopModel[]) ?? undefined,
      error: error ?? undefined,
    };
  }
}
