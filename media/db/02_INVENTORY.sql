-- ######################################################################
-- # INVENTORY MODULE
-- ######################################################################
DROP SCHEMA IF EXISTS inventory CASCADE;
CREATE SCHEMA IF NOT EXISTS inventory;

DROP TABLE IF EXISTS inventory.items CASCADE;
DROP TABLE IF EXISTS inventory.categories CASCADE;
DROP TABLE IF EXISTS inventory.machines CASCADE;
-- ======================================================================
-- CATEGORIAS 
-- ======================================================================
CREATE TABLE IF NOT EXISTS inventory.categories (
  id SMALLSERIAL PRIMARY KEY,
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
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Materiales y Soportes', 'Papeles, vinilos, acrílicos, listones de madera, entre otros.', 1)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_materiales  FROM inventory.categories WHERE name = 'Materiales y Soportes';    

    -- =================================================================================
    -- NIVEL 1: PAPELES Y CARTULINAS
    -- =================================================================================
    INSERT INTO inventory.categories ( parent_id, name, sort_order) 
    VALUES ( id_materiales, 'Papeles y Cartulinas', 1) RETURNING id INTO sub_papel;

    -- NIVEL 2: Tipos de papel (De tu constante de código)
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( sub_papel, 'Adhesivo', 1),
    ( sub_papel, 'Bond', 2),
    ( sub_papel, 'Canson', 3),
    ( sub_papel, 'Couche', 4),
    ( sub_papel, 'Folkote', 5),
    ( sub_papel, 'Fotografía', 6),
    ( sub_papel, 'Hilo', 7),
    ( sub_papel, 'Opalina', 8);
  

    -- =================================================================================
    -- NIVEL 1: VINILOS Y GIGANTOGRAFÍA
    -- =================================================================================
    INSERT INTO inventory.categories (parent_id,name,sort_order)
    VALUES ( id_materiales, 'Vinilos y Gigantografía', 2) RETURNING id INTO sub_vinil;
    -- -- NIVEL 2: Tipos de Vinilo
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( sub_vinil, 'Gigantografias', 1),
    ( sub_vinil, 'Vinilos', 2),
    ( sub_vinil, 'Rigidos', 3);
END $$;
-- ======================================================================

-- ======================================================================
-- I N S U M O S   Y   A C A B A D O S
-- =====================================================================
DO $$
DECLARE
    
    id_insumos INT;
    sub_tintas INT;
    sub_consumibles INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Insumos y Consumibles', 'Tintas UV, toners, polvos DTF, tintas sublimación, entre otros.', 2)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_insumos FROM inventory.categories WHERE name = 'Insumos y Consumibles'; 

    -- =================================================================================
    -- NIVEL 1 Y 2: INSUMOS (Lo que consumen tus máquinas)
    -- =================================================================================
    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_insumos, 'Tintas y Toners', 1) RETURNING id INTO sub_tintas;
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( sub_tintas, 'Toners', 1),
    ( sub_tintas, 'Tintas Ecosolventes', 2),
    ( sub_tintas, 'Tintas UV', 3),
    ( sub_tintas, 'Tintas Hibridas', 4),
    ( sub_tintas, 'Cartuchos', 5);
END $$;

