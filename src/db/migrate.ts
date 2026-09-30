import path from "node:path";
import { db, dbDriver, dbReady } from "./index";

/** Applies pending SQL migrations from ./drizzle. Safe to call repeatedly. */
export async function runMigrations() {
  await dbReady();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (dbDriver() === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder });
  }
}
