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
        path: 'item/:itemId',
        loadComponent: () => import('./kardex/item-kardex-history/item-kardex-history'),
      },
    ],
  },
];

export default inventoryRoutes;
