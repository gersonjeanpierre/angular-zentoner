-- ======================================================================
-- PRODUCTION SCHEMA
-- Manufacturing jobs tracking
-- ======================================================================

DROP SCHEMA IF EXISTS production CASCADE;
CREATE SCHEMA IF NOT EXISTS production;

-- ======================================================================
-- TABLES
-- ======================================================================

CREATE TABLE production.jobs (
  id UUID PRIMARY KEY,
  order_detail_id UUID REFERENCES sales.order_details(id) NOT NULL,
  machine_id UUID REFERENCES inventory.machines(id) NOT NULL,
  employee_id UUID REFERENCES hr.employees(id) NOT NULL,
  
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================
-- TRIGGERS
-- ======================================================================

CREATE TRIGGER trg_update_production_jobs_timestamp 
  BEFORE UPDATE ON production.jobs 
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- ======================================================================
-- RLS
-- ======================================================================

ALTER TABLE production.jobs ENABLE ROW LEVEL SECURITY;
