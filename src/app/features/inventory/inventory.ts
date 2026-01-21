import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CategoryService } from '@core/services/category-service';

@Component({
  selector: 'app-inventory',
  imports: [],
  templateUrl: './inventory.html',
})
export default class Inventory {
  protected readonly title = signal('Inventario');
  protected readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);

  protected readonly categoriesTree = signal<any[]>([]);

  async ngOnInit() {
    // console.log('Categorias', await this.categoryService.categories());
    // console.log('Subcategorias', await this.categoryService.subcategories(1));
    this.categoryService.loadCategories();

    this.categoryService.getCategoryTree().subscribe((tree) => {
      this.categoriesTree.set(tree);
    });

    console.log('Árbol de categorías', this.categoriesTree());
  }

  protected toItems() {
    this.router.navigate(['/inventario/items']);
  }

  protected toKardex() {
    this.router.navigate(['/inventario/kardex']);
  }

  protected toMachines() {
    this.router.navigate(['/inventario/maquinas']);
  }
}
