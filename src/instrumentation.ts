export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { dbReady } = await import("./db");
  await dbReady();
  if (process.env.AUTO_MIGRATE !== "false") {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  }
}
