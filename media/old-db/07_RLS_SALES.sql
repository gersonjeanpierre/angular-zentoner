-- =====================================================================
-- RLS POLICIES FOR SALES SCHEMA
-- =====================================================================
-- Este archivo crea las políticas de Row Level Security (RLS)
-- para las tablas del schema sales (orders, order_details, payments, etc.)
-- =====================================================================

-- =====================================================================
-- POLÍTICAS PARA: sales.order_status
-- =====================================================================

-- Permitir SELECT a usuarios autenticados
CREATE POLICY "authenticated_can_select_order_status"
ON sales.order_status
FOR SELECT
TO authenticated
USING (true);

-- =====================================================================
-- POLÍTICAS PARA: sales.orders
-- =====================================================================

-- Permitir SELECT a usuarios autenticados
-- Los usuarios pueden ver todas las órdenes de su tienda
CREATE POLICY "authenticated_can_select_orders"
ON sales.orders
FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT a usuarios autenticados
-- Los usuarios pueden crear órdenes
CREATE POLICY "authenticated_can_insert_orders"
ON sales.orders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE a usuarios autenticados
-- Los usuarios pueden actualizar órdenes
CREATE POLICY "authenticated_can_update_orders"
ON sales.orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir DELETE a usuarios autenticados (soft delete con deleted_at)
-- CREATE POLICY "authenticated_can_delete_orders"
-- ON sales.orders
-- FOR DELETE
-- TO authenticated
-- USING (true);

-- =====================================================================
-- POLÍTICAS PARA: sales.order_details
-- =====================================================================

-- Permitir SELECT a usuarios autenticados
CREATE POLICY "authenticated_can_select_order_details"
ON sales.order_details
FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT a usuarios autenticados
CREATE POLICY "authenticated_can_insert_order_details"
ON sales.order_details
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE a usuarios autenticados
CREATE POLICY "authenticated_can_update_order_details"
ON sales.order_details
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir DELETE a usuarios autenticados
-- CREATE POLICY "authenticated_can_delete_order_details"
-- ON sales.order_details
-- FOR DELETE
-- TO authenticated
-- USING (true);

-- =====================================================================
-- POLÍTICAS PARA: sales.cash_register_sessions
-- =====================================================================

-- Permitir SELECT a usuarios autenticados
CREATE POLICY "authenticated_can_select_cash_sessions"
ON sales.cash_register_sessions
FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT a usuarios autenticados (abrir sesión)
CREATE POLICY "authenticated_can_insert_cash_sessions"
ON sales.cash_register_sessions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE a usuarios autenticados (cerrar sesión)
CREATE POLICY "authenticated_can_update_cash_sessions"
ON sales.cash_register_sessions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================================
-- POLÍTICAS PARA: sales.payments
-- =====================================================================

-- Permitir SELECT a usuarios autenticados
CREATE POLICY "authenticated_can_select_payments"
ON sales.payments
FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT a usuarios autenticados (registrar pagos)
CREATE POLICY "authenticated_can_insert_payments"
ON sales.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE a usuarios autenticados
CREATE POLICY "authenticated_can_update_payments"
ON sales.payments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir DELETE a usuarios autenticados (soft delete)
-- CREATE POLICY "authenticated_can_delete_payments"
-- ON sales.payments
-- FOR DELETE
-- TO authenticated
-- USING (true);

-- =====================================================================
-- POLÍTICAS PARA: sales.customers (si existe en el schema sales)
-- =====================================================================

-- Verificar si la tabla existe antes de crear políticas
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'sales' 
    AND table_name = 'customers'
  ) THEN
    -- Permitir SELECT
    EXECUTE 'CREATE POLICY "authenticated_can_select_customers" 
    ON sales.customers FOR SELECT TO authenticated USING (true)';
    
    -- Permitir INSERT
    EXECUTE 'CREATE POLICY "authenticated_can_insert_customers" 
    ON sales.customers FOR INSERT TO authenticated WITH CHECK (true)';
    
    -- Permitir UPDATE
    EXECUTE 'CREATE POLICY "authenticated_can_update_customers" 
    ON sales.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================================
-- NOTAS IMPORTANTES
-- =====================================================================
-- 
-- 1. Estas políticas son permisivas para usuarios autenticados
-- 2. Para mayor seguridad, puedes agregar condiciones adicionales:
--    - Filtrar por shop_id del usuario
--    - Validar roles específicos (admin, cajero, vendedor)
--    - Limitar acceso por horarios o estados
--
-- 3. Ejemplo de política con filtro por tienda:
--    USING (shop_id = auth.jwt()->>'shop_id')
--
-- 4. Ejemplo de política por rol:
--    USING (EXISTS (
--      SELECT 1 FROM hr.employees e
--      WHERE e.user_id = auth.uid()
--      AND e.role_id IN (1, 2, 3)
--    ))
--
-- =====================================================================
