-- Winston Multi-Tenant Data Layer
-- Strategy: Row-Level Security with app.current_tenant_id session variable
-- Every table carries tenant_id; RLS policies enforce isolation automatically.

-- ─── Extensions ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy product name search

-- ─── Tenants ─────────────────────────────────────────────────────────────────
-- One row per cannabis retailer. No RLS on this table (it's the anchor).

CREATE TABLE IF NOT EXISTS tenants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        NOT NULL UNIQUE,           -- url-safe name e.g. "green-leaf-la"
  display_name  TEXT        NOT NULL,
  state_code    CHAR(2)     NOT NULL,                  -- two-letter state e.g. "CA"
  license_number TEXT,
  metrc_license TEXT,
  pos_type      TEXT        NOT NULL,                  -- "treez" | "dutchie" | "blaze"
  timezone      TEXT        NOT NULL DEFAULT 'America/Los_Angeles',
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS helper ──────────────────────────────────────────────────────────────
-- Every query must SET app.current_tenant_id = '<uuid>' before running.
-- The policy checks this local variable so isolation is automatic and
-- cannot be bypassed by application code.

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT nullif(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- ─── Products ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id     TEXT        NOT NULL,               -- POS-native id
  pos_type        TEXT        NOT NULL,               -- adapter that owns this row
  name            TEXT        NOT NULL,
  brand           TEXT,
  category        TEXT        NOT NULL,               -- matches ProductCategory enum
  subcategory     TEXT,
  sku             TEXT,
  barcode         TEXT,
  price_retail    NUMERIC(10,2),
  price_wholesale NUMERIC(10,2),
  thc_percentage  NUMERIC(5,2),
  cbd_percentage  NUMERIC(5,2),
  weight_grams    NUMERIC(8,3),
  unit_of_measure TEXT,
  metrc_tag       TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  raw_payload     JSONB,                              -- full POS response for debugging
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, external_id, pos_type)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_products_tenant      ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_products_metrc_tag   ON products(tenant_id, metrc_tag);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm   ON products USING gin(name gin_trgm_ops);

-- ─── Inventory Records ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id        UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  external_id       TEXT        NOT NULL,
  pos_type          TEXT        NOT NULL,
  location_id       TEXT,
  location_name     TEXT,
  quantity_on_hand  INTEGER     NOT NULL DEFAULT 0,
  quantity_reserved INTEGER     NOT NULL DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_point     INTEGER     NOT NULL DEFAULT 0,
  reorder_quantity  INTEGER     NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(10,2),
  raw_payload       JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, external_id, pos_type)
);

ALTER TABLE inventory_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_records
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_inventory_tenant     ON inventory_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory_records(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock  ON inventory_records(tenant_id, quantity_available)
  WHERE quantity_available <= reorder_point;

-- ─── Customers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id         TEXT        NOT NULL,
  pos_type            TEXT        NOT NULL,
  first_name          TEXT,
  last_name           TEXT,
  email               TEXT,
  phone               TEXT,
  date_of_birth       DATE,
  id_type             TEXT,
  id_number_hash      TEXT,                           -- hashed, never store plain
  customer_type       TEXT        NOT NULL DEFAULT 'recreational', -- recreational | medical
  loyalty_points      INTEGER     NOT NULL DEFAULT 0,
  loyalty_tier        TEXT,
  total_spend         NUMERIC(12,2) NOT NULL DEFAULT 0,
  visit_count         INTEGER     NOT NULL DEFAULT 0,
  last_visit_at       TIMESTAMPTZ,
  opt_in_sms          BOOLEAN     NOT NULL DEFAULT FALSE,
  opt_in_email        BOOLEAN     NOT NULL DEFAULT FALSE,
  raw_payload         JSONB,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, external_id, pos_type)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_customers_tenant     ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email      ON customers(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_type       ON customers(tenant_id, customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty    ON customers(tenant_id, loyalty_tier);

-- ─── Sale Transactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sale_transactions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id       TEXT        NOT NULL,
  pos_type          TEXT        NOT NULL,
  customer_id       UUID        REFERENCES customers(id),
  employee_id       TEXT,
  employee_name     TEXT,
  register_id       TEXT,
  location_id       TEXT,
  subtotal          NUMERIC(10,2) NOT NULL,
  discount_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  payment_method    TEXT        NOT NULL,             -- cash | credit | debit | check
  status            TEXT        NOT NULL DEFAULT 'completed',
  sale_type         TEXT        NOT NULL DEFAULT 'retail', -- retail | medical
  completed_at      TIMESTAMPTZ NOT NULL,
  raw_payload       JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, external_id, pos_type)
);

