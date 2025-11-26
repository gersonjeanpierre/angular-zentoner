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
    // loadComponent: () => import('./layout/main-layout/main-layout'),
    loadComponent: () => import('./layout/layout'),
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];
