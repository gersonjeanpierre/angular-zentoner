import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import {
  CashRegisterSession,
  SessionDashboard,
  SessionStatus,
  SessionType,
} from '@data/models/sales/cash-register.model';

@Component({
  selector: 'app-session-history',
  imports: [CommonModule],
  templateUrl: './session-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SessionHistory implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // State
  protected sessions = signal<CashRegisterSession[]>([]);
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected currentUserId = signal<string | null>(null);
  protected currentShopId = signal<string | null>(null);

  // Filtros
  protected statusFilter = signal<SessionStatus | 'ALL'>('ALL');
  protected typeFilter = signal<SessionType | 'ALL'>('ALL');
  protected dateFromFilter = signal<string>('');
  protected dateToFilter = signal<string>('');

  // Modal
  protected selectedSession = signal<CashRegisterSession | null>(null);
  protected selectedSessionDashboard = signal<SessionDashboard | null>(null);
  protected loadingModal = signal(false);
  protected showModal = signal(false);

  // Computed
  protected filteredSessions = computed(() => {
    let filtered = this.sessions();

    const status = this.statusFilter();
    if (status !== 'ALL') {
      filtered = filtered.filter((s) => s.status === status);
    }

    const type = this.typeFilter();
    if (type !== 'ALL') {
      filtered = filtered.filter((s) => s.sessionType === type);
    }

    const dateFrom = this.dateFromFilter();
    if (dateFrom) {
      filtered = filtered.filter((s) => s.openedAt >= dateFrom);
    }

    const dateTo = this.dateToFilter();
    if (dateTo) {
      filtered = filtered.filter((s) => s.openedAt <= dateTo + 'T23:59:59');
    }

    return filtered;
  });

  protected totalSessions = computed(() => this.filteredSessions().length);
  protected openSessions = computed(
    () => this.filteredSessions().filter((s) => s.status === 'ABIERTO').length,
  );
  protected closedSessions = computed(
    () => this.filteredSessions().filter((s) => s.status === 'CERRADO').length,
  );

  async ngOnInit() {
    await this.loadUserData();
    await this.loadSessions();
  }

  private async loadUserData() {
    try {
      const user = await this.authService.getUserProfileData();
      if (!user || !user.shopId) {
        this.error.set('No se encontró información de tienda del usuario');
        return;
      }

      this.currentUserId.set(user.id);
      this.currentShopId.set(user.shopId);
    } catch (error) {
      console.error('Error al cargar datos de usuario:', error);
      this.error.set('Error al cargar datos de usuario');
    }
  }

  protected async loadSessions() {
    const shopId = this.currentShopId();
    const userId = this.currentUserId();

    if (!shopId || !userId) {
      this.error.set('No hay información de usuario disponible');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const sessions = await this.cashRegisterService.getSessions({
        shopId: shopId,
        cashierId: userId,
      });

      this.sessions.set(sessions);
    } catch (err: any) {
      console.error('Error al cargar sesiones:', err);
      this.error.set(err.message || 'Error al cargar el historial de sesiones');
    } finally {
      this.loading.set(false);
    }
  }

  protected async openSessionDetail(session: CashRegisterSession) {
    this.selectedSession.set(session);
    this.showModal.set(true);
    this.loadingModal.set(true);

    try {
      const dashboard = await this.cashRegisterService.getSessionDashboard(session.id);
      this.selectedSessionDashboard.set(dashboard);
    } catch (err: any) {
      console.error('Error al cargar detalle de sesión:', err);
      this.error.set('Error al cargar el detalle de la sesión');
    } finally {
      this.loadingModal.set(false);
    }
  }

  protected closeModal() {
    this.showModal.set(false);
    this.selectedSession.set(null);
    this.selectedSessionDashboard.set(null);
  }

  protected setStatusFilter(status: SessionStatus | 'ALL') {
    this.statusFilter.set(status);
  }

  protected setTypeFilter(type: SessionType | 'ALL') {
    this.typeFilter.set(type);
  }

  protected setDateFromFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    this.dateFromFilter.set(input.value);
  }

  protected setDateToFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    this.dateToFilter.set(input.value);
  }

  protected clearFilters() {
    this.statusFilter.set('ALL');
    this.typeFilter.set('ALL');
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
  }

  protected navigateBack() {
    this.router.navigate(['/caja/dashboard']);
  }

  protected formatCurrency(amount: number | null): string {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatDateOnly(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected getSessionDuration(session: CashRegisterSession): string {
    if (!session.closedAt) return 'En curso';

    const start = new Date(session.openedAt);
    const end = new Date(session.closedAt);
    const diff = end.getTime() - start.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  protected getStatusBadgeClass(status: SessionStatus): string {
    return status === 'ABIERTO' ? 'badge-success' : 'badge-ghost';
  }

  protected getTypeBadgeClass(type: SessionType): string {
    return type === 'FINAL' ? 'badge-primary' : 'badge-secondary';
  }

  protected getDifferenceClass(difference: number | null): string {
    if (difference === null || difference === 0) return 'text-success';
    return difference > 0 ? 'text-info' : 'text-error';
  }
}
