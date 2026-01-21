import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ShopService } from '@core/services/shop-service';
import { v7 as uuid } from 'uuid';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.html',
})
export default class Settings {
  private router = inject(Router);
  private readonly shopService = inject(ShopService);

  toCreateUser() {
    this.router.navigate(['configuracion/crear_usuario']);
  }

  async toShops() {
    // this.router.navigate(['configuracion/tiendas']);
    const shopData = [
      {
        id: uuid(),
        name: 'Stand 194',
        address: 'Jr. Huaraz 1717 - Piso 1 - Interior 194',
        email: 'laser.guizado.plaza@gmail.com',
        mainPhone: '995558329',
        secondaryPhone: null,
        companyData: {
          default: {
            legalName: 'LASER VELOZ IMPORT E.I.R.L.',
            ruc: '20610129910',
            address: 'Jr. Huaraz 1717 - Piso 1 - Interior 194',
            bankAccount: '191-7075355-0-30',
            cci: '00219100707535503053',
            yape_primary: '903095920',
            yape_secondary: null,
            plin: null,
          },
        },
        basicServiceProviders: null,
      },
    ];

    const { data, error } = await this.shopService.insertShops(shopData);
    if (error) console.error('Error inserting shops:', error);
    console.log('Inserted shops data:', data);
  }
}
