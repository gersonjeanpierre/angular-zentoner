import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface SearchableItem {
  id: string;
  displayText: string;
  displayFitText?: string;
  subtitle?: string;
  metadata?: unknown;
}

@Component({
  selector: 'app-search-modal',
  imports: [],
  templateUrl: './search-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchModal {
  readonly isOpen = input.required<boolean>();
  readonly title = input<string>('Buscar');
  readonly items = input<SearchableItem[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly isSyncing = input<boolean>(false);
  readonly placeholder = input<string>('Buscar...');
  readonly showSyncButton = input<boolean>(true);

  readonly onClose = output<void>();
  readonly onSelect = output<SearchableItem>();
  readonly onSearch = output<string>();
  readonly onSync = output<void>();

  protected searchTerm = signal('');

  // ngOnChanges() {
  //   console.log('Items changed:', this.items());
  // }

  protected filteredItems = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const allItems = this.items();

    if (!term) return allItems;

    return allItems.filter(
      (item) =>
        item.displayText.toLowerCase().includes(term) ||
        item.subtitle?.toLowerCase().includes(term),
    );
  });

  protected handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.onSearch.emit(value);
  }

  protected handleSelect(item: SearchableItem) {
    this.onSelect.emit(item);
    this.handleClose();
  }

  protected handleClose() {
    this.searchTerm.set('');
    this.onClose.emit();
  }

  protected handleSync() {
    this.onSync.emit();
  }
}
