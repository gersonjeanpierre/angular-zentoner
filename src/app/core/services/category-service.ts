import { inject, Injectable } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly supabaseClient = inject(Supabase).client;

  async getCategoriesRaw() {
    const { data, error } = await this.supabaseClient
      .schema('inventory')
      .from('categories')
      .select('id,parent_id, name, slug, sort_order');
    return {
      data: data ?? undefined,
      error: error ?? undefined,
    };
  }

  async categories() {
    const { data, error } = await this.getCategoriesRaw();
    const categories = data?.filter((category) => category.parent_id === null) || [];

    return {
      data: categories,
      error: error,
    };
  }

  async subcategories(parentId: number) {
    const { data, error } = await this.getCategoriesRaw();
    const subcategories = data?.filter((category) => category.parent_id === parentId) || [];
    return {
      data: subcategories,
      error: error,
    };
  }
}
