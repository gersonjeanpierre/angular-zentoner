import { Routes } from '@angular/router';
import { cashierRoleGuard } from '@core/guards/cashier-role-guard';

export const cashierRoutes: Routes = [
  {
    path: '',
    canActivate: [cashierRoleGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./cash-register-dashboard/cash-register-dashboard'),
        title: 'Caja Registradora',
      },
      {
        path: 'abrir-sesion',
        loadComponent: () => import('./cash-register-open/cash-register-open'),
        title: 'Abrir Sesión de Caja',
      },
      {
        path: 'cerrar-sesion',
        loadComponent: () => import('./cash-register-close/cash-register-close'),
        title: 'Cerrar Sesión de Caja',
      },
      {
        path: 'ventas-dia',
        loadComponent: () => import('./daily-sales/daily-sales'),
        title: 'Ventas del Día',
      },
    ],
  },
];
