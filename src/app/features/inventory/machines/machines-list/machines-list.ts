import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MachineService } from '@core/services/machine-service';
import { MachineView } from '@data/models/inventory/machine.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-machines-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './machines-list.html',
  styleUrl: './machines-list.css',
})
export default class MachinesList implements OnInit {
  private readonly router = inject(Router);
  private readonly machineService = inject(MachineService);
  private readonly searchSubject = new Subject<string>();

  // State signals
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly machines = signal<MachineView[]>([]);

  // Filter signals
  protected readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  protected readonly searchTerm = signal('');

  activeMachinesCount = computed(
    () => this.machines().filter((machine) => machine.is_active).length,
  );
  inactiveMachinesCount = computed(
    () => this.machines().filter((machine) => !machine.is_active).length,
  );

  async ngOnInit() {
    // Configurar debounce para búsqueda
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((searchTerm) => {
      this.searchTerm.set(searchTerm);
      this.loadMachines();
    });

    await this.loadMachines();
  }

  private async loadMachines() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const machines = await this.machineService.getMachines({
        status: this.statusFilter(),
        search: this.searchTerm(),
      });

      this.machines.set(machines);
    } catch (err: any) {
      this.error.set(err.message || 'Error al cargar las máquinas');
      console.error('Error loading machines:', err);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  protected onStatusFilterChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'ALL' | 'ACTIVE' | 'INACTIVE';
    this.statusFilter.set(value);
    this.loadMachines();
  }

  protected navigateToCreate() {
    this.router.navigate(['/inventario/maquinas/crear']);
  }

  protected navigateToEdit(id: string) {
    this.router.navigate(['/inventario/maquinas/editar', id]);
  }

  protected async deleteMachine(machine: MachineView) {
    if (!confirm(`¿Estás seguro de eliminar la máquina "${machine.name}"?`)) {
      return;
    }

    try {
      this.loading.set(true);
      await this.machineService.deleteMachine(machine.id);
      await this.loadMachines();
    } catch (err: any) {
      this.error.set(err.message || 'Error al eliminar la máquina');
      console.error('Error deleting machine:', err);
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack() {
    this.router.navigate(['/inventario']);
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
