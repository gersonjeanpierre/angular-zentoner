-- EJEMPLO DESDE LA DOCUMENTACIÓN DE SUPABASE
-- https://supabase.com/docs/guides/api/using-custom-schemas?queryGroups=language&language=javascript
GRANT USAGE ON SCHEMA myschema TO anon,
  authenticated,
  service_role;
GRANT ALL ON ALL TABLES IN SCHEMA myschema TO anon,
  authenticated,
  service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA myschema TO anon,
  authenticated,
  service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA myschema TO anon,
  authenticated,
  service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema
GRANT ALL ON TABLES TO anon,
  authenticated,
  service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema
GRANT ALL ON ROUTINES TO anon,
  authenticated,
  service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema
GRANT ALL ON SEQUENCES TO anon,
  authenticated,
  service_role;
-- FIN EJEMPLO DESDE LA DOCUMENTACIÓN DE SUPABASE
--***************************************************************
-- PERMISOS PARA SCHEMA CORE ************************************
--***************************************************************
GRANT USAGE ON SCHEMA core TO authenticated,
  service_role;
GRANT SELECT,
  INSERT,
  UPDATE ON ALL TABLES IN SCHEMA core TO authenticated,
  service_role;
--***************************************************************
-- PERMISOS PARA SCHEMA Y FUNCIONES DE AUTH_MANAGEMENT **********
--***************************************************************
GRANT USAGE ON SCHEMA auth_management TO authenticated,
  service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth_management TO authenticated,
  service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth_management
GRANT ALL ON TABLES TO authenticated,
  service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth_management
GRANT ALL ON ROUTINES TO authenticated,
  service_role;
--***************************************************************
-- PERMISOS PARA SCHEMA Y FUNCIONES DE HR ***********************
--***************************************************************
GRANT USAGE ON SCHEMA hr TO authenticated,
  service_role;
GRANT SELECT,
  INSERT,
  UPDATE ON ALL TABLES IN SCHEMA hr TO authenticated,
  service_role;
-- ***************************************************************
-- PERMISOS PARA SCHEMA Y FUNCIONES DE SALES *********************
-- ***************************************************************
GRANT USAGE ON SCHEMA sales TO authenticated,
  service_role;
GRANT SELECT,
  INSERT,
  UPDATE ON ALL TABLES IN SCHEMA sales TO authenticated,
  service_role;
select *
from sales.active_customers;