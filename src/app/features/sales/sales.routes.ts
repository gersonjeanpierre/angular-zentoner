import { Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () => import('./orders-list/orders-list'),
  },
  {
    path: 'ver/:id',
    loadComponent: () => import('./order-view/order-view'),
  },
] satisfies Routes;
