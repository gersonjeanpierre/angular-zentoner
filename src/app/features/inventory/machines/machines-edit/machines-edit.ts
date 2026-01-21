import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField, required } from '@angular/forms/signals';
import { MachineService } from '@core/services/machine-service';
import { ShopService } from '@core/services/shop-service';
import { MachineFormModel, MachinePayload } from '@data/models/inventory/machine.model';
import { ShopModel } from '@data/models/shop/shop-model';

@Component({
  selector: 'app-machines-edit',
  imports: [CommonModule, FormField],
  templateUrl: './machines-edit.html',
  styleUrl: './machines-edit.css',
})
export default class MachinesEdit implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly machineService = inject(MachineService);
  private readonly shopService = inject(ShopService);

  protected readonly loading = signal(false);
  protected readonly loadingData = signal(true);
  protected readonly loadingShops = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly shops = signal<ShopModel[]>([]);
  protected readonly machineId = signal<string>('');

  protected readonly machineModel = signal<MachineFormModel>({
    shop_id: '',
    name: '',
    model: '',
    metadata: {},
    is_active: true,
  });

  protected readonly machineForm = form(this.machineModel, (schema) => {
    required(schema.shop_id, { message: 'Tienda es requerida' });
    required(schema.name, { message: 'Nombre es requerido' });
  });

  async ngOnInit() {
    this.machineId.set(this.route.snapshot.params['id']);
    await Promise.all([this.loadShops(), this.loadMachine()]);
  }

  private async loadShops() {
    try {
      this.loadingShops.set(true);
      const result = await this.shopService.getShopDetails({ deletedAt: null });
      if (result.data) {
        this.shops.set(result.data);
      }
    } catch (err: any) {
      console.error('Error loading shops:', err);
      this.error.set('Error al cargar las tiendas');
    } finally {
      this.loadingShops.set(false);
    }
  }

  private async loadMachine() {
    try {
      this.loadingData.set(true);
      const machine = await this.machineService.getMachineById(this.machineId());

      if (!machine) {
        this.error.set('Máquina no encontrada');
        return;
      }

      this.machineModel.set({
        shop_id: machine.shop_id,
        name: machine.name,
        model: machine.model || '',
        metadata: machine.metadata || {},
        is_active: machine.is_active,
      });
    } catch (err: any) {
      console.error('Error loading machine:', err);
      this.error.set('Error al cargar los datos de la máquina');
    } finally {
      this.loadingData.set(false);
    }
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (this.machineForm.shop_id().invalid() || this.machineForm.name().invalid()) {
      this.error.set('Por favor completa todos los campos requeridos');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const formData = this.machineModel();
      const payload: Partial<MachinePayload> = {
        shop_id: formData.shop_id,
        name: formData.name,
        model: formData.model || null,
        metadata: formData.metadata || null,
        is_active: formData.is_active,
      };

      await this.machineService.updateMachine(this.machineId(), payload);

      this.success.set(true);
      setTimeout(() => {
        this.router.navigate(['/dashboard/inventario/maquinas']);
      }, 1500);
    } catch (err: any) {
      this.error.set(err.message || 'Error al actualizar la máquina');
      console.error('Error updating machine:', err);
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack() {
    this.router.navigate(['/dashboard/inventario/maquinas']);
  }
}
