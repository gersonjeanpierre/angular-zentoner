import { Routes } from '@angular/router';
import { authGuard, authRedirectGuard } from '@core/auth/guards/auth-guard';
export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [authRedirectGuard],
    loadChildren: () => import('./features/auth/auth.routes'),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout'),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard'),
      },
      {
        path: 'clientes',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/customers/list/customers-list'),
          },
          {
            path: 'create',
            loadComponent: () => import('./features/customers/create/customers-create'),
          },
          {
            path: 'edit/:id',
            loadComponent: () => import('./features/customers/edit/customers-edit'),
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
