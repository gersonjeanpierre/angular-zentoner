import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CashRegisterSession } from '@data/models/sales/cash-register.model';
import { AuthService } from '@core/services/auth-service';

@Component({
  selector: 'app-access-denied',
  imports: [CommonModule],
  templateUrl: './access-denied.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AccessDenied implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  protected reason = signal<string>('No tienes acceso a esta sección');
  protected session = signal<CashRegisterSession | null>(null);

  ngOnInit() {
    // Obtener el estado de navegación
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;

    if (state?.reason) {
      this.reason.set(state.reason);
    }

    if (state?.session) {
      this.session.set(state.session);
    }
  }

  protected navigateBack() {
    this.router.navigate(['/dashboard']);
  }

  protected async navigateToLogin() {
    await this.authService.signOut();
    this.router.navigate(['/auth/log-in']);
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
