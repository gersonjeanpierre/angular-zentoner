import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField, required } from '@angular/forms/signals';
import { MachineService } from '@core/services/machine-service';
import { ShopService } from '@core/services/shop-service';
import { MachineFormModel, MachinePayload } from '@data/models/inventory/machine.model';
import { ShopModel } from '@data/models/shop/shop-model';
import { v7 as uuidv7 } from 'uuid';

@Component({
  selector: 'app-machines-create',
  imports: [CommonModule, FormField],
  templateUrl: './machines-create.html',
  styleUrl: './machines-create.css',
})
export default class MachinesCreate implements OnInit {
  private readonly router = inject(Router);
  private readonly machineService = inject(MachineService);
  private readonly shopService = inject(ShopService);

  protected readonly loading = signal(false);
  protected readonly loadingShops = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly shops = signal<ShopModel[]>([]);

  protected readonly machineModel = signal<MachineFormModel>({
    shop_id: '',
    name: '',
    model: '',
    metadata: [] as { key: string; value: string }[],
    is_active: true,
  });

  protected readonly machineForm = form(this.machineModel, (schema) => {
    required(schema.shop_id, { message: 'Tienda es requerida' });
    required(schema.name, { message: 'Nombre es requerido' });
  });

  async ngOnInit() {
    await this.loadShops();
  }

  private async loadShops() {
    try {
      this.loadingShops.set(true);
      const result = await this.shopService.getShopDetails({ deletedAt: null });
      if (result.data) {
        this.shops.set(result.data.filter((shop) => shop.id));
        // Auto-seleccionar si hay solo una tienda
        if (result.data.length === 1) {
          this.machineForm.shop_id().value.set(result.data[0].id!);
        }
      }
    } catch (err: any) {
      console.error('Error loading shops:', err);
      this.error.set('Error al cargar las tiendas');
    } finally {
      this.loadingShops.set(false);
    }
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (!this.machineForm.shop_id().valid() || !this.machineForm.name().valid()) {
      this.error.set('Por favor completa todos los campos requeridos');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const formData = this.machineModel();
      const payload: MachinePayload = {
        id: uuidv7(),
        shop_id: formData.shop_id,
        name: formData.name,
        model: formData.model || null,
        metadata: formData.metadata || null,
        is_active: formData.is_active,
      };

      await this.machineService.createMachine(payload);

      this.success.set(true);
      setTimeout(() => {
        this.router.navigate(['/dashboard/inventario/maquinas']);
      }, 1500);
    } catch (err: any) {
      this.error.set(err.message || 'Error al crear la máquina');
      console.error('Error creating machine:', err);
    } finally {
      this.loading.set(false);
    }
  }

  get metadataArray() {
    return this.machineModel().metadata as { key: string; value: string }[];
  }

  addMetadata() {
    const current = this.machineModel().metadata as { key: string; value: string }[];
    this.machineModel.set({
      ...this.machineModel(),
      metadata: [...current, { key: '', value: '' }],
    });
  }

  removeMetadata(index: number) {
    const current = this.machineModel().metadata as { key: string; value: string }[];
    this.machineModel.set({
      ...this.machineModel(),
      metadata: current.filter((_, i) => i !== index),
    });
  }

  private serializeMetadata(): Record<string, string> | null {
    const metadata = this.machineModel().metadata as { key: string; value: string }[];
    const metadataObj: Record<string, string> = {};
    for (const { key, value } of metadata) {
      if (key && key.trim()) metadataObj[key.trim()] = value;
    }
    return Object.keys(metadataObj).length ? metadataObj : null;
  }

  protected goBack() {
    this.router.navigate(['/inventario/maquinas']);
  }
}
