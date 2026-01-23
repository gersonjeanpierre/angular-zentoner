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
  TicketDataModel,
  TicketItemModel,
  TicketTransformer,
  Order,
  OrderDetail,
  OrderStatus,
} from '@data/models/tickets';
import { TicketPreview } from './ticket-preview/ticket-preview';
import { ModalSearch } from './modal-search/modal-search';
import { SearchModal, SearchableItem } from '@shared/components/search-modal/search-modal';
import { ITEM_MACHINE, ITEM_SIZE, ITEM_TYPE, METHOD_PAYMENT } from '@data/constants';
import { v7 as uuidv7 } from 'uuid';
import { PRINTING_CATEGORIES } from '@data/constants/categories';
import { CustomerService } from '@core/services/customer-service';
import { EmployeeService } from '@core/services/employee-service';
import { OrderService } from '@core/services/order-service';
import { AuthService } from '@core/services/auth-service';

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
  protected readonly methodsPayment: string[] = METHOD_PAYMENT;

  // Modal state
  protected modalOpen = signal(false);
  protected modalList = signal<string[]>([]);
  protected modalTitle = signal('');
  protected isCustomSize = signal(false);
  private modalTarget:
    | { index: number; field: 'category' | 'size' | 'type' | 'machine' }
    | { field: 'methodOfPayment' }
    | null = null;

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

  // Form model
  ticketModel = signal<TicketDataModel>({
    companyName: 'LASER COLOR VELOZ',
    address: 'JR. ORBEGOSO 243 PISO 1 STAND 243',
    socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
    ruc: '20607873411',
    correlative: 777,
    designer: '',
    client: '',
    methodOfPayment: 'YAPE',
    creationDate: new Date(),
    saleDetails: [],
    totalPrice: 0,
    advance: 0,
    discount: 0,
    igv: 0,
    saldo: 0,
    finalAmount: 0,
    printDate: new Date(),
  });

  // Form instance
  ticketForm = form(this.ticketModel);

  // IGV checkbox
  includeIGV = signal(true);

  // Ticket UUID for QR code
  protected ticketUuid = signal<string | null>(null);

  // Computed values for totals
  protected totalPrice = computed(() => {
    const details = this.ticketForm.saleDetails().value();
    return details.reduce((sum, item) => sum + (item.total || 0), 0);
  });

  protected igvAmount = computed(() => {
    return this.includeIGV() ? this.totalPrice() * 0.18 : 0;
  });

  protected saldoAmount = computed(() => {
    const advance = this.ticketForm.advance().value();
    return this.totalPrice() - advance;
  });

  protected finalAmount = computed(() => {
    const discount = this.ticketForm.discount().value();
    const advance = this.ticketForm.advance().value();
    return this.totalPrice() - discount + this.igvAmount() - advance;
  });

  /**
   * Getter reactivo para compatibilidad con template
   * Combina modelo base con totales calculados
   */
  protected get ticketData(): TicketDataModel {
    return {
      ...this.ticketModel(),
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      saldo: this.saldoAmount(),
      finalAmount: this.finalAmount(),
    };
  }

  ngOnInit() {
    this.initUser();
    this.updateTotalsInModel();
  }

  private async initUser() {
    try {
      const userProfile = await this.authService.getUserProfileData();
      if (userProfile.roles.includes(4)) {
        console.log('Diseñador fijo asignado:', userProfile);
        this.isDesignerFixed.set(true);
        this.selectedEmployeeId.set(userProfile.id);
        this.ticketForm.designer().value.set(userProfile.name);
      }
    } catch (error) {
      console.error('Error obteniendo perfil de usuario:', error);
    }
  }

  /**
   * Genera UUID v7 para el código QR del ticket
   */
  protected generateTicketQR(): void {
    this.ticketUuid.set(uuidv7());
  }

  /**
   * Actualiza los totales calculados en el modelo signal
   * Se llama después de cada cambio en items o descuentos
   */
  protected updateTotalsInModel(): void {
    this.ticketModel.update((data) => ({
      ...data,
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      saldo: this.saldoAmount(),
      finalAmount: this.finalAmount(),
    }));
  }

  /**
   * Abre modal de selección para campos de items de venta
   * @param index - Índice del item en saleDetails
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
      const item = this.ticketForm.saleDetails().value()[index];
      const category = this.category.find((c) => c.name === item.category);
      this.modalList.set(category ? category.itemTypes : this.types);
      this.modalTitle.set('Seleccionar Tipo');
      this.isCustomSize.set(false);
    } else if (field === 'size') {
      const item = this.ticketForm.saleDetails().value()[index];
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
      const item = this.ticketForm.saleDetails().value()[index];
      const category = this.category.find((c) => c.name === item.category);
      this.modalList.set(category ? category.compatibleMachines : this.machines);
      this.modalTitle.set('Seleccionar Máquina');
      this.isCustomSize.set(false);
    }
    this.modalOpen.set(true);
  }

  /**
   * Abre modal de selección de método de pago
   */
  protected openModalForMethodPayment(): void {
    this.modalTarget = { field: 'methodOfPayment' };
    this.modalList.set(this.methodsPayment);
    this.modalTitle.set('Seleccionar Método de Pago');
    this.modalOpen.set(true);
  }

  /**
   * Maneja la selección de un valor en el modal
   * @param value - Valor seleccionado del modal
   */
  protected onModalSelect(value: string): void {
    if (!this.modalTarget) return;

    if ('index' in this.modalTarget) {
      const { index, field } = this.modalTarget;
      const saleDetails = [...this.ticketForm.saleDetails().value()];
      if (field === 'category') {
        saleDetails[index].category = value;
        saleDetails[index].size = '';
        saleDetails[index].type = '';
        saleDetails[index].machine = '';
      } else {
        saleDetails[index][field] = value;
      }
      this.ticketForm.saleDetails().value.set(saleDetails);
      this.updateTotalsInModel();
    } else if (this.modalTarget.field === 'methodOfPayment') {
      this.ticketForm.methodOfPayment().value.set(value);
    }

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
   * Agrega un nuevo item vacío a la lista de venta
   */
  protected addSaleItem(): void {
    const currentDetails = this.ticketForm.saleDetails().value();
    const newItem: TicketItemModel = {
      category: '',
      size: '',
      type: '',
      machine: '',
      quantity: 1,
      price: 0,
      total: 0,
    };
    this.ticketForm.saleDetails().value.set([...currentDetails, newItem]);
    this.updateTotalsInModel();
  }

  /**
   * Elimina un item de la lista de venta
   * @param index - Índice del item a eliminar
   */
  protected removeSaleItem(index: number): void {
    const currentDetails = this.ticketForm.saleDetails().value();
    const updated = currentDetails.filter((_, i) => i !== index);
    this.ticketForm.saleDetails().value.set(updated);
    this.updateTotalsInModel();
  }

  /**
   * Actualiza un campo específico de un item de venta
   * Recalcula automáticamente el total del item
   * @param index - Índice del item
   * @param field - Campo a actualizar
   * @param value - Nuevo valor
   */
  protected updateSaleItem(
    index: number,
    field: keyof TicketItemModel,
    value: string | number,
  ): void {
    const saleDetails = [...this.ticketForm.saleDetails().value()];
    const item = saleDetails[index];

    if (field === 'size' || field === 'type' || field === 'machine') {
      item[field] = value as string;
    } else if (field === 'quantity' || field === 'price') {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      item[field] = numValue;
      item.total = item.quantity * item.price;
    } else if (field === 'total') {
      item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    }

    this.ticketForm.saleDetails().value.set(saleDetails);
    this.updateTotalsInModel();
  }

  /**
   * Actualiza el monto de adelanto y recalcula totales
   * @param value - Nuevo monto de adelanto
   */
  protected updateAdvance(value: number): void {
    this.ticketForm.advance().value.set(value || 0);
    this.updateTotalsInModel();
  }

  /**
   * Actualiza el descuento y recalcula totales
   * @param value - Nuevo monto de descuento
   */
  protected updateDiscount(value: number): void {
    this.ticketForm.discount().value.set(value || 0);
    this.updateTotalsInModel();
  }

  /**
   * Imprime el ticket en formato físico (76mm)
   * Convierte canvas QR a imagen antes de clonar para impresión
   */
  protected printTicket(): void {
    this.ticketModel.update((data) => ({ ...data, printDate: new Date() }));
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
   * @param preview - Elemento HTML del preview del ticket
   */
  private setupPrintWindow(printWindow: Window, preview: Element): void {
    const doc = printWindow.document;
    doc.head.innerHTML = '';
    doc.body.innerHTML = '';

    const title = doc.createElement('title');
    title.textContent = `Ticket - ${this.ticketData.companyName}`;
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
    this.ticketForm.client().value.set(item.displayText);
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

      console.log('Empleados cargados en order-create:', response);

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
    this.ticketForm.designer().value.set(item.displayText);
    this.employeeModalOpen.set(false);
  }

  /**
   * Guarda el ticket como orden en la base de datos
   * Valida datos requeridos y transforma modelos usando TicketTransformer
   * Genera QR con el ID de la orden creada
   *
   * @throws Error si falla la inserción en BD
   */
  protected async saveOrder() {
    // Validaciones previas
    if (!this.selectedCustomerId()) {
      alert('Debe seleccionar un cliente');
      return;
    }

    if (!this.selectedEmployeeId()) {
      alert('Debe seleccionar un diseñador');
      return;
    }

    if (this.ticketData.saleDetails.length === 0) {
      alert('Debe agregar al menos un producto/servicio');
      return;
    }

    // Validar que todos los items tengan precio y cantidad
    const invalidItems = this.ticketData.saleDetails.filter(
      (item) => item.quantity <= 0 || item.price <= 0,
    );

    if (invalidItems.length > 0) {
      alert('Todos los items deben tener cantidad y precio válidos');
      return;
    }

    try {
      // TODO: Obtener shop_id de la sesión del usuario autenticado
      const shopId = crypto.randomUUID(); // Temporal

      // Transformar TicketDataModel a Order usando el helper
      const order: Order = TicketTransformer.toOrder(
        this.ticketData,
        this.selectedCustomerId(),
        this.selectedEmployeeId(),
        shopId,
        OrderStatus.PENDIENTE,
      );

      // Transformar TicketItemModel[] a OrderDetail[] usando el helper
      const orderDetails: OrderDetail[] = TicketTransformer.toOrderDetails(
        this.ticketData.saleDetails,
      );

      // Guardar en base de datos
      const orderId = await this.orderService.createOrder(order, orderDetails);

      // Éxito: generar QR con el ID de la orden
      this.ticketUuid.set(orderId);

      alert(`✅ Orden #${orderId} guardada exitosamente`);

      // Opcional: Limpiar formulario o navegar a vista de órdenes
      // this.resetForm();
    } catch (error) {
      console.error('Error al guardar orden:', error);
      alert('❌ Error al guardar la orden. Por favor intente nuevamente.');
    }
  }
}
