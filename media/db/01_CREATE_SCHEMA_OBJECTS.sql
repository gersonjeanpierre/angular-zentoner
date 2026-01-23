--
-- ######################################################################
-- # 1. BORRADO CONDICIONAL Y CREACIÓN DE SCHEMAS
-- ######################################################################
-- Borrado condicional de vistas, tablas y funciones antiguas DROP VIEW IF EXISTS sales.active_customers CASCADE;
DROP TABLE IF EXISTS hr.employee_roles CASCADE;
DROP TABLE IF EXISTS hr.roles CASCADE;
DROP TABLE IF EXISTS hr.employee_statuses CASCADE;
DROP TABLE IF EXISTS sales.customers CASCADE;
DROP TABLE IF EXISTS hr.employees CASCADE;
DROP TABLE IF EXISTS core.persons CASCADE;
DROP TABLE IF EXISTS core.audit_logs CASCADE;
DROP TABLE IF EXISTS core.shops CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
DROP SCHEMA IF EXISTS hr CASCADE;
DROP SCHEMA IF EXISTS sales CASCADE;
DROP SCHEMA IF EXISTS auth_management CASCADE;
DROP SCHEMA IF EXISTS inventory CASCADE;
DROP SCHEMA IF EXISTS production CASCADE;
DROP FUNCTION IF EXISTS core.set_updated_at () CASCADE;
DROP FUNCTION IF EXISTS core.set_audit_updated_by() () CASCADE;
DROP FUNCTION IF EXISTS auth_management.is_super_admin (uuid) CASCADE;
DROP FUNCTION IF EXISTS auth_management.is_creator (uuid) CASCADE;
DROP FUNCTION IF EXISTS auth_management.can_manage_hr (uuid) CASCADE;
DROP FUNCTION IF EXISTS auth_management.is_employee (uuid) CASCADE;
DROP FUNCTION IF EXISTS auth_management.is_universal_manager (uuid) CASCADE;
DROP FUNCTION IF EXISTS sales.soft_delete_customer (uuid) CASCADE;
DROP TYPE IF EXISTS core.person_type_enum;
-- ######################################################################
-- # 2. CREACIÓN DE TABLAS BASE (CORE)
-- ######################################################################
-- Creación de Schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS auth_management;
-- Tipo ENUM para reutilización
CREATE TYPE core.person_type_enum AS ENUM ('JURIDICA', 'NATURAL');
-- =  =  = CORE.SHOPS (Locales de Imprenta Láser) =  =  =
CREATE TABLE core.shops (
  id uuid PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  email TEXT UNIQUE,
  main_phone TEXT,
  secondary_phone TEXT,
  company_data jsonb DEFAULT '{}'::jsonb,
  basic_service_providers jsonb DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW());
