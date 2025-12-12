import {
  Component,
  input,
  output,
  computed,
  signal,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'modal-search',
  imports: [FormsModule],
  templateUrl: 'modal-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalSearch {
  readonly open = input<boolean>(false);
  readonly list = input<string[]>([]);
  readonly title = input<string>('Seleccionar');
  readonly isCustomSize = input<boolean>(false);
  readonly selectItem = output<string>();
  readonly closed = output<void>();

  protected search = signal('');
  protected readonly filteredList = computed(() => {
    const searching = this.search().toLowerCase();
    return this.list().filter((list) => list.toLowerCase().includes(searching));
  });

  // For custom size
  protected selectedWidth = '';
  protected height = '';

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
    this.search.set('');
    this.selectedWidth = '';
    this.height = '';
    this.closed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  handleEsc(event: KeyboardEvent) {
    if (this.open() && event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    }
  }
}
