import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { ACCESS_HEADER, peekAccess } from "./access";
import { checkToken, hashPassword, makeToken, randomId, verifyPassword } from "./crypto";
import { contentDisposition, guessMime, parseRange, servedType, validateName } from "./files";
import {
  HttpError,
  ROOT_ID,
  ancestors,
  deleteForever,
  freeName,
  getLiveFolder,
  getLiveNode,
  getNode,
  getNodeWithCounts,
  insertNode,
  isInside,
  listChildren,
  publicNode,
  recentFiles,
  restoreNode,
  touch,
  trashNode,
} from "./repo";
import type { Deps, NodeRow, ShareRow, UploadRow } from "./types";

// Chunked uploads use parts of this size. R2 needs at least 5 MiB for each part except the last.
export const PART_SIZE = 10 * 1024 * 1024;
// Cloudflare limits a request body to 100 MB on the free plan.
const MAX_SINGLE_UPLOAD = 95 * 1024 * 1024;
const SHARE_UNLOCK_TTL = 12 * 3600 * 1000;
const CSRF_HEADER = "x-requested-with";

type Env = { Variables: { deps: Deps } };
type C = Context<Env>;

const isHttps = (c: C) =>
  new URL(c.req.url).protocol === "https:" || c.req.header("x-forwarded-proto") === "https";

// Wrong share-link passwords from one address before a lockout.
const MAX_PASSWORD_FAILURES = 10;
const PASSWORD_LOCKOUT = 15 * 60 * 1000;
const clientIp = (c: C) =>
  c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

