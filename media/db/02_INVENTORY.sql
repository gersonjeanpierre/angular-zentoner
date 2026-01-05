-- ######################################################################
-- # INVENTORY MODULE
-- ######################################################################
DROP SCHEMA IF EXISTS inventory CASCADE;
CREATE SCHEMA IF NOT EXISTS inventory;

DROP TABLE IF EXISTS inventory.kardex CASCADE;
DROP TABLE IF EXISTS inventory.movement_type CASCADE;
DROP TABLE IF EXISTS inventory.movement_reason CASCADE;
DROP TABLE IF EXISTS inventory.items CASCADE;
DROP TABLE IF EXISTS inventory.categories CASCADE;
-- ======================================================================
-- CATEGORIAS 
-- ======================================================================
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

-- ======================================================================
-- SEED DATA PARA CATEGORIES
-- ======================================================================

-- ======================================================================
-- M A T E R I A L E S   Y   S O P O R T E S
-- ======================================================================
DO $$ 
DECLARE 
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    -- IDs de Nivel 0
    id_materiales INT;
    -- IDs de Nivel 1 (para crear Nivel 2)
    sub_papel INT;
    sub_vinil INT;
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
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Materiales y Soportes', 'Papeles, vinilos, acrílicos, listones de madera, entre otros.', 1)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_materiales  FROM inventory.categories WHERE name = 'Materiales y Soportes'    AND shop_id = shop_uuid;

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
    (shop_uuid, sub_papel_tamano_bond, 'SA3', 6);

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
    (shop_uuid, sub_vinil_tipos_giganto, 'Lona Backlight', 2),
    (shop_uuid, sub_vinil_tipos_giganto, 'Lona Blackout', 3);
    -- Subcategoria tipos de vinilos
    SELECT id INTO sub_vinil_tipos_vinilo FROM inventory.categories WHERE name = 'Vinilos' AND parent_id = sub_vinil AND shop_id = shop_uuid;
    -- NIVEL 3: Tipos de Vinilos
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_vinil_tipos_vinilo, 'Vinilo Blanco', 1),
    (shop_uuid, sub_vinil_tipos_vinilo, 'Vinilo Transparente', 2);
    -- Subcategoria tipos de rigidos
    SELECT id INTO sub_vinil_tipos_rigido FROM inventory.categories WHERE name = 'Rigidos' AND parent_id = sub_vinil AND shop_id = shop_uuid;
    -- NIVEL 3: Tipos de Rígidos
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_vinil_tipos_rigido, 'Foam', 1),
    (shop_uuid, sub_vinil_tipos_rigido, 'Celtex', 2),
    (shop_uuid, sub_vinil_tipos_rigido, 'Acrílico', 3);
END $$;
-- ======================================================================

-- ======================================================================
-- I N S U M O S   Y   A C A B A D O S
-- =====================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_insumos INT;
    sub_tintas INT;
    sub_consumibles INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Insumos y Consumibles', 'Tintas UV, toners, polvos DTF, tintas sublimación, entre otros.', 2)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_insumos FROM inventory.categories WHERE name = 'Insumos y Consumibles' AND shop_id = shop_uuid;

    -- =================================================================================
    -- NIVEL 1 Y 2: INSUMOS (Lo que consumen tus máquinas)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_insumos, 'Tintas y Toners', 1) RETURNING id INTO sub_tintas;
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_tintas, 'Toners', 1),
    (shop_uuid, sub_tintas, 'Tintas Ecosolventes', 2),
    (shop_uuid, sub_tintas, 'Tintas UV', 3),
    (shop_uuid, sub_tintas, 'Tintas Hibridas', 4),
    (shop_uuid, sub_tintas, 'Cartuchos', 5);
END $$;

