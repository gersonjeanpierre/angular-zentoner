-- ######################################################################
-- # INVENTORY MODULE - OPTIMIZED FOR SUPABASE
-- # Features: Real-time, RLS, Performance, Scalability
-- ######################################################################
DROP SCHEMA IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS inventory.categories CASCADE;
-- ======================================================================
-- 1. CREATE SCHEMA AND EXTENSIONS
-- ======================================================================

CREATE SCHEMA IF NOT EXISTS inventory;

-- ======================================================================
-- 2. PRODUCT CATALOG MANAGEMENT
-- ======================================================================
-- PRODUCT CATEGORIES (Hierarchical with closure table pattern)
CREATE TABLE IF NOT EXISTS inventory.categories (
  id SMALLSERIAL PRIMARY KEY,  
  shop_id UUID REFERENCES core.shops(id),
  parent_id SMALLINT REFERENCES inventory.categories(id),
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  sort_order SMALLINT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- CONSTRAINTS PARA inventory.categories
ALTER TABLE inventory.categories
  ADD CONSTRAINT chk_category_name_length CHECK (
    name IS NULL OR char_length(name) <= 50
  ),
  ADD CONSTRAINT chk_description_length CHECK (
    description IS NULL OR char_length(description) <= 200
  ),
  ADD CONSTRAINT chk_slug_length CHECK (
    slug IS NULL OR char_length(slug) <= 100
  );

-- TRIGGERS PARA update_at
CREATE TRIGGER trg_categories_set_updated_at
  BEFORE UPDATE ON inventory.categories
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();
-----
-- TRIGGER slug
CREATE TRIGGER trg_categories_slug_update
  BEFORE INSERT OR UPDATE ON inventory.categories
  FOR EACH ROW
  EXECUTE FUNCTION core.handle_slug();

-- RLS
ALTER TABLE inventory.categories ENABLE ROW LEVEL SECURITY;


-- Categorias iniciales
DO $$ 
DECLARE 
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
BEGIN 
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Materiales y Soportes', 'Papeles, vinilos, acrílicos, listones de madera, entre otros.', 1),
    (shop_uuid, 'Insumos y Consumibles', 'Tintas UV, toners, polvos DTF, tintas sublimación, entre otros.', 2),
    (shop_uuid, 'Acabados y Post-prensa', 'Laminados, enmicados, ojalillos, entre otros.', 3),
    (shop_uuid, 'Merchandising y Blancos', 'Tazas para sublimar, lapiceros para UV, llaveros, bolsas, agendas, entre otros.', 4),
    (shop_uuid, 'Tecnología DTF', 'Categoría principal de productos DTF para las impresiones.', 5),
    (shop_uuid, 'Maquinaria y Equipos', 'Maquinaria y equipos para las impresiones. Hibrida UV, Laminadora, enmicadora, entre otros.', 6),
    (shop_uuid, 'Estructuras y Displays', 'Estructuras y displays para las impresiones, Roll ups, marcos, entre otros.', 7),
    (shop_uuid, 'Servicios y Otros', 'Servicios y otros relacionados con las impresiones.', 8)
    ON CONFLICT DO NOTHING;
END $$;
-- ======================================================================
-- Subcategorias detallada para Materiales y Soportes
DO $$ 
DECLARE 
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    -- IDs de Nivel 0
    id_materiales INT;
    -- id_insumos INT;
    -- id_acabados INT;
    -- id_merch INT;
    -- id_dtf INT;
    -- id_maquinaria INT;
    -- id_estructuras INT;
    -- id_servicios INT;

    -- IDs de Nivel 1 (para crear Nivel 2)
    sub_papel INT;
    sub_vinil INT;
    sub_acrilico INT;

    -- Ids de Nivel 2 para papeles
    sub_papel_tamano_adhesivo INT;
    sub_papel_tamano_bond INT;
    sub_papel_tamano_canson INT;
    sub_papel_tamano_couche INT;
    sub_papel_tamano_folkote INT;
    sub_papel_tamano_fotografia INT;
    sub_papel_tamano_hilo INT;
    sub_papel_tamano_opalina INT;

    -- Ids de Nivel 2 para vinilos
    sub_vinil_tipos_giganto INT;
    sub_vinil_tipos_vinilo INT;
    sub_vinil_tipos_rigido INT;
BEGIN 
    -- 1. CAPTURA DE CATEGORÍAS RAÍZ
    SELECT id INTO id_materiales  FROM inventory.categories WHERE name = 'Materiales y Soportes'    AND shop_id = shop_uuid;
    -- SELECT id INTO id_insumos     FROM inventory.categories WHERE name = 'Insumos y Consumibles'    AND shop_id = shop_uuid;
    -- SELECT id INTO id_acabados    FROM inventory.categories WHERE name = 'Acabados y Post-prensa'   AND shop_id = shop_uuid;
    -- SELECT id INTO id_merch       FROM inventory.categories WHERE name = 'Merchandising y Blancos'  AND shop_id = shop_uuid;
    -- SELECT id INTO id_dtf         FROM inventory.categories WHERE name = 'Tecnología DTF'           AND shop_id = shop_uuid;
    -- SELECT id INTO id_estructuras FROM inventory.categories WHERE name = 'Estructuras y Displays'   AND shop_id = shop_uuid;

    -- M A T E R I A L E S   Y   S O P O R T E S
    -- =================================================================================
    -- NIVEL 1: PAPELES Y CARTULINAS
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_materiales, 'Papeles y Cartulinas', 1) RETURNING id INTO sub_papel;

    -- NIVEL 2: Tipos de papel (De tu constante de código)
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel, 'Adhesivo', 1),
    (shop_uuid, sub_papel, 'Bond', 2),
    (shop_uuid, sub_papel, 'Canson', 3),
    (shop_uuid, sub_papel, 'Couche', 4),
    (shop_uuid, sub_papel, 'Folkote', 5),
    (shop_uuid, sub_papel, 'Fotografía', 6),
    (shop_uuid, sub_papel, 'Hilo', 7),
    (shop_uuid, sub_papel, 'Opalina', 8);
    -- Subcategoría Tamaño de Papel para Adhesivo
    SELECT id INTO sub_papel_tamano_adhesivo FROM inventory.categories  WHERE name = 'Adhesivo' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_adhesivo, 'A4', 1),
    (shop_uuid, sub_papel_tamano_adhesivo, 'SA3', 2);

    -- Subcategoría Tamaño de Papel para Bond
    SELECT id INTO sub_papel_tamano_bond FROM inventory.categories  WHERE name = 'Bond' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_bond, 'A0', 1),
    (shop_uuid, sub_papel_tamano_bond, 'A1', 2),
    (shop_uuid, sub_papel_tamano_bond, 'A2', 3),
    (shop_uuid, sub_papel_tamano_bond, 'A3', 4),
    (shop_uuid, sub_papel_tamano_bond, 'A4', 5),
    (shop_uuid, sub_papel_tamano_bond, 'A5', 6),
    (shop_uuid, sub_papel_tamano_bond, 'A6', 7),
    (shop_uuid, sub_papel_tamano_bond, 'A7', 8),
    (shop_uuid, sub_papel_tamano_bond, 'A8', 9),
    (shop_uuid, sub_papel_tamano_bond, 'SA3', 10);

    -- Subcategoría Tamaño de Papel para Canson
    SELECT id INTO sub_papel_tamano_canson FROM inventory.categories  WHERE name = 'Canson' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_canson, 'A4', 1),
    (shop_uuid, sub_papel_tamano_canson, 'A3', 2),
    (shop_uuid, sub_papel_tamano_canson, 'SA3', 3);

    -- Subcategoría Tamaño de Papel para Couche
    SELECT id INTO sub_papel_tamano_couche FROM inventory.categories  WHERE name = 'Couche' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_couche, 'A4', 1),
    (shop_uuid, sub_papel_tamano_couche, 'A3', 2),
    (shop_uuid, sub_papel_tamano_couche, 'SA3', 3);

    -- Subcategoría Tamaño de Papel para Folkote
    SELECT id INTO sub_papel_tamano_folkote FROM inventory.categories  WHERE name = 'Folkote' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_folkote, 'A4', 1),
    (shop_uuid, sub_papel_tamano_folkote, 'A3', 2),
    (shop_uuid, sub_papel_tamano_folkote, 'SA3', 3);

    -- Subcategoría Tamaño de Papel para Fotografía
    SELECT id INTO sub_papel_tamano_fotografia FROM inventory.categories  WHERE name = 'Fotografía' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_fotografia, 'A4', 1),
    (shop_uuid, sub_papel_tamano_fotografia, 'A3', 2),
    (shop_uuid, sub_papel_tamano_fotografia, 'SA3', 3);

    -- Subcategoría Tamaño de Papel para Hilo
    SELECT id INTO sub_papel_tamano_hilo FROM inventory.categories  WHERE name = 'Hilo' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_hilo, 'A4', 1),
    (shop_uuid, sub_papel_tamano_hilo, 'A3', 2),
    (shop_uuid, sub_papel_tamano_hilo, 'SA3', 3);

    -- Subcategoría Tamaño de Papel para Opalina
    SELECT id INTO sub_papel_tamano_opalina FROM inventory.categories  WHERE name = 'Opalina' AND parent_id = sub_papel AND shop_id = shop_uuid;
    --NIVEL 3: Tamaños de Papel
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_papel_tamano_opalina, 'A4', 1),
    (shop_uuid, sub_papel_tamano_opalina, 'A3', 2),
    (shop_uuid, sub_papel_tamano_opalina, 'SA3', 3);

    -- =================================================================================
    -- NIVEL 1: VINILOS Y GIGANTOGRAFÍA
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id,parent_id,name,sort_order)
    VALUES (shop_uuid, id_materiales, 'Vinilos y Gigantografía', 2) RETURNING id INTO sub_vinil;
    -- -- NIVEL 2: Tipos de Vinilo
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_vinil, 'Gigantografias', 1),
    (shop_uuid, sub_vinil, 'Vinilos', 2),
    (shop_uuid, sub_vinil, 'Rigidos', 3);
    -- Subcategoria tipos de lonas para gigantografias
    SELECT id INTO sub_vinil_tipos_giganto FROM inventory.categories WHERE name = 'Gigantografias' AND parent_id = sub_vinil AND shop_id = shop_uuid;
    -- NIVEL 3: Tipos de Lonas
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_vinil_tipos_giganto, 'Lona Frontlit', 1),
    (shop_uuid, sub_vinil_tipos_giganto, 'Lona Blockout', 2),
    (shop_uuid, sub_vinil_tipos_giganto, 'Lona Backlight', 3),
    (shop_uuid, sub_vinil_tipos_giganto, 'Lona Mesh', 4);
    -- Subcategoria tipos de vinilos
    SELECT id INTO sub_vinil_tipos_vinilo FROM inventory.categories WHERE name = 'Vinilos' AND parent_id = sub_vinil AND shop_id = shop_uuid;
    -- NIVEL 3: Tipos de Vinilos
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_vinil_tipos_vinilo, 'Vinilo Mate', 1),
    (shop_uuid, sub_vinil_tipos_vinilo, 'Vinilo Brillo', 2),
    (shop_uuid, sub_vinil_tipos_vinilo, 'Vinilo Transparente', 3),
    (shop_uuid, sub_vinil_tipos_vinilo, 'Vinilo Electrostatico', 4);


    SELECT 
