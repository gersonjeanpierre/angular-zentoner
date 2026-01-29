import { CustomerView } from '@data/models/customer/customer.model';
import { EmployeeView } from '@data/models/employee/employee.model';
import { ShopModel } from '@data/models/shop/shop-model';
import { Dexie, EntityTable } from 'dexie';

export default class AppDB extends Dexie {
  shops!: EntityTable<ShopModel, 'id'>;
  customers!: EntityTable<CustomerView, 'id'>;
  employees!: EntityTable<EmployeeView, 'employeeId'>;

  constructor() {
    super('LaserColorVelozDB');
    this.version(2).stores({
      shops: 'id, name',
      customers: 'id, customerCode, customerTypeCode, email, dni, ruc, ce',
      employees: 'employeeId, shopId, employeeCode, firstName, lastName',
    });
  }
}
