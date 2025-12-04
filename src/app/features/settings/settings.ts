import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.html',
})
export default class Settings {
  private router = inject(Router);

  toCreateUser() {
    this.router.navigate(['configuracion/crear_usuario']);
  }

  toShops() {
    this.router.navigate(['configuracion/tiendas']);
  }
}
