-- ======================================================================
-- GRANTS AND PERMISSIONS
-- Configure access permissions for roles
-- ======================================================================

-- ======================================================================
-- CORE SCHEMA
-- ======================================================================

GRANT USAGE ON SCHEMA core TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA core TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA core TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA core TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA core
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA core
GRANT ALL ON ROUTINES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA core
GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- ======================================================================
-- AUTH_MANAGEMENT SCHEMA
-- ======================================================================

GRANT USAGE ON SCHEMA auth_management TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth_management TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth_management TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth_management
GRANT ALL ON ROUTINES TO authenticated, service_role;

-- ======================================================================
-- HR SCHEMA
-- ======================================================================

GRANT USAGE ON SCHEMA hr TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hr TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hr TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hr
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hr
GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- ======================================================================
-- SALES SCHEMA
-- ======================================================================

GRANT USAGE ON SCHEMA sales TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA sales TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA sales TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sales TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sales
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sales
GRANT ALL ON ROUTINES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sales
GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- ======================================================================
-- INVENTORY SCHEMA
-- ======================================================================

GRANT USAGE ON SCHEMA inventory TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA inventory TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA inventory TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA inventory TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA inventory
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA inventory
GRANT ALL ON ROUTINES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA inventory
GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- ======================================================================
-- PRODUCTION SCHEMA
-- ======================================================================

GRANT USAGE ON SCHEMA production TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA production TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA production TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA production
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA production
GRANT ALL ON SEQUENCES TO authenticated, service_role;
