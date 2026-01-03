import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-inventory',
  imports: [],
  templateUrl: './inventory.html',
})
export default class Inventory {
  protected readonly title = signal('Inventario');
}