-- ======================================================================
-- A C A B A D O S   Y   P O S T I M P R E S I Ó N
-- ======================================================================
DO $$
DECLARE
    
    id_acabados INT;
    id_lam_plas_enmi INT;
    id_acabados_fisico INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Acabados y Postimpresión', 'Laminados, enmicados, ojalillos, entre otros.', 3)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_acabados FROM inventory.categories WHERE name = 'Acabados y Postimpresión'; 

    -- =================================================================================
    -- NIVEL 1 Y 2: ACABADOS (Tu enmicadora, troqueladora y manuales)
    -- =================================================================================
    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_acabados, 'Laminado, Plastificado y Enmicado', 1) RETURNING id INTO id_lam_plas_enmi;
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( id_lam_plas_enmi, 'Rollos BOPP (Laminación)', 1),
    ( id_lam_plas_enmi, 'Micas/Pouches (Enmicado)', 2),
    ( id_lam_plas_enmi, 'Plastificado Mate/Brillo', 3);

    -- =================================================================================
    -- NIVEL 1 Y 2: POST-IMPRESIÓN FÍSICO (Tu encuadernadora y manuales)
    -- =================================================================================
    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_acabados, 'Post-Impresión Físico', 2)  RETURNING id INTO id_acabados_fisico;
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( id_acabados_fisico, 'Ojalillos y Accesorios', 1),
    ( id_acabados_fisico, 'Encuadernación', 2),
    ( id_acabados_fisico, 'Anillado y Espiralado', 3),
    ( id_acabados_fisico, 'Empastado', 4),
    ( id_acabados_fisico, 'Otros', 5);
END $$;

-- =====================================================================
-- M E R C H A N D I S I N G 
-- =====================================================================
DO $$
DECLARE
    
    -- IDs de Nivel 0
    id_merch INT;
    -- IDs de Nivel 1 (para crear Nivel 2)
    sub_merch_textil INT;
    sub_merch_rigido INT;
    -- Ids de Nivel 2 para textil
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Merchandising', 'Tazas para sublimar, lapiceros para UV, llaveros, bolsas, agendas, entre otros.', 4) ON CONFLICT DO NOTHING;

    SELECT id INTO id_merch FROM inventory.categories WHERE name = 'Merchandising';
    -- =================================================================================
    -- NIVEL 1 Y 2: MERCHANDISING (Tu impresora UV y sublimación)
    -- =================================================================================
    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_merch, 'Merchandising Textil', 1) RETURNING id INTO sub_merch_textil; 
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( sub_merch_textil, 'Polos y Poleras', 1),
    ( sub_merch_textil, 'Gorras y Sombreros', 2),
    ( sub_merch_textil, 'Bolsas y Mochilas', 3),
    ( sub_merch_textil, 'Mousepads', 4),
    ( sub_merch_textil, 'Lanyards', 5);
    

    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_merch, 'Merchandising Rígido', 2) RETURNING id INTO sub_merch_rigido;
    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( sub_merch_rigido, 'Copas, Tazas y Vasos', 1),
    ( sub_merch_rigido, 'Mugs, Tomatodos y Thermos', 2),
    ( sub_merch_rigido, 'Sellos', 3),
    ( sub_merch_rigido, 'Llaveros y Pines', 4),
    ( sub_merch_rigido, 'Libretas, Agendas, Block y Folders', 5),
    ( sub_merch_rigido, 'Lapiceros y Resaltadores', 6),
    ( sub_merch_rigido, 'Alcancías y Antiestrés', 7),
    ( sub_merch_rigido, 'Foto Roca y Rompecabezas', 8),
    ( sub_merch_rigido, 'Fotoshecks y Credenciales', 9),
    ( sub_merch_rigido, 'Paletas, Toppers y Ruletas', 10),
    ( sub_merch_rigido, 'Otros', 12);
END $$;

-- ======================================================================
-- T E C N O L O G Í A   D T F
-- ======================================================================
DO $$
DECLARE
    
    id_dtf INT;
    sub_dtf_textil INT;
    sub_dtf_merch INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Tecnología DTF', 'Categoría principal de productos DTF para las impresiones.', 5)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_dtf FROM inventory.categories WHERE name = 'Tecnología DTF'; 
    -- solo nivel 1
    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_dtf, 'DTF Textil', 1);
    INSERT INTO inventory.categories ( parent_id, name, sort_order)
    VALUES ( id_dtf, 'DTF Merchandising', 2);
END $$;

