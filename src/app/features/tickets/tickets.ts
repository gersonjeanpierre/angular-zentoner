import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  signal,
  inject,
  resource,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { AlertModal, AlertType } from '@shared/components/alert-modal/alert-modal';
import { ITEM_MACHINE, ITEM_SIZE, ITEM_TYPE } from '@data/constants';
import { v7 as uuidv7 } from 'uuid';
import { PRINTING_CATEGORIES } from '@data/constants/categories';
import { CustomerService } from '@core/services/customer-service';
import { EmployeeService } from '@core/services/employee-service';
import { OrderService } from '@core/services/order-service';
import { AuthService } from '@core/services/auth-service';
import { splitNamesForDisplayFitText } from '@shared/utils/functions/split-names';
import { ShopService } from '@core/services/shop-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tickets',
  imports: [FormField, TicketPreview, ModalSearch, SearchModal, AlertModal],
  templateUrl: './tickets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Tickets {
  // Services
  private readonly customerService = inject(CustomerService);
  private readonly employeeService = inject(EmployeeService);
  private readonly orderService = inject(OrderService);
  private readonly authService = inject(AuthService);
  private readonly shopService = inject(ShopService);
  private readonly router = inject(Router);

  // Constants
  protected readonly sizes: string[] = ITEM_SIZE;
  protected readonly types: string[] = ITEM_TYPE;
  protected readonly machines: string[] = ITEM_MACHINE;
  protected readonly category = PRINTING_CATEGORIES;
  protected readonly categories = this.category.map((c) => c.name);

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
  protected syncingCustomers = signal(false);
  protected syncingEmployees = signal(false);
  protected selectedCustomerId = signal<string>('');
  protected selectedEmployeeId = signal<string>('');

  // Alert Modal state
  protected alertModalOpen = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('info');

  // Observables reactivos de Dexie - se actualizan automáticamente
  private readonly allCustomers = toSignal(this.customerService.dataCustomers$, {
    initialValue: [],
  });

  private readonly allEmployees = toSignal(this.employeeService.dataEmployees$, {
    initialValue: [],
  });

  private readonly allShops = toSignal(this.shopService.dataShops$, {
    initialValue: [],
  });

  // Computed: mapea customers de Dexie a SearchableItems
  protected readonly customersSearchable = computed((): SearchableItem[] => {
    return this.allCustomers()
      .filter((c) => !c.customerDeletedAt && !c.personDeletedAt)
      .map((customer) => ({
        id: customer.id,
        displayText: customer.legalName || `${customer.firstName} ${customer.lastName}`,
        subtitle:
          customer.phone || customer.email || customer.dni || customer.ruc || 'Sin contacto',
        displayFitText: splitNamesForDisplayFitText(customer.firstName!, customer.lastName!),
        metadata: customer,
      }));
  });

  // Computed: mapea employees de Dexie a SearchableItems
  protected readonly employeesSearchable = computed((): SearchableItem[] => {
    return this.allEmployees().map((employee) => ({
      id: employee.employeeId,
      displayText: `${employee.firstName} ${employee.lastName}`,
      metadata: employee,
    }));
  });

  protected readonly shopList = computed(() => {
    const shops = this.allShops();
    return shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      address: shop.address,
    }));
  });

  // Resource para carga inicial de datos
  protected readonly loadResource = resource({
    loader: async () => {
      await Promise.all([
        this.customerService.ensureCustomersLoaded(),
        this.employeeService.ensureEmployeesLoaded(),
      ]);
      return { loaded: true };
    },
  });

  // Resource para cargar el perfil del usuario de forma declarativa
  protected readonly userProfileResource = resource({
    loader: async () => {
      return await this.authService.getUserProfileData();
    },
  });

  // Computed signals para estados de UI basados en resource
  protected readonly loading = computed(() => this.userProfileResource.isLoading());
  protected readonly error = computed(() => this.userProfileResource.error()?.message ?? null);

  // Computed: userProfile del resource
  protected readonly userProfile = computed(() => this.userProfileResource.value());

  // Computed: address reactivo basado en shops y userProfile
  protected readonly computedAddress = computed(() => {
    const profile = this.userProfile();
    const shops = this.allShops();

    if (!profile || shops.length === 0) return '';

    const userShop = shops.find((shop) => shop.id === profile.shopId) || shops[0];
    return userShop?.address ?? '';
  });

  // Computed: determina si el usuario es diseñador (role 4)
  protected readonly isDesignerRole = computed(() => {
    const profile = this.userProfile();
    console.log('--- User Profile ---', profile);
    console.log('--> Is DESIGNER:', profile?.roles.includes(4) ?? false);
    return profile?.roles.includes(4) ?? false;
  });

  // Computed: nombre del empleado - auto-asigna si es diseñador
  protected readonly computedEmployeeName = computed(() => {
    if (this.isDesignerRole()) {
      const profile = this.userProfile();

      return profile?.name ?? '';
    }
    return this.orderFormModel().employeeName;
  });

  // Computed: ID del empleado - auto-asigna si es diseñador
  protected readonly computedEmployeeId = computed(() => {
    if (this.isDesignerRole()) {
      const profile = this.userProfile();
      console.log('<--<- User Profile ---', profile);
      return profile?.id ?? '';
    }
    return this.selectedEmployeeId();
  });

  // === Form Model ===
  // Modelo de formulario para crear órdenes (alineado con sales.orders)
  protected orderFormModel = signal<OrderFormModel>({
    // Información de empresa (estática)
    companyName: 'LASER COLOR VELOZ',
    address: '', // Se llenará reactivamente desde computedAddress

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

  // Checkboxes para controlar qué campos mostrar/calcular
  protected includeIGV = signal(true);
  protected showAdvance = signal(false);
  protected showDiscount = signal(false);

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
    const discount = this.showDiscount() ? this.orderForm.discount().value() : 0;
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
    const advance = this.showAdvance() ? this.orderForm.advance().value() : 0;
    return finalAmount - advance;
  });

  /**
   * final_amount: Monto final de la orden
   * Fórmula: total_price - discount + igv
   * Constraint: final_amount >= 0
   */
  protected finalAmount = computed(() => {
    const totalPrice = this.totalPrice();
    const discount = this.showDiscount() ? this.orderForm.discount().value() : 0;
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
    const advance = this.showAdvance() ? this.orderForm.advance().value() : 0;

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
      address: this.computedAddress(),
      employeeName: this.computedEmployeeName(),
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      remainingBalance: this.remainingBalance(),
      finalAmount: this.finalAmount(),
    };
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
      address: this.computedAddress(), // Sincroniza address reactivo
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

    // Actualizar campo según tipo
    switch (field) {
      case 'size':
      case 'type':
      case 'machine':
      case 'category':
      case 'description':
        item[field] = value as string;
        break;

      case 'quantity':
      case 'price':
        item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
        // Recalcular subtotal usando el helper
        item.total = OrderItemValidator.calculateSubtotal(item);
        break;

      case 'total':
        item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
        break;
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
   * Los datos se cargan automáticamente desde Dexie
   */
  protected openCustomerModal() {
    this.customerItems.set(this.customersSearchable());
    this.customerModalOpen.set(true);
  }

  /**
   * Maneja la búsqueda de clientes en tiempo real (filtrado local)
   */
  protected handleCustomerSearch(searchTerm: string) {
    if (!searchTerm.trim()) {
      this.customerItems.set(this.customersSearchable());
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = this.customersSearchable().filter(
      (item) =>
        item.displayText.toLowerCase().includes(term) ||
        item.subtitle?.toLowerCase().includes(term),
    );
    this.customerItems.set(filtered);
  }

  /**
   * Maneja la selección de un cliente del modal
   * @param item - Item seleccionado con datos del cliente
   */
  protected handleCustomerSelect(item: SearchableItem) {
    this.selectedCustomerId.set(item.id);
    this.orderForm.customerName().value.set(item.displayText);
    // Auto-asignar empleado si el usuario es diseñador
    if (this.isDesignerRole()) {
      const profile = this.userProfile();
      this.selectedEmployeeId.set(profile?.id ?? '');
    }
    this.customerModalOpen.set(false);
  }

  /**
   * Abre modal de búsqueda de empleados/diseñadores
   * Los datos se cargan automáticamente desde Dexie
   * Bloqueado si el usuario es diseñador (role 4)
   */
  protected openEmployeeModal() {
    if (this.isDesignerRole()) return;
    this.employeeItems.set(this.employeesSearchable());
    this.employeeModalOpen.set(true);
  }

  /**
   * Maneja la búsqueda de empleados en tiempo real (filtrado local)
   */
  protected handleEmployeeSearch(searchTerm: string) {
    if (!searchTerm.trim()) {
      this.employeeItems.set(this.employeesSearchable());
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = this.employeesSearchable().filter((item) =>
      item.displayText.toLowerCase().includes(term),
    );
    this.employeeItems.set(filtered);
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
   * Sincroniza clientes desde Supabase: limpia caché y recarga datos
   */
  protected async syncCustomers() {
    this.syncingCustomers.set(true);
    try {
      await this.customerService.syncCustomers();
      this.customerItems.set(this.customersSearchable());
      console.log('[Tickets] Clientes sincronizados');
    } catch (error) {
      console.error('[Tickets] Error al sincronizar clientes:', error);
    } finally {
      this.syncingCustomers.set(false);
    }
  }

  /**
   * Sincroniza empleados desde Supabase: limpia caché y recarga datos
   */
  protected async syncEmployees() {
    this.syncingEmployees.set(true);
    try {
      await this.employeeService.syncEmployees();
      this.employeeItems.set(this.employeesSearchable());
      console.log('[Tickets] Empleados sincronizados');
    } catch (error) {
      console.error('[Tickets] Error al sincronizar empleados:', error);
    } finally {
      this.syncingEmployees.set(false);
    }
  }

  /**
   * Muestra una alerta modal
   * @param title - Título de la alerta
   * @param message - Mensaje de la alerta
   * @param type - Tipo de alerta (info, success, warning, error)
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

  /**
   * Valida que la orden tenga todos los datos requeridos
   * @returns true si la orden es válida, false en caso contrario
   */
  private validateOrder(): boolean {
    if (!this.selectedCustomerId()) {
      this.showAlert('Cliente requerido', 'Debe seleccionar un cliente', 'warning');
      return false;
    }

    if (!this.selectedEmployeeId()) {
      this.showAlert('Empleado requerido', 'Debe seleccionar un empleado/diseñador', 'warning');
      return false;
    }

    const items = this.orderData.items;

    if (items.length === 0) {
      this.showAlert('Items requeridos', 'Debe agregar al menos un item a la orden', 'warning');
      return false;
    }

    // Validar cada item usando el validator
    const hasInvalidItems = items.some((item) => {
      const validation = OrderItemValidator.validate(item);
      return !validation.hasValidQuantity || !validation.hasValidPrice;
    });

    if (hasInvalidItems) {
      this.showAlert(
        'Items inválidos',
        'Todos los items deben tener cantidad y precio válidos (mayores a 0)',
        'warning',
      );
      return false;
    }

    return true;
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
    if (!this.validateOrder()) return;

    // === Transformación y Persistencia ===

    try {
      // Obtener shop_id de la sesión del usuario autenticado
      const { shopId } = await this.authService.getUserProfileData();

      // Sincronizar totales calculados antes de guardar
      this.syncTotalsToModel();

      const items = this.orderData.items;

      // Transformar OrderFormModel → Order (según schema sales.orders)
      const order: Order = OrderTransformer.toOrder(
        this.orderData,
        this.selectedCustomerId(),
        this.computedEmployeeId(), // Usa el computed que considera si es diseñador
        shopId,
        1, // status_id = 1 (PENDIENTE)
      );

      // Transformar OrderItemModel[] → OrderDetail[] (según schema sales.order_details)
      const orderDetails: OrderDetail[] = OrderTransformer.toOrderDetails(items);

      // Insertar en base de datos
      const orderId = await this.orderService.createOrder(order, orderDetails);

      // Generar QR con el UUID de la orden
      this.orderUuid.set(orderId);

      console.log('[Tickets] Orden guardada exitosamente:', orderId);
      this.showAlert(
        'Orden guardada',
        `La orden ha sido guardada exitosamente con ID: ${orderId}`,
        'success',
      );
      setTimeout(() => {
        this.router.navigate(['/ventas']);
      }, 2000);
      // TODO: Opcional - Limpiar formulario o navegar a vista de órdenes
      // this.resetForm();
      // this.router.navigate(['/orders', orderId]);
    } catch (error) {
      console.error('[Tickets] Error al guardar orden:', error);
      this.showAlert(
        'Error al guardar',
        'No se pudo guardar la orden. Por favor intente nuevamente.',
        'error',
      );
      throw error;
    }
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
}