-- ======================================================================
-- A C A B A D O S   Y   P O S T I M P R E S I Ó N
-- ======================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_acabados INT;
    id_lam_plas_enmi INT;
    id_acabados_fisico INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Acabados y Postimpresión', 'Laminados, enmicados, ojalillos, entre otros.', 3)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_acabados FROM inventory.categories WHERE name = 'Acabados y Postimpresión' AND shop_id = shop_uuid;

    -- =================================================================================
    -- NIVEL 1 Y 2: ACABADOS (Tu enmicadora, troqueladora y manuales)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_acabados, 'Laminado, Plastificado y Enmicado', 1) RETURNING id INTO id_lam_plas_enmi;
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_lam_plas_enmi, 'Rollos BOPP (Laminación)', 1),
    (shop_uuid, id_lam_plas_enmi, 'Micas/Pouches (Enmicado)', 2),
    (shop_uuid, id_lam_plas_enmi, 'Plastificado Mate/Brillo', 3);

    -- =================================================================================
    -- NIVEL 1 Y 2: POST-IMPRESIÓN FÍSICO (Tu encuadernadora y manuales)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_acabados, 'Post-Impresión Físico', 2)  RETURNING id INTO id_acabados_fisico;
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_acabados_fisico, 'Ojalillos y Accesorios', 1),
    (shop_uuid, id_acabados_fisico, 'Encuadernación', 2),
    (shop_uuid, id_acabados_fisico, 'Anillado y Espiralado', 3),
    (shop_uuid, id_acabados_fisico, 'Empastado', 4),
    (shop_uuid, id_acabados_fisico, 'Otros', 5);
END $$;

-- =====================================================================
-- M E R C H A N D I S I N G   Y   B L A N C O S
-- =====================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_merch INT;
    sub_merch_textil INT;
    sub_merch_rigido INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Merchandising', 'Tazas para sublimar, lapiceros para UV, llaveros, bolsas, agendas, entre otros.', 4) ON CONFLICT DO NOTHING;

    SELECT id INTO id_merch FROM inventory.categories WHERE name = 'Merchandising y Blancos' AND shop_id = shop_uuid;
    -- =================================================================================
    -- NIVEL 1 Y 2: MERCHANDISING (Tu impresora UV y sublimación)
    -- =================================================================================
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_merch, 'Merchandising Textil', 1) RETURNING id INTO sub_merch_textil; 
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_merch_textil, 'Polos y Poleras', 1),
    (shop_uuid, sub_merch_textil, 'Gorras y Sombreros', 2),
    (shop_uuid, sub_merch_textil, 'Bolsas y Mochilas', 3),
    (shop_uuid, sub_merch_textil, 'Mousepads', 4),
    (shop_uuid, sub_merch_textil, 'Lanyards', 5);
    

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_merch, 'Merchandising Rígido', 2) RETURNING id INTO sub_merch_rigido;
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, sub_merch_rigido, 'Copas, Tazas y Vasos', 1),
    (shop_uuid, sub_merch_rigido, 'Mugs, Tomatodos y Thermos', 2),
    (shop_uuid, sub_merch_rigido, 'Sellos', 3),
    (shop_uuid, sub_merch_rigido, 'Llaveros y Pines', 4),
    (shop_uuid, sub_merch_rigido, 'Libretas, Agendas, Block y Folders', 5),
    (shop_uuid, sub_merch_rigido, 'Lapiceros y Resaltadores', 6),
    (shop_uuid, sub_merch_rigido, 'Alcancías y Antiestrés', 7),
    (shop_uuid, sub_merch_rigido, 'Foto Roca y Rompecabezas', 8),
    (shop_uuid, sub_merch_rigido, 'Fotoshecks y Credenciales', 9),
    (shop_uuid, sub_merch_rigido, 'Paletas, Toppers y Ruletas', 10),
    (shop_uuid, sub_merch_rigido, 'Otros', 12);
END $$;

-- ======================================================================
-- T E C N O L O G Í A   D T F
-- ======================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_dtf INT;
    sub_dtf_textil INT;
    sub_dtf_merch INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Tecnología DTF', 'Categoría principal de productos DTF para las impresiones.', 5)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_dtf FROM inventory.categories WHERE name = 'Tecnología DTF' AND shop_id = shop_uuid;
    -- solo nivel 1
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_dtf, 'DTF Textil', 1);
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order)
    VALUES (shop_uuid, id_dtf, 'DTF Merchandising', 2);
