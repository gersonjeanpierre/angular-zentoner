import { Component, Input, Output, EventEmitter, HostListener, OnChanges } from '@angular/core';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'modal-search',
  imports: [FormsModule],
  templateUrl: 'modal-search.html'
})
export class ModalSearch implements OnChanges {
  @Input() open = false;
  @Input() list: string[] = [];
  @Input() title = 'Seleccionar';
  @Input() isCustomSize = false;
  @Output() selectItem = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  search = '';
  filteredList: string[] = [];

  // For custom size
  selectedWidth = '';
  height = '';

  ngOnChanges() {
    this.filterList();
  }

  filterList() {
    const searching = this.search.toLowerCase();
    this.filteredList = this.list.filter(x => x.toLowerCase().includes(searching));
  }

  select(item: string) {
    this.selectItem.emit(item);
    this.onClose();
  }

  selectCustomSize() {
    if (this.selectedWidth && this.height) {
      const size = `${this.selectedWidth} x ${this.height} m`;
      this.selectItem.emit(size);
      this.onClose();
    }
  }

  onClose() {
    this.search = '';
    this.selectedWidth = '';
    this.height = '';
    this.closed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  handleEsc(event: KeyboardEvent) {
    if (this.open && event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    }
  }
}
