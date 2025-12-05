import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  effect,
  signal,
} from '@angular/core';
import { TicketDataModel } from '@data/models/tickets';
import { TicketItemModel } from '@data/models/tickets/ticket-item-model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-ticket-preview',
  imports: [],
  templateUrl: './ticket-preview.html',
})
export class TicketPreview implements AfterViewInit {
  @Input() ticketData!: TicketDataModel;
  @Input() printDate!: Date;
  @Input() includeIGV = true;
  @Input() set ticketUuid(value: string | null) {
    this._ticketUuid = value;
    // Usar setTimeout para asegurar que el DOM se haya actualizado
    if (value) {
      setTimeout(() => {
        if (this.qrCanvas) {
          this.renderQrCode();
        }
      }, 0);
    }
  }
  get ticketUuid(): string | null {
    return this._ticketUuid;
  }
  private _ticketUuid: string | null = null;

  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  constructor() {}

  ngAfterViewInit(): void {
    // Si hay un UUID pendiente y el setter no lo manejó, renderizarlo ahora
    if (this.ticketUuid && this.qrCanvas) {
      setTimeout(() => this.renderQrCode(), 0);
    }
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

  getItemDescription(item: TicketItemModel): string {
    const parts = [item.size, item.type, item.machine]
      .filter((x) => !!x)
      .map((x) => x!.toUpperCase());
    return parts.length ? parts.join(' - ') : 'Sin descripción';
  }

  private renderQrCode(): void {
    if (!this.qrCanvas || !this.ticketUuid) return;
    const canvas = this.qrCanvas.nativeElement;
    QRCode.toCanvas(
      canvas,
      this.ticketUuid,
      {
        width: 150,
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
