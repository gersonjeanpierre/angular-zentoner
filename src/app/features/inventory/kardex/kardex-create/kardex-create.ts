import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField, required, min } from '@angular/forms/signals';
import { KardexService } from '@core/services/kardex-service';
import { ItemsService } from '@core/services/items-service';
import { AuthService } from '@core/services/auth-service';
import { KardexFormModel, KardexPayload } from '@data/models/inventory/kardex.model';
import { ItemView } from '@data/models/inventory/item.model';
import { v7 as uuidv7 } from 'uuid';

@Component({
  selector: 'app-kardex-create',
  imports: [CommonModule, FormField],
  templateUrl: './kardex-create.html',
  styleUrl: './kardex-create.css',
})
export default class KardexCreate implements OnInit {
  private readonly router = inject(Router);
  private readonly kardexService = inject(KardexService);
  private readonly itemsService = inject(ItemsService);
  private readonly authService = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly loadingData = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected readonly items = signal<ItemView[]>([]);

  protected readonly selectedItem = signal<ItemView | null>(null);

  protected readonly kardexModel = signal<KardexFormModel>({
    item_id: '',
    batch_code: '',
    quantity_base: '',
    notes: '',
  });

  protected readonly kardexForm = form(this.kardexModel, (schema) => {
    required(schema.item_id, { message: 'Seleccione un item' });
    required(schema.batch_code, { message: 'Ingrese el código de lote' });
    required(schema.quantity_base, { message: 'Ingrese la cantidad base' });
    min(schema.quantity_base, 0.001, { message: 'La cantidad debe ser mayor a 0' });
  });

  async ngOnInit() {
    await this.loadInitialData();
  }

  private async loadInitialData() {
    try {
      this.loadingData.set(true);
      const itemsResponse = await this.itemsService.getItems({ status: 'ACTIVE', pageSize: 1000 });
      this.items.set(itemsResponse.data);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      this.error.set('Error al cargar los datos necesarios');
    } finally {
      this.loadingData.set(false);
    }
  }

  protected async onItemChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const itemId = select.value;

    if (!itemId) {
      this.selectedItem.set(null);
      return;
    }

    const item = this.items().find((i) => i.id === itemId);
    this.selectedItem.set(item || null);
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (
      this.kardexForm.item_id().invalid() ||
      this.kardexForm.batch_code().invalid() ||
      this.kardexForm.quantity_base().invalid()
    ) {
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.kardexModel();
      const {
        data: { user: currentUser },
      } = await this.authService.getUser();

      const payload: KardexPayload = {
        id: uuidv7(),
        item_id: formData.item_id,
        batch_code: formData.batch_code || null,
        quantity_base: Number(formData.quantity_base),
        notes: formData.notes || null,
        created_by: currentUser?.id || null,
      };

      await this.kardexService.createKardexEntry(payload);

      this.success.set(true);
      setTimeout(() => {
        this.router.navigate(['/inventario/kardex']);
      }, 1500);
    } catch (error) {
      console.error('Error al registrar lote:', error);
      this.error.set('Error al registrar el lote de kardex');
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel() {
    this.router.navigate(['/inventario/kardex']);
  }
}
