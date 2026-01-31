-- ======================================================================
-- RLS POLICIES
-- Row Level Security for all schemas
-- ======================================================================

-- ======================================================================
-- CORE SCHEMA POLICIES
-- ======================================================================

-- core.shops
DROP POLICY IF EXISTS "All active employees can read shops" ON core.shops;
CREATE POLICY "All active employees can read shops" 
  ON core.shops FOR SELECT TO authenticated
  USING (
    auth_management.is_employee((SELECT auth.uid())::uuid) 
    AND deleted_at IS NULL
  );

-- core.persons
DROP POLICY IF EXISTS "authenticated_persons_select_consolidated" ON core.persons;
CREATE POLICY "authenticated_persons_select_consolidated" 
  ON core.persons FOR SELECT TO authenticated
  USING (
    ((SELECT auth.uid())::uuid = id AND deleted_at IS NULL)
    OR (
      deleted_at IS NULL 
      AND NOT auth_management.is_universal_manager((SELECT auth.uid())::uuid)
      AND EXISTS (
        SELECT 1 FROM sales.customers sc 
        WHERE sc.id = core.persons.id AND sc.deleted_at IS NULL
      )
    )
    OR (auth_management.is_universal_manager((SELECT auth.uid())::uuid))
  );

DROP POLICY IF EXISTS "Authenticated insert persons (combined)" ON core.persons;
CREATE POLICY "Authenticated insert persons (combined)" 
  ON core.persons FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = id AND deleted_at IS NULL)
    OR (auth_management.is_universal_manager((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "authenticated_persons_update_consolidated" ON core.persons;
CREATE POLICY "authenticated_persons_update_consolidated" 
  ON core.persons FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.uid())::uuid = id) AND deleted_at IS NULL)
    OR (auth_management.is_universal_manager((SELECT auth.uid())::uuid))
  )
  WITH CHECK (
    (((SELECT auth.uid())::uuid = id) AND deleted_at IS NULL)
    OR (auth_management.is_universal_manager((SELECT auth.uid())::uuid))
  );

-- ======================================================================
-- HR SCHEMA POLICIES
-- ======================================================================

DROP POLICY IF EXISTS "hr_employees_select_consolidated" ON hr.employees;
CREATE POLICY "hr_employees_select_consolidated" 
  ON hr.employees FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "hr_employees_insert_managers" ON hr.employees;
CREATE POLICY "hr_employees_insert_managers" 
  ON hr.employees FOR INSERT TO authenticated
  WITH CHECK (
    auth_management.can_manage_hr(((SELECT auth.uid())::uuid))
  );

DROP POLICY IF EXISTS "hr_employees_update_managers" ON hr.employees;
CREATE POLICY "hr_employees_update_managers" 
  ON hr.employees FOR UPDATE TO authenticated
  USING (
    auth_management.can_manage_hr(((SELECT auth.uid())::uuid))
  )
  WITH CHECK (
    auth_management.can_manage_hr(((SELECT auth.uid())::uuid))
  );

-- ======================================================================
-- SALES SCHEMA POLICIES
-- ======================================================================

-- customers
DROP POLICY IF EXISTS "customers_select_consolidated" ON sales.customers;
CREATE POLICY "customers_select_consolidated" 
  ON sales.customers FOR SELECT TO authenticated
  USING (
    auth_management.is_creator((SELECT auth.uid())::uuid)
    OR auth_management.is_employee((SELECT auth.uid())::uuid)
    OR id = (SELECT auth.uid())::uuid
  );

DROP POLICY IF EXISTS "creator_can_insert_customers" ON sales.customers;
CREATE POLICY "creator_can_insert_customers" 
  ON sales.customers FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_creator((SELECT auth.uid())::uuid));