END $$;

-- ======================================================================
-- M A Q U I N A R I A   Y   E Q U I P O S
-- ======================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_maquinaria INT;
    id_printers INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Maquinaria y Equipos', 'Maquinaria y equipos para las impresiones. Hibrida UV, Laminadora, enmicadora, entre otros.', 6)
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO id_maquinaria FROM inventory.categories WHERE name = 'Maquinaria y Equipos' AND shop_id = shop_uuid;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_maquinaria, 'Impresoras', 1) RETURNING id INTO id_printers;
    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_printers, 'UV Híbridas', 1),
    (shop_uuid, id_printers, 'Eco Solvente', 2),
    (shop_uuid, id_printers, 'imagePRESS', 3),
    (shop_uuid, id_printers, 'iPF', 4);
    

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_maquinaria, 'DTF', 2),
    (shop_uuid, id_maquinaria, 'Laminadoras', 3),
    (shop_uuid, id_maquinaria, 'Enmicadoras', 4),
    (shop_uuid, id_maquinaria, 'Plastificadoras', 5),
    (shop_uuid, id_maquinaria, 'Troqueladoras', 6),
    (shop_uuid, id_maquinaria, 'Corte y Grabado Láser', 7 ),
    (shop_uuid, id_maquinaria, 'Sublimadoras', 8);
END $$;

-- ======================================================================
-- E S T R U C T U R A S   Y   D I S P L A Y S
-- ======================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_estructuras INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Estructuras y Displays', 'Estructuras y displays para las impresiones, Roll ups, marcos, entre otros.', 7)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_estructuras FROM inventory.categories WHERE name = 'Estructuras y Displays' AND shop_id = shop_uuid;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_estructuras, 'Roll Ups', 1),
    (shop_uuid, id_estructuras, 'Marcos y Estructuras', 2),
    (shop_uuid, id_estructuras, 'Stands y Exhibidores', 3),
    (shop_uuid, id_estructuras, 'Otros', 4);
END $$;

-- ======================================================================
-- S E R V I C I O S   Y   O T R O S
-- ======================================================================
DO $$
DECLARE
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    id_servicios INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories (shop_id, name, description, sort_order) VALUES
    (shop_uuid, 'Servicios y Otros', 'Servicios y otros relacionados con las impresiones.', 8)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_servicios FROM inventory.categories WHERE name = 'Servicios y Otros' AND shop_id = shop_uuid;

    INSERT INTO inventory.categories (shop_id, parent_id, name, sort_order) VALUES
    (shop_uuid, id_servicios, 'Servicios de Impresión', 1),
    (shop_uuid, id_servicios, 'Otros', 2);
END $$;
-- ######################################################################
-- ITEMs Tabla principal de inventario
-- ######################################################################

