#!/usr/bin/env node
// @ts-nocheck
/**
 * Database migrator (node-postgres, `pg`).
 *
 * Applies pending files in ../migrations to DATABASE_URL, each in one
 * transaction, recorded in `_migrations`. Safe to re-run.
 *
 * Invoked from the Neon server path on startup. The build does not call it:
 * the publish environment's database is often still waking up, and a failed
 * connect used to fail `npm run build` even though the app itself compiled.
 *
 * No DATABASE_URL -> skip. The PGLite fallback migrates itself (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { realpathSync } from "node:fs";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";
import { withNeonSsl } from "./pg-ssl.mjs";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

/** Split a migration file into statements. Our files have no semicolons inside quotes. */
export function splitSql(text) {
  return text
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter((part) => part && !part.split("\n").every((line) => line.trim().startsWith("--") || !line.trim()));
}

async function applyOnClient(client) {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  await client.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const applied = (await client.query("SELECT name FROM _migrations")).rows.map((row) => row.name);

  let count = 0;
  for (const { name } of pendingMigrations(entries, applied)) {
    const text = await readFile(join(migrationsDir, name), "utf8");
    const statements = splitSql(text);
    try {
      await client.query("BEGIN");
      for (const statement of statements) {
        await client.query(statement);
      }
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (err) {
      console.error(`[migrate] error applying ${name}`);
      try {
        await client.query("ROLLBACK");
      } catch {
        // ROLLBACK fails when the connection died — keep the original error.
      }
      throw err;
    }
    console.log(`[migrate] applied ${name}`);
    count += 1;
  }
  console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
}

export async function applyMigrations(connectionString) {
  if (!connectionString || !String(connectionString).trim()) {
    console.log("[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).");
    return;
  }
  const pool = new pg.Pool({
    connectionString: withNeonSsl(connectionString),
    max: 1,
    connectionTimeoutMillis: 20000,
  });
  const client = await pool.connect();
  try {
    await applyOnClient(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  let last;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await applyMigrations(databaseUrl);
      return;
    } catch (err) {
      last = err;
      console.error(`[migrate] attempt ${attempt} failed:`, err?.message || err);
      for (const key of ["code", "detail", "hint", "position", "where"]) {
        if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
      }
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw last;
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error("[migrate] failed:", err?.message || err);
    process.exit(1);
  });
}
