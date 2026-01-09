import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CategoryService } from '@core/services/category-service';
import { ItemsService } from '@core/services/items-service';
import { ItemView } from '@data/models/inventory/item.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { supplyTypes, unitTypes } from '@data/constants';

@Component({
  selector: 'app-items-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './items-list.html',
  styleUrl: './items-list.css',
})
export default class ItemsList implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);
  private readonly itemsService = inject(ItemsService);
  private readonly searchSubject = new Subject<string>();

  // State signals
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<ItemView[]>([]);

  // Filter signals
  protected readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  protected readonly searchTerm = signal('');

  // Pagination signals
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);

  // Route params
  protected readonly categorySlug = signal<string>('');
  protected readonly subcategorySlug = signal<string>('');
  protected readonly subcategoryData = signal<any>(null);

  protected readonly supplyTypes = supplyTypes;
  protected readonly unitTypes = unitTypes;

  // Computed breadcrumb
  protected readonly breadcrumb = computed(() => {
    const subcat = this.subcategoryData();
    if (!subcat) return '';
    return `${subcat.parent_name || ''} > ${subcat.name || ''}`;
  });

  ngOnInit() {
    this.categorySlug.set(this.route.snapshot.params['categorySlug']);
    this.subcategorySlug.set(this.route.snapshot.params['subcategorySlug']);
    this.loadSubcategoryData();

    // Configurar debounce para búsqueda
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((searchTerm) => {
      this.searchTerm.set(searchTerm);
      this.currentPage.set(1);
      this.loadItems();
    });
    this.loadItems();
  }

  private loadSubcategoryData() {
    this.categoryService.getCategoryTree().subscribe((tree) => {
      const category = tree.find((cat: any) => cat.slug === this.categorySlug());
      if (category) {
        const subcategory = category.children?.find(
          (sub: any) => sub.slug === this.subcategorySlug(),
        );
        if (subcategory) {
          this.subcategoryData.set({
            ...subcategory,
            parent_name: category.name,
          });
        }
      }
    });
  }

  private async loadItems() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const subcategoryId = this.subcategoryData()?.id;
      if (!subcategoryId) {
        this.loading.set(false);
        return;
      }

      const response = await this.itemsService.getItems({
        status: this.statusFilter(),
        search: this.searchTerm(),
        page: this.currentPage(),
        pageSize: this.pageSize(),
      });

      this.items.set(response.data);

      this.totalCount.set(response.count);
      this.totalPages.set(response.totalPages);
    } catch (err: any) {
      this.error.set(err.message || 'Error al cargar items');
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  protected onStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.statusFilter.set(target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
    this.currentPage.set(1);
    this.loadItems();
  }

  protected onPageChange(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadItems();
  }

  protected navigateToCreate() {
    this.router.navigate(['crear'], { relativeTo: this.route });
  }

  protected navigateToEdit(itemId: string) {
    this.router.navigate(['editar', itemId], { relativeTo: this.route });
  }

  protected goBack() {
    this.router.navigate(['/inventario/items', this.categorySlug()]);
  }
}
