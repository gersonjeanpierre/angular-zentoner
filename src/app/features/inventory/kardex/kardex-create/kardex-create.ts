import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField, required, min } from '@angular/forms/signals';
import { KardexService } from '@core/services/kardex-service';
import { ItemsService } from '@core/services/items-service';
import { AuthService } from '@core/services/auth-service';
import { RollTrackingFormModel } from '@data/models/inventory/kardex.model';
import { ItemView } from '@data/models/inventory/item.model';
import { v7 as uuidv7 } from 'uuid';

@Component({
  selector: 'app-kardex-create',
  imports: [CommonModule, FormField, RouterModule],
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

  protected readonly rollModel = signal<RollTrackingFormModel>({
    item_id: '',
    roll_code: '',
    current_quantity: '',
  });

  protected readonly rollForm = form(this.rollModel, (schema) => {
    required(schema.item_id, { message: 'Seleccione un item' });
    required(schema.roll_code, { message: 'Ingrese el código del rollo' });
    required(schema.current_quantity, { message: 'Ingrese la cantidad' });
    min(schema.current_quantity, 0, { message: 'La cantidad debe ser mayor a 0' });
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
      this.rollForm.item_id().invalid() ||
      this.rollForm.roll_code().invalid() ||
      this.rollForm.current_quantity().invalid()
    ) {
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.rollModel();

      await this.kardexService.registerPurchase({
        idKardex: uuidv7(),
        itemId: formData.item_id,
        rollCode: formData.roll_code,
      });

      this.success.set(true);
      setTimeout(() => {
        this.router.navigate(['/inventario/kardex']);
      }, 1500);
    } catch (error) {
      console.error('Error al registrar rollo:', error);
      this.error.set('Error al registrar el rollo en inventario');
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel() {
    this.router.navigate(['/inventario/kardex']);
  }
}
