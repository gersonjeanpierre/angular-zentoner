import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type AlertType = 'info' | 'warning' | 'error' | 'success';

@Component({
  selector: 'app-alert-modal',
  standalone: true,
  imports: [],
  templateUrl: './alert-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onClose()',
  },
})
export class AlertModal {
  readonly title = input('');
  readonly message = input('');
  readonly type = input<AlertType>('success');

  readonly closed = output<void>();

  protected readonly ringClass = computed(() => {
    switch (this.type()) {
      case 'success':
        return 'ring-green-200';
      case 'error':
        return 'ring-red-200';
      case 'warning':
        return 'ring-yellow-200';
      case 'info':
        return 'ring-blue-200';
      default:
        return 'ring-blue-200';
    }
  });

  protected readonly textClass = computed(() => {
    switch (this.type()) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-blue-600';
    }
  });

  onClose() {
    this.closed.emit();
  }
}
