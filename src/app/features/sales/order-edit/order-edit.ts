import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderDetail } from '@data/models/tickets/order-model';
import { form, required } from '@angular/forms/signals';
import { OrderService, OrderWithDetails } from '@core/services/order-service';
import { CustomerService } from '@core/services/customer-service';
import { EmployeeService } from '@core/services/employee-service';
import { SearchModal, SearchableItem } from '@shared/components/search-modal/search-modal';
import { CustomerView } from '@data/models/customer/customer.model';
import { EmployeeView } from '@data/models/employee/employee.model';
import { AlertModal, AlertType } from '@shared/components/alert-modal/alert-modal';

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
  selector: 'app-order-edit',
  imports: [SearchModal, AlertModal],
  templateUrl: './order-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderEdit {
  private orderService = inject(OrderService);
  private customerService = inject(CustomerService);
  private employeeService = inject(EmployeeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected orderId = signal<string | null>(null);
  protected isLoading = signal(true);

  protected orderModel = signal<OrderFormData>({
    customerId: '',
    customerName: '',
    employeeId: '',
    employeeName: '',
    shopId: '',
    statusId: 1,
    taxAmount: 0,
    details: [],
  });

  protected orderForm = form(this.orderModel, (schemaPath) => {
    required(schemaPath.customerId, { message: 'El cliente es requerido' });
    required(schemaPath.employeeId, { message: 'El diseñador es requerido' });
  });

  protected customerModalOpen = signal(false);
  protected employeeModalOpen = signal(false);
  protected customerItems = signal<SearchableItem[]>([]);
  protected employeeItems = signal<SearchableItem[]>([]);
  protected isLoadingCustomers = signal(false);
  protected isLoadingEmployees = signal(false);

  // Alert Modal signals
  protected alertModalOpen = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('info');

  protected currentDetail = signal<Partial<OrderDetail>>({
    description: '',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
    is_custom_size: false,
  });

  protected includeIGV = signal(true);

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

  constructor() {
    this.loadOrder();
  }

  private async loadOrder() {
    const orderId = this.route.snapshot.paramMap.get('id');

    if (!orderId) {
      this.router.navigate(['/tickets']);
      return;
    }

    this.orderId.set(orderId);

    try {
      const order = await this.orderService.getOrderById(orderId);

      if (!order) {
        this.showAlert('Orden no encontrada', 'La orden solicitada no existe', 'error');
        setTimeout(() => {
          this.router.navigate(['/tickets']);
        }, 2000);
        return;
      }

      this.orderModel.set({
        customerId: order.customer_id,
        customerName: order.customerName || order.customer_id,
        employeeId: order.employee_id,
        employeeName: order.employeeName || order.employee_id,
        shopId: order.shop_id,
        statusId: order.status_id,
        taxAmount: order.igv || 0,
        details: order.details || [],
      });

      this.includeIGV.set((order.igv || 0) > 0);
    } catch (error) {
      console.error('Error al cargar orden:', error);
      this.showAlert('Error al cargar orden', 'Error al cargar la orden', 'error');
      setTimeout(() => {
        this.router.navigate(['/tickets']);
      }, 2000);
    } finally {
      this.isLoading.set(false);
    }
  }

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
    this.orderForm.customerId().value.set(item.id);
    this.orderForm.customerName().value.set(item.displayText);
    this.customerModalOpen.set(false);
  }

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
        id: employee.employeeId,
        displayText: `${employee.firstName} ${employee.lastName}`,
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
    this.orderForm.employeeId().value.set(item.id);
    this.orderForm.employeeName().value.set(item.displayText);
    this.employeeModalOpen.set(false);
  }

  protected addDetail() {
    const detail = this.currentDetail();

    if (!detail.description || detail.quantity! <= 0 || detail.unit_price! <= 0) {
      this.showAlert('Campos requeridos', 'Complete todos los campos del detalle', 'warning');
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

  protected async onSubmit(event: Event) {
    event.preventDefault();

    const formData = this.orderModel();
    const orderId = this.orderId();

    if (!orderId) return;

    if (!formData.customerId || !formData.employeeId) {
      this.showAlert('Campos requeridos', 'Complete todos los campos requeridos', 'warning');
      return;
    }

    try {
      const order: Partial<Order> = {
        customer_id: formData.customerId,
        employee_id: formData.employeeId,
        shop_id: formData.shopId,
        status_id: formData.statusId,
        total_price: this.totalAmount(),
        discount: 0,
        igv: this.igvAmount(),
        final_amount: this.finalAmount(),
        advance: 0,
        remaining_balance: this.finalAmount(),
        payment_status: 'PENDIENTE',
      };

      await this.orderService.updateOrder(orderId, order);

      this.showAlert('Orden actualizada', 'Orden actualizada exitosamente', 'success');
      setTimeout(() => {
        this.router.navigate(['/tickets/ver', orderId]);
      }, 1500);
    } catch (error) {
      console.error('Error al actualizar orden:', error);
      this.showAlert('Error al actualizar', 'Error al actualizar la orden', 'error');
    }
  }

  protected cancel() {
    const orderId = this.orderId();
    if (orderId) {
      this.router.navigate(['/tickets/ver', orderId]);
    } else {
      this.router.navigate(['/tickets']);
    }
  }

  /**
   * Muestra una alerta modal
   */
  private showAlert(title: string, message: string, type: AlertType = 'info'): void {
    this.alertTitle.set(title);
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.alertModalOpen.set(true);
  }

  /**
   * Cierra el modal de alerta
   */
  protected closeAlert(): void {
    this.alertModalOpen.set(false);
  }
}
