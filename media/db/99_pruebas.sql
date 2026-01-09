SELECT * FROM inventory.categories;

WITH RECURSIVE cat_tree AS (
  SELECT
    id,
    parent_id,
    name,
    slug,
    shop_id,
    1 AS depth,
    ARRAY[id] AS path
  FROM inventory.categories
  WHERE parent_id IS NULL  -- raíces; quitar esta línea para iniciar desde todas

  UNION ALL

  SELECT
    c.id,
    c.parent_id,
    c.name,
    c.slug,
    c.shop_id,
    ct.depth + 1,
    ct.path || c.id
  FROM inventory.categories c
  JOIN cat_tree ct ON c.parent_id = ct.id
)
SELECT * FROM cat_tree
ORDER BY path;


WITH RECURSIVE cat_path AS (
  SELECT
    id,
    parent_id,
    name,
    slug,
    1 AS depth,
    name::text AS full_path
  FROM inventory.categories
  WHERE parent_id IS NULL

  UNION ALL

  SELECT
    c.id,
    c.parent_id,
    c.name,
    c.slug,
    cp.depth + 1,
    cp.full_path || ' > ' || c.name
  FROM inventory.categories c
  JOIN cat_path cp ON c.parent_id = cp.id
)
SELECT * FROM cat_path ORDER BY full_path;


SELECT auth_management.is_universal_manager('4d712d67-0ea4-48c0-b698-a9324c38a94b'::uuid);

SELECT er.*, r.name 
FROM hr.employee_roles er 
JOIN hr.roles r ON er.role_id = r.id 
WHERE er.employee_id = '4d712d67-0ea4-48c0-b698-a9324c38a94b'::uuid;

-- Asumiendo que 'Manager' existe en hr.roles (ajusta si es otro rol)
INSERT INTO hr.employee_roles (employee_id, role_id) 
VALUES ('4d712d67-0ea4-48c0-b698-a9324c38a94b'::uuid, (SELECT id FROM hr.roles WHERE name = 'Manager'));

(SELECT 1 FROM hr.employee_roles er JOIN hr.roles r ON er.role_id = r.id WHERE er.employee_id = '4d712d67-0ea4-48c0-b698-a9324c38a94b'::uuid AND r.name IN ('SuperAdmin', 'Manager', 'HRManager', 'Accountant', 'Administrator', 'Developer'))