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

  async insertShops(shops: ShopModel[]) {
    const shopsToInsert = shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      address: shop.address ?? null,
      email: shop.email ?? null,
      main_phone: shop.mainPhone ?? null,
      secondary_phone: shop.secondaryPhone ?? null,
      company_data: shop.companyData ? JSON.stringify(shop.companyData) : null,
      basic_service_providers: shop.basicServiceProviders
        ? JSON.stringify(shop.basicServiceProviders)
        : null,
    }));

    const { data, error } = await this.supabase
      .schema('core')
      .from('shops')
      .insert(shopsToInsert)
      .select();

    return {
      data: (data as ShopModel[]) ?? undefined,
      error: error ?? undefined,
    };
  }
}
