import { Routes } from '@angular/router';

const authRoutes: Routes = [
  {
    path: 'log-in',
    loadComponent: () => import('./log-in/log-in'),
  },
  {
    path: '**',
    redirectTo: 'log-in',
  },
];

export default authRoutes;
