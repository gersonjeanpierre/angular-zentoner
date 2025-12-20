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
SELECT * FROM cat_path ;