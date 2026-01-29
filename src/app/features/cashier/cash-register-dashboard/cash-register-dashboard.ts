import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cash-register-dashboard',
  imports: [CommonModule],
  templateUrl: './cash-register-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CashRegisterDashboard {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private router = inject(Router);

  protected currentSession = this.cashRegisterService.currentSession;
  protected isSessionActive = computed(() => this.currentSession() !== null);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected userData = signal<any>(null);

  async ngOnInit() {
    await this.loadUserData();
    await this.loadSession();
  }

  private async loadUserData() {
    try {
      const data = await this.authService.getUserProfileData();
      this.userData.set(data);
    } catch (error) {
      console.error('Error al cargar datos de usuario:', error);
    }
  }

  private async loadSession() {
    try {
      this.loading.set(true);
      await this.cashRegisterService.loadCurrentSession();
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected navigateToOpen() {
    this.router.navigate(['/cashier/abrir-sesion']);
  }

  protected navigateToClose() {
    this.router.navigate(['/cashier/cerrar-sesion']);
  }

  protected navigateToDailySales() {
    this.router.navigate(['/cashier/ventas-dia']);
  }

  protected navigateToOrders() {
    this.router.navigate(['/sales/orders-list']);
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
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

  protected getSessionDuration(): string {
    const session = this.currentSession();
    if (!session) return '0h 0m';

    const start = new Date(session.opened_at);
    const now = new Date();
    const diff = now.getTime() - start.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }
}
