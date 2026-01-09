import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '@core/services/category-service';

@Component({
  selector: 'app-subcategories',
  imports: [],
  templateUrl: './subcategories.html',
  styleUrl: './subcategories.css',
})
export default class Subcategories {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);

  protected readonly categorySlug = signal<string>('');
  protected readonly categoryData = signal<any>(null);

  ngOnInit() {
    this.categorySlug.set(this.route.snapshot.params['categorySlug']);
    this.loadCategoryData();
  }

  private loadCategoryData() {
    this.categoryService.getCategoryTree().subscribe((tree) => {
      const category = tree.find((cat: any) => cat.slug === this.categorySlug());

      if (category) {
        this.categoryData.set(category);
      }
    });
  }

  protected navigateToItems(subcategorySlug: string) {
    this.router.navigate(['/inventario/items', this.categorySlug(), subcategorySlug]);
  }

  protected goBack() {
    this.router.navigate(['/inventario']);
  }
}
