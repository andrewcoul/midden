// Applies the files in migrations/ when the Worker starts. It uses the same d1_migrations table as
// `wrangler d1 migrations apply`, so the two ways agree. A new deploy needs no extra setup step.
const files = import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true });

export const MIGRATIONS = Object.entries(files)
  .map(([path, sql]) => ({ name: path.split("/").pop()!, sql }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Splits a migration file into statements. The files have no triggers, so a ";" at a line end ends a statement. */
export function statements(sql: string) {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function migrate(d1: D1Database) {
  await d1
    .prepare(
      "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
    )
    .run();
  const applied = await d1.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
  const done = new Set(applied.results.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    try {
      // A batch is one transaction, so a file applies fully or not at all.
      await d1.batch([
        ...statements(m.sql).map((s) => d1.prepare(s)),
        d1.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(m.name),
      ]);
    } catch (err) {
      // Another Worker instance can apply the same file at the same time.
      const row = await d1.prepare("SELECT 1 FROM d1_migrations WHERE name = ?").bind(m.name).first();
      if (!row) throw err;
    }
  }
}