END $$;
-- ####################################################################



-- ######################################################################
-- Subcategorías
DO $$ 
DECLARE 
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    -- IDs de Nivel 0
    id_insumos INT; id_acabados INT; id_merch INT; id_dtf INT; id_estructuras INT; id_servicios INT;
    -- IDs de Nivel 1 (para crear Nivel 2)
    sub_tintas INT; sub_acabados_imp INT; sub_encuadernacion INT; 
    sub_merch_textil INT; sub_merch_rigido INT; sub_dtf_textil INT; sub_dtf_uv INT;
BEGIN 
    -- 1. CAPTURA DE CATEGORÍAS RAÍZ
    SELECT id INTO id_insumos     FROM inventory.categories WHERE name = 'Insumos y Consumibles'    AND shop_id = shop_uuid;
    SELECT id INTO id_acabados    FROM inventory.categories WHERE name = 'Acabados y Post-prensa'   AND shop_id = shop_uuid;
    SELECT id INTO id_merch       FROM inventory.categories WHERE name = 'Merchandising y Blancos'  AND shop_id = shop_uuid;
    SELECT id INTO id_dtf         FROM inventory.categories WHERE name = 'Tecnología DTF'           AND shop_id = shop_uuid;
    SELECT id INTO id_estructuras FROM inventory.categories WHERE name = 'Estructuras y Displays'   AND shop_id = shop_uuid;
    SELECT id INTO id_servicios   FROM inventory.categories WHERE name = 'Servicios y Otros'        AND shop_id = shop_uuid;

    -- =================================================================================
    -- NIVEL 1 Y 2: INSUMOS (Lo que consumen tus máquinas)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_insumos, 'Tintas y Toners', 1) RETURNING id INTO sub_tintas;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_tintas, 'Toner Minolta/Konica', 1),
    (shop_uuid, sub_tintas, 'Tintas UV Híbrida', 2),
    (shop_uuid, sub_tintas, 'Tintas Sublimación/Ecotank', 3),
    (shop_uuid, sub_tintas, 'Solventes y Limpiadores', 4);

    -- =================================================================================
    -- NIVEL 1 Y 2: ACABADOS (Tu enmicadora, troqueladora y manuales)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_acabados, 'Laminado y Enmicado', 1) RETURNING id INTO sub_acabados_imp;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_acabados_imp, 'Rollos BOPP (Laminación)', 1),
    (shop_uuid, sub_acabados_imp, 'Micas/Pouches (Enmicado)', 2),
    (shop_uuid, sub_acabados_imp, 'Plastificado Mate/Brillo', 3);

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_acabados, 'Post-Impresión Físico', 2) RETURNING id INTO sub_encuadernacion;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_encuadernacion, 'Anillado y Espiralado', 1),
    (shop_uuid, sub_encuadernacion, 'Troquelado y Semicorte', 2), -- Para tus troqueladoras
    (shop_uuid, sub_encuadernacion, 'Ojales y Remaches', 3),
    (shop_uuid, sub_encuadernacion, 'Empastado y Perforado', 4);

    -- =================================================================================
    -- NIVEL 1 Y 2: MERCHANDISING (Para Sublimación, Láser y UV)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_merch, 'Textiles Publicitarios', 1) RETURNING id INTO sub_merch_textil;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_merch_textil, 'Polos y Poleras', 1),
    (shop_uuid, sub_merch_textil, 'Gorras (Visera Blanca/Color)', 2),
    (shop_uuid, sub_merch_textil, 'Bolsas Notex/Tocuyo', 3);

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_merch, 'Regalos y Rígidos', 2) RETURNING id INTO sub_merch_rigido;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_merch_rigido, 'Lapiceros y Tomatodos (UV)', 1),
    (shop_uuid, sub_merch_rigido, 'Llaveros y Porta Retratos', 2),
    (shop_uuid, sub_merch_rigido, 'Mousepads y Rompecabezas', 3);

    -- =================================================================================
    -- NIVEL 1 Y 2: TECNOLOGÍA DTF
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_dtf, 'DTF Textil', 1) RETURNING id INTO sub_dtf_textil;
    
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_dtf_textil, 'Films 55cm', 1),
    (shop_uuid, sub_dtf_textil, 'Polvos Poliamida', 2);

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) 
    VALUES (shop_uuid, id_dtf, 'DTF UV (Merch)', 2) RETURNING id INTO sub_dtf_uv;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_dtf_uv, 'Láminas A/B UV', 1);

    -- =================================================================================
    -- NIVEL 1 Y 2: ESTRUCTURAS Y DISPLAYS
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_estructuras, 'Roll Screens', 1),
    (shop_uuid, id_estructuras, 'Parantes y Arañas', 2),
    (shop_uuid, id_estructuras, 'Paneles y Marcos', 3);

    -- =================================================================================
    -- NIVEL 1 Y 2: SERVICIOS Y OTROS
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_servicios, 'Diseño Gráfico', 1),
    (shop_uuid, id_servicios, 'Escaneo Documentos', 2),
    (shop_uuid, id_servicios, 'Movilidad y Envíos', 3),
    (shop_uuid, id_servicios, 'Saldos y Administrativos', 4);

END $$;