-- -- ======================================================================
-- -- M A Q U I N A R I A   Y   E Q U I P O S
-- -- ======================================================================
-- DO $$
-- DECLARE
--     
--     id_maquinaria INT;
--     id_printers INT;
-- BEGIN
--     -- Insertar Nivel 0 si no existen
--     INSERT INTO inventory.categories ( name, description, sort_order) VALUES
--     ( 'Maquinaria y Equipos', 'Maquinaria y equipos para las impresiones. Hibrida UV, Laminadora, enmicadora, entre otros.', 6)
--     ON CONFLICT DO NOTHING;
    
--     SELECT id INTO id_maquinaria FROM inventory.categories WHERE name = 'Maquinaria y Equipos'   

--     INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
--     ( id_maquinaria, 'Impresoras', 1),
--     ( id_maquinaria, 'DTF', 2),
--     ( id_maquinaria, 'Laminadoras', 3),
--     ( id_maquinaria, 'Enmicadoras', 4),
--     ( id_maquinaria, 'Plastificadoras', 5),
--     ( id_maquinaria, 'Troqueladoras', 6),
--     ( id_maquinaria, 'Corte y Grabado Láser', 7 ),
--     ( id_maquinaria, 'Sublimadoras', 8),
--     ( id_maquinaria, 'Otros Equipos', 9);
-- END $$;

-- ======================================================================
-- E S T R U C T U R A S   Y   D I S P L A Y S
-- ======================================================================
DO $$
DECLARE
    
    id_estructuras INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Estructuras y Displays', 'Estructuras y displays para las impresiones, Roll ups, marcos, entre otros.',6)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_estructuras FROM inventory.categories WHERE name = 'Estructuras y Displays';

    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( id_estructuras, 'Roll Ups', 1),
    ( id_estructuras, 'Marcos y Estructuras', 2),
    ( id_estructuras, 'Stands y Exhibidores', 3),
    ( id_estructuras, 'Otros', 4);
END $$;

-- ======================================================================
-- S E R V I C I O S   Y   O T R O S
-- ======================================================================
DO $$
DECLARE
    
    id_servicios INT;
BEGIN
    -- Insertar Nivel 0 si no existen
    INSERT INTO inventory.categories ( name, description, sort_order) VALUES
    ( 'Servicios y Otros', 'Servicios y otros relacionados con las impresiones.', 7)
    ON CONFLICT DO NOTHING;

    SELECT id INTO id_servicios FROM inventory.categories WHERE name = 'Servicios y Otros' ;

    INSERT INTO inventory.categories ( parent_id, name, sort_order) VALUES
    ( id_servicios, 'Servicios de Impresión', 1),
    ( id_servicios, 'Otros', 2);
END $$;

