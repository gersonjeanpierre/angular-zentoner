import { Component, inject, signal, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';

import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CustomerService } from '../../../core/services/customer-service';
import { CustomerView } from '@data/models/customer/customer.model';
import camelCase from 'camelcase-keys';
import { generateCustomerCode } from '../utils/customer-utils';
import { AlertModal } from '@shared/components/alert-modal/alert-modal';
import { form, FormField, required } from '@angular/forms/signals';

interface CustomerFormModel {
  personType: string;
  firstName: string;
  lastName: string;
  legalName: string;
  phone: string;
  email: string;
  dni: string;
  ce: string;
  ruc: string;
  customerCode: string;
  customerType: 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE';
}

@Component({
  selector: 'app-customers-edit',
  imports: [RouterModule, AlertModal, FormField],
  templateUrl: './customers-edit.html',
  styleUrls: ['./customers-edit.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CustomersEditComponent implements OnInit {
  // Inyección de dependencias
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);

  // Signals - Estado del componente
  protected readonly customer = signal<CustomerView | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly notesList = signal<{ key: string; value: string }[]>([]);

  // Alert State - Protected para uso en template
  protected showAlert = false;
  protected alertTitle = '';
  protected alertMessage = '';
  protected alertType: 'info' | 'warning' | 'error' | 'success' = 'info';

  // Form Model Signal
  protected readonly customerModel = signal<CustomerFormModel>({
    personType: '',
    firstName: '',
    lastName: '',
    legalName: '',
    phone: '',
    email: '',
    dni: '',
    ce: '',
    ruc: '',
    customerCode: '',
    customerType: 'NUEVO',
  });

  // Form con validadores
  protected readonly customerForm = form(this.customerModel, (schema) => {
    required(schema.phone, { message: 'Teléfono es requerido' });
    required(schema.customerType, { message: 'Tipo de cliente es requerido' });
  });

  constructor() {
    // Auto-generate customer code
    effect(() => {
      const { firstName, lastName } = this.customerModel();
      if (firstName && lastName) {
        const code = generateCustomerCode(firstName, lastName);
        if (this.customerModel().customerCode !== code) {
          this.customerForm.customerCode().value.set(code);
        }
      }
    });
  }

  ngOnInit(): void {
    this.initializeCustomer();
  }

  private initializeCustomer(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.loadCustomer(id);
    } else {
      this.showError('ID de cliente no proporcionado');
      this.loading.set(false);
    }
  }

  private async loadCustomer(id: string): Promise<void> {
    try {
      const customer = await this.customerService.getCustomerById(id);
      const camelCasedCustomer = camelCase(customer, { deep: true });

      console.log('Loaded customer:', camelCasedCustomer);
      this.customer.set(camelCasedCustomer);
      this.populateForm(camelCasedCustomer);
      this.loading.set(false);
    } catch (err: unknown) {
      console.error('Error loading customer:', err);
      this.showError('Error al cargar el cliente');
      this.loading.set(false);
    }
  }

  private populateForm(customer: CustomerView): void {
    // Populate notes
    const notes: { key: string; value: string }[] = [];
    if (customer.notes && typeof customer.notes === 'object') {
      Object.entries(customer.notes).forEach(([key, value]) => {
        notes.push({ key, value: String(value) });
      });
    }
    this.notesList.set(notes);

    // Update form model
    this.customerModel.set({
      personType: customer.personType || '',
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      legalName: customer.legalName || '',
      phone: customer.phone || '',
      email: customer.email || '',
      dni: customer.dni || '',
      ce: customer.ce || '',
      ruc: customer.ruc || '',
      customerCode: customer.customerCode || '',
      customerType:
        (customer.customerTypeCode as
          | 'NUEVO'
          | 'FRECUENTE'
          | 'IMPRENTERO_NUEVO'
          | 'IMPRENTERO_FRECUENTE') || 'NUEVO',
    });
  }

  protected addNote(): void {
    this.notesList.update((notes) => [...notes, { key: '', value: '' }]);
  }

  protected removeNote(index: number): void {
    this.notesList.update((notes) => notes.filter((_, i) => i !== index));
  }

  protected updateNote(index: number, field: 'key' | 'value', value: string): void {
    this.notesList.update((notes) => {
      const newNotes = [...notes];
      newNotes[index] = { ...newNotes[index], [field]: value };
      return newNotes;
    });
  }

  private validateConditionalFields(): boolean {
    const model = this.customerModel();
    if (model.personType === 'NATURAL') {
      if (!model.firstName || !model.lastName) {
        this.showError('Nombres y Apellidos son requeridos para persona natural');
        return false;
      }
    } else {
      if (!model.legalName) {
        this.showError('Razón social es requerida para persona jurídica');
        return false;
      }
    }
    return true;
  }

  private serializeNotes(): Record<string, string> | null {
    const notesArr = this.notesList();
    const notesObj: Record<string, string> = {};
    for (const { key, value } of notesArr) {
      if (key && key.trim()) notesObj[key.trim()] = value;
    }
    return Object.keys(notesObj).length ? notesObj : null;
  }

  protected async onSubmit(): Promise<void> {
    // Validar campos requeridos
    if (this.customerForm.phone().invalid() || this.customerForm.customerType().invalid()) {
      this.showError('Por favor complete los campos requeridos');
      return;
    }

    if (!this.validateConditionalFields()) {
      return;
    }

    this.saving.set(true);
    this.closeAlert();

    const customerId = this.customer()?.id;
    if (!customerId) {
      this.showError('ID de cliente no encontrado');
      this.saving.set(false);
      return;
    }

    const model = this.customerModel();
    const updateData = {
      firstName: model.firstName || undefined,
      lastName: model.lastName || undefined,
      legalName: model.legalName || undefined,
      phone: model.phone,
      email: model.email || undefined,
      dni: model.dni || undefined,
      ce: model.ce || undefined,
      ruc: model.ruc || undefined,
      customerCode: model.customerCode || undefined,
      customerType: model.customerType,
      notes: this.serializeNotes() || undefined,
    };

    try {
      const updatedCustomer = await this.customerService.updateCustomer(customerId, updateData);
      this.customer.set(updatedCustomer);
      this.showSuccess('Cliente actualizado correctamente');
      this.saving.set(false);
    } catch (err: unknown) {
      console.error('Error updating customer:', err);
      this.showError('Error al actualizar el cliente');
      this.saving.set(false);
    }
  }

  protected async onDelete(): Promise<void> {
    const customer = this.customer();
    if (!customer) return;

    if (
      !confirm(
        `¿Está seguro de que desea eliminar al cliente "${customer.firstName || customer.legalName}"?`,
      )
    ) {
      return;
    }

    this.deleting.set(true);
    this.closeAlert();

    try {
      await this.customerService.softDeleteCustomer(customer.id);
      this.showSuccess('Cliente eliminado correctamente');
      this.deleting.set(false);

      // Redirect to list after 2 seconds
      setTimeout(() => {
        this.router.navigate(['/clientes']);
      }, 2000);
    } catch (err: unknown) {
      console.error('Error deleting customer:', err);
      this.showError('Error al eliminar el cliente');
      this.deleting.set(false);
    }
  }

  // Alert Modal Methods
  protected closeAlert(): void {
    this.showAlert = false;
  }

  private showError(message: string): void {
    this.alertTitle = 'Error';
    this.alertMessage = message;
    this.alertType = 'error';
    this.showAlert = true;
  }

  private showSuccess(message: string): void {
    this.alertTitle = 'Éxito';
    this.alertMessage = message;
    this.alertType = 'success';
    this.showAlert = true;
  }
}
