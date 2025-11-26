import { Component, inject, signal, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';

import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CustomerService } from '../customer-service';
import { CustomerView } from '../../../core/customer/customer-model';
import camelCase from 'camelcase-keys';
import { generateCustomerCode } from '../utils/customer-utils';
import { AlertModal } from '@shared/components/alert-modal/alert-modal';
import { form, Field, required } from '@angular/forms/signals';

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
  customerType: string;
}

@Component({
  selector: 'app-customers-edit',
  standalone: true,
  imports: [RouterModule, AlertModal, Field],
  templateUrl: './customers-edit.html',
  styleUrls: ['./customers-edit.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);

  // Alert State
  showAlert = false;
  alertTitle = '';
  alertMessage = '';
  alertType: 'info' | 'warning' | 'error' | 'success' = 'info';

  // Signals
  customer = signal<CustomerView | null>(null);
  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);

  // Notes handled as a separate signal array
  notesList = signal<{ key: string; value: string }[]>([]);

  // Form Model
  customerModel = signal<CustomerFormModel>({
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

  // Form
  customerForm = form(this.customerModel, (schema) => {
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
        notes.push({ key, value });
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
      customerType: customer.customerTypeCode || 'NUEVO',
    });
  }

  addNote() {
    this.notesList.update((notes) => [...notes, { key: '', value: '' }]);
  }

  removeNote(index: number) {
    this.notesList.update((notes) => notes.filter((_, i) => i !== index));
  }

  updateNote(index: number, field: 'key' | 'value', value: string) {
    this.notesList.update((notes) => {
      const newNotes = [...notes];
      newNotes[index] = { ...newNotes[index], [field]: value };
      return newNotes;
    });
  }

  private serializeNotes(): Record<string, string> | null {
    const notesArr = this.notesList();
    const notesObj: Record<string, string> = {};
    for (const { key, value } of notesArr) {
      if (key && key.trim()) notesObj[key.trim()] = value;
    }
    return Object.keys(notesObj).length ? notesObj : null;
  }

  async onSubmit(): Promise<void> {
    if (this.customerForm.invalid()) {
      this.showError('Por favor complete los campos requeridos');
      return;
    }

    // Manual validation for conditional fields
    const model = this.customerModel();
    if (model.personType === 'NATURAL') {
      if (!model.firstName || !model.lastName) {
        this.showError('Nombres y Apellidos son requeridos para persona natural');
        return;
      }
    } else {
      if (!model.legalName) {
        this.showError('Razón social es requerida para persona jurídica');
        return;
      }
    }

    this.saving.set(true);
    this.closeAlert();

    const customerId = this.customer()?.id;
    if (!customerId) {
      this.showError('ID de cliente no encontrado');
      this.saving.set(false);
      return;
    }

    const updateData = {
      firstName: model.firstName || null,
      lastName: model.lastName || null,
      legalName: model.legalName || null,
      phone: model.phone,
      email: model.email || null,
      dni: model.dni || null,
      ce: model.ce || null,
      ruc: model.ruc || null,
      customerCode: model.customerCode || null,
      customerType: model.customerType,
      notes: this.serializeNotes(),
    };

    console.log('Update data:', updateData);

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

  async onDelete(): Promise<void> {
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
  closeAlert() {
    this.showAlert = false;
  }

  showError(message: string) {
    this.alertTitle = 'Error';
    this.alertMessage = message;
    this.alertType = 'error';
    this.showAlert = true;
  }

  showSuccess(message: string) {
    this.alertTitle = 'Éxito';
    this.alertMessage = message;
    this.alertType = 'success';
    this.showAlert = true;
  }
}
