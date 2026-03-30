import "server-only";

import {
  Pool,
  type PoolClient,
  type PoolConfig,
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
  var __proceit_postgres_sql__: DbSqlClient | undefined;
}

/* =========================
   TYPES
========================= */

export type QueryRowsResult<T extends QueryResultRow> = {
  rows: T[];
};

export type DbSqlClient = Sql<Record<string, PostgresType>>;
export type DbTransactionClient = DbSqlClient;

type DbTransactionCallback<T> = (tx: DbTransactionClient) => Promise<T>;

export type DbClient = DbSqlClient & {
  begin: <T>(callback: DbTransactionCallback<T>) => Promise<T>;
};

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
   POSTGRES TAGGED CLIENT
========================= */

function createSqlClient(): DbSqlClient {
  return postgres(env.DATABASE_URL, {
    ssl: buildSslConfigForPostgres(),
    max: DB_POOL_MAX_CONNECTIONS,
    idle_timeout: Math.floor(DB_IDLE_TIMEOUT_MILLISECONDS / 1000),
    connect_timeout: Math.floor(DB_CONNECTION_TIMEOUT_MILLISECONDS / 1000),
    prepare: true,
    transform: {
      undefined: null,
    },
    connection: {
      application_name: DB_APPLICATION_NAME,
    },
  }) as DbSqlClient;
}

const sqlClient = global.__proceit_postgres_sql__ ?? createSqlClient();

if (!env.isProduction) {
  global.__proceit_postgres_sql__ = sqlClient;
}

/* =========================
   DB HELPER (FIX CRÍTICO)
========================= */

/**
 * IMPORTANTE:
 * - NÃO usar Object.assign({}, sqlClient)
 * - Isso quebra o comportamento callable (tagged template)
 * - Precisamos manter db como função + métodos
 */

const db = sqlClient as DbClient;

db.begin = async <T>(callback: DbTransactionCallback<T>): Promise<T> => {
  const result = await sqlClient.begin(async (tx) => {
    return callback(tx as DbTransactionClient);
  });

  return result as T;
};

/* =========================
   HEALTH / LIFECYCLE
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
export type { PoolClient, PostgresType }; 