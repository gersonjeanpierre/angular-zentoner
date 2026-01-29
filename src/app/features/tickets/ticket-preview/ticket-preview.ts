import {
  Component,
  input,
  viewChild,
  effect,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TicketDataModel, OrderFormModel, OrderItemModel } from '@data/models/tickets';
import { TicketItemModel } from '@data/models/tickets/ticket-item-model';
import QRCode from 'qrcode';

/**
 * Componente de preview de orden/ticket
 * Soporta ambos modelos: OrderFormModel (nuevo) y TicketDataModel (legacy)
 */
@Component({
  selector: 'app-ticket-preview',
  imports: [],
  templateUrl: './ticket-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketPreview {
  // Acepta ambos modelos para compatibilidad
  readonly ticketData = input.required<TicketDataModel | OrderFormModel>();
  readonly printDate = input.required<Date>();
  readonly includeIGV = input<boolean>(true);
  readonly ticketUuid = input<string | null>();

  readonly qrCanvas = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');

  constructor() {
    effect(() => {
      const uuid = this.ticketUuid();
      const canvas = this.qrCanvas();
      if (uuid && canvas) {
        this.renderQrCode();
      }
    });
  }

  // === Helpers de Compatibilidad ===

  /**
   * Obtiene el número de orden/correlativo
   * Compatible con ambos modelos
   */
  protected getOrderNumber(): number {
    const data = this.ticketData();
    return 'orderNumber' in data ? data.orderNumber! : 0;
  }

  /**
   * Obtiene el nombre del empleado/diseñador
   * Compatible con ambos modelos
   */
  protected getEmployeeName(): string {
    const data = this.ticketData();
    return 'employeeName' in data ? data.employeeName : data.designer || 'N/A';
  }

  /**
   * Obtiene el nombre del cliente
   * Compatible con ambos modelos
   */
  protected getCustomerName(): string {
    const data = this.ticketData();
    return 'customerName' in data ? data.customerName : data.customer || 'N/A';
  }

  /**
   * Obtiene los items de la orden
   * Compatible con ambos modelos
   */
  protected getItems(): Array<TicketItemModel | OrderItemModel> {
    const data = this.ticketData();
    return 'items' in data ? data.items : data.saleDetails;
  }

  /**
   * Obtiene el saldo/remaining balance
   * Compatible con ambos modelos
   */
  protected getRemainingBalance(): number {
    const data = this.ticketData();
    return 'remainingBalance' in data ? data.remainingBalance : data.saldo;
  }

  formatDate(date: Date): string {
    const format = date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return format.replace(',', '');
  }

  /**
   * Genera descripción legible del item
   * Soporta ambos modelos: TicketItemModel y OrderItemModel
   */
  getItemDescription(item: TicketItemModel | OrderItemModel): string {
    const parts = [item.size, item.type, item.machine]
      .filter((x) => !!x)
      .map((x) => x!.toUpperCase());
    return parts.length ? parts.join(' - ') : 'Sin descripción';
  }

  private renderQrCode(): void {
    const canvas = this.qrCanvas()!.nativeElement;
    const uuid = this.ticketUuid()!;
    QRCode.toCanvas(
      canvas,
      uuid,
      {
        width: 125,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (error: any) => {
        if (error) {
          console.error('Error generando QR:', error);
        }
      },
    );
  }
}
