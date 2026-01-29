import { EmployeeView } from '@data/models/employee/employee.model';
import { ShopModel } from '@data/models/shop/shop-model';
import { Dexie, EntityTable } from 'dexie';

export default class AppDB extends Dexie {
  shops!: EntityTable<ShopModel, 'id'>;
  employees!: EntityTable<EmployeeView, 'id'>;

  constructor() {
    super('LaserColorVelozDB');
    this.version(1).stores({
      shops: 'id,name',
      employees: 'id,shop_id,first_name,last_name',
    });
  }
}