CREATE TABLE IF NOT EXISTS inventory.items (
  id UUID PRIMARY KEY,
  category_id SMALLINT REFERENCES inventory.categories(id),
  
  -- Clasificación Base
  supply_type TEXT NOT NULL, -- Esta en el constraint abajo
  unit_type TEXT NOT NULL, -- Esta en el constraint abajo
  name TEXT NOT NULL,
  sku TEXT UNIQUE,

  -- Atributos técnicos
  weight_gsm INT,          -- Gramaje (ej: 300 para Couche 300g)
  finish TEXT,            -- Mate, Brillo, Satinado
  width_mm INT,          -- Ancho total del material (ej. 1520mm para un rollo de 1.52m)
  height_mm INT,         -- Largo (NULL si es rollo, valor si es pliego/hoja ej. 480mm para SRA3)
  length_m DECIMAL(8,2), -- Si es ROLLO, ¿cuántos metros lineales trae originalmente? (ej. 50.00)
  color_code TEXT,         -- Para vinilos de corte o papeles de color , null si no aplica
  
  -- Area imprimible
  printable_width_mm INT,  -- El ancho menos los márgenes de pinza o rodillos
  printable_height_mm INT, -- El alto menos los márgenes (si aplica)
  
  -- Rigidez
  thickness_mm DECIMAL,   -- Para acrílicos/celtex (ej: 3.0, 5.0)

  -- Metadata de Máquinas (Opcional si es activo)
  serial_number TEXT,
  metadata JSONB,-- Para guardar specs técnicos variados (ej:{cabezal: "Epson i3200"})
  
  -- Control
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.items
ADD CONSTRAINT chk_item_name_length CHECK (
    name IS NULL OR char_length(name) <= 100
  ),
  ADD CONSTRAINT chk_sku_length CHECK (
    sku IS NULL OR char_length(sku) <= 50
  ),
  ADD CONSTRAINT chk_serial_number_length CHECK (
    serial_number IS NULL OR char_length(serial_number) <= 100
  ),
  ADD CONSTRAINT chk_width_positive CHECK (
    width_mm IS NULL OR width_mm > 0
  ),
  ADD CONSTRAINT chk_height_positive CHECK (
    height_mm IS NULL OR height_mm > 0
  ),
  ADD CONSTRAINT chk_length_positive CHECK (
    length_m IS NULL OR length_m > 0
  ),
  ADD CONSTRAINT chk_weight_positive CHECK (
    weight_gsm IS NULL OR weight_gsm > 0
  ),
  ADD CONSTRAINT chk_printable_width_positive CHECK (
    printable_width_mm IS NULL OR printable_width_mm > 0
  ),
  ADD CONSTRAINT chk_printable_height_positive CHECK (
    printable_height_mm IS NULL OR printable_height_mm > 0
  ),
  ADD CONSTRAINT chk_thickness_positive CHECK (
    thickness_mm IS NULL OR thickness_mm > 0
  ),
  ADD CONSTRAINT chk_supply_type_valid CHECK (
    supply_type IN ('papel', 'lona', 'vinilo', 'rigido', 'tinta', 'merchandising', 'repuesto','maquina','otro')
  ),
  ADD CONSTRAINT chk_unit_type_valid CHECK (
    unit_type IN ('metro-lineal', 'metro-cuadrado', 'unidad', 'mililitro')
  ),
  ADD CONSTRAINT chk_color_code_length CHECK (
    color_code IS NULL OR char_length(color_code) <= 20
  ),
  ADD CONSTRAINT chk_finish_length CHECK (
    finish IS NULL OR char_length(finish) <= 50
  );

-- RLS
ALTER TABLE inventory.items ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- K A R D E X   D E   I N V E N T A R I O
-- ======================================================================
DROP TABLE IF EXISTS inventory.movement_type CASCADE;
DROP TABLE IF EXISTS inventory.movement_reason CASCADE;

CREATE TABLE IF NOT EXISTS inventory.movement_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  delete_at TIMESTAMPTZ
);

ALTER TABLE inventory.movement_type
  ADD CONSTRAINT chk_movement_type_name_length CHECK (
    name IS NULL OR char_length(name) <= 50
  ),
  ADD CONSTRAINT chk_movement_type_description_length CHECK (
    description IS NULL OR char_length(description) <= 200
  );
CREATE TRIGGER trg_movement_type_set_updated_at
  BEFORE UPDATE ON inventory.movement_type
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE inventory.movement_type ENABLE ROW LEVEL SECURITY;
-- SEED DATA PARA MOVEMENT TYPES
INSERT INTO inventory.movement_type (name, description) VALUES
('ENTRADA', 'Ingreso de inventario al almacén'),
('SALIDA', 'Salida de inventario del almacén'),
('AJUSTE', 'Corrección manual o ajuste de inventario');

-- ======================================================================


CREATE TABLE IF NOT EXISTS inventory.movement_reason (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  delete_at TIMESTAMPTZ
);

ALTER TABLE inventory.movement_reason
  ADD CONSTRAINT chk_movement_reason_name_length CHECK (
    name IS NULL OR char_length(name) <= 50
  ),
  ADD CONSTRAINT chk_movement_reason_description_length CHECK (
    description IS NULL OR char_length(description) <= 200
  );

