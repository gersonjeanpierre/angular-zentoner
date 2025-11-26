import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup, FormArray } from '@angular/forms';
import { CustomerService } from '../customer-service';
import { CustomerPayload } from '@core/customer/customer-model';
import { v7 as uuidv7 } from 'uuid';
import { Router } from '@angular/router';

import { generateCustomerCode } from '../utils/customer-utils';

@Component({
  selector: 'app-customers-create',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './customers-create.html',
  styleUrl: './customers-create.css',
})
export default class CustomersCreate {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomerService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  form = this.fb.group({
    firstName: [''],
    lastName: [''],
    legalName: [''],
    email: ['', [Validators.email]],
    phone: ['+51', [Validators.required]],
    dni: [''],
    ruc: [''],
    ce: [''],
    personType: [''],
    customerCode: [''],
    customerType: [''],
    notes: this.fb.array<FormGroup>([]),
  });

  get notesArray() {
    return this.form.get('notes') as FormArray<FormGroup>;
  }

  addNote() {
    this.notesArray.push(this.fb.group({ key: [''], value: [''] }));
  }

  removeNote(index: number) {
    this.notesArray.removeAt(index);
  }

  private serializeNotes(): Record<string, string> | null {
    const notesArr = this.notesArray.value as Array<{ key: string; value: string }>;
    const notesObj: Record<string, string> = {};
    for (const { key, value } of notesArr) {
      if (key && key.trim()) notesObj[key.trim()] = value;
    }
    return Object.keys(notesObj).length ? notesObj : null;
  }

  generateCode() {
    const { firstName, lastName } = this.form.value;
    if (!firstName || !lastName) return;
    
    const code = generateCustomerCode(firstName, lastName);
    this.form.patchValue({ customerCode: code });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const raw = this.form.value;
    const customer: CustomerPayload = {
      id: uuidv7(),
      firstName: raw.firstName ?? '',
      lastName: raw.lastName ?? '',
      legalName: raw.legalName || null,
      email: raw.email || null,
      phone: raw.phone || null,
      dni: raw.dni || null,
      ruc: raw.ruc || null,
      ce: raw.ce || null,
      personType: (raw.personType || '') as 'JURIDICA' | 'NATURAL',
      customerCode: raw.customerCode || null,
      customerType: (raw.customerType || '') as
        | 'NUEVO'
        | 'FRECUENTE'
        | 'IMPRENTERO_NUEVO'
        | 'IMPRENTERO_FRECUENTE',
      notes: this.serializeNotes(),
    };
    try {
      await this.customersService.createCustomer(customer);
      this.success.set(true);
      setTimeout(() => this.router.navigate(['/clientes']), 800);
    } catch (e: any) {
      this.error.set(e.message || 'Error al crear cliente');
    } finally {
      this.loading.set(false);
    }
  }
}
