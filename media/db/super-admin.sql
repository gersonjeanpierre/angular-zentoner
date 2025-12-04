-- Ejecutar en la Consola SQL de Supabase
DO $$
DECLARE
    -- ! CONFIGURACIÓN:
    admin_auth_email text := 'admin@lasercolorveloz.com'; -- ! DEBE COINCIDIR con el email del usuario en auth.users
    default_shop_id uuid; -- ID del local por defecto para el empleado (SuperAdmin)
    
    -- Variables de trabajo:
    admin_uuid uuid;
    super_admin_role_id bigint;
    active_status_id smallint;
BEGIN
    -- 0. Obtener el ID del Local por defecto (Usando 'ORBEGOSO')
    SELECT id INTO default_shop_id FROM core.shops WHERE name = 'ORBEGOSO';

    IF default_shop_id IS NULL THEN
        RAISE EXCEPTION 'El local "ORBEGOSO" no existe. Por favor, asegúrese de poblar core.shops primero.';
    END IF;

    -- 1. Obtener el ID del usuario registrado en Auth
    SELECT id INTO admin_uuid FROM auth.users WHERE email = admin_auth_email;
    
    IF admin_uuid IS NULL THEN
        RAISE EXCEPTION 'El usuario % no existe en auth.users. Asegúrese de crearlo primero.', admin_auth_email;
    END IF;

    -- 2. Obtener IDs de roles y estados necesarios
    SELECT id INTO super_admin_role_id FROM hr.roles WHERE name = 'SuperAdmin';
    SELECT id INTO active_status_id FROM hr.employee_statuses WHERE code = 'ACTIVE';

    IF super_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'El rol SuperAdmin no fue encontrado en hr.roles.';
    END IF;

    IF active_status_id IS NULL THEN
        RAISE EXCEPTION 'El estado ACTIVE no fue encontrado en hr.employee_statuses.';
    END IF;


    -- 3. Crear/Actualizar el Perfil en CORE.PERSONS
    INSERT INTO core.persons (
        id, email, first_name, last_name, person_type, created_by_id, updated_by_id -- ✅ updated_by_id incluido
    )
    VALUES (
        admin_uuid, admin_auth_email, 'Super', 'Admin', 'NATURAL', admin_uuid, admin_uuid -- ✅ updated_by_id incluido
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        updated_at = NOW(), 
        updated_by_id = admin_uuid; -- ✅ updated_by_id incluido
    
    -- 4. Crear/Actualizar el registro de HR.EMPLOYEES
    INSERT INTO hr.employees (
        id, shop_id, auth_email, status_id, hire_date, created_by_id, updated_by_id -- ✅ updated_by_id incluido
    )
    VALUES (
        admin_uuid, default_shop_id, admin_auth_email, active_status_id, CURRENT_DATE, admin_uuid, admin_uuid -- ✅ updated_by_id incluido
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        shop_id = EXCLUDED.shop_id, 
        status_id = EXCLUDED.status_id, 
        updated_at = NOW(),
        updated_by_id = admin_uuid; -- ✅ updated_by_id incluido
    
    -- 5. Asignar el rol SUPER_ADMIN
    INSERT INTO hr.employee_roles (employee_id, role_id)
    VALUES (admin_uuid, super_admin_role_id)
    ON CONFLICT (employee_id, role_id) DO NOTHING;
    
    RAISE NOTICE '✅ ¡Super Administrador % (UUID: %) creado/actualizado y listo para usar la aplicación!', admin_auth_email, admin_uuid;
END $$;