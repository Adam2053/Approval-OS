import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

type DbState = { db: DB | null; driver: "postgres" | "pglite"; ready: Promise<void> };

const globalForDb = globalThis as unknown as { __aosDb?: DbState };

/**
 * Uses Postgres when DATABASE_URL is set. Otherwise falls back to an embedded
 * Postgres (PGlite) stored in ./.data/pglite so the app runs with zero setup.
 */
function create(): DbState {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
    return { db: drizzlePg({ client: pool, schema }), driver: "postgres", ready: Promise.resolve() };
  }
  const state: DbState = { db: null, driver: "pglite", ready: Promise.resolve() };
  state.ready = (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { mkdirSync } = await import("node:fs");
    const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await client.waitReady;
    state.db = drizzle({ client, schema }) as unknown as DB;
  })();
  return state;
}

function state(): DbState {
  if (!globalForDb.__aosDb) globalForDb.__aosDb = create();
  return globalForDb.__aosDb;
}

/** Resolves once the database connection is open (instant for Postgres). */
export async function dbReady() {
  await state().ready;
}

export function dbDriver() {
  return state().driver;
}

/** Drizzle instance. `instrumentation.ts` awaits `dbReady()` before the server takes requests. */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = state().db;
    if (!real) throw new Error("Database is still starting up. Try again in a moment.");
    const v = (real as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export { schema };
