import { Component, HostListener } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TicketDataModel, TicketItemModel } from '@data/models/tickets';
import { TicketPreview } from './ticket-preview/ticket-preview';
import { ViewChild } from '@angular/core';
import { ModalSearch } from './modal-search/modal-search';
import { ITEM_MACHINE, ITEM_SIZE, ITEM_TYPE } from '@data/constants';

@Component({
  selector: 'app-tickets',
  imports: [FormsModule, TicketPreview, ModalSearch],
  templateUrl: './tickets.html',
})
export default class Tickets {
  // Modal search state
  modalOpen = false;
  modalList: string[] = [];
  modalTitle = '';
  modalTarget: { index: number; field: 'size' | 'type' | 'machine' } | null = null;
  sizes: string[] = ITEM_SIZE;
  types: string[] = ITEM_TYPE;
  machines: string[] = ITEM_MACHINE;

  // Abrir modal para seleccionar campo
  openModalForField(index: number, field: 'size' | 'type' | 'machine') {
    this.modalTarget = { index, field };
    if (field === 'size') {
      this.modalList = this.sizes;
      this.modalTitle = 'Seleccionar Tamaño';
    } else if (field === 'type') {
      this.modalList = this.types;
      this.modalTitle = 'Seleccionar Tipo';
    } else if (field === 'machine') {
      this.modalList = this.machines;
      this.modalTitle = 'Seleccionar Máquina';
    }
    this.modalOpen = true;
  }

  // Manejar selección del modal
  onModalSelect(value: string) {
    if (this.modalTarget) {
      const { index, field } = this.modalTarget;
      this.ticketData.saleDetails[index][field] = value;
      this.modalOpen = false;
      this.modalTarget = null;
    }
  }

  // Cerrar modal
  onModalClosed() {
    this.modalOpen = false;
    this.modalTarget = null;
  }

  @HostListener('document:keydown', ['$event'])
  handleF1(event: KeyboardEvent) {
    if (event.key === 'F1') {
      event.preventDefault();
    }
  }

  includeIGV = true; // Checkbox para incluir IGV

  ticketData: TicketDataModel = {
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
  };

  constructor() {
    this.calculateTotals();
  }

  onMaterialInputKeydown(event: KeyboardEvent) {
    if (event.key === 'F1') {
      event.preventDefault();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydownGlobal(event: KeyboardEvent) {
    if (event.key === 'F1') {
      event.preventDefault();
    }
  }

  printTicket(): void {
    this.ticketData.printDate = new Date();
    const preview = document.querySelector('.ticket-preview');
    if (!preview) return;

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) return;

    const doc = printWindow.document;
    doc.head.innerHTML = '';
    doc.body.innerHTML = '';

    const title = doc.createElement('title');
    title.textContent = `Ticket - ${this.ticketData.companyName}`;
    doc.head.appendChild(title);

    const styleLink = document.querySelector(
      'link[rel="stylesheet"][href*="styles-"]',
    ) as HTMLLinkElement;
    const cssHref = styleLink ? styleLink.href : '/zentoner/browser/styles.css';

    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles.css';
    // link.href = cssHref;
    doc.head.appendChild(link);

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

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Method to update ticket data (for demo purposes)
  updateTicketData(data: Partial<TicketDataModel>): void {
    this.ticketData = { ...this.ticketData, ...data };
  }

  // Methods for managing sale details
  addSaleItem(): void {
    this.ticketData.saleDetails.push({
      size: '',
      type: '',
      machine: '',
      quantity: 1,
      price: 0,
      total: 0,
    });
  }

  removeSaleItem(index: number): void {
    this.ticketData.saleDetails.splice(index, 1);
    this.calculateTotals();
  }

  updateSaleItem(index: number, field: keyof TicketItemModel, value: string | number): void {
    const item = this.ticketData.saleDetails[index];
    if (field === 'size' || field === 'type' || field === 'machine') {
      item[field] = value as string;
    } else if (field === 'quantity' || field === 'price') {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      item[field] = numValue;
      item.total = item.quantity * item.price;
    } else if (field === 'total') {
      item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    }
    this.calculateTotals();
  }
  calculateTotals(): void {
    // Calculate total price from sale details
    this.ticketData.totalPrice = this.ticketData.saleDetails.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    // Calculate IGV (18%) only if includeIGV is true
    this.ticketData.igv = this.includeIGV ? this.ticketData.totalPrice * 0.18 : 0;

    // Calculate final amount (total - discount + IGV - advance)
    this.ticketData.finalAmount =
      this.ticketData.totalPrice -
      this.ticketData.discount +
      this.ticketData.igv -
      this.ticketData.advance;

    // Calculate saldo (monto pendiente a pagar)
    this.ticketData.saldo = this.ticketData.totalPrice - this.ticketData.advance;
  }

  // Update methods for form fields
  updateDesigner(value: string): void {
    this.ticketData.designer = value;
  }

  updateClient(value: string): void {
    this.ticketData.client = value;
  }

  updateCreationDate(value: string): void {
    this.ticketData.creationDate = new Date(value);
  }

  updateAdvance(value: number): void {
    this.ticketData.advance = value || 0;
    this.calculateTotals();
  }

  updateDiscount(value: number): void {
    this.ticketData.discount = value || 0;
    this.calculateTotals();
  }
}
