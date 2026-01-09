import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, Field, required } from '@angular/forms/signals';
import { CategoryService } from '@core/services/category-service';
import { ItemsService } from '@core/services/items-service';
import {
  ItemView,
  UpdateItemPayload,
  SupplyType,
  UnitType,
} from '@data/models/inventory/item.model';
import { supplyTypes, unitTypes } from '@data/constants';

interface ItemFormModel {
  name: string;
  sku: string;
  supply_type: SupplyType;
  unit_type: UnitType;
  price_reference?: number | string;
  size_name?: string;
  weight_gsm: number | string;
  finish: string;
  width_mm: number | string;
  height_mm: number | string;
  length_m: number | string;
  color_code: string;
  printable_width_mm: number | string;
  printable_height_mm: number | string;
  thickness_mm: number | string;
  serial_number: string;
  is_active: boolean;
}

@Component({
  selector: 'app-items-edit',
  imports: [CommonModule, Field],
  templateUrl: './items-edit.html',
  styleUrl: './items-edit.css',
})
export default class ItemsEdit implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);
  private readonly itemsService = inject(ItemsService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected readonly itemId = signal<string>('');
  protected readonly categorySlug = signal<string>('');
  protected readonly subcategorySlug = signal<string>('');
  protected readonly subcategoryData = signal<any>(null);

  protected readonly itemModel = signal<ItemFormModel>({
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

  ngOnInit() {
    this.itemId.set(this.route.snapshot.params['id']);
    this.categorySlug.set(this.route.snapshot.params['categorySlug']);
    this.subcategorySlug.set(this.route.snapshot.params['subcategorySlug']);
    this.loadSubcategoryData();
    this.loadItem();
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

  private async loadItem() {
    try {
      const item = await this.itemsService.getItemById(this.itemId());

      this.itemModel.set({
        name: item.name,
        sku: item.sku,
        supply_type: item.supply_type,
        unit_type: item.unit_type,
        weight_gsm: item.weight_gsm || '',
        finish: item.finish || '',
        width_mm: item.width_mm || '',
        height_mm: item.height_mm || '',
        length_m: item.length_m || '',
        color_code: item.color_code || '',
        printable_width_mm: item.printable_width_mm || '',
        printable_height_mm: item.printable_height_mm || '',
        thickness_mm: item.thickness_mm || '',
        serial_number: item.serial_number || '',
        is_active: item.is_active,
      });
    } catch (err: any) {
      this.error.set(err.message || 'Error al cargar item');
    } finally {
      this.loading.set(false);
    }
  }

  protected async onSubmit() {
    if (this.itemForm.name().invalid() || this.itemForm.sku().invalid()) {
      this.error.set('Por favor complete los campos requeridos');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const formData = this.itemModel();
      const payload: UpdateItemPayload = {
        name: formData.name,
        sku: formData.sku,
        supply_type: formData.supply_type,
        unit_type: formData.unit_type,
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

      await this.itemsService.updateItem(this.itemId(), payload);

      this.success.set(true);
      setTimeout(() => {
        this.goBack();
      }, 1500);
    } catch (err: any) {
      this.error.set(err.message || 'Error al actualizar item');
    } finally {
      this.saving.set(false);
    }
  }

  protected async onDelete() {
    if (!confirm('¿Está seguro de eliminar este item?')) return;

    this.deleting.set(true);
    this.error.set(null);

    try {
      await this.itemsService.deleteItem(this.itemId());
      this.goBack();
    } catch (err: any) {
      this.error.set(err.message || 'Error al eliminar item');
    } finally {
      this.deleting.set(false);
    }
  }

  protected goBack() {
    this.router.navigate(['/inventario/items', this.categorySlug(), this.subcategorySlug()]);
  }
}
