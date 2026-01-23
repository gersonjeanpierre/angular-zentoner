-- EJEMPLO DESDE LA DOCUMENTACIÓN DE SUPABASE
-- https://supabase.com/docs/guides/api/using-custom-schemas?queryGroups=language&language=javascript
GRANT USAGE ON SCHEMA myschema TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA myschema TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA myschema TO anon,  authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA myschema TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema
GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema
GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema
GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
-- FIN EJEMPLO DESDE LA DOCUMENTACIÓN DE SUPABASE


