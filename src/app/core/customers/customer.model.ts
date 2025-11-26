export interface CustomerPayload {
  id: string; // UUIDv7

  // Datos de la tabla 'people' (Asegúrate de que todos los tipos de campo sean opcionales si lo son en la DB)
  firstName: string;
  lastName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  ruc: string | null;
  ce: string | null;
  personType: 'JURIDICA' | 'NATURAL';

  // Datos de la tabla 'customers'
  customerCode: string | null;
  customerType: 'NUEVO' | 'FRECUENTE' | 'IMPRENTERO_NUEVO' | 'IMPRENTERO_FRECUENTE';
  notes: Record<string, string> | null;
}

export interface CustomerView {
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

  // --- Campos de Customers ---
  customerCode: string | null;
  customerTypeCode: string; // NUEVO, FRECUENTE, IMPRENTERO_NUEVO, IMPRENTERO_FRECUENTE
  notes: any; // JSONB
  createdById: string | null;

  // --- Campos de Auditoría ---
  personDeletedAt: string | null;
  personUpdatedAt: string | null;
  customerDeletedAt: string | null;
  customerUpdatedAt: string | null;
}

export interface ReturnListCustomers {
  data?: CustomerView[];
  error?: any;
}
