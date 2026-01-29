-- ###############################################################
-- Production 
-- ###############################################################
CREATE SCHEMA IF NOT EXISTS production;

DROP TABLE IF EXISTS production.jobs CASCADE;
CREATE TABLE IF NOT EXISTS production.jobs (
  id UUID PRIMARY KEY,
  order_detail_id UUID REFERENCES sales.order_details(id) NOT NULL,
  machine_id UUID REFERENCES inventory.machines(id) NOT NULL, 
  
  employee_id UUID REFERENCES hr.employees(id) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  
  -- Aquí se registra el consumo real que afectará al Kardex
  -- material_used_id UUID REFERENCES inventory.items(id) NOT NULL,
  -- quantity_used DECIMAL(12,3) NOT NULL, -- Ej: 3.20 metros lineales
  -- waste_quantity DECIMAL(12,3) DEFAULT 0, -- Merma

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER TABLE production.jobs
--   ADD CONSTRAINT chk_quantity_used CHECK (quantity_used >= 0),
--   ADD CONSTRAINT chk_waste_quantity CHECK (waste_quantity >= 0);

CREATE TRIGGER trg_update_production_jobs_timestamp
  BEFORE UPDATE ON production.jobs
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE production.jobs ENABLE ROW LEVEL SECURITY;