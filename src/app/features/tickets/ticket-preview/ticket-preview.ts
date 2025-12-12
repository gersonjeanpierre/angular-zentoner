import {
  Component,
  input,
  viewChild,
  effect,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TicketDataModel } from '@data/models/tickets';
import { TicketItemModel } from '@data/models/tickets/ticket-item-model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-ticket-preview',
  imports: [],
  templateUrl: './ticket-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketPreview {
  readonly ticketData = input.required<TicketDataModel>();
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
