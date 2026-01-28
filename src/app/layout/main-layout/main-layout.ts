import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth-service';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { CategoryService } from '@core/services/category-service';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, RouterOutlet, Header],
  templateUrl: './main-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class MainLayout implements OnInit {
  // Dependency Injection
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);

  // State Signals (protected readonly - used in template)
  protected readonly userName = signal<string>('');
  protected readonly authEmail = signal<string>('');
  protected readonly shopName = signal<string>('');
  protected readonly activeMenu = signal('Dashboard');
  protected readonly fontSize = signal('1.2em');

  // Menu Configuration
  protected readonly menuItems = [
    {
      name: 'Dashboard',
      icon: 'icon-[fa7-solid--layer-group]',
      routeLink: '/dashboard',
    },
    {
      name: 'Clientes',
      icon: 'icon-[fa6-solid--users]',
      routeLink: '/clientes',
    },
    {
      name: 'Ventas',
      icon: 'icon-[fa7-solid--file-invoice-dollar]',
      routeLink: '/ventas',
    },
    {
      name: 'Inventario',
      icon: 'icon-[fa7-solid--boxes]',
      routeLink: '/inventario',
    },
    {
      name: 'Reportes',
      icon: 'icon-[fa6-solid--chart-line]',
      routeLink: '/reportes',
    },
    {
      name: 'Tickets',
      icon: 'icon-[fa6-solid--ticket]',
      routeLink: '/tickets',
    },
    {
      name: 'Configuración',
      icon: 'icon-[fa6-solid--gear]',
      routeLink: '/configuracion',
    },
    {
      name: 'Cerrar sesión',
      icon: 'icon-[fa7-solid--sign-out-alt]',
      routeLink: '/auth/log-in',
    },
  ] as const;

  ngOnInit(): void {
    this.loadUserInfo();
  }

  private async loadUserInfo(): Promise<void> {
    const response = await this.authService.getUserProfileData();
    this.userName.set(response.name);
    this.authEmail.set(response.email);
    this.shopName.set(response.shopName);
  }

  protected setActiveMenuByRoute(url: string): void {
    const found = this.menuItems.find((item) => url.startsWith(item.routeLink));
    if (found) {
      this.activeMenu.set(found.name);
    }
  }

  protected logOut(): void {
    this.activeMenu.set('Cerrar sesión');
    this.authService.signOut();
    this.categoryService.clearCache();
    this.router.navigateByUrl('/auth/log-in');
  }
}
