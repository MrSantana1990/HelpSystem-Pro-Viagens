CREATE SCHEMA identity;
REVOKE ALL ON SCHEMA identity FROM PUBLIC;
CREATE TABLE identity.users (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id),
 email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id, tenant_id),
 CHECK (id = tenant_id)
);
CREATE TABLE identity.sessions (
 token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
 user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_idx ON identity.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON identity.sessions(expires_at);
ALTER TABLE public.trip_plans ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.trip_plans ALTER COLUMN selected_scenario DROP NOT NULL;
-- Preserve legacy rows; new/modified rows require a real identity.
ALTER TABLE public.trip_plans ADD CONSTRAINT trip_owner_fk
 FOREIGN KEY (owner_id, tenant_id) REFERENCES identity.users(id, tenant_id) NOT VALID;
ALTER TABLE public.trip_plans ADD CONSTRAINT trip_scope_unique UNIQUE(id,tenant_id,owner_id);
CREATE TABLE public.trip_scenarios (
 id uuid PRIMARY KEY,
 trip_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
 search_input jsonb NOT NULL CHECK (jsonb_typeof(search_input) = 'object'),
 snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
 source_type text NOT NULL DEFAULT 'DEMO' CHECK (source_type IN ('DEMO','INDICATIVE','LIVE')),
 provider text NOT NULL,
 observed_at timestamptz NOT NULL,
 expires_at timestamptz,
 currency text NOT NULL CHECK (currency = 'BRL'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (trip_id,tenant_id,owner_id) REFERENCES public.trip_plans(id,tenant_id,owner_id) ON DELETE CASCADE,
 CHECK (expires_at IS NULL OR expires_at >= observed_at)
);
CREATE INDEX scenarios_trip_idx ON public.trip_scenarios(tenant_id,owner_id,trip_id);
ALTER TABLE public.trip_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_scenarios FORCE ROW LEVEL SECURITY;
CREATE POLICY scenario_isolation ON public.trip_scenarios
USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_id = NULLIF(current_setting('app.user_id',true),'')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_id = NULLIF(current_setting('app.user_id',true),'')::uuid);

-- Narrow identity functions; no direct runtime access to users/sessions.
CREATE FUNCTION public.register_identity(p_id uuid,p_email text,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 INSERT INTO public.tenants(id,name) VALUES (p_id,'Personal');
 INSERT INTO identity.users(id,tenant_id,email,password_hash) VALUES(p_id,p_id,p_email,p_hash);
EXCEPTION WHEN unique_violation THEN RETURN;
END $$;
CREATE FUNCTION public.login_identity(p_email text)
RETURNS TABLE(id uuid,tenant_id uuid,password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT u.id,u.tenant_id,u.password_hash FROM identity.users u WHERE u.email=p_email;
$$;
CREATE FUNCTION public.issue_session(p_user uuid,p_hash text,p_old_hash text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE expiry timestamptz := now() + interval '8 hours';
BEGIN
 UPDATE identity.sessions SET revoked_at=now() WHERE token_hash=p_old_hash AND revoked_at IS NULL;
 DELETE FROM identity.sessions WHERE user_id=p_user AND (expires_at<=now() OR revoked_at IS NOT NULL);
 UPDATE identity.sessions SET revoked_at=now()
 WHERE token_hash IN (SELECT token_hash FROM identity.sessions WHERE user_id=p_user AND revoked_at IS NULL ORDER BY created_at DESC OFFSET 9);
 INSERT INTO identity.sessions(token_hash,user_id,expires_at) VALUES(p_hash,p_user,expiry);
 RETURN expiry;
END $$;
CREATE FUNCTION public.resolve_session(p_hash text)
RETURNS TABLE(id uuid,tenant_id uuid,email text,expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT u.id,u.tenant_id,u.email,s.expires_at FROM identity.sessions s
 JOIN identity.users u ON u.id=s.user_id
 WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now();
$$;
CREATE FUNCTION public.revoke_session(p_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
 UPDATE identity.sessions SET revoked_at=now() WHERE token_hash=p_hash AND revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.register_identity(uuid,text,text),public.login_identity(text),
 public.issue_session(uuid,text,text),public.resolve_session(text),public.revoke_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_identity(uuid,text,text),public.login_identity(text),
 public.issue_session(uuid,text,text),public.resolve_session(text),public.revoke_session(text) TO viagens_runtime;
GRANT USAGE ON SCHEMA public TO viagens_runtime;
GRANT SELECT ON public.schema_migrations TO viagens_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.trip_plans,public.trip_scenarios TO viagens_runtime;
REVOKE ALL ON public.tenants FROM viagens_runtime;
