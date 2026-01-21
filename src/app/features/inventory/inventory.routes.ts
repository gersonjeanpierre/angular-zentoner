import { Routes } from '@angular/router';

const inventoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../inventory/inventory'),
  },
  {
    path: 'items',
    loadComponent: () => import('./items/items'),
  },
  {
    path: 'items/:categorySlug',
    loadComponent: () => import('./items/subcategories/subcategories'),
  },
  {
    path: 'items/:categorySlug/:subcategorySlug',
    children: [
      {
        path: '',
        loadComponent: () => import('./items/items-list/items-list'),
      },
      {
        path: 'crear',
        loadComponent: () => import('./items/items-create/items-create'),
      },
      {
        path: 'editar/:id',
        loadComponent: () => import('./items/items-edit/items-edit'),
      },
    ],
  },
  {
    path: 'kardex',
    children: [
      {
        path: '',
        loadComponent: () => import('./kardex/kardex-list/kardex-list'),
      },
      {
        path: 'nuevo',
        loadComponent: () => import('./kardex/kardex-create/kardex-create'),
      },
      {
        path: 'produccion',
        loadComponent: () => import('./kardex/production-form/production-form'),
      },
      {
        path: 'item/:itemId',
        loadComponent: () => import('./kardex/item-kardex-history/item-kardex-history'),
      },
      {
        path: 'rollo/:rollId',
        loadComponent: () => import('./kardex/item-kardex-history/item-kardex-history'),
      },
    ],
  },
  {
    path: 'maquinas',
    children: [
      {
        path: '',
        loadComponent: () => import('./machines/machines-list/machines-list'),
      },
      {
        path: 'crear',
        loadComponent: () => import('./machines/machines-create/machines-create'),
      },
      {
        path: 'editar/:id',
        loadComponent: () => import('./machines/machines-edit/machines-edit'),
      },
    ],
  },
];

export default inventoryRoutes;
