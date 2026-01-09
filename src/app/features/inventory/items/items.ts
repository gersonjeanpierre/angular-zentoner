import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CategoryService } from '@core/services/category-service';

@Component({
  selector: 'app-items',
  templateUrl: './items.html',
  styleUrl: './items.css',
})
export default class Items {
  private readonly categoryService = inject(CategoryService);
  private router = inject(Router);
  readonly categoriesTree = signal<any[]>([]);

  protected readonly icons = [
    { id: 1, icon: 'icon-[fluent-emoji-high-contrast--roll-of-paper]' },
    { id: 2, icon: 'icon-[f7--drop]' },
    { id: 3, icon: 'icon-[streamline-sharp--cutter]' },
    { id: 4, icon: 'icon-[bi--bag-heart]' },
    { id: 5, icon: 'icon-[mi-coleccion--dtf]' },
    { id: 6, icon: 'icon-[streamline-ultimate--print-text]' },
    { id: 7, icon: 'icon-[fluent--projection-screen-24-regular]' },
    { id: 8, icon: 'icon-[fluent--design-ideas-48-regular]' },
  ];

  protected readonly categoriesWithIcons = computed(() => {
    const iconsMap: Record<number, { id: number; icon: string }> = {};
    for (const icon of this.icons) {
      iconsMap[icon.id] = icon;
    }
    return this.categoriesTree().map((category) => ({
      ...category,
      icon: iconsMap[category.sort_order]?.icon || null,
    }));
  });

  async ngOnInit() {
    this.categoryService.loadCategories();

    this.categoryService.getCategoryTree().subscribe((tree) => {
      this.categoriesTree.set(tree);
    });
  }

  protected navigateToSubcategory(categorySlug: string, subcategorySlug: string) {
    this.router.navigate(['/inventario/items', categorySlug, subcategorySlug]);
  }
}
