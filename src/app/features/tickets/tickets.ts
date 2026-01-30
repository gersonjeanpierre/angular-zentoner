import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  signal,
  inject,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  OrderFormModel,
  OrderItemModel,
  OrderItemValidator,
  OrderTransformer,
  Order,
  OrderDetail,
} from '@data/models/tickets';
import { TicketPreview } from './ticket-preview/ticket-preview';
import { ModalSearch } from './modal-search/modal-search';
import { SearchModal, SearchableItem } from '@shared/components/search-modal/search-modal';
import { ITEM_MACHINE, ITEM_SIZE, ITEM_TYPE } from '@data/constants';
import { v7 as uuidv7 } from 'uuid';
import { PRINTING_CATEGORIES } from '@data/constants/categories';
import { CustomerService } from '@core/services/customer-service';
import { EmployeeService } from '@core/services/employee-service';
import { OrderService } from '@core/services/order-service';
import { AuthService } from '@core/services/auth-service';
import { splitNamesForDisplayFitText } from '@shared/utils/functions/split-names';
import { ShopService } from '@core/services/shop-service';

@Component({
  selector: 'app-tickets',
  imports: [FormField, TicketPreview, ModalSearch, SearchModal],
  templateUrl: './tickets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Tickets {
  // Services
  private customerService = inject(CustomerService);
  private employeeService = inject(EmployeeService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);

  // Constants
  protected readonly sizes: string[] = ITEM_SIZE;
  protected readonly types: string[] = ITEM_TYPE;
  protected readonly machines: string[] = ITEM_MACHINE;

  // Modal state para selección de campos de items
  protected modalOpen = signal(false);
  protected modalList = signal<string[]>([]);
  protected modalTitle = signal('');
  protected isCustomSize = signal(false);
  private modalTarget: {
    index: number;
    field: 'category' | 'size' | 'type' | 'machine';
  } | null = null;

  // Search Modals state
  protected customerModalOpen = signal(false);
  protected employeeModalOpen = signal(false);
  protected customerItems = signal<SearchableItem[]>([]);
  protected employeeItems = signal<SearchableItem[]>([]);
  protected isLoadingCustomers = signal(false);
  protected isLoadingEmployees = signal(false);
  protected selectedCustomerId = signal<string>('');
  protected selectedEmployeeId = signal<string>('');

  protected isDesignerFixed = signal(false);

  protected category = PRINTING_CATEGORIES;

  protected categories = this.category.map((c) => c.name);

  // === Form Model ===
  // Modelo de formulario para crear órdenes (alineado con sales.orders)
  protected orderFormModel = signal<OrderFormModel>({
    // Información de empresa (estática)
    companyName: 'LASER COLOR VELOZ',
    address: 'JR. ORBEGOSO 243 PISO 1 STAND 243',
    socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
    ruc: '20607873411',

    // Referencias
    orderNumber: 777,
    employeeName: '',
    customerName: '',

    // Fechas
    createdAt: new Date(),
    printDate: new Date(),

    // Items de la orden (sales.order_details)
    items: [],

    // Totales financieros (sales.orders)
    totalPrice: 0, // total_price
    discount: 0, // discount
    igv: 0, // igv
    finalAmount: 0, // final_amount
    advance: 0, // advance
    remainingBalance: 0, // remaining_balance
  });

  // Signal Form instance
  protected orderForm = form(this.orderFormModel);

  // IGV checkbox
  includeIGV = signal(true);

  // === Computed Totals (Alineados con sales.orders schema) ===

  /**
   * total_price: Suma de subtotales de todos los items
   * Equivale a: SUM(order_details.subtotal)
   */
  protected totalPrice = computed(() => {
    const items = this.orderForm.items().value();
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  });

  /**
   * igv: Impuesto calculado (18% en Perú)
   * Fórmula: (total_price - discount) × 0.18
   * Constraint: igv >= 0
   */
  protected igvAmount = computed(() => {
    if (!this.includeIGV()) return 0;

    const totalPrice = this.totalPrice();
    const discount = this.orderForm.discount().value();
    return (totalPrice - discount) * 0.18;
  });

  /**
   * remaining_balance: Saldo pendiente de pago
   * Fórmula: final_amount - advance
   * Constraint: remaining_balance >= 0
   *
   * Usado para calcular payment_status:
   * - remaining_balance = 0 → PAGADO
   * - remaining_balance > 0 && advance > 0 → PARCIAL
   * - remaining_balance > 0 && advance = 0 → PENDIENTE
   */
  protected remainingBalance = computed(() => {
    const finalAmount = this.finalAmount();
    const advance = this.orderForm.advance().value();
    return finalAmount - advance;
  });

  /**
   * final_amount: Monto final de la orden
   * Fórmula: total_price - discount + igv
   * Constraint: final_amount >= 0
   */
  protected finalAmount = computed(() => {
    const totalPrice = this.totalPrice();
    const discount = this.orderForm.discount().value();
    const igv = this.igvAmount();
    return totalPrice - discount + igv;
  });

  /**
   * payment_status: Estado del pago de la orden
   * Valores: 'PENDIENTE' | 'PARCIAL' | 'PAGADO'
   * Calculado según lógica del backend (05_SALES.sql)
   */
  protected paymentStatus = computed((): 'PENDIENTE' | 'PARCIAL' | 'PAGADO' => {
    const remaining = this.remainingBalance();
    const advance = this.orderForm.advance().value();

    if (remaining <= 0) return 'PAGADO';
    if (advance > 0) return 'PARCIAL';
    return 'PENDIENTE';
  });

  // UUID de la orden para código QR
  protected orderUuid = signal<string | null>(null);

  /**
   * Getter reactivo para datos de la orden combinando modelo + totales calculados
   * Usado para preview y validaciones
   */
  protected get orderData(): OrderFormModel {
    return {
      ...this.orderFormModel(),
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      remainingBalance: this.remainingBalance(),
      finalAmount: this.finalAmount(),
    };
  }

  ngOnInit() {
    this.initUser();
    this.syncTotalsToModel();
  }

  /**
   * Inicializa el usuario actual
   * Si es diseñador (role 4), lo fija automáticamente en el formulario
   */
  private async initUser() {
    try {
      const userProfile = await this.authService.getUserProfileData();

      // Si el usuario es diseñador, fijarlo automáticamente
      if (userProfile.roles.includes(4)) {
        console.log('Diseñador fijo asignado:', userProfile);
        this.isDesignerFixed.set(true);
        this.selectedEmployeeId.set(userProfile.id);
        this.orderForm.employeeName().value.set(userProfile.name);
      }
    } catch (error) {
      console.error('Error obteniendo perfil de usuario:', error);
    }
  }

  /**
   * Genera UUID v7 para el código QR de la orden
   */
  protected generateOrderQR(): void {
    this.orderUuid.set(uuidv7());
  }

  /**
   * Sincroniza los totales calculados (computed) al modelo del formulario
   * Esto es necesario para que los totales estén disponibles al guardar
   *
   * Protected porque se llama desde el template en eventos (input)
   */
  protected syncTotalsToModel(): void {
    this.orderFormModel.update((data) => ({
      ...data,
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      remainingBalance: this.remainingBalance(),
      finalAmount: this.finalAmount(),
    }));
  }

  /**
   * Abre modal de selección para campos de items de la orden
   * @param index - Índice del item en el array de items
   * @param field - Campo a editar (category, size, type, machine)
   */
  protected openModalForField(
    index: number,
    field: 'category' | 'size' | 'type' | 'machine',
  ): void {
    this.modalTarget = { index, field };
    if (field === 'category') {
      this.modalList.set(this.categories);
      this.modalTitle.set('Seleccionar Categoría');
      this.isCustomSize.set(false);
    } else if (field === 'type') {
      const item = this.orderForm.items().value()[index];
      const category = this.category.find((c) => c.name === item.category);
      this.modalList.set(category ? category.itemTypes : this.types);
      this.modalTitle.set('Seleccionar Tipo');
      this.isCustomSize.set(false);
    } else if (field === 'size') {
      const item = this.orderForm.items().value()[index];
      const category = this.category.find((c) => c.name === item.category);
      if (category && category.id === 2) {
        if (item.type && item.type.toUpperCase().includes('VINIL')) {
          this.modalList.set(['1.5']);
        } else {
          this.modalList.set(['3.2', '2.2', '2.5', '1.8', '1.6', '1.1']);
        }
        this.modalTitle.set('Seleccionar Tamaño');
        this.isCustomSize.set(true);
      } else {
        this.modalList.set(category ? category.allowedSizes : this.sizes);
        this.modalTitle.set('Seleccionar Tamaño');
        this.isCustomSize.set(false);
      }
    } else if (field === 'machine') {
      const item = this.orderForm.items().value()[index];
      const category = this.category.find((c) => c.name === item.category);
      this.modalList.set(category ? category.compatibleMachines : this.machines);
      this.modalTitle.set('Seleccionar Máquina');
      this.isCustomSize.set(false);
    }
    this.modalOpen.set(true);
  }

  /**
   * Maneja la selección de un valor en el modal
   * @param value - Valor seleccionado del modal
   */
  protected onModalSelect(value: string): void {
    if (!this.modalTarget) return;

    const { index, field } = this.modalTarget;
    const items = [...this.orderForm.items().value()];
    if (field === 'category') {
      items[index].category = value;
      items[index].size = '';
      items[index].type = '';
      items[index].machine = '';
    } else {
      items[index][field] = value;
    }
    this.orderForm.items().value.set(items);
    this.syncTotalsToModel();

    this.modalOpen.set(false);
    this.modalTarget = null;
  }

  /**
   * Maneja el cierre del modal sin selección
   */
  protected onModalClosed(): void {
    this.modalOpen.set(false);
    this.modalTarget = null;
    this.isCustomSize.set(false);
  }

  /**
   * Previene el comportamiento por defecto de F1
   */
  @HostListener('document:keydown', ['$event'])
  handleF1(event: KeyboardEvent): void {
    if (event.key === 'F1') {
      event.preventDefault();
    }
  }

  /**
   * Agrega un nuevo item vacío a la orden
   */
  protected addOrderItem(): void {
    const currentItems = this.orderForm.items().value();
    const newItem: OrderItemModel = OrderItemValidator.createEmpty();
    this.orderForm.items().value.set([...currentItems, newItem]);
    this.syncTotalsToModel();
  }

  /**
   * Elimina un item de la orden
   * @param index - Índice del item a eliminar
   */
  protected removeOrderItem(index: number): void {
    const currentItems = this.orderForm.items().value();
    const updated = currentItems.filter((_, i) => i !== index);
    this.orderForm.items().value.set(updated);
    this.syncTotalsToModel();
  }

  /**
   * Actualiza un campo específico de un item de la orden
   * Recalcula automáticamente el subtotal del item
   *
   * @param index - Índice del item
   * @param field - Campo a actualizar
   * @param value - Nuevo valor
   */
  protected updateOrderItem(
    index: number,
    field: keyof OrderItemModel,
    value: string | number,
  ): void {
    const items = [...this.orderForm.items().value()];
    const item = items[index];

    if (
      field === 'size' ||
      field === 'type' ||
      field === 'machine' ||
      field === 'category' ||
      field === 'description'
    ) {
      item[field] = value as string;
    } else if (field === 'quantity' || field === 'price') {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      item[field] = numValue;
      // Recalcular subtotal usando el helper
      item.total = OrderItemValidator.calculateSubtotal(item);
    } else if (field === 'total') {
      item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    }

    this.orderForm.items().value.set(items);
    this.syncTotalsToModel();
  }

  /**
   * Actualiza el monto de adelanto y recalcula totales
   * @param value - Nuevo monto de adelanto (advance)
   */
  protected updateAdvance(value: number): void {
    this.orderForm.advance().value.set(value || 0);
    this.syncTotalsToModel();
  }

  /**
   * Actualiza el descuento y recalcula totales
   * @param value - Nuevo monto de descuento
   */
  protected updateDiscount(value: number): void {
    this.orderForm.discount().value.set(value || 0);
    this.syncTotalsToModel();
  }

  /**
   * Imprime la orden en formato físico (76mm)
   * Convierte canvas QR a imagen antes de clonar para impresión
   */
  protected printOrder(): void {
    this.orderFormModel.update((data) => ({ ...data, printDate: new Date() }));
    const preview = document.querySelector('.ticket-preview');
    if (!preview) return;

    // Convertir canvas QR a imagen antes de clonar
    const canvas = preview.querySelector('canvas');
    if (canvas) {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.width = canvas.width;
      img.height = canvas.height;
      img.className = canvas.className;
      canvas.parentElement?.replaceChild(img, canvas);
    }

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) return;

    this.setupPrintWindow(printWindow, preview);

    // Restaurar canvas original después de un breve delay
    if (canvas) {
      const img = preview.querySelector('img[src^="data:image/png"]');
      if (img && img.parentElement) {
        img.parentElement.replaceChild(canvas, img);
      }
    }
  }

  /**
   * Configura la ventana de impresión con estilos necesarios
   * @param printWindow - Ventana de impresión
   * @param preview - Elemento HTML del preview de la orden
   */
  private setupPrintWindow(printWindow: Window, preview: Element): void {
    const doc = printWindow.document;
    doc.head.innerHTML = '';
    doc.body.innerHTML = '';

    const title = doc.createElement('title');
    title.textContent = `Orden - ${this.orderData.companyName}`;
    doc.head.appendChild(title);

    // Copiar todos los estilos inline desde el documento actual
    const allStylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    allStylesheets.forEach((stylesheet) => {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = (stylesheet as HTMLLinkElement).href;
      doc.head.appendChild(link);
    });

    // Copiar estilos inline del head
    const allStyles = Array.from(document.querySelectorAll('style'));
    allStyles.forEach((style) => {
      const newStyle = doc.createElement('style');
      newStyle.textContent = style.textContent;
      doc.head.appendChild(newStyle);
    });

    // Agregar estilos específicos para impresión
    const style = doc.createElement('style');
    style.textContent = `
      @media print {
        @page { size: 76mm auto; margin: 0; }
        body { margin: 0; padding: 0; }
      }
      body { margin: 0; padding: 0; }
    `;
    doc.head.appendChild(style);
    doc.body.appendChild(preview.cloneNode(true));

    printWindow.document.fonts.ready.then(() => {
      printWindow.focus();
    });
  }

  /**
   * Formatea fecha para visualización en español
   * @param date - Fecha a formatear
   * @returns Fecha formateada (dd/mm/yyyy hh:mm)
   */
  protected formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Abre modal de búsqueda de clientes
   * Carga automáticamente la lista de clientes activos
   */
  protected async openCustomerModal() {
    this.customerModalOpen.set(true);
    await this.loadCustomers();
  }

  /**
   * Carga lista de clientes desde Supabase
   * @param searchTerm - Término de búsqueda opcional
   */
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
        subtitle:
          customer.phone || customer.email || customer.dni || customer.ruc || 'Sin contacto',
        displayFitText: splitNamesForDisplayFitText(customer.firstName!, customer.lastName!),
        metadata: customer,
      }));

      this.customerItems.set(items);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      this.isLoadingCustomers.set(false);
    }
  }

  /**
   * Maneja la búsqueda de clientes en tiempo real
   * @param searchTerm - Término de búsqueda
   */
  protected handleCustomerSearch(searchTerm: string) {
    this.loadCustomers(searchTerm);
  }

  /**
   * Maneja la selección de un cliente del modal
   * @param item - Item seleccionado con datos del cliente
   */
  protected handleCustomerSelect(item: SearchableItem) {
    this.selectedCustomerId.set(item.id);
    this.orderForm.customerName().value.set(item.displayText);
    this.customerModalOpen.set(false);
  }

  /**
   * Abre modal de búsqueda de empleados/diseñadores
   * Carga automáticamente la lista de empleados
   */
  protected async openEmployeeModal() {
    if (this.isDesignerFixed()) return;
    this.employeeModalOpen.set(true);
    await this.loadEmployees();
  }

  /**
   * Carga lista de empleados desde Supabase
   * @param searchTerm - Término de búsqueda opcional
   */
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

  /**
   * Maneja la búsqueda de empleados en tiempo real
   * @param searchTerm - Término de búsqueda
   */
  protected handleEmployeeSearch(searchTerm: string) {
    this.loadEmployees(searchTerm);
  }

  /**
   * Maneja la selección de un empleado del modal
   * @param item - Item seleccionado con datos del empleado
   */
  protected handleEmployeeSelect(item: SearchableItem) {
    this.selectedEmployeeId.set(item.id);
    this.orderForm.employeeName().value.set(item.displayText);
    this.employeeModalOpen.set(false);
  }

  /**
   * Guarda la orden en la base de datos
   *
   * Flujo:
   * 1. Valida datos requeridos (cliente, empleado, items)
   * 2. Transforma OrderFormModel → Order + OrderDetail[]
   * 3. Inserta en sales.orders y sales.order_details
   * 4. Genera QR con el UUID de la orden creada
   *
   * @throws Error si falla la validación o inserción en BD
   */
  protected async saveOrder(): Promise<void> {
    // === Validaciones ===

    if (!this.selectedCustomerId()) {
      alert('⚠️ Debe seleccionar un cliente');
      return;
    }

    if (!this.selectedEmployeeId()) {
      alert('⚠️ Debe seleccionar un empleado/diseñador');
      return;
    }

    const items = this.orderData.items;

    if (items.length === 0) {
      alert('⚠️ Debe agregar al menos un item a la orden');
      return;
    }

    // Validar cada item usando el validator
    const invalidItems = items.filter((item) => {
      const validation = OrderItemValidator.validate(item);
      return !validation.hasValidQuantity || !validation.hasValidPrice;
    });

    if (invalidItems.length > 0) {
      alert('⚠️ Todos los items deben tener cantidad y precio válidos (mayores a 0)');
      return;
    }

    // === Transformación y Persistencia ===

    try {
      // TODO: Obtener shop_id de la sesión del usuario autenticado
      // Por ahora usamos un UUID temporal
      const shopId = (await this.authService.getUserProfileData()).shopId;

      // Sincronizar totales calculados antes de guardar
      this.syncTotalsToModel();

      // Transformar OrderFormModel → Order (según schema sales.orders)
      const order: Order = OrderTransformer.toOrder(
        this.orderData,
        this.selectedCustomerId(),
        this.selectedEmployeeId(),
        shopId,
        1, // status_id = 1 (PENDIENTE)
      );

      // Transformar OrderItemModel[] → OrderDetail[] (según schema sales.order_details)
      const orderDetails: OrderDetail[] = OrderTransformer.toOrderDetails(items);

      // Insertar en base de datos
      const orderId = await this.orderService.createOrder(order, orderDetails);

      // Generar QR con el UUID de la orden
      this.orderUuid.set(orderId);

      alert(`✅ Orden guardada exitosamente\\nID: ${orderId}`);

      // TODO: Opcional - Limpiar formulario o navegar a vista de órdenes
      // this.resetForm();
      // this.router.navigate(['/orders', orderId]);
    } catch (error) {
      console.error('❌ Error al guardar orden:', error);
      alert('❌ Error al guardar la orden. Por favor intente nuevamente.');
      throw error;
    }
  }
}
