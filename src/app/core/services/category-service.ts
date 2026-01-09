import { inject, Injectable } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { map, tap, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly supabaseClient = inject(Supabase).client;
  private STORAGE_KEY = 'cache_categorias';

  private categoriesSubject = new BehaviorSubject<any[] | null>(this.getStoredData());
  public categories$ = this.categoriesSubject.asObservable();

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

  loadCategories(): void {
    console.log('[CategoryService] loadCategories: start');
    if (this.categoriesSubject.value && this.categoriesSubject.value.length > 0) {
      console.log('[CategoryService] loadCategories: cache hit, skipping fetch');
      return;
    }

    from(this.getCategoriesRaw())
      .pipe(
        map((res) => res.data || []),
        tap((data) => {
          console.log('[CategoryService] loadCategories: fetched', data);
          this.saveToStorage(data);
          this.categoriesSubject.next(data);
        }),
      )
      .subscribe({
        complete: () => console.log('[CategoryService] loadCategories: end'),
        error: (err) => console.error('[CategoryService] loadCategories: error', err),
      });
  }

  getCategoryTree(): Observable<any[]> {
    return this.categories$.pipe(map((list) => this.buildTree(list || [])));
  }

  getSubSubCategories(parentId: number) {
    return this.categories$.pipe(
      map((list) => {
        const parentCategory = list?.find((cat) => cat.id === parentId);
        if (!parentCategory) return [];
        return this.buildTree(list || [], parentId);
      }),
    );
  }

  getRootCategory(categoryId: number): any | null {
    const tree = this.categoriesSubject.value;
    if (!tree) return null;
    // Para simplificar, busca en el array plano y sigue parent_id hasta null
    const findRootFromId = (id: number): any | null => {
      let current = tree.find((cat) => cat.id === id);
      if (!current) return null;
      while (current.parent_id) {
        current = tree.find((cat) => cat.id === current.parent_id);
        if (!current) return null; // Error en datos
      }
      return current;
    };

    return findRootFromId(categoryId);
  }

  private buildTree(list: any[], parentId: number | null = null): any[] {
    return list
      .filter((item) => item.parent_id === parentId)
      .map((item) => ({
        ...item,
        children: this.buildTree(list, item.id),
      }));
  }

  // Manejo de persistencia para F5
  private saveToStorage(data: any[]) {
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  private getStoredData(): any[] | null {
    const data = sessionStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  // Limpieza total al cerrar sesión
  clearCache(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    // this.categoriesSubject.next(null);
  }
}
