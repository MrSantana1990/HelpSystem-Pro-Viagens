#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
 -v migration_password="$MIGRATION_PASSWORD" -v runtime_password="$RUNTIME_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE viagens_migrator LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'migration_password') \gexec
SELECT format('CREATE ROLE viagens_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'runtime_password') \gexec
ALTER DATABASE viagens OWNER TO viagens_migrator;
REVOKE ALL ON DATABASE viagens FROM PUBLIC;
GRANT CONNECT ON DATABASE viagens TO viagens_runtime;
ALTER SCHEMA public OWNER TO viagens_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO viagens_runtime;
SQL