CREATE TRIGGER trg_movement_reason_set_updated_at
  BEFORE UPDATE ON inventory.movement_reason
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE inventory.movement_reason ENABLE ROW LEVEL SECURITY;
-- SEED DATA PARA MOVEMENT REASONS
INSERT INTO inventory.movement_reason (name, description) VALUES
('COMPRA', 'Entrada por factura de proveedor'),
('VENTA', 'Salida por despacho al cliente'),
('PRODUCCION', 'Salida por consumo en máquina'),
('MERMA_TECNICA', 'Desperdicio por inicio de impresión/calibración'),
('DAÑO_OPERATIVO', 'Se malogró el material por atascamiento o error humano'),
('DEVOLUCION', 'El cliente devolvió o nosotros devolvemos al proveedor'),
('INVENTARIO_INICIAL', 'Carga inicial del sistema'),
('AJUSTE_MANUAL', 'Corrección manual por auditoría o conteo físico'),
('TRASLADO', 'Movimiento entre almacenes o sucursales'),
('OTRO', 'Otros motivos no listados');


CREATE TABLE IF NOT EXISTS inventory.kardex (
    id UUID PRIMARY KEY,
    item_id UUID REFERENCES inventory.items(id) NOT NULL,
    batch_code TEXT,  -- Lote o código de lote si aplica
    
    -- Información del movimiento
    movement_type_id SMALLINT REFERENCES inventory.movement_type(id) NOT NULL,
    movement_reason_id SMALLINT REFERENCES inventory.movement_reason(id) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL, -- Siempre positiva, el tipo_movimiento define el signo
    
    -- Instantánea (Snapshot) para auditoría rápida
    -- en ingles
    previous_balance DECIMAL(12,3) NOT NULL,
    subsequent_balance DECIMAL(12,3) NOT NULL,
    
    -- Valoración (Importante para reportes de rentabilidad)
    unit_cost_at_moment NUMERIC(15,4) DEFAULT 0,
    
    -- Trazabilidad y Documentación
    order_detail_id UUID REFERENCES sales.order_details(id),
    notes TEXT,             -- Ej: "Desperdicio de 2 metros por atasco en cabezal"
    
    -- Auditoría Supabase
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) -- Quién realizó la acción
);

ALTER TABLE inventory.kardex
  ADD CONSTRAINT chk_batch_code_length CHECK (
    batch_code IS NULL OR char_length(batch_code) <= 50
  ),
  ADD CONSTRAINT chk_quantity_positive CHECK (
    quantity > 0
  ),
  ADD CONSTRAINT chk_unit_cost_at_moment_nonnegative CHECK (
    unit_cost_at_moment >= 0
  ),
  ADD CONSTRAINT chk_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 500
  );

-- Indices para reportes rápidos (vital cuando el kardex crezca)
CREATE INDEX idx_kardex_item_id ON inventory.kardex(item_id);
CREATE INDEX idx_kardex_created_at ON inventory.kardex(created_at);

ALTER TABLE inventory.kardex ENABLE ROW LEVEL SECURITY;



-- ######################################################################
-- # SEED ITEMS DE INVENTARIO
-- ######################################################################
DO $$ 
DECLARE 
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    -- IDs de categorías (Asumiendo que se generaron en el orden del script anterior)
    -- En un entorno real, es mejor buscarlos por nombre y shop_id
    v_cat_papel_couche_sa3 SMALLINT;
    v_cat_vinilo_blanco SMALLINT;
    v_cat_tazas SMALLINT;
    v_cat_maquinaria_uv SMALLINT;
    v_cat_maquinaria_laser SMALLINT;
