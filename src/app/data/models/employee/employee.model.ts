export interface Employee {
  id: string; // UUID
  shopId: string;
  employeeCode: string | null;
  authEmail: string | null;
  hireDate: string | null;
  salary: number | null;
  statusId: number;
  workNotes: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeView {
  // --- Campos de People ---
  id: string; // UUID
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  ruc: string | null;
  ce: string | null;
  personType: 'JURIDICA' | 'NATURAL';

  // --- Campos de Employees ---
  shopId: string;
  employeeCode: string | null;
  authEmail: string | null;
  hireDate: string | null;
  salary: number | null;
  statusId: number;
  workNotes: Record<string, unknown> | null;

  // --- Campos de Auditoría ---
  personDeletedAt: string | null;
  personUpdatedAt: string | null;
  employeeUpdatedAt: string | null;
}
