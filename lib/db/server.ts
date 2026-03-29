import "server-only";

import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import postgres, {
  type Sql,
  type PostgresType,
} from "postgres";

import { env } from "@/lib/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __proceit_pg_pool__: Pool | undefined;

  // eslint-disable-next-line no-var
  var __proceit_postgres_sql__: Sql | undefined;
}

/* =========================
   RUNTIME CONSTANTS
========================= */

const DB_APPLICATION_NAME = "proceit-auth-runtime";
const DB_POOL_MAX_CONNECTIONS = 10;
const DB_IDLE_TIMEOUT_MILLISECONDS = 30_000;
const DB_CONNECTION_TIMEOUT_MILLISECONDS = 10_000;
const DB_MAX_USES = 10_000;

/**
 * Política atual:
 * - manter SSL habilitado para conexões remotas;
 * - em ambientes com providers gerenciados/poolers, operar com
 *   rejectUnauthorized=false até existir cadeia/certificado validado
 *   de forma explícita no projeto.
 *
 * Evolução futura recomendada:
 * - mover política SSL para env tipado e centralizado por ambiente.
 */
function buildSslConfigForPg(): PoolConfig["ssl"] {
  return {
    rejectUnauthorized: false,
  };
}

function buildSslConfigForPostgres():
  | "require"
  | boolean
  | postgres.Options<Record<string, PostgresType>>["ssl"] {
  return "require";
}

/* =========================
   PG POOL (query style)
========================= */

function buildPoolConfig(): PoolConfig {
  return {
    connectionString: env.DATABASE_URL,
    ssl: buildSslConfigForPg(),
    max: DB_POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MILLISECONDS,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MILLISECONDS,
    maxUses: DB_MAX_USES,
    application_name: DB_APPLICATION_NAME,
  };
}

function createPool(): Pool {
  const instance = new Pool(buildPoolConfig());

  instance.on("error", (error) => {
    console.error("DB_POOL_UNEXPECTED_ERROR", {
      name: error.name,
      message: error.message,
    });
  });

  return instance;
}

const pool = global.__proceit_pg_pool__ ?? createPool();

if (!env.isProduction) {
  global.__proceit_pg_pool__ = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/* =========================
   POSTGRES TAGGED CLIENT
   (sql`` + begin)
========================= */

/**
 * Observação importante:
 * - este client é usado para SQL tagged templates e transações com begin();
 * - mantemos pg.Pool em paralelo para query(text, params), por compatibilidade
 *   e ergonomia com partes já existentes do projeto;
 * - ambos os clients devem permanecer apontando para o mesmo DATABASE_URL
 *   e mesma identidade de aplicação.
 */
function createSqlClient(): Sql {
  return postgres(env.DATABASE_URL, {
    ssl: buildSslConfigForPostgres(),
    max: DB_POOL_MAX_CONNECTIONS,
    idle_timeout: Math.floor(DB_IDLE_TIMEOUT_MILLISECONDS / 1000),
    connect_timeout: Math.floor(DB_CONNECTION_TIMEOUT_MILLISECONDS / 1000),

    /**
     * Mantido como true no runtime atual.
     * Revisar se o ambiente final operar exclusivamente via pooler
     * com restrições específicas de prepared statements.
     */
    prepare: true,

    transform: {
      /**
       * Padroniza undefined -> null para parâmetros enviados ao banco,
       * reduzindo ambiguidade entre campos omitidos e nulos explícitos
       * no runtime atual.
       */
      undefined: null,
    },

    connection: {
      application_name: DB_APPLICATION_NAME,
    },
  });
}

const sqlClient = global.__proceit_postgres_sql__ ?? createSqlClient();

if (!env.isProduction) {
  global.__proceit_postgres_sql__ = sqlClient;
}

/* =========================
   DB HELPER
========================= */

type DbTransactionCallback<T> = (tx: Sql) => Promise<T>;

type DbClient = Sql & {
  begin: <T>(callback: DbTransactionCallback<T>) => Promise<T>;
};

const db = Object.assign(sqlClient, {
  begin: async <T>(callback: DbTransactionCallback<T>): Promise<T> => {
    return sqlClient.begin(async (tx) => {
      return callback(tx);
    });
  },
}) as DbClient;

/* =========================
   HEALTH / LIFECYCLE
========================= */

export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  code: string;
}> {
  try {
    await sqlClient`select 1`;
    return {
      ok: true,
      code: "DATABASE_OK",
    };
  } catch {
    return {
      ok: false,
      code: "DATABASE_UNAVAILABLE",
    };
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export async function closeSqlClient(): Promise<void> {
  await sqlClient.end({ timeout: 5 });
}

export async function closeDatabaseConnections(): Promise<void> {
  await Promise.allSettled([closePool(), closeSqlClient()]);
}

/* =========================
   EXPORTS
========================= */

export { pool, db };
export type { PoolClient, PostgresType, DbClient };