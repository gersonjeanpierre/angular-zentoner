import { inject, Injectable } from '@angular/core';
import { dexieDB } from '@core/dexie/db';
import { Supabase } from '@core/supabase/supabase';
import { ShopModel } from '@data/models/shop/shop-model';
import { liveQuery } from 'dexie';
import { BehaviorSubject, from, map, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ShopService {
  private readonly supabase = inject(Supabase).client;
  private STORAGE_KEY = 'cache_shops';
  private shopsSubject = new BehaviorSubject<ShopModel[]>(this.getShopStoredData());
  public dataShops$: Observable<ShopModel[]> = from(liveQuery(() => dexieDB.shops.toArray()));

  async fetchShopsFromSupabase() {
    console.log('[ShopService] fetchShopsFromSupabase: Iniciando...');
    try {
      const { data, error } = await this.supabase
        .schema('core')
        .from('shops')
        .select('*')
        .is('deleted_at', null);

      if (error) {
        console.error('[ShopService] Error al obtener las tiendas:', error);
        throw error;
      }

      if (data) {
        console.log('[ShopService] Datos recibidos de Supabase:', data.length, 'shops');
        await dexieDB.shops.bulkPut(data as ShopModel[]);
        console.log('[ShopService] Shops guardados en Dexie correctamente');
      } else {
        console.warn('[ShopService] No se recibieron datos de Supabase');
      }
    } catch (error) {
      console.error('[ShopService] Error en fetchShopsFromSupabase:', error);
      throw error;
    }
  }

  /**
   * Asegura que las tiendas estén cargadas en Dexie.
   * Solo hace fetch si Dexie está vacío (primera vez después de autenticación).
   */
  async ensureShopsLoaded(): Promise<void> {
    const count = await dexieDB.shops.count();
    if (count === 0) {
      console.log('[ShopService] Cargando tiendas desde Supabase (primera vez)');
      await this.fetchShopsFromSupabase();
    } else {
      console.log('[ShopService] Usando caché de Dexie (', count, 'tiendas)');
    }
  }

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

  loadShops(): void {
    console.log('[ShopService] loadShops: start');
    if (this.shopsSubject.value && this.shopsSubject.value.length > 0) {
      console.log('[ShopService] loadShops: cache hit, skipping fetch');
      return;
    }
    from(this.getShopDetails()).pipe(
      map((response) => response.data || []),
      tap((data) => {
        console.log('[ShopService] loadShops: fetched', data);
        this.saveToStorage(data);
        this.shopsSubject.next(data);
      }),
    );
  }

  private saveToStorage(shops: ShopModel[]): void {
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(shops));
  }

  private getShopStoredData(): ShopModel[] {
    const shopData = sessionStorage.getItem(this.STORAGE_KEY);
    return shopData ? JSON.parse(shopData) : [];
  }

  private clearCache(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
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
