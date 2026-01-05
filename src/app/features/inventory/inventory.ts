import { Component, inject, signal } from '@angular/core';
import { CategoryService } from '@core/services/category-service';

@Component({
  selector: 'app-inventory',
  imports: [],
  templateUrl: './inventory.html',
})
export default class Inventory {
  protected readonly title = signal('Inventario');
  private readonly categoryService = inject(CategoryService);

  async ngOnInit() {
    console.log('Categorias', await this.categoryService.categories());
    console.log('Subcategorias', await this.categoryService.subcategories(1));
  }
}
