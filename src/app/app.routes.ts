import { Routes } from '@angular/router';
import { authGuard, authRedirectGuard } from '@core/guards/auth-guard';
export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [authRedirectGuard],
    loadChildren: () => import('@features/auth/auth.routes'),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@layout/main-layout/main-layout'),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('@features/dashboard/dashboard'),
      },
      {
        path: 'clientes',
        children: [
          {
            path: '',
            loadComponent: () => import('@features/customers/list/customers-list'),
          },
          {
            path: 'crear_nuevo',
            loadComponent: () => import('@features/customers/create/customers-create'),
          },
          {
            path: 'editar/:id',
            loadComponent: () => import('@features/customers/edit/customers-edit'),
          },
        ],
      },
      {
        path: 'inventario',
        children: [
          {
            path: '',
            loadComponent: () => import('@features/inventory/inventory'),
          },
          {
            path: 'items',
            loadComponent: () => import('@features/inventory/items/items'),
          },
        ],
      },
      {
        path: 'tickets',
        children: [
          {
            path: '',
            loadComponent: () => import('@features/tickets/tickets'),
          },
        ],
      },
      {
        path: 'configuracion',
        children: [
          {
            path: '',
            loadComponent: () => import('@features/settings/settings'),
          },
          {
            path: 'crear_usuario',
            loadComponent: () => import('@features/auth/sign-up/sign-up'),
            data: { breadcrumb: 'Crear Usuario', icon: 'icon-[fa7-solid--user-plus]' },
          },
        ],
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'auth',
  },
];
