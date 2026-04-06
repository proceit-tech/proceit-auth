import "server-only";

import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResultRow,
} from "pg";
import postgres, {
  type Sql,
  type TransactionSql,
  type PostgresType,
} from "postgres";

import { env } from "@/lib/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __proceit_pg_pool__: Pool | undefined;

  // eslint-disable-next-line no-var
  var __proceit_postgres_sql__: DbSqlClient | undefined;
}

/* =========================
   TYPES
========================= */

export type QueryRowsResult<T extends QueryResultRow> = {
  rows: T[];
};

export type DbSqlClient = Sql<Record<string, PostgresType>>;

export type DbTransactionClient =
  TransactionSql<Record<string, PostgresType>>;

type DbTransactionCallback<T> = (tx: DbTransactionClient) => Promise<T>;

export type DbClient = DbSqlClient;

/* =========================
   RUNTIME CONSTANTS
========================= */

const DB_APPLICATION_NAME = "proceit-auth-runtime";
const DB_POOL_MAX_CONNECTIONS = 10;
const DB_IDLE_TIMEOUT_MILLISECONDS = 30_000;
const DB_CONNECTION_TIMEOUT_MILLISECONDS = 10_000;
const DB_MAX_USES = 10_000;

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
   PG POOL
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

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryRowsResult<T>> {
  const result = await pool.query<T>(text, params);

  return {
    rows: result.rows as T[],
  };
}

/* =========================
   POSTGRES CLIENT
========================= */

function createSqlClient(): DbSqlClient {
  return postgres(env.DATABASE_URL, {
    ssl: buildSslConfigForPostgres(),
    max: DB_POOL_MAX_CONNECTIONS,
    idle_timeout: Math.floor(DB_IDLE_TIMEOUT_MILLISECONDS / 1000),
    connect_timeout: Math.floor(DB_CONNECTION_TIMEOUT_MILLISECONDS / 1000),

    /**
     * Importante para compatibilidade com Supabase + pooler.
     *
     * Prepared statements podem gerar comportamento inconsistente
     * em chamadas de função, casts e reuso de conexão em ambiente
     * gerenciado / transaction pooler.
     */
    prepare: false,

    transform: {
      undefined: null,
    },

    connection: {
      application_name: DB_APPLICATION_NAME,
    },

    onnotice(notice) {
      console.warn("DB_POSTGRES_NOTICE", {
        severity: notice.severity,
        code: notice.code,
        message: notice.message,
        detail: notice.detail,
        hint: notice.hint,
      });
    },

    debug(connection, query, parameters) {
      if (!env.isProduction) {
        console.debug("DB_POSTGRES_DEBUG", {
          connection:
            typeof connection === "object" && connection !== null
              ? {
                  pid:
                    "pid" in connection &&
                    typeof connection.pid === "number"
                      ? connection.pid
                      : null,
                }
              : null,
          query,
          parameters_count: Array.isArray(parameters)
            ? parameters.length
            : 0,
        });
      }
    },
  }) as DbSqlClient;
}

const sqlClient = global.__proceit_postgres_sql__ ?? createSqlClient();

if (!env.isProduction) {
  global.__proceit_postgres_sql__ = sqlClient;
}

/* =========================
   DB EXPORT
========================= */

export const db: DbClient = sqlClient;

/* =========================
   TRANSACTION WRAPPER
========================= */

export async function withDbTransaction<T>(
  callback: DbTransactionCallback<T>
): Promise<T> {
  const result = await sqlClient.begin(async (tx) => {
    return callback(tx as DbTransactionClient);
  });

  return result as T;
}

/* =========================
   HEALTH
========================= */

export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  code: string;
}> {
  try {
    await db`select 1`;

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

export async function getDatabaseRuntimeFingerprint(): Promise<{
  ok: boolean;
  database?: string;
  current_user?: string;
  server_addr?: string | null;
  server_port?: number | null;
  application_name?: string | null;
  error?: string;
}> {
  try {
    const rows = await db<{
      database: string;
      current_user: string;
      server_addr: string | null;
      server_port: number | null;
      application_name: string | null;
    }[]>`
      select
        current_database() as database,
        current_user as current_user,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port,
        current_setting('application_name', true) as application_name
    `;

    const row = rows[0];

    return {
      ok: true,
      database: row?.database ?? undefined,
      current_user: row?.current_user ?? undefined,
      server_addr: row?.server_addr ?? null,
      server_port: row?.server_port ?? null,
      application_name: row?.application_name ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown database runtime fingerprint error",
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

export type { PoolClient, PostgresType };