import pg from 'pg';
export type Identity = {
  id: string;
  tenantId: string;
  email: string;
  expiresAt: string;
};
export class Database {
  readonly pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 8,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      query_timeout: 6000,
      idle_in_transaction_session_timeout: 10000,
    });
    this.pool.on('error', () => {});
  }
  async ready() {
    const result = await this.pool
      .query(`SELECT current_user AS name, r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,
   pg_has_role(current_user,'viagens_migrator','MEMBER') AS migration_member,
   (SELECT count(*)::int FROM public.schema_migrations WHERE version IN ('001_foundation','002_identity_runtime')) AS migrations,
   (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname IN ('trip_plans','trip_scenarios') AND c.relrowsecurity AND c.relforcerowsecurity
    AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS protected_tables
   FROM pg_roles r WHERE r.rolname=current_user`);
    const row = result.rows[0];
    if (
      !row ||
      row.name !== 'viagens_runtime' ||
      row.rolsuper ||
      row.rolbypassrls ||
      row.rolcreatedb ||
      row.rolcreaterole ||
      row.rolreplication ||
      row.migration_member ||
      row.migrations !== 2 ||
      row.protected_tables !== 2
    )
      throw new Error('Runtime database privileges or schema invalid');
  }
  async asUser<T>(
    user: Identity,
    action: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    let destroy = false;
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT set_config('app.tenant_id',$1,true),set_config('app.user_id',$2,true)",
        [user.tenantId, user.id],
      );
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {
        destroy = true;
      });
      throw error;
    } finally {
      client.release(destroy);
    }
  }
  async close() {
    await this.pool.end();
  }
}
