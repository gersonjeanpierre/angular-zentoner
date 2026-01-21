import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OrderService, GetOrdersParams } from '@core/services/order-service';
import { Router } from '@angular/router';
import { Order } from '@data/models/tickets/order-model';

@Component({
  selector: 'app-orders-list',
  imports: [],
  templateUrl: './orders-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrdersList {
  private orderService = inject(OrderService);
  private router = inject(Router);

  protected orders = signal<Order[]>([]);
  protected isLoading = signal(false);
  protected currentPage = signal(1);
  protected totalPages = signal(0);
  protected totalCount = signal(0);
  protected pageSize = signal(20);

  // Filtros
  protected searchTerm = signal('');
  protected selectedStatus = signal<number | undefined>(undefined);

  protected orderStatuses = signal<Array<{ id: number; name: string }>>([]);

  constructor() {
    this.loadOrderStatuses();
    this.loadOrders();
  }

  protected async loadOrderStatuses() {
    try {
      const statuses = await this.orderService.getOrderStatuses();
      this.orderStatuses.set(statuses);
    } catch (error) {
      console.error('Error al cargar estados:', error);
    }
  }

  protected async loadOrders() {
    this.isLoading.set(true);

    try {
      const params: GetOrdersParams = {
        page: this.currentPage(),
        pageSize: this.pageSize(),
        search: this.searchTerm() || undefined,
        statusId: this.selectedStatus(),
      };

      const response = await this.orderService.getOrders(params);

      this.orders.set(response.data);
      this.totalPages.set(response.totalPages);
      this.totalCount.set(response.count);
    } catch (error) {
      console.error('Error al cargar órdenes:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.currentPage.set(1);
    this.loadOrders();
  }

  protected handleStatusFilter(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedStatus.set(value ? parseInt(value) : undefined);
    this.currentPage.set(1);
    this.loadOrders();
  }

  protected goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadOrders();
    }
  }

  protected viewOrder(orderId: string) {
    this.router.navigate(['/ventas/ver', orderId]);
  }

  protected editOrder(orderId: string) {
    this.router.navigate(['/ventas/editar', orderId]);
  }

  protected getStatusClass(statusId: number): string {
    const statusMap: Record<number, string> = {
      1: 'badge-warning', // PENDIENTE
      2: 'badge-info', // EN_PRODUCCION
      3: 'badge-success', // COMPLETADO
      4: 'badge-primary', // ENTREGADO
      5: 'badge-error', // CANCELADO
    };
    return statusMap[statusId] || 'badge-ghost';
  }

  protected formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  }

  protected getStatusName(statusId: number): string {
    return this.orderStatuses().find((s) => s.id === statusId)?.name || 'N/A';
  }
}
