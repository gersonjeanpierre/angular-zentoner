-- ======================================================================
-- HR SCHEMA
-- Human Resources: employees, roles, statuses
-- ======================================================================

DROP SCHEMA IF EXISTS hr CASCADE;
CREATE SCHEMA IF NOT EXISTS hr;

-- ======================================================================
-- TABLES
-- ======================================================================

-- employee_statuses
CREATE TABLE hr.employee_statuses (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_employment_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr.employee_statuses
ADD CONSTRAINT chk_employee_statuses_code_length CHECK (char_length(code) <= 30),
ADD CONSTRAINT chk_employee_statuses_name_length CHECK (char_length(name) <= 50);

-- roles
CREATE TABLE hr.roles (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr.roles
ADD CONSTRAINT chk_roles_name_length CHECK (char_length(name) <= 50);

-- employees
CREATE TABLE hr.employees (
  id UUID PRIMARY KEY REFERENCES core.persons(id),
  shop_id UUID REFERENCES core.shops(id) NOT NULL,
  employee_code TEXT UNIQUE,
  auth_email TEXT UNIQUE,
  hire_date DATE,
  salary NUMERIC(12,2),
  status_id BIGINT REFERENCES hr.employee_statuses(id) NOT NULL,
  work_notes JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID REFERENCES auth.users(id) NOT NULL,
  updated_by_id UUID REFERENCES auth.users(id),
  deleted_by_id UUID REFERENCES auth.users(id)
);

ALTER TABLE hr.employees
ADD CONSTRAINT chk_employees_code_format CHECK (
  employee_code IS NULL OR employee_code ~ '^[A-Za-z0-9]{1,14}$'
),
ADD CONSTRAINT chk_employees_email_format CHECK (
  auth_email IS NULL OR (
    char_length(auth_email) <= 150 
    AND auth_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

-- employee_roles (junction table)
CREATE TABLE hr.employee_roles (
  employee_id UUID REFERENCES hr.employees(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES hr.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_id, role_id)
);

-- ======================================================================
-- VIEWS
-- ======================================================================

CREATE OR REPLACE VIEW hr.active_employees WITH (security_invoker = ON) AS
SELECT 
  e.id AS employee_id,
  p.first_name, p.last_name,
  e.employee_code, e.auth_email,
  e.hire_date, e.salary, e.status_id,
  e.work_notes, e.shop_id,
  e.updated_at AS employee_updated_at,
  p.email AS person_email, p.phone,
  p.dni, p.ruc, p.ce,
  p.person_type, p.legal_name,
  p.deleted_at AS person_deleted_at,
  p.updated_at AS person_updated_at
FROM hr.employees e
JOIN core.persons p ON e.id = p.id
WHERE p.deleted_at IS NULL AND p.first_name <> 'Super';

-- ======================================================================
-- TRIGGERS
-- ======================================================================

CREATE TRIGGER trg_employee_statuses_set_updated_at 
  BEFORE UPDATE ON hr.employee_statuses 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_roles_set_updated_at 
  BEFORE UPDATE ON hr.roles 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_employees_set_updated_at 
  BEFORE UPDATE ON hr.employees 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_employees_set_updated_by 
  BEFORE UPDATE ON hr.employees 
  FOR EACH ROW EXECUTE FUNCTION core.set_audit_updated_by();

-- ======================================================================
-- RLS
-- ======================================================================

ALTER TABLE hr.employee_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_roles ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- SEED DATA
-- ======================================================================

INSERT INTO hr.employee_statuses (code, name, is_employment_active) VALUES
('ACTIVE', 'Activo - Trabajando', TRUE),
('INACTIVE', 'Inactivo - Sin labores', FALSE),
('ON_LEAVE', 'Permiso/Licencia', FALSE),
('TERMINATED', 'Relación Laboral Terminada', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO hr.roles (name, description) VALUES
('SuperAdmin', 'Control total del sistema y base de datos.'),
('Manager', 'Gerente de Local o Área, con capacidad de gestión HR.'),
('Employee', 'Empleado de Imprenta (producción, diseño).'),
('Designer', 'Diseñador Gráfico.'),
('Cashier', 'Cajero de Local (manejo de transacciones).'),
('HRManager', 'Recursos Humanos.'),
('Accountant', 'Contabilidad y finanzas.'),
('Administrator', 'Administrador de Sucursal.'),
('Developer', 'Mantenimiento y desarrollo de la app.')
ON CONFLICT (name) DO NOTHING;
