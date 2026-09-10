-- Foundation only: no public persistence endpoints before authentication + tenant tests.
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE trip_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  owner_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  search_input jsonb NOT NULL,
  selected_scenario jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_plans_owner_idx ON trip_plans (tenant_id, owner_id);
ALTER TABLE trip_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY trip_plans_isolation ON trip_plans
USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
   AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
   AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