DROP POLICY IF EXISTS "creator_can_update_customers" ON sales.customers;
CREATE POLICY "creator_can_update_customers" 
  ON sales.customers FOR UPDATE TO authenticated
  USING (auth_management.is_creator((SELECT auth.uid())::uuid))
  WITH CHECK (auth_management.is_creator((SELECT auth.uid())::uuid));

-- order_status
DROP POLICY IF EXISTS "authenticated_can_select_order_status" ON sales.order_status;
CREATE POLICY "authenticated_can_select_order_status" 
  ON sales.order_status FOR SELECT TO authenticated 
  USING (true);

-- orders
DROP POLICY IF EXISTS "authenticated_can_select_orders" ON sales.orders;
CREATE POLICY "authenticated_can_select_orders" 
  ON sales.orders FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_orders" ON sales.orders;
CREATE POLICY "authenticated_can_insert_orders" 
  ON sales.orders FOR INSERT TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_update_orders" ON sales.orders;
CREATE POLICY "authenticated_can_update_orders" 
  ON sales.orders FOR UPDATE TO authenticated 
  USING (true) WITH CHECK (true);

-- order_details
DROP POLICY IF EXISTS "authenticated_can_select_order_details" ON sales.order_details;
CREATE POLICY "authenticated_can_select_order_details" 
  ON sales.order_details FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_order_details" ON sales.order_details;
CREATE POLICY "authenticated_can_insert_order_details" 
  ON sales.order_details FOR INSERT TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_update_order_details" ON sales.order_details;
CREATE POLICY "authenticated_can_update_order_details" 
  ON sales.order_details FOR UPDATE TO authenticated 
  USING (true) WITH CHECK (true);

-- cash_register_sessions
DROP POLICY IF EXISTS "authenticated_can_select_cash_sessions" ON sales.cash_register_sessions;
CREATE POLICY "authenticated_can_select_cash_sessions" 
  ON sales.cash_register_sessions FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_cash_sessions" ON sales.cash_register_sessions;
CREATE POLICY "authenticated_can_insert_cash_sessions" 
  ON sales.cash_register_sessions FOR INSERT TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_update_cash_sessions" ON sales.cash_register_sessions;
CREATE POLICY "authenticated_can_update_cash_sessions" 
  ON sales.cash_register_sessions FOR UPDATE TO authenticated 
  USING (true) WITH CHECK (true);

-- payments
DROP POLICY IF EXISTS "authenticated_can_select_payments" ON sales.payments;
CREATE POLICY "authenticated_can_select_payments" 
  ON sales.payments FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_payments" ON sales.payments;
CREATE POLICY "authenticated_can_insert_payments" 
  ON sales.payments FOR INSERT TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_update_payments" ON sales.payments;
CREATE POLICY "authenticated_can_update_payments" 
  ON sales.payments FOR UPDATE TO authenticated 
  USING (true) WITH CHECK (true);

-- cash_expenses
DROP POLICY IF EXISTS "authenticated_can_select_cash_expenses" ON sales.cash_expenses;
CREATE POLICY "authenticated_can_select_cash_expenses" 
  ON sales.cash_expenses FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_cash_expenses" ON sales.cash_expenses;
CREATE POLICY "authenticated_can_insert_cash_expenses" 
  ON sales.cash_expenses FOR INSERT TO authenticated 
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

-- ======================================================================
-- INVENTORY SCHEMA POLICIES
-- ======================================================================

-- categories
DROP POLICY IF EXISTS "authenticated_can_select_categories" ON inventory.categories;
CREATE POLICY "authenticated_can_select_categories" 
  ON inventory.categories FOR SELECT TO authenticated 
  USING (true);

-- items
DROP POLICY IF EXISTS "authenticated_can_select_items" ON inventory.items;
CREATE POLICY "authenticated_can_select_items" 
  ON inventory.items FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_items" ON inventory.items;
CREATE POLICY "authenticated_can_insert_items" 
  ON inventory.items FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_update_items" ON inventory.items;