BEGIN 

    -- Obtener IDs de categorías para asegurar integridad
    SELECT id INTO v_cat_papel_couche_sa3 FROM inventory.categories WHERE id=24 AND shop_id = shop_uuid LIMIT 1;
    SELECT id INTO v_cat_vinilo_blanco FROM inventory.categories WHERE name = 'Vinilo Blanco' AND shop_id = shop_uuid LIMIT 1;
    SELECT id INTO v_cat_tazas FROM inventory.categories WHERE name = 'Copas, Tazas y Vasos' AND shop_id = shop_uuid LIMIT 1;
    SELECT id INTO v_cat_maquinaria_uv FROM inventory.categories WHERE name = 'UV Híbridas' AND shop_id = shop_uuid LIMIT 1;
    SELECT id INTO v_cat_maquinaria_laser FROM inventory.categories WHERE name = 'imagePRESS' AND shop_id = shop_uuid LIMIT 1;

    -- ======================================================================
    -- MAQUINARIA (Activos fijos)
    -- ======================================================================
    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku, serial_number, metadata) VALUES
    (gen_random_uuid(), v_cat_maquinaria_uv, 'maquina', 'unidad', 'Impresora UV Híbrida Flora 2.5m', 'MAC-UV-001', 'FL2500-X99', '{"cabezal": "Epson i3200", "tintas": "CMYK+W+V"}'),
    (gen_random_uuid(), v_cat_maquinaria_laser, 'maquina', 'unidad', 'VP 23', 'VP-023', 'VP023-2025', '{"ultimo_mantenimiento": "2024-05-15", "horas_uso": 1200}'),
    (gen_random_uuid(), v_cat_maquinaria_laser, 'maquina', 'unidad', 'Eco Solvent Printer', 'Q5-3208', 'Q5-3208-194', '{"ultimo_mantenimiento": "10-10-2025", "formato": "3200mm"}');

    -- ======================================================================
    -- GIGANTOGRAFÍA Y VINILOS (Rollos - Salida por Metro Lineal)
    -- ======================================================================
    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku, width_mm, length_m, printable_width_mm) VALUES
    -- Vinilo en rollo de 1.27m x 50m
    (gen_random_uuid(), v_cat_vinilo_blanco, 'vinilo', 'metro-lineal', 'Vinilo Blanco Brillante 1.27m', 'MAT-VIN-127', 1270, 50.00, 1250);
    -- ======================================================================
    -- PAPELERÍA (Pliegos - Salida por Unidad de pliego)
    -- ======================================================================
    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku, weight_gsm, finish, width_mm, height_mm) VALUES
    -- Papel Couche SRA3 (320mm x 450mm)
    (gen_random_uuid(), v_cat_papel_couche_sa3, 'papel', 'unidad', 'Papel Couche Brillo 150g SA3', 'PAP-COU-B-150-SA3', 150, 'Brillo', 320, 450),
    (gen_random_uuid(), v_cat_papel_couche_sa3, 'papel', 'unidad', 'Papel Couche Brillo 200g SA3', 'PAP-COU-B-200-SA3', 150, 'Brillo', 320, 450),
    (gen_random_uuid(), v_cat_papel_couche_sa3, 'papel', 'unidad', 'Papel Couche Brillo 200g SA3', 'PAP-COU-B-300-SA3', 300, 'Brillo', 320, 450),
    (gen_random_uuid(), v_cat_papel_couche_sa3, 'papel', 'unidad', 'Papel Couche Mate 150g SA3', 'PAP-COU-M-150-SA3', 150, 'Mate', 320, 450),
    (gen_random_uuid(), v_cat_papel_couche_sa3, 'papel', 'unidad', 'Papel Couche Mate 200g SA3', 'PAP-COU-M-200-SA3', 150, 'Mate', 320, 450),
    (gen_random_uuid(), v_cat_papel_couche_sa3, 'papel', 'unidad', 'Papel Couche Mate 200g SA3', 'PAP-COU-M-300-SA3', 300, 'Mate', 320, 450);

    -- ======================================================================|
    -- MERCHANDISING (Blancos - Salida por Unidad)
    -- ======================================================================
    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku) VALUES
    (gen_random_uuid(), v_cat_tazas, 'merchandising', 'unidad', 'Taza Blanca para Sublimar 11oz', 'MER-TAZA-001'),
    (gen_random_uuid(), v_cat_tazas, 'merchandising', 'unidad', 'Taza Asa e Interior Color Negro 11oz', 'MER-TAZA-002');