-- Constraints para CORE.SHOPS
ALTER TABLE core.shops
ADD CONSTRAINT chk_shops_name_length CHECK (char_length(name) <= 150),
  ADD CONSTRAINT chk_shops_address_length CHECK (
    address IS NULL
    OR char_length(address) <= 200
  ),
  ADD CONSTRAINT chk_shops_email_format CHECK (
    email IS NULL
    OR (
      char_length(email) <= 150
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  ),
  ADD CONSTRAINT chk_shops_main_phone_format CHECK (
    main_phone IS NULL
    OR main_phone ~ '^\+[1-9]\d{1,14}$'
  ),
  ADD CONSTRAINT chk_shops_secondary_phone_format CHECK (
    secondary_phone IS NULL
    OR secondary_phone ~ '^\+[1-9]\d{1,14}$'
  );
-- =  =  = CORE.PERSONS TABLE =  =  = (Base para Clientes/Empleados)
CREATE TABLE core.persons (
  id uuid PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  legal_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  dni TEXT,
  ruc TEXT UNIQUE,
  ce TEXT,
  person_type core.person_type_enum NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id uuid REFERENCES auth.users (id),
  updated_by_id uuid REFERENCES auth.users (id),
  deleted_by_id uuid REFERENCES auth.users (id)
);
-- Constraints para CORE.PERSONS
ALTER TABLE core.persons
ADD CONSTRAINT chk_persons_first_name_length CHECK (
    first_name IS NULL
    OR char_length(first_name) <= 35
  ),
  ADD CONSTRAINT chk_persons_last_name_length CHECK (
    last_name IS NULL
    OR char_length(last_name) <= 80
  ),
  ADD CONSTRAINT chk_persons_legal_name_length CHECK (
    legal_name IS NULL
    OR char_length(legal_name) <= 200
  ),
  ADD CONSTRAINT chk_persons_email_format CHECK (
    email IS NULL
    OR (
      char_length(email) <= 150
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  ),
  ADD CONSTRAINT chk_persons_phone_format CHECK (
    phone IS NULL
    OR phone ~ '^\+[1-9]\d{1,14}$'
  ),
  ADD CONSTRAINT chk_persons_dni_format CHECK (
    dni IS NULL
    OR dni ~ '^\d{8}$'
  ),
  ADD CONSTRAINT chk_persons_ruc_format CHECK (
    ruc IS NULL
    OR ruc ~ '^\d{11}$'
  ),
  ADD CONSTRAINT chk_persons_ce_format CHECK (
    ce IS NULL
    OR ce ~ '^[A-Za-z0-9]{6,20}$'
  ),
  ADD CONSTRAINT chk_persons_dni_or_ce CHECK (
    (
      dni IS NOT NULL
      AND ce IS NULL
    )
    OR (
      dni IS NULL
      AND ce IS NOT NULL
    )
    OR (
      dni IS NULL
      AND ce IS NULL
    )
  );
-- =  =  = CORE.AUDIT_LOGS =  =  =
CREATE TABLE core.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  action TEXT NOT NULL,
  actor_id uuid REFERENCES auth.users (id),
  target_table TEXT,
  target_id uuid,
  status TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ######################################################################
-- # 3. CREACIÓN DE TABLAS HR (HUMAN RESOURCES)
-- ######################################################################
-- =  =  = HR.EMPLOYEE_STATUSES (Nueva tabla de apoyo) =  =  =
CREATE TABLE hr.employee_statuses (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_employment_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Constraints para HR.EMPLOYEE_STATUSES
ALTER TABLE hr.employee_statuses
ADD CONSTRAINT chk_employee_statuses_code_length CHECK (char_length(code) <= 30),
  ADD CONSTRAINT chk_employee_statuses_name_length CHECK (char_length(name) <= 50);

-- =  =  = HR.ROLES =  =  =
CREATE TABLE hr.roles (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Constraints para HR.ROLES
ALTER TABLE hr.roles
ADD CONSTRAINT chk_roles_name_length CHECK (char_length(name) <= 50);
-- =  =  = HR.EMPLOYEES TABLE =  =  =
CREATE TABLE hr.employees (
  id uuid PRIMARY KEY REFERENCES core.persons (id),
  shop_id uuid REFERENCES core.shops (id) NOT NULL,
  employee_code TEXT UNIQUE,
  auth_email TEXT UNIQUE,
  hire_date DATE,
  salary NUMERIC(12, 2),
  status_id BIGINT REFERENCES hr.employee_statuses (id) NOT NULL,
  work_notes jsonb DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id uuid REFERENCES auth.users (id) NOT NULL,
  updated_by_id uuid REFERENCES auth.users (id),
  deleted_by_id uuid REFERENCES auth.users (id)
);
-- Constraints para HR.EMPLOYEES
ALTER TABLE hr.employees
ADD CONSTRAINT chk_employees_code_format CHECK (
    employee_code IS NULL
    OR employee_code ~ '^[A-Za-z0-9]{1,14}$'
  ),
  ADD CONSTRAINT chk_employees_email_format CHECK (
    auth_email IS NULL
    OR (
      char_length(auth_email) <= 150
      AND auth_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  );
-- =  =  = HR.EMPLOYEE_ROLES (Junction table) =  =  =
CREATE TABLE hr.employee_roles (
  employee_id uuid REFERENCES hr.employees (id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES hr.roles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_id, role_id)
);

DROP VIEW IF EXISTS hr.active_employees;
CREATE OR REPLACE VIEW hr.active_employees WITH (security_invoker = ON) AS
SELECT 
  e.id AS employee_id,
  p.first_name,
  p.last_name,
  e.employee_code,
  e.auth_email,
  e.hire_date,
  e.salary,
  e.status_id,
  e.work_notes,
  e.shop_id,
  e.updated_at AS employee_updated_at,
  p.email AS person_email,
  p.phone,
  p.dni,
  p.ruc,
  p.ce,
  p.person_type,
  p.legal_name,
  p.deleted_at AS person_deleted_at,
  p.updated_at AS person_updated_at
FROM hr.employees e
JOIN core.persons p ON e.id = p.id
WHERE p.deleted_at IS NULL AND p.first_name <> 'Super';


-- ######################################################################
-- # 4. CREACIÓN DE TABLAS SALES (VENTAS/CLIENTES)
-- ######################################################################
CREATE TABLE sales.customers (
  id uuid PRIMARY KEY REFERENCES core.persons (id),
  customer_code TEXT UNIQUE,
  customer_type_code TEXT,
  notes jsonb DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id uuid REFERENCES auth.users (id) NOT NULL,
  updated_by_id uuid REFERENCES auth.users (id),
  deleted_by_id uuid REFERENCES auth.users (id)
);
ALTER TABLE sales.customers -- quitar el not null a notes
ALTER COLUMN notes DROP NOT NULL;
-- Constraints para SALES.CUSTOMERS
ALTER TABLE sales.customers
ADD CONSTRAINT chk_customers_code_format CHECK (
    customer_code IS NULL
    OR customer_code ~ '^[A-Za-z0-9]{1,14}$'
  ),
  ADD CONSTRAINT chk_customers_type_code CHECK (
    customer_type_code IN (
      'NUEVO',
      'FRECUENTE',
      'IMPRENTERO_NUEVO',
      'IMPRENTERO_FRECUENTE'
    )
  );
-- Vista para seleccionar customers activos (Unión persons y customers)
DROP VIEW IF EXISTS sales.active_customers;
CREATE OR REPLACE VIEW sales.active_customers WITH (security_invoker = ON) AS
SELECT c.id,
  p.first_name,
  p.last_name,
  p.legal_name,
  p.email,
  p.phone,
  p.dni,
  p.ruc,
  p.ce,
  p.person_type,
  c.customer_code,
  c.customer_type_code,
  c.notes,
  c.created_by_id,
  p.deleted_at as person_deleted_at,
  p.updated_at as person_updated_at,
  c.deleted_at as customer_deleted_at,
  c.updated_at as customer_updated_at
FROM sales.customers c
  JOIN core.persons p ON c.id = p.id;

----
-- INDEXES PARA OPTIMIZACIÓN DE CONSULTAS
----
-- eliminar si existe el index
DROP INDEX IF EXISTS core.idx_core_persons_deleted_at;
CREATE INDEX IF NOT EXISTS idx_core_persons_deleted_at ON core.persons (deleted_at);
DROP INDEX IF EXISTS sales.idx_sales_customers_id_deleted_at;
CREATE INDEX IF NOT EXISTS idx_sales_customers_id_deleted_at ON sales.customers (id, deleted_at);

-- ######################################################################
-- # 5. FUNCIONES DE UTILIDAD Y AUTENTICACIÓN (INCLUYENDO AUDITORÍA)
-- ######################################################################
-- Funcion para slug
CREATE OR REPLACE FUNCTION core.handle_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug = LOWER(
    REGEXP_REPLACE(
      translate(unaccent(NEW.name), 'ñü', 'nu'),  -- Transliterate ñ->n, ü->u (add more if needed)
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función set_updated_at
CREATE OR REPLACE FUNCTION core.set_updated_at() 
RETURNS TRIGGER LANGUAGE plpgsql
AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$;


-- Función de Auditoría: Establece el usuario que actualiza
CREATE OR REPLACE FUNCTION core.set_audit_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql 
AS $$ BEGIN NEW.updated_by_id = auth.uid();
RETURN NEW;
END;
$$;
-- TRIGGERS PARA UPDATED_AT
CREATE TRIGGER trg_shops_set_updated_at BEFORE
UPDATE ON core.shops FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_persons_set_updated_at BEFORE
UPDATE ON core.persons FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_employees_set_updated_at BEFORE
UPDATE ON hr.employees FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_customers_set_updated_at BEFORE
UPDATE ON sales.customers FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_roles_set_updated_at BEFORE
UPDATE ON hr.roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_employee_roles_set_updated_at BEFORE
UPDATE ON hr.employee_roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_employee_statuses_set_updated_at BEFORE
UPDATE ON hr.employee_statuses FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
-- TRIGGERS PARA UPDATED_BY_ID
CREATE TRIGGER trg_shops_set_updated_by BEFORE
UPDATE ON core.shops FOR EACH ROW EXECUTE FUNCTION core.set_audit_updated_by();
CREATE TRIGGER trg_persons_set_updated_by BEFORE
UPDATE ON core.persons FOR EACH ROW EXECUTE FUNCTION core.set_audit_updated_by();
-- < --- Trigger para core.persons
CREATE TRIGGER trg_employees_set_updated_by BEFORE
UPDATE ON hr.employees FOR EACH ROW EXECUTE FUNCTION core.set_audit_updated_by();
CREATE TRIGGER trg_customers_set_updated_by BEFORE
UPDATE ON sales.customers FOR EACH ROW EXECUTE FUNCTION core.set_audit_updated_by();
-- FUNCIONES DE CHECKEO DE ROLES (auth_management)
-- Función para verificar roles que tienen acceso universal a gestión (Gestores)

CREATE OR REPLACE FUNCTION auth_management.is_universal_manager(user_id uuid) 
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
AS $$ 
SELECT EXISTS (
  SELECT 1
  FROM hr.employee_roles er
  JOIN hr.roles r ON er.role_id = r.id
  WHERE er.employee_id = user_id
    AND r.name IN ('SuperAdmin', 'Manager', 'HRManager', 'Accountant', 'Administrator', 'Developer')
);
$$;


CREATE OR REPLACE FUNCTION auth_management.is_employee(user_id uuid) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1
    FROM hr.employees
    WHERE id = user_id
  );
$$;
CREATE OR REPLACE FUNCTION auth_management.is_super_admin(user_id uuid) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1
    FROM hr.employee_roles er
      JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id
      AND r.name = 'SuperAdmin'
  );
$$;
CREATE OR REPLACE FUNCTION auth_management.is_creator(user_id uuid) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ -- Roles que pueden crear/gestionar usuarios y entidades principales
SELECT EXISTS (
    SELECT 1
    FROM hr.employee_roles er
      JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id
      AND r.name IN ('SuperAdmin', 'Administrator', 'HRManager')
  );
$$;
CREATE OR REPLACE FUNCTION auth_management.can_manage_hr(user_id uuid) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ -- Roles que pueden gestionar RR.HH. (empleados, salarios, estados, etc.)
SELECT EXISTS (
    SELECT 1
    FROM hr.employee_roles er
      JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id
      AND r.name IN (
        'SuperAdmin',
        'HRManager',
        'Accountant',
        'Manager',
        'Developer'
      )
  );
$$;
-- ######################################################################
-- # 6. RPC: FUNCIONES DE MANIPULACIÓN DE DATOS (AJUSTADAS A AUDITORÍA Y RLS)
-- ######################################################################
DROP FUNCTION IF EXISTS sales.create_customer();
CREATE OR REPLACE FUNCTION sales.create_customer(
    p_user_id uuid,
    p_first_name TEXT,
    p_last_name TEXT,
    p_person_type core.person_type_enum,
    p_legal_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_dni TEXT DEFAULT NULL,
    p_ruc TEXT DEFAULT NULL,
    p_ce TEXT DEFAULT NULL,
    p_customer_code TEXT DEFAULT NULL,
    p_customer_type_code TEXT DEFAULT NULL,
    p_notes jsonb DEFAULT '{}'::jsonb
  ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN -- Validacion: no se puede crear si ambos dni y ce son no nulos
IF p_dni IS NOT NULL
AND p_ce IS NOT NULL THEN RAISE EXCEPTION 'DATA_VALIDATION_ERROR: No se puede proporcionar ambos DNI y CE al mismo tiempo.';
END IF;
-- verificar si esta autenticado
IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_ERROR: Usuario no autenticado.';
END IF;
-- Inserción en core.persons
INSERT INTO core.persons (
    id,
    first_name,
    last_name,
    legal_name,
    email,
    phone,
    dni,
    ruc,
    ce,
    person_type,
    created_by_id
  )
VALUES (
    p_user_id,
    p_first_name,
    p_last_name,
    p_legal_name,
    p_email,
    p_phone,
    p_dni,
    p_ruc,
    p_ce,
    p_person_type,
    v_user_id
  );
-- Inserción en sales.customers
INSERT INTO sales.customers (
    id,
    customer_code,
    customer_type_code,
    notes,
    created_by_id
  )
VALUES (
    p_user_id,
    p_customer_code,
    p_customer_type_code,
    p_notes,
    v_user_id
  );
-- Auditoría
INSERT INTO core.audit_logs (
    action,
    actor_id,
    target_table,
    target_id,
    status,
    payload
  )
VALUES (
    'create_customer',
    v_user_id,
    'sales.customers',
    p_user_id,
    'SUCCESS',
    jsonb_build_object(
      'customer_code',
      p_customer_code,
      'customer_type_code',
      p_customer_type_code
    )
  );
RETURN p_user_id;
EXCEPTION
WHEN OTHERS THEN -- Auditoría de fallo
INSERT INTO core.audit_logs (
    action,
    actor_id,
    target_table,
    target_id,
    status,
    payload
  )
VALUES (
    'create_customer',
    v_user_id,
    'sales.customers',
    p_user_id,
    'FAILURE',
    jsonb_build_object('error_message', SQLERRM)
  );
RAISE;
END;
$$;
-- RPC: Función de Borrado Lógico de Customer (Sin cambios)
CREATE OR REPLACE FUNCTION sales.soft_delete_customer(p_customer_id uuid) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN -- Verificar permisos
IF NOT auth_management.is_employee(v_user_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED: Only active employees can manage customer deletion.';
END IF;
-- 1. Borrado Lógico en 'core.persons'
UPDATE core.persons
SET deleted_at = NOW(),
  deleted_by_id = v_user_id,
  updated_by_id = v_user_id
WHERE id = p_customer_id;
-- 2. Borrado Lógico en 'sales.customers' (para la relación)
UPDATE sales.customers
SET deleted_at = NOW(),
  deleted_by_id = v_user_id
WHERE id = p_customer_id;
-- 3. Log de auditoría
INSERT INTO core.audit_logs (
    action,
    actor_id,
    target_table,
    target_id,
    status,
    payload
  )
VALUES (
    'soft_delete',
    v_user_id,
    'sales.customers',
    p_customer_id,
    'SUCCESS',
    jsonb_build_object('reason', 'soft deleted by employee')
  );
END;
$$;
-- RPC: Función para actualizar cliente
CREATE OR REPLACE FUNCTION sales.update_customer(
    p_customer_id uuid,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_legal_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_dni TEXT DEFAULT NULL,
    p_ruc TEXT DEFAULT NULL,
    p_ce TEXT DEFAULT NULL,
    p_customer_code TEXT DEFAULT NULL,
    p_customer_type_code TEXT DEFAULT NULL,
    p_notes jsonb DEFAULT NULL
  ) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN -- Validacion: no se puede tener ambos dni y ce
IF p_dni IS NOT NULL
AND p_ce IS NOT NULL THEN RAISE EXCEPTION 'DATA_VALIDATION_ERROR: No se puede proporcionar ambos DNI y CE al mismo tiempo.';
END IF;
-- verificar si esta autenticado
IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_ERROR: Usuario no autenticado.';
END IF;
-- Verificar permisos: solo empleados pueden actualizar
IF NOT auth_management.is_employee(v_user_id) THEN RAISE EXCEPTION 'PERMISSION_DENIED: Only active employees can manage customers.';
END IF;
-- Actualizar core.persons
UPDATE core.persons
SET first_name = COALESCE(p_first_name, first_name),
  last_name = COALESCE(p_last_name, last_name),
  legal_name = COALESCE(p_legal_name, legal_name),
  email = COALESCE(p_email, email),
  phone = COALESCE(p_phone, phone),
  dni = COALESCE(p_dni, dni),
  ruc = COALESCE(p_ruc, ruc),
  ce = COALESCE(p_ce, ce),
  updated_by_id = v_user_id,
  updated_at = NOW()
WHERE id = p_customer_id;
-- Actualizar sales.customers
UPDATE sales.customers
SET customer_code = COALESCE(p_customer_code, customer_code),
  customer_type_code = COALESCE(p_customer_type_code, customer_type_code),
  notes = COALESCE(p_notes, notes),
  updated_by_id = v_user_id,
  updated_at = NOW()
WHERE id = p_customer_id;
-- Auditoría
INSERT INTO core.audit_logs (
    action,
    actor_id,
    target_table,
    target_id,
    status,
    payload
  )
VALUES (
    'update_customer',
    v_user_id,
    'sales.customers',
    p_customer_id,
    'SUCCESS',
    jsonb_build_object(
      'customer_code',
      p_customer_code,
      'customer_type_code',
      p_customer_type_code
    )
  );
EXCEPTION
WHEN OTHERS THEN -- Auditoría de fallo
INSERT INTO core.audit_logs (
    action,
    actor_id,
    target_table,
    target_id,
    status,
    payload
  )
VALUES (
    'update_customer',
    v_user_id,
    'sales.customers',
    p_customer_id,
    'FAILURE',
    jsonb_build_object('error_message', SQLERRM)
  );
RAISE;
END;
$$;
-- ######################################################################
-- # 7. SEGURIDAD: ROW LEVEL SECURITY (RLS) - REFINADO POR ROLES GESTORES
-- ######################################################################
-- RLS Habilitadas (Sin cambios)
ALTER TABLE core.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_statuses ENABLE ROW LEVEL SECURITY;
ALTER VIEW sales.active_customers
SET (security_barrier = true);
-- POLÍTICAS REFINADAS
-- CORE.SHOPS: Se permite a todos los empleados ver los locales (metadato).
DROP POLICY IF EXISTS "hr_employees_select_consolidated" ON hr.employees;
CREATE POLICY "hr_employees_select_consolidated" ON hr.employees FOR
SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hr_employees_insert_managers" ON hr.employees;
CREATE POLICY "hr_employees_insert_managers" ON hr.employees FOR
INSERT TO authenticated WITH CHECK (
    auth_management.can_manage_hr(
      (
        (
          SELECT auth.uid()
        )::uuid
      )
    )
  );
DROP POLICY IF EXISTS "hr_employees_update_managers" ON hr.employees;
CREATE POLICY "hr_employees_update_managers" ON hr.employees FOR
UPDATE TO authenticated USING (
    auth_management.can_manage_hr(
      (
        (
          SELECT auth.uid()
        )::uuid
      )
    )
  ) WITH CHECK (
    auth_management.can_manage_hr(
      (
        (
          SELECT auth.uid()
        )::uuid
      )
    )
  );
DROP POLICY IF EXISTS "authenticated_persons_select_consolidated" ON core.persons;
CREATE POLICY "authenticated_persons_select_consolidated" ON core.persons FOR
SELECT TO authenticated USING (
    -- 1) Empleado propietario: el id del person = auth.uid( )
    (
      (
        SELECT auth.uid()
      )::uuid = id
      AND deleted_at IS NULL
    )
    OR -- 2) Non-managers: persona activa y es customer
    (
      deleted_at IS NULL
      AND NOT auth_management.is_universal_manager(
        (
          SELECT auth.uid()
        )::uuid
      )
      AND EXISTS (
        SELECT 1
        FROM sales.customers sc
        WHERE sc.id = core.persons.id
          AND sc.deleted_at IS NULL
      )
    )
    OR -- 3) Managers universales
    (
      auth_management.is_universal_manager(
        (
          SELECT auth.uid()
        )::uuid
      )
    )
  );
DROP POLICY IF EXISTS "All active employees can read shops" ON core.shops;
CREATE POLICY "All active employees can read shops" ON core.shops FOR
SELECT TO authenticated USING (
    auth_management.is_employee(
      (
        SELECT auth.uid()
      )::uuid
    )
    AND deleted_at IS NULL
  );
-- CORE.PERSONS (Datos Personales)
--
 --INSERT COMBINADO: Permite a los empleados insertarse a sí mismos o a Managers crear otros registros
DROP POLICY IF EXISTS "Authenticated insert persons (combined)" ON core.persons;
CREATE POLICY "Authenticated insert persons (combined)" ON core.persons FOR
INSERT TO authenticated WITH CHECK (
    (
      (
        SELECT auth.uid()
      ) = id
      AND deleted_at IS NULL
    )
    OR (
      auth_management.is_universal_manager(
        (
          SELECT auth.uid()
        )
      )
    )
  );
CREATE POLICY "authenticated_persons_update_consolidated" ON core.persons FOR
UPDATE TO authenticated USING (
    (
      -- Empleado propietario: puede actualizar su propio registro sólo si no está eliminad o
      (
        (
          SELECT auth.uid()
        )::uuid = id
      )
      AND deleted_at IS NULL
    )
    OR (
      -- Managers universales: pueden actualizar cualquier fil a
      auth_management.is_universal_manager(
        (
          SELECT auth.uid()
        )::uuid
      )
    )
  ) WITH CHECK (
    (
      -- Al insertar/actualizar: permitir cambios si el actor es el propietario (y fila no eliminada )
      (
        (
          SELECT auth.uid()
        )::uuid = id
      )
      AND deleted_at IS NULL
    )
    OR (
      -- O si el actor es manager universa l
      auth_management.is_universal_manager(
        (
          SELECT auth.uid()
        )::uuid
      )
    )
  );
-- HR.EMPLOYEES (Registros Laborales)
-- Las políticas de HR ya son universales si usas can_manage_hr. No necesitan shop_id.
-- SALES.CUSTOMERS (Gestión de Clientes)
-- 🔥 REFINADO: Solo roles de creación/administración pueden gestionar clientes, no todos los empleados. -- Eliminamos la anterior

DROP POLICY IF EXISTS "customers_select_consolidated" ON sales.customers;
CREATE POLICY "customers_select_consolidated" ON sales.customers FOR 
SELECT TO authenticated USING ( 
  auth_management.is_creator((SELECT auth.uid())::uuid) 
  OR auth_management.is_employee((SELECT auth.uid())::uuid) 
  OR id = (SELECT auth.uid())::uuid 
  );

DROP POLICY IF EXISTS "creator_can_insert_customers" ON sales.customers;
CREATE POLICY "creator_can_insert_customers" ON sales.customers 
FOR INSERT TO authenticated WITH CHECK( 
  auth_management.is_creator((SELECT auth.uid())::uuid) 
  );

DROP POLICY IF EXISTS "creator_can_update_customers" ON sales.customers;
CREATE POLICY "creator_can_update_customers" ON sales.customers 
FOR  UPDATE TO authenticated USING ( 
  auth_management.is_creator((SELECT auth.uid())::uuid) 
  ) WITH CHECK ( 
    auth_management.is_creator((SELECT auth.uid())::uuid) 
  );



-- ######################################################################
-- # 8. INICIALIZACIÓN DE DATOS (ROLES, LOCALES Y STATUSES)
-- ######################################################################
-- Inicialización de Statuses de Empleado (Sin cambios)
INSERT INTO hr.employee_statuses (code, name, is_employment_active)
VALUES ('ACTIVE', 'Activo - Trabajando', TRUE),
  ('INACTIVE', 'Inactivo - Sin labores', FALSE),
  ('ON_LEAVE', 'Permiso/Licencia', FALSE),
  (
    'TERMINATED',
    'Relación Laboral Terminada',
    FALSE
  ) ON CONFLICT (code) DO NOTHING;
-- Inicialización de Roles (Sin cambios)
INSERT INTO hr.roles (name, description)
VALUES (
    'SuperAdmin',
    'Control total del sistema y base de datos.'
  ),
  (
    'Manager',
    'Gerente de Local o Área, con capacidad de gestión HR.'
  ),
  (
    'Employee',
    'Empleado de Imprenta (producción, diseño).'
  ),
  ('Designer', 'Diseñador Gráfico.'),
  (
    'Cashier',
    'Cajero de Local (manejo de transacciones).'
  ),
  ('HRManager', 'Recursos Humanos.'),
  ('Accountant', 'Contabilidad y finanzas.'),
  ('Administrator', 'Administrador de Sucursal.'),
  (
    'Developer',
    'Mantenimiento y desarrollo de la app.'
  ) ON CONFLICT (name) DO NOTHING;


INSERT INTO core.shops (
  id,
  name,
  address,
  email,
  main_phone,
  secondary_phone,
  company_data,
  basic_service_providers
) VALUES (
  '019bdc20-4e05-7cb7-81f5-634bdcbf826e',
  'Stand 194',
  'Jr. Huaraz 1717 - Piso 1 - Interior 194',
  'laser.guizado.plaza@gmail.com',
  '+51995558329',
  NULL,
  '{"default": 
  {"legalName": "LASER VELOZ IMPORT E.I.R.L.", 
  "ruc": "20610129910", 
  "address": "Jr. Huaraz 1717 - Piso 1 - Interior 194", 
  "bankAccount": "191-7075355-0-30", 
  "cci": "00219100707535503053", 
  "yape_primary": "903095920", 
  "yape_secondary": null, 
  "plin": null}}'::jsonb,
  NULL
);


INSERT INTO core.shops ( 
  id,
  name,
  address,
  email,
  main_phone,
  secondary_phone,
  company_data,
  basic_service_providers
) VALUES ( 
  '019bdc22-b528-73b1-8956-763ab43828d8',
  'Stand 243',
  'Jr. Orbegoso 243 - Piso 1 - Interior 243',
  'laser.guizado.orbegoso243@gmail.com',
  '+51970899806',
  NULL,
  '{"default": {
    "legalName": "ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.",
    "ruc": "20607873411",
    "address": "Jr. Orbegoso 243 - Piso 1 - Interior 243",
    "bankAccount": "191-2536428-0-83",
    "cci": "00219100253642808351",
    "yape_primary": "970899806",
    "yape_secondary": null,
    "plin": null}}'::jsonb,
  NULL
);