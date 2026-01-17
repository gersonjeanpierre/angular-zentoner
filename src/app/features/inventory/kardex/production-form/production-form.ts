import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { form, FormField, required, min } from '@angular/forms/signals';
import { KardexService } from '@core/services/kardex-service';
import { ItemsService } from '@core/services/items-service';
import { MachineService } from '@core/services/machine-service';
import { AuthService } from '@core/services/auth-service';
import {
  ProductionFormModel,
  RollTrackingView,
  MovementType,
  MovementReason,
} from '@data/models/inventory/kardex.model';
import { ItemView } from '@data/models/inventory/item.model';
import { MachineView } from '@data/models/inventory/machine.model';

@Component({
  selector: 'app-production-form',
  imports: [CommonModule, FormField, RouterModule],
  templateUrl: './production-form.html',
  styleUrl: './production-form.css',
})
export default class ProductionForm implements OnInit {
  private readonly router = inject(Router);
  private readonly kardexService = inject(KardexService);
  private readonly itemsService = inject(ItemsService);
  private readonly machineService = inject(MachineService);
  private readonly authService = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly loadingData = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected readonly items = signal<ItemView[]>([]);
  protected readonly machines = signal<MachineView[]>([]);
  protected readonly rolls = signal<RollTrackingView[]>([]);
  protected readonly movementTypes = signal<MovementType[]>([]);
  protected readonly movementReasons = signal<MovementReason[]>([]);

  protected readonly selectedItem = signal<ItemView | null>(null);
  protected readonly selectedRoll = signal<RollTrackingView | null>(null);

  // Computed signals
  protected readonly getTotalQuantity = computed(() => {
    const formData = this.productionModel();
    return (
      Number(formData.customer_quantity || 0) +
      Number(formData.calibration_waste || 0) +
      Number(formData.error_waste || 0)
    );
  });

  // Eliminado getPercentage - no existe initial_quantity en el schema

  protected readonly productionModel = signal<ProductionFormModel>({
    movement_type_id: '2', // SALIDA
    movement_reason_id: '3', // PRODUCCION
    roll_id: '',
    machine_id: '',
    operator_id: '',
    job_name: '',
    order_detail_id: '',
    customer_quantity: '',
    calibration_waste: '',
    error_waste: '',
    width_used_mm: '',
    length_used_mm: '',
    notes: '',
  });

  protected readonly productionForm = form(this.productionModel, (schema) => {
    required(schema.movement_type_id, { message: 'Tipo de movimiento requerido' });
    required(schema.movement_reason_id, { message: 'Razón de movimiento requerida' });
    required(schema.roll_id, { message: 'Seleccione un rollo' });
    required(schema.machine_id, { message: 'Seleccione una máquina' });
    required(schema.job_name, { message: 'Ingrese el nombre del trabajo' });
    required(schema.customer_quantity, { message: 'Ingrese la cantidad del cliente' });
    min(schema.customer_quantity, 0, { message: 'La cantidad debe ser >= 0' });
    min(schema.calibration_waste, 0, { message: 'La merma debe ser >= 0' });
    min(schema.error_waste, 0, { message: 'El error debe ser >= 0' });
  });

  async ngOnInit() {
    await this.loadInitialData();
  }

  private async loadInitialData() {
    try {
      this.loadingData.set(true);

      const [itemsResponse, machines, movementTypes, movementReasons] = await Promise.all([
        this.itemsService.getItems({ status: 'ACTIVE', pageSize: 1000 }),
        this.machineService.getMachines({ status: 'ACTIVE' }),
        this.kardexService.getMovementTypes(),
        this.kardexService.getMovementReasons(),
      ]);

      this.items.set(itemsResponse.data);
      this.machines.set(machines);
      this.movementTypes.set(movementTypes);
      this.movementReasons.set(movementReasons);
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
      this.rolls.set([]);
      return;
    }

    const item = this.items().find((i) => i.id === itemId);
    this.selectedItem.set(item || null);

    // Cargar rollos disponibles del item
    try {
      const rolls = await this.kardexService.getRollsByItem(itemId);
      this.rolls.set(rolls);
    } catch (error) {
      console.error('Error al cargar rollos:', error);
      this.rolls.set([]);
    }
  }

  protected async onRollChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const rollId = select.value;

    if (!rollId) {
      this.selectedRoll.set(null);
      return;
    }

    const roll = this.rolls().find((r) => r.id === rollId);
    this.selectedRoll.set(roll || null);
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (
      this.productionForm.roll_id().invalid() ||
      this.productionForm.machine_id().invalid() ||
      this.productionForm.job_name().invalid() ||
      this.productionForm.customer_quantity().invalid()
    ) {
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.productionModel();
      const {
        data: { user: currentUser },
      } = await this.authService.getUser();

      const totalQuantity =
        Number(formData.customer_quantity) +
        Number(formData.calibration_waste || 0) +
        Number(formData.error_waste || 0);

      // Validar que el rollo tenga suficiente cantidad
      if (this.selectedRoll() && this.selectedRoll()!.current_quantity < totalQuantity) {
        this.error.set(
          `Stock insuficiente. Disponible: ${this.selectedRoll()!.current_quantity}, Necesario: ${totalQuantity}`,
        );
        return;
      }

      await this.kardexService.registerProduction({
        rollId: formData.roll_id,
        machineId: formData.machine_id,
        operatorId: currentUser?.id,
        jobName: formData.job_name,
        orderDetailId: formData.order_detail_id || undefined,
        customerQuantity: Number(formData.customer_quantity),
        calibrationWaste: Number(formData.calibration_waste || 0),
        errorWaste: Number(formData.error_waste || 0),
        widthUsedMm: formData.width_used_mm ? Number(formData.width_used_mm) : undefined,
        lengthUsedMm: formData.length_used_mm ? Number(formData.length_used_mm) : undefined,
        notes: formData.notes || undefined,
      });

      this.success.set(true);
      setTimeout(() => {
        this.router.navigate(['/inventario/kardex']);
      }, 1500);
    } catch (error) {
      console.error('Error al registrar producción:', error);
      this.error.set('Error al registrar la producción');
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel() {
    this.router.navigate(['/inventario/kardex']);
  }
}
