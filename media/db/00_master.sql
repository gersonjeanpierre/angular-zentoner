-- ======================================================================
-- MASTER SCRIPT
-- Execute all database schema files in correct order
-- ======================================================================

-- EXECUTION ORDER:
-- 1. Core schema (base tables and utilities)
-- 2. Auth management (authorization functions)
-- 3. HR schema (human resources)
-- 4. Sales schema (POS and customers)
-- 5. Inventory schema (categories and items)
-- 6. Kardex system (tracking and movements)
-- 7. Production schema (jobs)
-- 8. RLS policies (security)
-- 9. RPC functions (business logic)
-- 10. Grants (permissions)

\echo '======================================================================';
\echo 'Starting database setup...';
\echo '======================================================================';

\echo '';
\echo '1. Creating CORE schema...';
\i 01_core_schema.sql

\echo '';
\echo '2. Creating AUTH_MANAGEMENT schema...';
\i 02_auth_management_schema.sql

\echo '';
\echo '3. Creating HR schema...';
\i 03_hr_schema.sql

\echo '';
\echo '4. Creating SALES schema...';
\i 04_sales_schema.sql

\echo '';
\echo '5. Creating INVENTORY schema...';
\i 05_inventory_schema.sql

\echo '';
\echo '6. Creating KARDEX system...';
\i 06_kardex_system.sql

\echo '';
\echo '7. Creating PRODUCTION schema...';
\i 07_production_schema.sql

\echo '';
\echo '8. Applying RLS policies...';
\i 08_rls_policies.sql

\echo '';
\echo '9. Creating RPC functions...';
\i 09_rpc_functions.sql

\echo '';
\echo '10. Configuring grants and permissions...';
\i 10_grants.sql

\echo '';
\echo '======================================================================';
\echo 'Database setup completed successfully!';
\echo '======================================================================';
\echo '';
\echo 'Summary:';
\echo '- Core tables: shops, persons, audit_logs';
\echo '- HR: employees, roles, statuses';
\echo '- Sales: customers, orders, payments, cash sessions';
\echo '- Inventory: categories, items, machines';
\echo '- Kardex: movements, roll tracking, consumption logs';
\echo '- Production: jobs';
\echo '- RLS policies applied to all tables';
\echo '- RPC functions created for business logic';
\echo '- Grants configured for authenticated users';
\echo '';