ALTER TABLE sale_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sale_transactions
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_sales_tenant         ON sale_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_completed_at   ON sale_transactions(tenant_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer       ON sale_transactions(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_employee       ON sale_transactions(tenant_id, employee_id);

-- ─── Sale Line Items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sale_line_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id    UUID        NOT NULL REFERENCES sale_transactions(id) ON DELETE CASCADE,
  product_id        UUID        REFERENCES products(id),
  external_id       TEXT,
  product_name      TEXT        NOT NULL,
  product_category  TEXT,
  quantity          NUMERIC(8,3) NOT NULL,
  unit_price        NUMERIC(10,2) NOT NULL,
  discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax               NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total        NUMERIC(10,2) NOT NULL,
  metrc_tag         TEXT,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sale_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sale_line_items
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_line_items_tenant      ON sale_line_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_line_items_transaction ON sale_line_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_line_items_product     ON sale_line_items(tenant_id, product_id);

-- ─── METRC Packages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metrc_packages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label             TEXT        NOT NULL,             -- METRC tag (unique per tenant)
  package_type      TEXT        NOT NULL DEFAULT 'Product',
  item_name         TEXT,
  item_category     TEXT,
  quantity          NUMERIC(10,4) NOT NULL,
  unit_of_measure   TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  packaged_date     DATE,
  use_by_date       DATE,
  lab_testing_state TEXT,
  thc_percentage    NUMERIC(5,2),
  cbd_percentage    NUMERIC(5,2),
  source_harvest_name TEXT,
  license_number    TEXT,
  raw_payload       JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, label)
);

ALTER TABLE metrc_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON metrc_packages
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_metrc_packages_tenant  ON metrc_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrc_packages_label   ON metrc_packages(tenant_id, label);
CREATE INDEX IF NOT EXISTS idx_metrc_packages_active  ON metrc_packages(tenant_id, is_active);

-- ─── METRC Transfers ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metrc_transfers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  manifest_number       TEXT        NOT NULL,
  transfer_type         TEXT        NOT NULL,  -- "incoming" | "outgoing"
  shipper_name          TEXT,
  shipper_license       TEXT,
  recipient_name        TEXT,
  recipient_license     TEXT,
  departed_at           TIMESTAMPTZ,
  received_at           TIMESTAMPTZ,
  package_count         INTEGER,
  raw_payload           JSONB,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, manifest_number)
);

ALTER TABLE metrc_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON metrc_transfers
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_metrc_transfers_tenant   ON metrc_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrc_transfers_manifest ON metrc_transfers(tenant_id, manifest_number);

-- ─── Sync Jobs ───────────────────────────────────────────────────────────────
-- Tracks the last successful sync per tenant + source + entity type.
-- Used by the ingestion pipeline for incremental pulls.

CREATE TABLE IF NOT EXISTS sync_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source            TEXT        NOT NULL,             -- "treez" | "metrc" | "dutchie"
  entity_type       TEXT        NOT NULL,             -- "products" | "inventory" | "sales" | "customers" | "packages"
  status            TEXT        NOT NULL DEFAULT 'pending', -- pending | running | success | failed
  records_synced    INTEGER     NOT NULL DEFAULT 0,
  last_synced_at    TIMESTAMPTZ,
  cursor            TEXT,                             -- opaque pagination cursor for incremental sync
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source, entity_type)
);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sync_jobs
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant  ON sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status  ON sync_jobs(tenant_id, status);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants', 'products', 'inventory_records', 'customers',
    'sale_transactions', 'metrc_packages', 'metrc_transfers', 'sync_jobs'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
