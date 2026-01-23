import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Order, OrderDetail } from '@data/models/tickets/order-model';
import { form, required } from '@angular/forms/signals';
import { OrderService } from '@core/services/order-service';
import { CustomerService } from '@core/services/customer-service';
import { EmployeeService } from '@core/services/employee-service';
import { SearchModal, SearchableItem } from '@shared/components/search-modal/search-modal';
import { CustomerView } from '@data/models/customer/customer.model';
import { EmployeeView } from '@data/models/employee/employee.model';

interface OrderFormData {
  customerId: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  shopId: string;
  statusId: number;
  taxAmount: number;
  details: OrderDetail[];
}

@Component({
  selector: 'app-order-create',
  imports: [SearchModal],
  templateUrl: './order-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderCreate {
  private orderService = inject(OrderService);
  private customerService = inject(CustomerService);
  private employeeService = inject(EmployeeService);
  private router = inject(Router);

  // Form Model
  protected orderModel = signal<OrderFormData>({
    customerId: '',
    customerName: '',
    employeeId: '',
    employeeName: '',
    shopId: '', // TODO: Obtener de la sesión actual
    statusId: 1, // PENDIENTE
    taxAmount: 0,
    details: [],
  });

  // Form Instance
  protected orderForm = form(this.orderModel, (schemaPath) => {
    required(schemaPath.customerId, { message: 'El cliente es requerido' });
    required(schemaPath.employeeId, { message: 'El diseñador es requerido' });
  });

  // Modal States
  protected customerModalOpen = signal(false);
  protected employeeModalOpen = signal(false);

  // Search Items
  protected customerItems = signal<SearchableItem[]>([]);
  protected employeeItems = signal<SearchableItem[]>([]);
  protected isLoadingCustomers = signal(false);
  protected isLoadingEmployees = signal(false);

  // Detail Form
  protected currentDetail = signal<Partial<OrderDetail>>({
    description: '',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
    is_custom_size: false,
  });

  // Include IGV
  protected includeIGV = signal(true);

  // Computed Totals
  protected totalAmount = computed(() => {
    const details = this.orderForm.details().value();
    return details.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  });

  protected igvAmount = computed(() => {
    return this.includeIGV() ? this.totalAmount() * 0.18 : 0;
  });

  protected finalAmount = computed(() => {
    return this.totalAmount() + this.igvAmount();
  });

  // Customer Modal
  protected async openCustomerModal() {
    this.customerModalOpen.set(true);
    await this.loadCustomers();
  }

  protected async loadCustomers(searchTerm?: string) {
    this.isLoadingCustomers.set(true);
    try {
      const response = await this.customerService.getCustomers({
        status: 'ACTIVE',
        search: searchTerm,
        pageSize: 50,
      });

      const items: SearchableItem[] = response.data.map((customer) => ({
        id: customer.id,
        displayText: customer.legalName || `${customer.firstName} ${customer.lastName}`,
        subtitle: customer.email || customer.phone || customer.dni || customer.ruc || undefined,
        metadata: customer,
      }));

      this.customerItems.set(items);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      this.isLoadingCustomers.set(false);
    }
  }

  protected handleCustomerSearch(searchTerm: string) {
    this.loadCustomers(searchTerm);
  }

  protected handleCustomerSelect(item: SearchableItem) {
    const customer = item.metadata as CustomerView;
    this.orderForm.customerId().value.set(item.id);
    this.orderForm.customerName().value.set(item.displayText);
    this.customerModalOpen.set(false);
  }

  // Employee Modal
  protected async openEmployeeModal() {
    this.employeeModalOpen.set(true);
    await this.loadEmployees();
  }

  protected async loadEmployees(searchTerm?: string) {
    this.isLoadingEmployees.set(true);
    try {
      const response = await this.employeeService.getEmployees({
        search: searchTerm,
        pageSize: 50,
      });

      const items: SearchableItem[] = response.data.map((employee) => ({
        id: employee.employee_id,
        displayText: `${employee.first_name} ${employee.last_name}`,
        metadata: employee,
      }));

      this.employeeItems.set(items);
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    } finally {
      this.isLoadingEmployees.set(false);
    }
  }

  protected handleEmployeeSearch(searchTerm: string) {
    this.loadEmployees(searchTerm);
  }

  protected handleEmployeeSelect(item: SearchableItem) {
    const employee = item.metadata as EmployeeView;
    this.orderForm.employeeId().value.set(item.id);
    this.orderForm.employeeName().value.set(item.displayText);
    this.employeeModalOpen.set(false);
  }

  // Detail Management
  protected addDetail() {
    const detail = this.currentDetail();

    if (!detail.description || detail.quantity! <= 0 || detail.unit_price! <= 0) {
      alert('Complete todos los campos del detalle');
      return;
    }

    const newDetail: OrderDetail = {
      id: crypto.randomUUID(),
      description: detail.description,
      quantity: detail.quantity!,
      unit_price: detail.unit_price!,
      subtotal: detail.quantity! * detail.unit_price!,
      is_custom_size: detail.is_custom_size!,
      width_mm: detail.width_mm,
      height_mm: detail.height_mm,
      area_mm2: detail.area_mm2,
      production_notes: detail.production_notes,
    };

    const currentDetails = this.orderForm.details().value();
    this.orderForm.details().value.set([...currentDetails, newDetail]);

    // Reset detail form
    this.currentDetail.set({
      description: '',
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
      is_custom_size: false,
    });
  }

  protected removeDetail(detailId: string) {
    const currentDetails = this.orderForm.details().value();
    this.orderForm.details().value.set(currentDetails.filter((d) => d.id !== detailId));
  }

  protected updateDetailSubtotal() {
    const detail = this.currentDetail();
    const subtotal = (detail.quantity || 0) * (detail.unit_price || 0);
    this.currentDetail.set({ ...detail, subtotal });
  }

  protected handleQuantityChange(value: string) {
    const quantity = parseFloat(value) || 0;
    const detail = this.currentDetail();
    const subtotal = quantity * (detail.unit_price || 0);
    this.currentDetail.set({ ...detail, quantity, subtotal });
  }

  protected handleUnitPriceChange(value: string) {
    const unitPrice = parseFloat(value) || 0;
    const detail = this.currentDetail();
    const subtotal = (detail.quantity || 0) * unitPrice;
    this.currentDetail.set({ ...detail, unit_price: unitPrice, subtotal });
  }

  protected handleDescriptionChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.currentDetail.set({ ...this.currentDetail(), description: value });
  }

  protected handleQuantityInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.handleQuantityChange(value);
  }

  protected handleUnitPriceInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.handleUnitPriceChange(value);
  }

  protected handleIGVChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.includeIGV.set(checked);
  }

  // Submit
  protected async onSubmit(event: Event) {
    event.preventDefault();

    const formData = this.orderModel();

    if (!formData.customerId || !formData.employeeId) {
      alert('Complete todos los campos requeridos');
      return;
    }

    if (formData.details.length === 0) {
      alert('Agregue al menos un detalle a la orden');
      return;
    }

    try {
      const order: Order = {
        customer_id: formData.customerId,
        employee_id: formData.employeeId,
        shop_id: formData.shopId || crypto.randomUUID(), // TODO: Usar shop actual
        status_id: formData.statusId,
        total_amount: this.totalAmount(),
        tax_amount: this.igvAmount(),
      };

      const orderId = await this.orderService.createOrder(order, formData.details);

      alert('Orden creada exitosamente');
      this.router.navigate(['/tickets/ver', orderId]);
    } catch (error) {
      console.error('Error al crear orden:', error);
      alert('Error al crear la orden');
    }
  }

  protected cancel() {
    this.router.navigate(['/tickets']);
  }
}
