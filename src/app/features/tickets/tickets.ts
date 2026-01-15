import { ChangeDetectionStrategy, Component, computed, HostListener, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { TicketDataModel, TicketItemModel } from '@data/models/tickets';
import { TicketPreview } from './ticket-preview/ticket-preview';
import { ModalSearch } from './modal-search/modal-search';
import { ITEM_MACHINE, ITEM_SIZE, ITEM_TYPE, METHOD_PAYMENT } from '@data/constants';
import { v7 as uuidv7 } from 'uuid';
import { PRINTING_CATEGORIES } from '@data/constants/categories';

@Component({
  selector: 'app-tickets',
  imports: [FormField, TicketPreview, ModalSearch],
  templateUrl: './tickets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Tickets {
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

  protected category = PRINTING_CATEGORIES;

  protected categories = this.category.map((c) => c.name);

  // Form model
  ticketModel = signal<TicketDataModel>({
    companyName: 'LASER COLOR VELOZ',
    address: 'JR. ORBEGOSO 243 PISO 1 STAND 243',
    socialReason: 'ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.',
    ruc: '20607873411',
    correlative: 777,
    designer: 'GERSON SALAS',
    client: 'JHON WICK',
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

  // Access to ticketData for template compatibility
  get ticketData(): TicketDataModel {
    return {
      ...this.ticketModel(),
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      saldo: this.saldoAmount(),
      finalAmount: this.finalAmount(),
    };
  }

  constructor() {
    this.updateTotalsInModel();
    console.log(this.category);
  }

  protected generateTicketQR(): void {
    this.ticketUuid.set(uuidv7());
  }

  private updateTotalsInModel(): void {
    this.ticketModel.update((data) => ({
      ...data,
      totalPrice: this.totalPrice(),
      igv: this.igvAmount(),
      saldo: this.saldoAmount(),
      finalAmount: this.finalAmount(),
    }));
  }

  // Modal management
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

  protected openModalForMethodPayment(): void {
    this.modalTarget = { field: 'methodOfPayment' };
    this.modalList.set(this.methodsPayment);
    this.modalTitle.set('Seleccionar Método de Pago');
    this.modalOpen.set(true);
  }

  protected onModalSelect(value: string): void {
    if (this.modalTarget) {
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
  }

  protected onModalClosed(): void {
    this.modalOpen.set(false);
    this.modalTarget = null;
    this.isCustomSize.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  handleF1(event: KeyboardEvent): void {
    if (event.key === 'F1') {
      event.preventDefault();
    }
  }

  // Sale items management
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

  protected removeSaleItem(index: number): void {
    const currentDetails = this.ticketForm.saleDetails().value();
    const updated = currentDetails.filter((_, i) => i !== index);
    this.ticketForm.saleDetails().value.set(updated);
    this.updateTotalsInModel();
  }

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

  protected calculateTotals(): void {
    this.updateTotalsInModel();
  }

  // Form field updates
  protected updateDesigner(value: string): void {
    this.ticketForm.designer().value.set(value);
  }

  protected updateClient(value: string): void {
    this.ticketForm.client().value.set(value);
  }

  protected updateAdvance(value: number): void {
    this.ticketForm.advance().value.set(value || 0);
    this.updateTotalsInModel();
  }

  protected updateDiscount(value: number): void {
    this.ticketForm.discount().value.set(value || 0);
    this.updateTotalsInModel();
  }

  // Print functionality
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

  protected formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
