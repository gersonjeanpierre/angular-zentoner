import { Component, Input } from '@angular/core';
import { TicketDataModel } from '@data/models/tickets';

@Component({
  selector: 'app-ticket-preview',
  imports: [],
  templateUrl: './ticket-preview.html',
})
export class TicketPreview {
  @Input() ticketData!: TicketDataModel;
  @Input() printDate!: Date;
  @Input() includeIGV = true;

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
}
