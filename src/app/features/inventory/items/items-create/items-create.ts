import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, Field, required } from '@angular/forms/signals';
import { CategoryService } from '@core/services/category-service';
import { ItemsService } from '@core/services/items-service';
import {
  ItemFormModel,
  ItemPayload,
  selectOption,
  SupplyType,
  UnitType,
} from '@data/models/inventory/item.model';
import { v7 as uuidv7 } from 'uuid';
import { supplyTypes, unitTypes } from '@data/constants';

@Component({
  selector: 'app-items-create',
  imports: [CommonModule, Field],
  templateUrl: './items-create.html',
  styleUrl: './items-create.css',
})
export default class ItemsCreate implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);
  private readonly itemsService = inject(ItemsService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected readonly categorySlug = signal<string>('');
  protected readonly subcategorySlug = signal<string>('');
  protected readonly subcategoryData = signal<any>(null);

  protected readonly itemModel = signal<ItemFormModel>({
    category_id: '',
    name: '',
    sku: '',
    supply_type: 'papel',
    unit_type: 'unidad',
    price_reference: '',
    size_name: '',
    weight_gsm: '',
    finish: '',
    width_mm: '',
    height_mm: '',
    length_m: '',
    color_code: '',
    printable_width_mm: '',
    printable_height_mm: '',
    thickness_mm: '',
    serial_number: '',
    is_active: true,
  });

  protected readonly itemForm = form(this.itemModel, (schema) => {
    required(schema.name, { message: 'Nombre es requerido' });
    required(schema.sku, { message: 'SKU es requerido' });
    required(schema.supply_type, { message: 'Tipo de material es requerido' });
    required(schema.unit_type, { message: 'Unidad de medida es requerida' });
  });

  protected readonly supplyTypes = supplyTypes;
  protected readonly unitTypes = unitTypes;

  protected readonly breadcrumb = computed(() => {
    const subcat = this.subcategoryData();
    if (!subcat) return '';
    return `${subcat.parent_name || ''} > ${subcat.name || ''}`;
  });

  // Computed para mostrar campos dinámicamente
  protected readonly showPaperFields = computed(
    () =>
      this.itemForm.supply_type().value() === 'papel' ||
      this.itemForm.supply_type().value() === 'lona',
  );

  protected readonly showRollFields = computed(
    () =>
      this.itemForm.supply_type().value() === 'lona' ||
      this.itemForm.supply_type().value() === 'vinilo',
  );

  protected readonly showRigidFields = computed(
    () => this.itemForm.supply_type().value() === 'rigido',
  );

  protected readonly showMachineFields = computed(
    () => this.itemForm.supply_type().value() === 'maquina',
  );

  protected readonly showDimensionFields = computed(() => {
    const type = this.itemForm.supply_type().value();
    return type === 'papel' || type === 'lona' || type === 'vinilo' || type === 'rigido';
  });

  protected readonly subSubCategories = signal<selectOption[]>([]);

  ngOnInit() {
    this.categorySlug.set(this.route.snapshot.params['categorySlug']);
    this.subcategorySlug.set(this.route.snapshot.params['subcategorySlug']);
    this.loadSubcategoryData();
    this.categoryService.getSubSubCategories(this.subcategoryData()?.id).subscribe((subSubs) => {
      const options = (subSubs || []).map((subSub: any) => ({
        value: subSub.id.toString(),
        label: subSub.name,
      }));
      this.subSubCategories.set(options);
    });
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

  protected async onSubmit() {
    if (this.itemForm.name().invalid() || this.itemForm.sku().invalid()) {
      this.error.set('Por favor complete los campos requeridos');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const subcategoryId = this.subcategoryData()?.id;
      if (!subcategoryId) {
        throw new Error('No se pudo obtener el ID de la subcategoría');
      }

      const formData = this.itemModel();
      const payload: ItemPayload = {
        id: uuidv7(),
        category_id: Number(formData.category_id),
        supply_type: formData.supply_type,
        unit_type: formData.unit_type,
        name: formData.name,
        sku: formData.sku,
        price_reference: formData.price_reference ? Number(formData.price_reference) : null,
        size_name: formData.size_name || null,
        weight_gsm: formData.weight_gsm ? Number(formData.weight_gsm) : null,
        finish: formData.finish || null,
        width_mm: formData.width_mm ? Number(formData.width_mm) : null,
        height_mm: formData.height_mm ? Number(formData.height_mm) : null,
        length_m: formData.length_m ? Number(formData.length_m) : null,
        color_code: formData.color_code || null,
        printable_width_mm: formData.printable_width_mm
          ? Number(formData.printable_width_mm)
          : null,
        printable_height_mm: formData.printable_height_mm
          ? Number(formData.printable_height_mm)
          : null,
        thickness_mm: formData.thickness_mm ? Number(formData.thickness_mm) : null,
        serial_number: formData.serial_number || null,
        is_active: formData.is_active,
      };
      console.log('Item creado:', payload);

      await this.itemsService.createItem(payload);

      this.success.set(true);
      setTimeout(() => {
        this.goBack();
      }, 1500);
    } catch (err: any) {
      this.error.set(err.message || 'Error al crear item');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack() {
    this.router.navigate(['/inventario/items', this.categorySlug(), this.subcategorySlug()]);
  }
}
