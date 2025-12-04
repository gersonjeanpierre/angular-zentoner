import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'modal-search',
  imports: [FormsModule],
  templateUrl: 'modal-search.html'
})
export class ModalSearch {
  @Input() open = false;
  @Input() list: string[] = [];
  @Input() title = 'Seleccionar';
  @Output() selectItem = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  search = '';
  filteredList: string[] = [];

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

  onClose() {
    this.search = '';
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
