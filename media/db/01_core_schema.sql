-- ======================================================================
-- CORE SCHEMA
-- Base tables and utility functions
-- ======================================================================

-- Drop existing objects
DROP SCHEMA IF EXISTS core CASCADE;
DROP TYPE IF EXISTS core.person_type_enum;
DROP FUNCTION IF EXISTS core.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS core.set_audit_updated_by() CASCADE;
DROP FUNCTION IF EXISTS core.handle_slug() CASCADE;

-- Create schema
CREATE SCHEMA IF NOT EXISTS core;

-- ======================================================================
-- ENUMS
-- ======================================================================
CREATE TYPE core.person_type_enum AS ENUM ('JURIDICA', 'NATURAL');

-- ======================================================================
-- TABLES
-- ======================================================================

-- shops
CREATE TABLE core.shops (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  email TEXT UNIQUE,
  main_phone TEXT,
  secondary_phone TEXT,
  company_data JSONB DEFAULT '{}'::JSONB,
  basic_service_providers JSONB DEFAULT '{}'::JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE core.shops
ADD CONSTRAINT chk_shops_name_length CHECK (char_length(name) <= 150),
ADD CONSTRAINT chk_shops_address_length CHECK (address IS NULL OR char_length(address) <= 200),
ADD CONSTRAINT chk_shops_email_format CHECK (
  email IS NULL OR (
    char_length(email) <= 150 
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
),
ADD CONSTRAINT chk_shops_main_phone_format CHECK (
  main_phone IS NULL OR main_phone ~ '^\+[1-9]\d{1,14}$'
),
ADD CONSTRAINT chk_shops_secondary_phone_format CHECK (
  secondary_phone IS NULL OR secondary_phone ~ '^\+[1-9]\d{1,14}$'
);

-- persons
CREATE TABLE core.persons (
  id UUID PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  legal_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  dni TEXT,
  ruc TEXT UNIQUE,
  ce TEXT,
  person_type core.person_type_enum NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID REFERENCES auth.users(id),
  updated_by_id UUID REFERENCES auth.users(id),
  deleted_by_id UUID REFERENCES auth.users(id)
);

ALTER TABLE core.persons
ADD CONSTRAINT chk_persons_first_name_length CHECK (first_name IS NULL OR char_length(first_name) <= 35),
ADD CONSTRAINT chk_persons_last_name_length CHECK (last_name IS NULL OR char_length(last_name) <= 80),
ADD CONSTRAINT chk_persons_legal_name_length CHECK (legal_name IS NULL OR char_length(legal_name) <= 200),
ADD CONSTRAINT chk_persons_email_format CHECK (
  email IS NULL OR (
    char_length(email) <= 150 
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
),
ADD CONSTRAINT chk_persons_phone_format CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{1,14}$'),
ADD CONSTRAINT chk_persons_dni_format CHECK (dni IS NULL OR dni ~ '^\d{8}$'),
ADD CONSTRAINT chk_persons_ruc_format CHECK (ruc IS NULL OR ruc ~ '^\d{11}$'),
ADD CONSTRAINT chk_persons_ce_format CHECK (ce IS NULL OR ce ~ '^[A-Za-z0-9]{6,20}$'),
ADD CONSTRAINT chk_persons_dni_or_ce CHECK (
  (dni IS NOT NULL AND ce IS NULL) OR 
  (dni IS NULL AND ce IS NOT NULL) OR 
  (dni IS NULL AND ce IS NULL)
);

CREATE INDEX idx_core_persons_deleted_at ON core.persons(deleted_at);

-- audit_logs
CREATE TABLE core.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  target_table TEXT,
  target_id UUID,
  status TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================================================
-- UTILITY FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION core.handle_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug = LOWER(
    REGEXP_REPLACE(
      translate(unaccent(NEW.name), 'ñü', 'nu'),
      '[^a-zA-Z0-9]+', '-', 'g'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION core.set_audit_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_by_id = auth.uid();
  RETURN NEW;
END;
$$;

-- ======================================================================
-- TRIGGERS
-- ======================================================================

CREATE TRIGGER trg_shops_set_updated_at 
  BEFORE UPDATE ON core.shops 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_persons_set_updated_at 
  BEFORE UPDATE ON core.persons 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_persons_set_updated_by 
  BEFORE UPDATE ON core.persons 
  FOR EACH ROW EXECUTE FUNCTION core.set_audit_updated_by();

-- ======================================================================
-- RLS
-- ======================================================================

ALTER TABLE core.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.shops ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- SEED DATA
-- ======================================================================

INSERT INTO core.shops (id, name, address, email, main_phone, company_data) VALUES
('019bdc20-4e05-7cb7-81f5-634bdcbf826e', 'Stand 194', 'Jr. Huaraz 1717 - Piso 1 - Interior 194', 'laser.guizado.plaza@gmail.com', '+51995558329', 
  '{"default": {"legalName": "LASER VELOZ IMPORT E.I.R.L.", "ruc": "20610129910", "address": "Jr. Huaraz 1717 - Piso 1 - Interior 194", "bankAccount": "191-7075355-0-30", "cci": "00219100707535503053", "yape_primary": "903095920"}}'::JSONB),
('019bdc22-b528-73b1-8956-763ab43828d8', 'Stand 243', 'Jr. Orbegoso 243 - Piso 1 - Interior 243', 'laser.guizado.orbegoso243@gmail.com', '+51970899806', 
  '{"default": {"legalName": "ASESORIAS GLOBALES EMPRESARIALES E.I.R.L.", "ruc": "20607873411", "address": "Jr. Orbegoso 243 - Piso 1 - Interior 243", "bankAccount": "191-2536428-0-83", "cci": "00219100253642808351", "yape_primary": "970899806"}}'::JSONB);
