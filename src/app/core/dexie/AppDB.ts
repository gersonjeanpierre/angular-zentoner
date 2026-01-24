import { ShopModel } from '@data/models/shop/shop-model';
import { Dexie, EntityTable } from 'dexie';

export default class AppDB extends Dexie {
  shops!: EntityTable<ShopModel, 'id'>;

  constructor() {
    super('LaserColorVelozDB');
    this.version(1).stores({
      shops: 'id,name',
    });
  }
}
