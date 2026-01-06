import { Component, computed, inject, signal } from '@angular/core';
import { CategoryService } from '@core/services/category-service';

@Component({
  selector: 'app-items',
  templateUrl: './items.html',
  styleUrl: './items.css',
})
export default class Items {
  private readonly categoryService = inject(CategoryService);
  readonly categoriesTree = signal<any[]>([]);

  protected readonly icons = [
    { id: 1, icon: 'icon-[fluent-emoji-high-contrast--roll-of-paper]' },
    { id: 2, icon: 'icon-[gridicons--ink]' },
    { id: 3, icon: 'icon-[streamline-sharp--cutter]' },
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
}
