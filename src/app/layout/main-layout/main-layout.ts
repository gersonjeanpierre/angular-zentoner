import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth-service';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';

@Component({
  selector: 'app-main-layout',
  imports: [Sidebar, RouterOutlet, Header],
  templateUrl: './main-layout.html',
})
export default class MainLayout implements OnInit {
  private readonly authService = inject(AuthService);
  private router = inject(Router);

  protected user = signal<any | null>(null);
  protected session = signal<any | null>(null);

  protected activeMenu = signal('Dashboard');
  protected fontSize = signal('1.2em');

  menuItems = [
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
  ];

  ngOnInit() {
    return 'Hello';
  }

  setActiveMenuByRoute(url: string) {
    // Find the menu item whose routeLink matches the start of the url
    const found = this.menuItems.find((item) => url.startsWith(item.routeLink));
    if (found) {
      this.activeMenu.set(found.name);
    }
  }

  logOut() {
    this.activeMenu.set('Cerrar sesión');
    this.authService.signOut();
    this.router.navigateByUrl('/auth/log-in');
  }
}