async function jsonBody<T>(c: C): Promise<Partial<T>> {
  try {
    return (await c.req.json()) as Partial<T>;
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
}

function contentLength(c: C) {
  const size = Number(c.req.header("content-length"));
  if (!Number.isSafeInteger(size) || size < 0) throw new HttpError(400, "Content-Length is required");
  return size;
}

const emptyStream = () => new Response(new Uint8Array(0)).body!;

async function serveFile(c: C, node: NodeRow, download: boolean) {
  const { blobs } = c.var.deps;
  const range = parseRange(c.req.header("range"), node.size);
  if (range === null) {
    return c.body(null, 416, { "Content-Range": `bytes */${node.size}` });
  }
  const stream = node.size === 0 ? emptyStream() : await blobs.get(node.id, range);
  if (!stream) throw new HttpError(404, "File data is missing");

  const type = download ? "application/octet-stream" : servedType(node.mime);
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(range ? range.length : node.size),
    "Content-Disposition": contentDisposition(download ? "attachment" : "inline", node.name),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  // A sandbox stops scripts in files such as SVG. Chrome does not show a PDF in a sandbox.
  if (type !== "application/pdf") headers["Content-Security-Policy"] = "sandbox";
  if (range) {
    headers["Content-Range"] = `bytes ${range.offset}-${range.offset + range.length - 1}/${node.size}`;
    return c.body(stream, 206, headers);
  }
  return c.body(stream, 200, headers);
}

/** The Access user of the request, after the signature check. Null if there is no valid token. */
async function accessEmail(c: C) {
  const { verifyAccess } = c.var.deps;
  const token = c.req.header(ACCESS_HEADER);
  return verifyAccess && token ? verifyAccess(token) : null;
}

async function currentUser(c: C): Promise<{ method: "access" | "dev"; email: string } | null> {
  const { config } = c.var.deps;
  const email = await accessEmail(c);
  if (email && (!config.allowedEmails || config.allowedEmails.includes(email))) return { method: "access", email };
  // Only `vite dev` sets devEmail. A production build never has it.
  if (config.devEmail) return { method: "dev", email: config.devEmail };
  return null;
}

/** Stops a guess loop on share-link passwords. Failures are in D1, so all Worker instances agree. */
async function limitPasswordGuesses(c: C, check: () => Promise<boolean>) {
  const { db } = c.var.deps;
  const ip = clientIp(c);
  const now = Date.now();
  const entry = await db.first<{ count: number; until: number }>("SELECT count, until FROM login_failures WHERE ip = ?", ip);
  if (entry && entry.until > now && entry.count >= MAX_PASSWORD_FAILURES) {
    throw new HttpError(429, "Too many attempts. Try again later.");
  }
  if (await check()) {
    await db.run("DELETE FROM login_failures WHERE ip = ? OR until < ?", ip, now);
    return;
  }
  const count = entry && entry.until > now ? entry.count + 1 : 1;
  await db.run(
    "INSERT INTO login_failures (ip, count, until) VALUES (?, ?, ?) ON CONFLICT (ip) DO UPDATE SET count = excluded.count, until = excluded.until",
    ip,
    count,
    now + PASSWORD_LOCKOUT,
  );
  await new Promise((r) => setTimeout(r, 500));
  throw new HttpError(401, "Wrong password");
}

export function createApp(getDeps: (c: C) => Deps | Promise<Deps>) {
  const app = new Hono<Env>();

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    if (String(err).includes("UNIQUE constraint")) {
      return c.json({ error: "An item with that name already exists" }, 409);
    }
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  });

  app.use("/api/*", async (c, next) => {
    c.set("deps", await getDeps(c));
    // Browsers do not send a custom header to another origin without CORS approval. This stops CSRF.
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && c.req.header(CSRF_HEADER) !== "midden") {
      throw new HttpError(403, "Missing CSRF header");
    }
    await next();
  });

  app.get("/api/me", async (c) => {
    const { verifyAccess } = c.var.deps;
    const user = await currentUser(c);
    const token = c.req.header(ACCESS_HEADER);
    const email = user ? null : await accessEmail(c);
    return c.json({
      authenticated: !!user,
      method: user?.method ?? null,
      email: user?.email ?? null,
      accessReady: !!verifyAccess,
      // Access signed in this user, but the email is not in MIDDEN_ALLOWED_EMAILS.
      denied: email,
      // Access is in front of midden, but midden does not know the team yet. The setup page shows
      // these values so that the owner can copy them into the Worker settings.
      detected: !verifyAccess && token ? peekAccess(token) : null,
    });
  });

  // ---------- Public share links ----------

  async function loadShare(c: C) {
    const { db, config } = c.var.deps;
    const token = c.req.param("token")!;
    const share = await db.first<ShareRow>("SELECT * FROM shares WHERE id = ?", token);
    if (!share) throw new HttpError(404, "This link does not exist");
    if (share.expires_at && share.expires_at < Date.now()) throw new HttpError(410, "This link expired");
    const root = await getNode(db, share.node_id);
    if (!root || root.trashed_at !== null) throw new HttpError(404, "This link does not exist");
    const unlocked =
      !share.password_hash ||
      (await checkToken(config.sessionSecret, `share:${share.id}`, getCookie(c, `midden_share_${share.id}`)));
    return { share, root, unlocked };
  }

  async function sharedNode(c: C, id: string) {
    const { share, root, unlocked } = await loadShare(c);
    if (!unlocked) throw new HttpError(401, "Password required");
    if (id === root.id) return { share, root, node: root };
    const node = await getLiveNode(c.var.deps.db, id);
    if (root.kind !== "folder" || !(await isInside(c.var.deps.db, id, root.id))) {
      throw new HttpError(404, "Not found");
    }
    return { share, root, node };
  }

  app.get("/api/s/:token", async (c) => {
    const { share, root, unlocked } = await loadShare(c);
    return c.json({
      id: share.id,
      locked: !unlocked,
      expiresAt: share.expires_at,
      root: unlocked ? publicNode(root) : null,
    });
  });

  app.post("/api/s/:token/unlock", async (c) => {
    const { share } = await loadShare(c);
    const { password } = await jsonBody<{ password: string }>(c);
    const hash = share.password_hash;
    if (!hash) throw new HttpError(400, "This link has no password");
    await limitPasswordGuesses(c, async () => typeof password === "string" && verifyPassword(password, hash));
    const token = await makeToken(c.var.deps.config.sessionSecret, `share:${share.id}`, SHARE_UNLOCK_TTL);
    setCookie(c, `midden_share_${share.id}`, token, {
      httpOnly: true,
      secure: isHttps(c),
      sameSite: "Lax",
      path: `/api/s/${share.id}`,
      maxAge: SHARE_UNLOCK_TTL / 1000,
    });
    return c.json({ ok: true });
  });

  app.get("/api/s/:token/folders/:id", async (c) => {
    const { root, node } = await sharedNode(c, c.req.param("id"));
    if (node.kind !== "folder") throw new HttpError(400, "Not a folder");
    const path = await ancestors(c.var.deps.db, node.id);
    const start = path.findIndex((p) => p.id === root.id);
    return c.json({
      folder: publicNode(node),
      path: path.slice(start),
      children: (await listChildren(c.var.deps.db, node.id)).map(publicNode),
    });
  });

  app.get("/api/s/:token/files/:id/content", async (c) => {
    const { share, node } = await sharedNode(c, c.req.param("id"));
    if (node.kind !== "file") throw new HttpError(400, "Not a file");
    const download = c.req.query("download") === "1";
    if (download && !c.req.header("range")) {
      await c.var.deps.db.run("UPDATE shares SET downloads = downloads + 1 WHERE id = ?", share.id);
    }
    return serveFile(c, node, download);
  });

  // ---------- Everything below needs a login ----------

  app.use("/api/*", async (c, next) => {
    if (!(await currentUser(c))) throw new HttpError(401, "Log in first");
    await next();
  });

  app.get("/api/folders/:id", async (c) => {
    const { db } = c.var.deps;
    const folder = await getLiveFolder(db, c.req.param("id"));
    return c.json({
      folder: publicNode((await getNodeWithCounts(db, folder.id))!),
      path: await ancestors(db, folder.id),
      children: (await listChildren(db, folder.id)).map(publicNode),
    });
  });

  app.post("/api/folders", async (c) => {
    const { db } = c.var.deps;
    const body = await jsonBody<{ parentId: string; name: string }>(c);
    const name = validateName(body.name);
    if (!name) throw new HttpError(400, "Name is not valid");
    const parent = await getLiveFolder(db, body.parentId ?? ROOT_ID);
    const node = await insertNode(db, {
      id: crypto.randomUUID(),
      parentId: parent.id,
      name: await freeName(db, parent.id, name),
      kind: "folder",
    });
    return c.json(publicNode(node), 201);
  });

  app.get("/api/nodes/:id", async (c) => {
    const { db } = c.var.deps;
    const node = await getLiveNode(db, c.req.param("id"));
    return c.json({ node: publicNode(node), path: await ancestors(db, node.id) });
  });

  // Rename and move.
  app.patch("/api/nodes/:id", async (c) => {
    const { db } = c.var.deps;
    const id = c.req.param("id");
    if (id === ROOT_ID) throw new HttpError(400, "You cannot change My Drive");
    const node = await getLiveNode(db, id);
    const body = await jsonBody<{ name: string; parentId: string }>(c);

    let parentId = node.parent_id!;
    if (body.parentId !== undefined && body.parentId !== parentId) {
      const target = await getLiveFolder(db, String(body.parentId));
      if (await isInside(db, target.id, node.id)) {
        throw new HttpError(400, "You cannot move a folder into itself");
      }
      parentId = target.id;
    }

    let name = node.name;
    if (body.name !== undefined) {
      const valid = validateName(body.name);
      if (!valid) throw new HttpError(400, "Name is not valid");
      name = valid;
    }
    if (parentId !== node.parent_id) {
      name = await freeName(db, parentId, name, node.id);
    } else if (name.toLowerCase() !== node.name.toLowerCase() && (await freeName(db, parentId, name, node.id)) !== name) {
      throw new HttpError(409, "An item with that name already exists");
    }

    await db.run(
      "UPDATE nodes SET parent_id = ?, name = ?, updated_at = ? WHERE id = ?",
      parentId,
      name,
      Date.now(),
      node.id,
    );
    if (parentId !== node.parent_id) await touch(db, node.parent_id!);
    await touch(db, parentId);
    return c.json(publicNode((await getNode(db, node.id))!));
  });

  app.post("/api/nodes/:id/trash", async (c) => {
    const { db } = c.var.deps;
    const id = c.req.param("id");
    if (id === ROOT_ID) throw new HttpError(400, "You cannot delete My Drive");
    const node = await getLiveNode(db, id);
    await trashNode(db, node.id);
    await touch(db, node.parent_id!);
    return c.json({ ok: true });
  });

  app.post("/api/nodes/:id/restore", async (c) => {
    const { db } = c.var.deps;
    const node = await getNode(db, c.req.param("id"));
    if (!node || !node.trash_root) throw new HttpError(404, "Not in trash");
    await restoreNode(db, node);
    return c.json(publicNode((await getNode(db, node.id))!));
  });

  app.delete("/api/nodes/:id", async (c) => {
    const { db, blobs } = c.var.deps;
    const id = c.req.param("id");
    if (id === ROOT_ID) throw new HttpError(400, "You cannot delete My Drive");
    const node = await getNode(db, id);
    if (!node) throw new HttpError(404, "Not found");
    await deleteForever(db, blobs, node.id);
    return c.json({ ok: true });
  });

  app.get("/api/trash", async (c) => {
    const rows = await c.var.deps.db.all<NodeRow>(
      "SELECT * FROM nodes WHERE trash_root = 1 ORDER BY trashed_at DESC",
    );
    return c.json({ items: rows.map(publicNode) });
  });

  app.delete("/api/trash", async (c) => {
    const { db, blobs } = c.var.deps;
    const rows = await db.all<{ id: string }>("SELECT id FROM nodes WHERE trash_root = 1");
    for (const r of rows) await deleteForever(db, blobs, r.id);
    return c.json({ deleted: rows.length });
  });

  app.get("/api/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ items: [] });
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const rows = await c.var.deps.db.all<NodeRow & { parent_name: string }>(
      `SELECT n.*, p.name AS parent_name FROM nodes n JOIN nodes p ON p.id = n.parent_id
       WHERE n.trashed_at IS NULL AND n.name LIKE ? ESCAPE '\\'
       ORDER BY n.kind = 'file', n.name COLLATE NOCASE LIMIT 200`,
      like,
    );
    return c.json({ items: rows.map((r) => ({ ...publicNode(r), parentName: r.parent_name })) });
  });

  app.get("/api/recent", async (c) => {
    const rows = await recentFiles(c.var.deps.db, 8);
    return c.json({ items: rows.map((r) => ({ ...publicNode(r), parentName: r.parent_name })) });
  });

  // Save a file from a URL into a folder. The Worker downloads it and streams it into storage.
  app.post("/api/import", async (c) => {
    const { db, blobs } = c.var.deps;
    const body = await jsonBody<{ parentId: string; url: string }>(c);
    let url: URL;
    try {
      url = new URL(String(body.url));
    } catch {
      throw new HttpError(400, "That is not a valid link");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "Only http and https links");
    const parent = await getLiveFolder(db, body.parentId ?? ROOT_ID);

    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body) throw new HttpError(400, `The link returned ${res.status}`);
    const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
    const fromPath = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
    const name = validateName(fromHeader ? decodeURIComponent(fromHeader) : fromPath) ?? url.hostname;
    const mime = guessMime(name, res.headers.get("content-type")?.split(";")[0]);

    // Storage needs the size first. Use Content-Length when the server sends it; otherwise buffer.
    let size = Number(res.headers.get("content-length"));
    let stream: ReadableStream<Uint8Array> = res.body;
    if (!Number.isSafeInteger(size) || size < 0) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_SINGLE_UPLOAD) throw new HttpError(413, "That file is too large to import");
      size = buf.byteLength;
      stream = new Response(buf).body!;
    }
    if (size > MAX_SINGLE_UPLOAD) throw new HttpError(413, "That file is too large to import");

    const id = crypto.randomUUID();
    if (size > 0) await blobs.put(id, stream, size);
    const node = await insertNode(db, {
      id,
      parentId: parent.id,
      name: await freeName(db, parent.id, name),
      kind: "file",
      size,
      mime,
    });
    return c.json(publicNode(node), 201);
  });

  app.get("/api/usage", async (c) => {
    const row = await c.var.deps.db.first<{ files: number; bytes: number | null }>(
      "SELECT COUNT(*) AS files, SUM(size) AS bytes FROM nodes WHERE kind = 'file'",
    );
    return c.json({ files: row?.files ?? 0, bytes: row?.bytes ?? 0 });
  });

  app.get("/api/files/:id/content", async (c) => {
    const node = await getLiveNode(c.var.deps.db, c.req.param("id"));
    if (node.kind !== "file") throw new HttpError(400, "Not a file");
    return serveFile(c, node, c.req.query("download") === "1");
  });

  // ---------- Uploads ----------

  // Small files: one request with the file as the body.
  app.put("/api/upload", async (c) => {
    const { db, blobs } = c.var.deps;
    const name = validateName(c.req.query("name"));
    if (!name) throw new HttpError(400, "Name is not valid");
    const size = contentLength(c);
    if (size > MAX_SINGLE_UPLOAD) throw new HttpError(413, "Use a chunked upload for large files");
    const parent = await getLiveFolder(db, c.req.query("parentId") ?? ROOT_ID);

    const id = crypto.randomUUID();
    if (size > 0) await blobs.put(id, c.req.raw.body ?? emptyStream(), size);
    const node = await insertNode(db, {
      id,
      parentId: parent.id,
      name: await freeName(db, parent.id, name),
      kind: "file",
      size,
      mime: guessMime(name, c.req.query("mime")),
    });
    return c.json(publicNode(node), 201);
  });

  // Large files: start, send parts of PART_SIZE, then complete.
  app.post("/api/uploads", async (c) => {
    const { db, blobs } = c.var.deps;
    const body = await jsonBody<{ parentId: string; name: string; size: number; mime: string }>(c);
    const name = validateName(body.name);
    if (!name) throw new HttpError(400, "Name is not valid");
    const size = Number(body.size);
    if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, "Size is not valid");
    if (Math.ceil(size / PART_SIZE) > 10_000) throw new HttpError(413, "File is too large");
    const parent = await getLiveFolder(db, body.parentId ?? ROOT_ID);

    const id = crypto.randomUUID();
    const blobKey = crypto.randomUUID();
    const storeId = await blobs.createMultipart(blobKey);
    await db.run(
      `INSERT INTO uploads (id, blob_key, store_id, parent_id, name, size, mime, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      blobKey,
      storeId,
      parent.id,
      name,
      size,
      guessMime(name, body.mime),
      Date.now(),
    );
    return c.json({ id, partSize: PART_SIZE, parts: Math.ceil(size / PART_SIZE) }, 201);
  });

  async function getUpload(c: C) {
    const row = await c.var.deps.db.first<UploadRow>("SELECT * FROM uploads WHERE id = ?", c.req.param("id"));
    if (!row) throw new HttpError(404, "Upload not found");
    return row;
  }

  app.put("/api/uploads/:id/parts/:n", async (c) => {
    const upload = await getUpload(c);
    const n = Number(c.req.param("n"));
    const total = Math.ceil(upload.size / PART_SIZE);
    if (!Number.isInteger(n) || n < 1 || n > total) throw new HttpError(400, "Part number is not valid");
    const expected = n < total ? PART_SIZE : upload.size - PART_SIZE * (total - 1);
    const size = contentLength(c);
    if (size !== expected) throw new HttpError(400, `Part ${n} must be ${expected} bytes`);
    const part = await c.var.deps.blobs.uploadPart(
      upload.blob_key,
      upload.store_id,
      n,
      c.req.raw.body ?? emptyStream(),
      size,
    );
    return c.json(part);
  });

  app.post("/api/uploads/:id/complete", async (c) => {
    const { db, blobs } = c.var.deps;
    const upload = await getUpload(c);
    const { parts } = await jsonBody<{ parts: { partNumber: number; etag: string }[] }>(c);
    const total = Math.ceil(upload.size / PART_SIZE);
    if (!Array.isArray(parts) || parts.length !== total) throw new HttpError(400, `Expected ${total} parts`);
    await blobs.completeMultipart(upload.blob_key, upload.store_id, parts);
    await db.run("DELETE FROM uploads WHERE id = ?", upload.id);

    // The folder can go to the trash during a long upload. Then the file goes to My Drive.
    const parent = await getNode(db, upload.parent_id);
    const parentId = parent && parent.trashed_at === null ? parent.id : ROOT_ID;
    const node = await insertNode(db, {
      id: upload.blob_key,
      parentId,
      name: await freeName(db, parentId, upload.name),
      kind: "file",
      size: upload.size,
      mime: upload.mime,
    });
    return c.json(publicNode(node), 201);
  });

  app.delete("/api/uploads/:id", async (c) => {
    const upload = await getUpload(c);
    await c.var.deps.blobs.abortMultipart(upload.blob_key, upload.store_id);
    await c.var.deps.db.run("DELETE FROM uploads WHERE id = ?", upload.id);
    return c.json({ ok: true });
  });

  // ---------- Managing share links ----------

  app.get("/api/shares", async (c) => {
    const rows = await c.var.deps.db.all<
      ShareRow & { name: string; kind: string; mime: string | null; parent_id: string | null; trashed_at: number | null }
    >(
      `SELECT s.*, n.name, n.kind, n.mime, n.parent_id, n.trashed_at FROM shares s JOIN nodes n ON n.id = s.node_id
       ORDER BY s.created_at DESC`,
    );
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        nodeId: r.node_id,
        name: r.name,
        kind: r.kind,
        mime: r.mime,
        parentId: r.parent_id,
        hasPassword: !!r.password_hash,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        downloads: r.downloads,
        trashed: r.trashed_at !== null,
      })),
    });
  });

  app.post("/api/shares", async (c) => {
    const { db } = c.var.deps;
    const body = await jsonBody<{ nodeId: string; password: string; expiresInDays: number }>(c);
    const node = await getLiveNode(db, String(body.nodeId));
    if (node.id === ROOT_ID) throw new HttpError(400, "You cannot share all of My Drive");
    const days = Number(body.expiresInDays);
    const expiresAt = days > 0 ? Date.now() + days * 24 * 3600 * 1000 : null;
    const passwordHash = body.password ? await hashPassword(String(body.password)) : null;
    const id = randomId(12);
    await db.run(
      "INSERT INTO shares (id, node_id, password_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      id,
      node.id,
      passwordHash,
      expiresAt,
      Date.now(),
    );
    return c.json({ id, nodeId: node.id, hasPassword: !!passwordHash, expiresAt }, 201);
  });

  app.delete("/api/shares/:id", async (c) => {
    await c.var.deps.db.run("DELETE FROM shares WHERE id = ?", c.req.param("id"));
    return c.json({ ok: true });
  });

  app.all("/api/*", () => {
    throw new HttpError(404, "Not found");
  });

  return app;
}
