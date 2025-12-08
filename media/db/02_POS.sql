-- 1. Crear un esquema para organizar las tablas
CREATE SCHEMA IF NOT EXISTS printing;

-- 2. Tabla de Categorías (Ej: Gigantografía, Digital, Offset)
CREATE TABLE printing.categories (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
);

-- 3. Tabla de Máquinas (Ej: Konica Minolta, Plotter Galaxy)
CREATE TABLE printing.machines (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL, -- Ej: 'MINOLTA', 'IPF - 750'
    model TEXT,
    is_operational BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla Intermedia: Categorías - Máquinas
-- Cumple tu requerimiento: "Las machine tambien son para cada categoria"
CREATE TABLE printing.category_machines (
    category_id INT REFERENCES printing.categories (id),
    machine_id INT REFERENCES printing.machines (id),
    PRIMARY KEY (category_id, machine_id)
);

-- 5. Tabla de Tamaños (Sizes)
-- Normalizamos los tamaños. En lugar de textos largos, guardamos medidas.
CREATE TABLE printing.sizes (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL, -- Ej: 'A4', 'Oficio', '1mx1m'
    width_mm NUMERIC(10, 2), -- Ancho en milímetros (Vital para cálculos)
    height_mm NUMERIC(10, 2), -- Alto en milímetros
    print_width_mm NUMERIC(10, 2), -- Ancho imprimible (si aplica)
    print_height_mm NUMERIC(10, 2), -- Alto imprimible (si aplica)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_custom BOOLEAN DEFAULT FALSE -- TRUE si es un tamaño personalizado por el cliente
);

-- 6. Tabla de Items / Productos Base
-- Aquí van 'BOND 90 GR', 'TAZA', 'DISEÑO'
CREATE TABLE printing.items (
    item_id SERIAL PRIMARY KEY,
    category_id INT REFERENCES printing.categories (category_id),
    name VARCHAR(150) NOT NULL,
    item_type VARCHAR(20) CHECK (
        item_type IN (
            'PRODUCTO',
            'SERVICIO',
            'INSUMO'
        )
    ),
    unit_measure VARCHAR(20) DEFAULT 'UNIDAD', -- 'UNIDAD', 'METRO_CUADRADO', 'METRO_LINEAL'
    is_stockable BOOLEAN DEFAULT TRUE, -- Si controla inventario
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla de Lista de Precios (Variantes)
-- Esta es la tabla más importante para el POS.
-- Relaciona el ITEM con el TAMAÑO y define el precio.
CREATE TABLE printing.price_list (
    price_id SERIAL PRIMARY KEY,
    item_id INT REFERENCES printing.items (item_id),
    size_id INT REFERENCES printing.sizes (size_id), -- Puede ser NULL si el servicio no tiene tamaño (ej: Diseño)
    base_price NUMERIC(10, 2) NOT NULL, -- Precio base
    min_qty INT DEFAULT 1, -- Para escalar precios (Ej: 1000 volantes cuestan menos c/u)
    currency VARCHAR(3) DEFAULT 'PEN'
);

-- ---------------------------------------------------------
-- DATOS DE EJEMPLO (Basados en tus archivos)
-- ---------------------------------------------------------

-- Insertamos Categorías
INSERT INTO
    printing.categories (name)
VALUES ('Impresión Digital'),
    ('Gigantografía'),
    ('Merchandising');

-- Insertamos Máquinas
INSERT INTO
    printing.machines (name)
VALUES ('MINOLTA'),
    ('IPF - 750'),
    ('SUBLIMADORA');

-- Asociamos Máquina a Categoría (Ej: Minolta es Digital)
INSERT INTO
    printing.category_machines (category_id, machine_id)
VALUES (1, 1), -- Digital -> Minolta
    (2, 2), -- Gigantografía -> IPF 750
    (3, 3);
-- Merch -> Sublimadora

-- Insertamos Tamaños (Limpiando tu data original)
INSERT INTO
    printing.sizes (name, width_mm, height_mm)
VALUES ('A4', 210, 297),
    ('A3', 297, 420),
    ('OFICIO', 216, 330),
    ('1mx1m', 1000, 1000);

-- Insertamos Items
INSERT INTO
    printing.items (
        category_id,
        name,
        item_type,
        unit_measure
    )
VALUES (
        1,
        'BOND 90 GR',
        'PRODUCTO',
        'UNIDAD'
    ),
    (
        2,
        'BANNER',
        'INSUMO',
        'METRO_CUADRADO'
    ),
    (
        3,
        'TAZA MAGICA',
        'PRODUCTO',
        'UNIDAD'
    );

-- Definimos Precios
-- Bond 90gr en A4 cuesta 0.50
INSERT INTO
    printing.price_list (item_id, size_id, base_price)
VALUES (1, 1, 0.50),
    -- Bond 90gr en A3 cuesta 1.00
    (1, 2, 1.00);