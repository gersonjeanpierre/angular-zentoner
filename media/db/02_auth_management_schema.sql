-- ======================================================================
-- AUTH MANAGEMENT SCHEMA
-- Authorization and role checking functions
-- ======================================================================

DROP SCHEMA IF EXISTS auth_management CASCADE;
CREATE SCHEMA IF NOT EXISTS auth_management;

-- ======================================================================
-- AUTHORIZATION FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION auth_management.is_employee(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM hr.employees WHERE id = user_id);
$$;

CREATE OR REPLACE FUNCTION auth_management.is_super_admin(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM hr.employee_roles er
    JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id AND r.name = 'SuperAdmin'
  );
$$;

CREATE OR REPLACE FUNCTION auth_management.is_creator(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM hr.employee_roles er
    JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id 
    AND r.name IN ('SuperAdmin', 'Administrator', 'HRManager')
  );
$$;

CREATE OR REPLACE FUNCTION auth_management.can_manage_hr(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM hr.employee_roles er
    JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id 
    AND r.name IN ('SuperAdmin', 'HRManager', 'Accountant', 'Manager', 'Developer')
  );
$$;

CREATE OR REPLACE FUNCTION auth_management.is_universal_manager(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM hr.employee_roles er
    JOIN hr.roles r ON er.role_id = r.id
    WHERE er.employee_id = user_id 
    AND r.name IN ('SuperAdmin', 'Manager', 'HRManager', 'Accountant', 'Administrator', 'Developer')
  );
$$;
