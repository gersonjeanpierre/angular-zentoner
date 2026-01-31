-- ======================================================================
-- INVENTORY SCHEMA
-- Categories, Items, Machines
-- ======================================================================

DROP SCHEMA IF EXISTS inventory CASCADE;
CREATE SCHEMA IF NOT EXISTS inventory;

-- ======================================================================
-- TABLES
-- ======================================================================

-- categories
CREATE TABLE inventory.categories (
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

ALTER TABLE inventory.categories
ADD CONSTRAINT chk_category_name_length CHECK (name IS NULL OR char_length(name) <= 50),
ADD CONSTRAINT chk_description_length CHECK (description IS NULL OR char_length(description) <= 200),
ADD CONSTRAINT chk_slug_length CHECK (slug IS NULL OR char_length(slug) <= 100);

-- items
CREATE TABLE inventory.items (
  id UUID PRIMARY KEY,
  category_id SMALLINT REFERENCES inventory.categories(id),
  parent_id SMALLINT,
  
  supply_type TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  brand TEXT,
  price_reference NUMERIC(10,2),
  
  size_name TEXT,
  weight_gsm INT,
  finish TEXT,
  width_mm INT,
  height_mm INT,
  length_m DECIMAL(8,2),
  color_code TEXT,
  volume_ml INT,
  
  printable_width_mm INT,
  printable_height_mm INT,
  
  thickness_mm DECIMAL(7,2),
  
  serial_number TEXT,
  metadata JSONB,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory.items
ADD CONSTRAINT chk_item_name_length CHECK (name IS NULL OR char_length(name) <= 100),
ADD CONSTRAINT chk_sku_length CHECK (sku IS NULL OR char_length(sku) <= 50),
ADD CONSTRAINT chk_size_name_length CHECK (size_name IS NULL OR char_length(size_name) <= 150),
ADD CONSTRAINT chk_serial_number_length CHECK (serial_number IS NULL OR char_length(serial_number) <= 100),
ADD CONSTRAINT chk_width_positive CHECK (width_mm IS NULL OR width_mm > 0),
ADD CONSTRAINT chk_height_positive CHECK (height_mm IS NULL OR height_mm > 0),
ADD CONSTRAINT chk_length_positive CHECK (length_m IS NULL OR length_m > 0),
ADD CONSTRAINT chk_weight_positive CHECK (weight_gsm IS NULL OR weight_gsm > 0),
ADD CONSTRAINT chk_printable_width_positive CHECK (printable_width_mm IS NULL OR printable_width_mm > 0),
ADD CONSTRAINT chk_printable_height_positive CHECK (printable_height_mm IS NULL OR printable_height_mm > 0),
ADD CONSTRAINT chk_thickness_positive CHECK (thickness_mm IS NULL OR thickness_mm > 0),
ADD CONSTRAINT chk_supply_type_valid CHECK (
  supply_type IN ('papel','lona','vinilo','rigido','tinta','merchandising','repuesto','maquina','herramienta','consumible','otro')
),
ADD CONSTRAINT chk_unit_type_valid CHECK (unit_type IN ('unidad','plancha','rollo','millar')),
ADD CONSTRAINT chk_color_code_length CHECK (color_code IS NULL OR char_length(color_code) <= 20),
ADD CONSTRAINT chk_finish_length CHECK (finish IS NULL OR char_length(finish) <= 50);

-- machines
CREATE TABLE inventory.machines (
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
ADD CONSTRAINT chk_machine_name_length CHECK (name IS NULL OR char_length(name) <= 150),
ADD CONSTRAINT chk_machine_model_length CHECK (model IS NULL OR char_length(model) <= 150);

-- ======================================================================
-- TRIGGERS
-- ======================================================================

CREATE TRIGGER trg_categories_set_updated_at 
  BEFORE UPDATE ON inventory.categories 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_categories_slug_update 
  BEFORE INSERT OR UPDATE ON inventory.categories 
  FOR EACH ROW EXECUTE FUNCTION core.handle_slug();

-- ======================================================================
-- RLS
-- ======================================================================

ALTER TABLE inventory.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.machines ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- SEED DATA
-- ======================================================================

DO $$ 
DECLARE 
  id_materiales INT;
  id_insumos INT;
  id_acabados INT;
  id_merch INT;
  id_dtf INT;
  id_estructuras INT;
  id_servicios INT;
  sub_papel INT;
  sub_vinil INT;
  sub_tintas INT;
  id_lam_plas_enmi INT;
  id_acabados_fisico INT;
  sub_merch_textil INT;
  sub_merch_rigido INT;
BEGIN 
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Materiales y Soportes', 'Papeles, vinilos, acrílicos, listones de madera, entre otros.', 1) ON CONFLICT DO NOTHING;
  SELECT id INTO id_materiales FROM inventory.categories WHERE name = 'Materiales y Soportes';
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_materiales, 'Papeles y Cartulinas', 1) RETURNING id INTO sub_papel;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (sub_papel, 'Adhesivo', 1), (sub_papel, 'Bond', 2), (sub_papel, 'Canson', 3),
  (sub_papel, 'Couche', 4), (sub_papel, 'Folkote', 5), (sub_papel, 'Fotografía', 6),
  (sub_papel, 'Hilo', 7), (sub_papel, 'Opalina', 8);
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_materiales, 'Vinilos y Gigantografía', 2) RETURNING id INTO sub_vinil;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (sub_vinil, 'Gigantografias', 1), (sub_vinil, 'Vinilos', 2), (sub_vinil, 'Rigidos', 3);
  
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Insumos y Consumibles', 'Tintas UV, toners, polvos DTF, tintas sublimación, entre otros.', 2) ON CONFLICT DO NOTHING;
  SELECT id INTO id_insumos FROM inventory.categories WHERE name = 'Insumos y Consumibles';
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_insumos, 'Tintas y Toners', 1) RETURNING id INTO sub_tintas;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (sub_tintas, 'Toners', 1), (sub_tintas, 'Tintas Ecosolventes', 2), (sub_tintas, 'Tintas UV', 3),
  (sub_tintas, 'Tintas Hibridas', 4), (sub_tintas, 'Cartuchos', 5);
  
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Acabados y Postimpresión', 'Laminados, enmicados, ojalillos, entre otros.', 3) ON CONFLICT DO NOTHING;
  SELECT id INTO id_acabados FROM inventory.categories WHERE name = 'Acabados y Postimpresión';
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_acabados, 'Laminado, Plastificado y Enmicado', 1) RETURNING id INTO id_lam_plas_enmi;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (id_lam_plas_enmi, 'Rollos BOPP (Laminación)', 1), (id_lam_plas_enmi, 'Micas/Pouches (Enmicado)', 2),
  (id_lam_plas_enmi, 'Plastificado Mate/Brillo', 3);
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_acabados, 'Post-Impresión Físico', 2) RETURNING id INTO id_acabados_fisico;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (id_acabados_fisico, 'Ojalillos y Accesorios', 1), (id_acabados_fisico, 'Encuadernación', 2),
  (id_acabados_fisico, 'Anillado y Espiralado', 3), (id_acabados_fisico, 'Empastado', 4),
  (id_acabados_fisico, 'Otros', 5);
  
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Merchandising', 'Tazas para sublimar, lapiceros para UV, llaveros, bolsas, agendas, entre otros.', 4) ON CONFLICT DO NOTHING;
  SELECT id INTO id_merch FROM inventory.categories WHERE name = 'Merchandising';
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_merch, 'Merchandising Textil', 1) RETURNING id INTO sub_merch_textil;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (sub_merch_textil, 'Polos y Poleras', 1), (sub_merch_textil, 'Gorras y Sombreros', 2),
  (sub_merch_textil, 'Bolsas y Mochilas', 3), (sub_merch_textil, 'Mousepads', 4),
  (sub_merch_textil, 'Lanyards', 5);
  
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES (id_merch, 'Merchandising Rígido', 2) RETURNING id INTO sub_merch_rigido;
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (sub_merch_rigido, 'Copas, Tazas y Vasos', 1), (sub_merch_rigido, 'Mugs, Tomatodos y Thermos', 2),
  (sub_merch_rigido, 'Sellos', 3), (sub_merch_rigido, 'Llaveros y Pines', 4),
  (sub_merch_rigido, 'Libretas, Agendas, Block y Folders', 5), (sub_merch_rigido, 'Lapiceros y Resaltadores', 6),
  (sub_merch_rigido, 'Alcancías y Antiestrés', 7), (sub_merch_rigido, 'Foto Roca y Rompecabezas', 8),
  (sub_merch_rigido, 'Fotoshecks y Credenciales', 9), (sub_merch_rigido, 'Paletas, Toppers y Ruletas', 10),
  (sub_merch_rigido, 'Otros', 12);
  
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Tecnología DTF', 'Categoría principal de productos DTF para las impresiones.', 5) ON CONFLICT DO NOTHING;
  SELECT id INTO id_dtf FROM inventory.categories WHERE name = 'Tecnología DTF';
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (id_dtf, 'DTF Textil', 1), (id_dtf, 'DTF Merchandising', 2);
  
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Estructuras y Displays', 'Estructuras y displays para las impresiones, Roll ups, marcos, entre otros.', 6) ON CONFLICT DO NOTHING;
  SELECT id INTO id_estructuras FROM inventory.categories WHERE name = 'Estructuras y Displays';
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (id_estructuras, 'Roll Ups', 1), (id_estructuras, 'Marcos y Estructuras', 2),
  (id_estructuras, 'Stands y Exhibidores', 3), (id_estructuras, 'Otros', 4);
  
  INSERT INTO inventory.categories (name, description, sort_order) VALUES
  ('Servicios y Otros', 'Servicios y otros relacionados con las impresiones.', 7) ON CONFLICT DO NOTHING;
  SELECT id INTO id_servicios FROM inventory.categories WHERE name = 'Servicios y Otros';
  INSERT INTO inventory.categories (parent_id, name, sort_order) VALUES
  (id_servicios, 'Servicios de Impresión', 1), (id_servicios, 'Otros', 2);
END $$;
