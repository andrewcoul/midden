import { env } from "cloudflare:workers";
import { accessVerifier } from "./access";
import { createApp } from "./app";
import { randomId } from "./crypto";
import { d1Db } from "./db/d1";
import { migrate } from "./migrate";
import { r2BlobStore } from "./storage/r2";
import type { Db, Deps } from "./types";

// All settings are optional. Set them as Worker variables or secrets (see README.md).
type Vars = Partial<
  Record<
    | "MIDDEN_SESSION_SECRET"
    | "MIDDEN_ACCESS_TEAM_DOMAIN"
    | "MIDDEN_ACCESS_AUD"
    | "MIDDEN_ALLOWED_EMAILS"
    | "MIDDEN_DEV_EMAIL",
    string
  >
>;

/** Gets a stored value, or stores a new one. Two instances that start together get the same value. */
async function setting(db: Db, key: string, make: () => string) {
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, make());
  return (await db.first<{ value: string }>("SELECT value FROM settings WHERE key = ?", key))!.value;
}

async function init(): Promise<Deps> {
  const vars = env as unknown as Vars;
  await migrate(env.DB);
  const db = d1Db(env.DB);
  const team = vars.MIDDEN_ACCESS_TEAM_DOMAIN?.trim();
  const aud = vars.MIDDEN_ACCESS_AUD?.trim();
  const emails = vars.MIDDEN_ALLOWED_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return {
    db,
    blobs: r2BlobStore(env.FILES),
    config: {
      sessionSecret:
        (vars.MIDDEN_SESSION_SECRET ?? "").length >= 32
          ? vars.MIDDEN_SESSION_SECRET!
          : await setting(db, "session_secret", () => randomId(32)),
      allowedEmails: emails?.length ? emails : null,
      // `vite dev` has no Access in front of it, so it signs in this test user. Set
      // MIDDEN_DEV_EMAIL to an empty value in .dev.vars to see the signed-out screens.
      devEmail: import.meta.env.DEV ? (vars.MIDDEN_DEV_EMAIL ?? "dev@localhost") || null : null,
    },
    verifyAccess: team && aud ? accessVerifier(team, aud) : null,
  };
}

// One set of dependencies for each isolate. If the start fails, the next request tries again.
let ready: Promise<Deps> | null = null;

export const api = createApp(() => (ready ??= init().catch((err) => ((ready = null), Promise.reject(err)))));
