import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuItemModel } from '@core/layout/models/sidebar.model';
import { LogoLaserVeloz } from '@shared/components/logo-laser-veloz/logo-laser-veloz';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, LogoLaserVeloz],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly activeMenu = signal('Dashboard');
  protected readonly fontSize = signal('1.2em');

  protected readonly menuItems = signal<MenuItemModel[]>([
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
  ]);

  protected logOut() {
    this.activeMenu.set('Cerrar sesión');
    // this.authService.signOut();
    // this.router.navigateByUrl('/auth/log-in');
  }
}