-- ######################################################################
-- ITEMs Tabla principal de inventario
-- ######################################################################
CREATE TABLE IF NOT EXISTS inventory.items (
  id UUID PRIMARY KEY,
  category_id SMALLINT REFERENCES inventory.categories(id),
  parent_id SMALLINT, -- Para subcategorías si aplica
  
  -- Clasificación Base
  supply_type TEXT NOT NULL, -- Esta en el constraint abajo
  unit_type TEXT NOT NULL, -- Esta en el constraint abajo
  name TEXT NOT NULL,
  sku TEXT UNIQUE,

  brand TEXT,            -- Marca del insumo o material
  price_reference NUMERIC(10,2), -- Precio de referencia para cotizaciones o ventas rápidas

  -- Atributos técnicos
  size_name TEXT,          -- Nombre comercial del tamaño (ej: SRA3, A3, A4, 1.27m, etc)
  weight_gsm INT,          -- Gramaje (ej: 300 para Couche 300g)
  finish TEXT,            -- Mate, Brillo, Satinado, Holográfico, etc.
  width_mm INT,          -- Ancho total del material (ej. 1520mm para un rollo de 1.52m)
  height_mm INT,         -- Largo (NULL si es rollo, valor si es pliego/hoja ej. 480mm para SRA3)
  length_m DECIMAL(8,2), -- Si es ROLLO, ¿cuántos metros lineales trae originalmente? (ej. 50.00)
  color_code TEXT,         -- Para vinilos de corte o papeles de color , null si no aplica
  volume_ml INT,        -- Para tintas o líquidos (ej: 500ml, 1000ml)
  
  -- Area imprimible
  printable_width_mm INT,  -- El ancho menos los márgenes de pinza o rodillos
  printable_height_mm INT, -- El alto menos los márgenes (si aplica)
  
  -- Rigidez
  thickness_mm DECIMAL(7,2),   -- Para acrílicos/celtex/foam/imantado (ej: 3.0, 5.0)

  -- Metadata de Máquinas (Opcional si es activo)
  serial_number TEXT,
  metadata JSONB,-- Para guardar specs técnicos variados (ej:{cabezal: "Epson i3200"})
  
  -- Control
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Agregar nueva columna parent_id
-- ALTER TABLE inventory.items ADD COLUMN IF NOT EXISTS parent_id SMALLINT;

ALTER TABLE inventory.items
ADD CONSTRAINT chk_item_name_length CHECK (
    name IS NULL OR char_length(name) <= 100
  ),
  ADD CONSTRAINT chk_sku_length CHECK (
    sku IS NULL OR char_length(sku) <= 50
  ),
  ADD CONSTRAINT chk_size_name_length CHECK (
    size_name IS NULL OR char_length(size_name) <= 150
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
    supply_type IN ('papel', 'lona', 'vinilo', 'rigido', 'tinta', 'merchandising', 'repuesto','maquina','herramienta','consumible','otro')
  ),
  ADD CONSTRAINT chk_unit_type_valid CHECK (
    unit_type IN ( 'unidad', 'plancha', 'rollo', 'millar')
  ),
  ADD CONSTRAINT chk_color_code_length CHECK (
    color_code IS NULL OR char_length(color_code) <= 20
  ),
  ADD CONSTRAINT chk_finish_length CHECK (
    finish IS NULL OR char_length(finish) <= 50
  );

ALTER TABLE inventory.items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS inventory.machines (
  id UUID PRIMARY KEY,
  shop_id UUID REFERENCES core.shops(id),
  name TEXT NOT NULL,
  model TEXT,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.machines
  ADD CONSTRAINT chk_machine_name_length CHECK (
    name IS NULL OR char_length(name) <= 150
  ),
  ADD CONSTRAINT chk_machine_model_length CHECK (
    model IS NULL OR char_length(model) <= 150
  );

ALTER TABLE inventory.machines ENABLE ROW LEVEL SECURITY;


-- #######################################
-- # RLS POLICIES INVENTORY
-- #######################################
DROP POLICY IF EXISTS "authenticated_can_select_categories" ON inventory.categories;
CREATE POLICY "authenticated_can_select_categories"
  ON inventory.categories
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_items" ON inventory.items;
CREATE POLICY "authenticated_can_insert_items"
  ON inventory.items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_management.is_universal_manager((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "authenticated_can_select_items" ON inventory.items;
CREATE POLICY "authenticated_can_select_items"
  ON inventory.items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_update_items" ON inventory.items;
CREATE POLICY "authenticated_can_update_items"
  ON inventory.items
  FOR UPDATE
  TO authenticated
  USING (
    auth_management.is_universal_manager((SELECT auth.uid()))
  )
  WITH CHECK (
    auth_management.is_universal_manager((SELECT auth.uid()))
  );

-- machines
DROP POLICY IF EXISTS "authenticated_can_select_machines" ON inventory.machines;
CREATE POLICY "authenticated_can_select_machines"
  ON inventory.machines
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_can_insert_machines" ON inventory.machines;
CREATE POLICY "authenticated_can_insert_machines"
  ON inventory.machines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_management.is_universal_manager((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "authenticated_can_update_machines" ON inventory.machines;
CREATE POLICY "authenticated_can_update_machines"
  ON inventory.machines
  FOR UPDATE
  TO authenticated
  USING (
    auth_management.is_universal_manager((SELECT auth.uid()))
  )
  WITH CHECK (
    auth_management.is_universal_manager((SELECT auth.uid()))
  );
  