END $$;

-- LONAS
DO $$ 
DECLARE 
    shop_uuid UUID := '019a1367-5dd3-79a4-a6cb-a3aa7a88612c';
    frontlit_id SMALLINT;
    backlight_id SMALLINT;
    blackout_id SMALLINT;
BEGIN 
    -- Buscamos la categoría de Lona Frontlit
    SELECT id INTO frontlit_id FROM inventory.categories WHERE name = 'Lona Frontlit' AND shop_id = shop_uuid LIMIT 1;

    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku, width_mm, length_m, printable_width_mm) VALUES
    (gen_random_uuid(), frontlit_id, 'lona', 'metro-cuadrado', 'Lona Frontlit 12oz - 3.20m', 'LONA-FRONT-320', 3200, 50, 3180),
    (gen_random_uuid(), frontlit_id, 'lona', 'metro-cuadrado', 'Lona Frontlit 12oz - 2.50m', 'LONA-FRONT-250', 2500, 50, 2480),
    (gen_random_uuid(), frontlit_id, 'lona', 'metro-cuadrado', 'Lona Frontlit 12oz - 2.20m', 'LONA-FRONT-220', 2200, 50, 2180),
    (gen_random_uuid(), frontlit_id, 'lona', 'metro-cuadrado', 'Lona Frontlit 12oz - 1.80m', 'LONA-FRONT-180', 1800, 50, 1780),
    (gen_random_uuid(), frontlit_id, 'lona', 'metro-cuadrado', 'Lona Frontlit 12oz - 1.60m', 'LONA-FRONT-160', 1600, 50, 1580),
    (gen_random_uuid(), frontlit_id, 'lona', 'metro-cuadrado', 'Lona Frontlit 12oz - 1.10m', 'LONA-FRONT-110', 1100, 50, 1080);

    -- Buscamos la categoría de Lona Backlight
    SELECT id INTO backlight_id FROM inventory.categories WHERE name = 'Lona Backlight'
    AND shop_id = shop_uuid LIMIT 1;
    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku, width_mm, length_m, printable_width_mm) VALUES
    (gen_random_uuid(), backlight_id, 'lona', 'metro-cuadrado', 'Lona Backlight 12oz - 3.20m', 'LONA-BACK-320', 3200, 50, 3180),
    (gen_random_uuid(), backlight_id, 'lona', 'metro-cuadrado', 'Lona Backlight 12oz - 2.50m', 'LONA-BACK-250', 2500, 50, 2480),
    (gen_random_uuid(), backlight_id, 'lona', 'metro-cuadrado', 'Lona Backlight 12oz - 2.20m', 'LONA-BACK-220', 2200, 50, 2180),
    (gen_random_uuid(), backlight_id, 'lona', 'metro-cuadrado', 'Lona Backlight 12oz - 1.80m', 'LONA-BACK-180', 1800, 50, 1780),
    (gen_random_uuid(), backlight_id, 'lona', 'metro-cuadrado', 'Lona Backlight 12oz - 1.60m', 'LONA-BACK-160', 1600, 50, 1580),
    (gen_random_uuid(), backlight_id, 'lona', 'metro-cuadrado', 'Lona Backlight 12oz - 1.10m', 'LONA-BACK-110', 1100, 50, 1080);
    -- Buscamos la categoría de Lona Blackout
    SELECT id INTO blackout_id FROM inventory.categories WHERE name = 'Lona Blackout'
    AND shop_id = shop_uuid LIMIT 1;
    INSERT INTO inventory.items (id, category_id, supply_type, unit_type, name, sku, width_mm, length_m, printable_width_mm) VALUES
    (gen_random_uuid(), blackout_id, 'lona', 'metro-cuadrado', 'Lona Blackout 12oz - 3.20m', 'LONA-BLACK-320', 3200, 50, 3180),
    (gen_random_uuid(), blackout_id, 'lona', 'metro-cuadrado', 'Lona Blackout 12oz - 2.50m', 'LONA-BLACK-250', 2500, 50, 2480),
    (gen_random_uuid(), blackout_id, 'lona', 'metro-cuadrado', 'Lona Blackout 12oz - 2.20m', 'LONA-BLACK-220', 2200, 50, 2180),
    (gen_random_uuid(), blackout_id, 'lona', 'metro-cuadrado', 'Lona Blackout 12oz - 1.80m', 'LONA-BLACK-180', 1800, 50, 1780),
    (gen_random_uuid(), blackout_id, 'lona', 'metro-cuadrado', 'Lona Blackout 12oz - 1.60m', 'LONA-BLACK-160', 1600, 50, 1580),
    (gen_random_uuid(), blackout_id, 'lona', 'metro-cuadrado', 'Lona Blackout 12oz - 1.10m', 'LONA-BLACK-110', 1100, 50, 1080); 