CREATE POLICY "authenticated_can_update_items" 
  ON inventory.items FOR UPDATE TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())))
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

-- machines
DROP POLICY IF EXISTS "authenticated_can_select_machines" ON inventory.machines;
CREATE POLICY "authenticated_can_select_machines" 
  ON inventory.machines FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_machines" ON inventory.machines;
CREATE POLICY "authenticated_can_insert_machines" 
  ON inventory.machines FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_update_machines" ON inventory.machines;
CREATE POLICY "authenticated_can_update_machines" 
  ON inventory.machines FOR UPDATE TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())))
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

-- movement_type & movement_reason
DROP POLICY IF EXISTS "authenticated_can_select_movement_type" ON inventory.movement_type;
CREATE POLICY "authenticated_can_select_movement_type" 
  ON inventory.movement_type FOR SELECT TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_select_movement_reason" ON inventory.movement_reason;
CREATE POLICY "authenticated_can_select_movement_reason" 
  ON inventory.movement_reason FOR SELECT TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())));

-- roll_tracking
DROP POLICY IF EXISTS "authenticated_can_select_roll_tracking" ON inventory.roll_tracking;
CREATE POLICY "authenticated_can_select_roll_tracking" 
  ON inventory.roll_tracking FOR SELECT TO authenticated
  USING (auth_management.is_employee((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_insert_roll_tracking" ON inventory.roll_tracking;
CREATE POLICY "authenticated_can_insert_roll_tracking" 
  ON inventory.roll_tracking FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_employee((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_update_roll_tracking" ON inventory.roll_tracking;
CREATE POLICY "authenticated_can_update_roll_tracking" 
  ON inventory.roll_tracking FOR UPDATE TO authenticated
  USING (auth_management.is_employee((SELECT auth.uid())))
  WITH CHECK (auth_management.is_employee((SELECT auth.uid())));

-- kardex
DROP POLICY IF EXISTS "authenticated_can_select_kardex" ON inventory.kardex;
CREATE POLICY "authenticated_can_select_kardex" 
  ON inventory.kardex FOR SELECT TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_insert_kardex_movement" ON inventory.kardex;
CREATE POLICY "authenticated_can_insert_kardex_movement" 
  ON inventory.kardex FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_update_kardex_movement" ON inventory.kardex;
CREATE POLICY "authenticated_can_update_kardex_movement" 
  ON inventory.kardex FOR UPDATE TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())))
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

-- consumption_logs
DROP POLICY IF EXISTS "authenticated_can_select_consumption_logs" ON inventory.consumption_logs;
CREATE POLICY "authenticated_can_select_consumption_logs" 
  ON inventory.consumption_logs FOR SELECT TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_insert_consumption_logs" ON inventory.consumption_logs;
CREATE POLICY "authenticated_can_insert_consumption_logs" 
  ON inventory.consumption_logs FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_update_consumption_logs" ON inventory.consumption_logs;
CREATE POLICY "authenticated_can_update_consumption_logs" 
  ON inventory.consumption_logs FOR UPDATE TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())))
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

-- kardex_consumption
DROP POLICY IF EXISTS "authenticated_can_select_kardex_consumption" ON inventory.kardex_consumption;
CREATE POLICY "authenticated_can_select_kardex_consumption" 
  ON inventory.kardex_consumption FOR SELECT TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_insert_kardex_consumption" ON inventory.kardex_consumption;
CREATE POLICY "authenticated_can_insert_kardex_consumption" 
  ON inventory.kardex_consumption FOR INSERT TO authenticated
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "authenticated_can_update_kardex_consumption" ON inventory.kardex_consumption;
CREATE POLICY "authenticated_can_update_kardex_consumption" 
  ON inventory.kardex_consumption FOR UPDATE TO authenticated
  USING (auth_management.is_universal_manager((SELECT auth.uid())))
  WITH CHECK (auth_management.is_universal_manager((SELECT auth.uid())));
