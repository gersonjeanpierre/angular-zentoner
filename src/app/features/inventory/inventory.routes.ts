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
];

export default inventoryRoutes;