END $$;

-- Insertando 2 rollos de 3.20m como ejemplo
DO $$ 
DECLARE 
    v_item_id UUID;
    v_ent SMALLINT := (SELECT id FROM inventory.movement_type WHERE name = 'ENTRADA');
    v_compra SMALLINT := (SELECT id FROM inventory.movement_reason WHERE name = 'COMPRA');
BEGIN 
    SELECT id INTO v_item_id FROM inventory.items WHERE sku = 'LONA-BACK-320' LIMIT 1;

    -- Rollo A
    INSERT INTO inventory.kardex (id, item_id, movement_type_id, movement_reason_id, quantity, previous_balance, subsequent_balance, batch_code, notes)
    VALUES (gen_random_uuid(), v_item_id, v_ent, v_compra, 50.00, 0, 50.00, '26-ENE-001','Lote Proveedor XYZ');

    -- Rollo B
    INSERT INTO inventory.kardex (id, item_id, movement_type_id, movement_reason_id, quantity, previous_balance, subsequent_balance, batch_code, notes)
    VALUES (gen_random_uuid(), v_item_id, v_ent, v_compra, 50.00, 0, 50.00, '26-ENE-002','Lote Proveedor XYZ');
END $$;

-- CONSUMIR 12 metros del primer rollo
DO $$
DECLARE 
    v_item_id UUID;
    v_ent SMALLINT := (SELECT id FROM inventory.movement_type WHERE name = 'SALIDA');
    v_venta SMALLINT := (SELECT id FROM inventory.movement_reason WHERE name = 'VENTA');
    v_current_balance DECIMAL := (SELECT previous_balance FROM inventory.kardex WHERE batch_code = '26-ENE-001' );
BEGIN
    SELECT id INTO v_item_id FROM inventory.items WHERE sku = 'LONA-BACK-320' LIMIT 1;

    -- Obtener el balance actual
    SELECT SUM(CASE 
      WHEN movement_type_id = v_ent THEN quantity 
      WHEN movement_type_id = (SELECT id FROM inventory.movement_type WHERE name = 'SALIDA') THEN -quantity 
      ELSE 0 
    END)
    INTO v_current_balance
    FROM inventory.kardex
    WHERE item_id = v_item_id;

    -- Registrar la salida de 12 metros
    INSERT INTO inventory.kardex (id, item_id, movement_type_id, movement_reason_id, quantity, previous_balance, subsequent_balance, batch_code, notes)
    VALUES (gen_random_uuid(), v_item_id, v_ent, v_venta, 12.00, v_current_balance, v_current_balance - 12.00, '26-ENE-001', 'Venta a Cliente ABC');
END $$;



-- #######################################
-- # RLS POLICIES INVENTORY
-- #######################################
DROP POLICY IF EXISTS "authenticated_can_select_categories" ON inventory.categories;
CREATE POLICY "authenticated_can_select_categories"
  ON inventory.categories
  FOR SELECT
  TO authenticated
  USING (true);