import { withSuffix } from "./files";
import type { BlobStore, Db, NodeRow } from "./types";

export const ROOT_ID = "root";

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 416 | 429,
    message: string,
  ) {
    super(message);
  }
}

const SUBTREE = `
  WITH RECURSIVE sub(id) AS (
    SELECT ?
    UNION ALL
    SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id
  )`;

export async function getNode(db: Db, id: string) {
  return db.first<NodeRow>("SELECT * FROM nodes WHERE id = ?", id);
}

export async function getLiveNode(db: Db, id: string) {
  const node = await getNode(db, id);
  if (!node || node.trashed_at !== null) throw new HttpError(404, "Not found");
  return node;
}

export async function getLiveFolder(db: Db, id: string) {
  const node = await getLiveNode(db, id);
  if (node.kind !== "folder") throw new HttpError(400, "Not a folder");
  return node;
}

// Folder item counts and share counts, for list rows.
const WITH_COUNTS = `n.*,
  (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id AND c.trashed_at IS NULL) AS child_count,
  (SELECT COUNT(*) FROM shares s WHERE s.node_id = n.id) AS share_count`;

export async function listChildren(db: Db, folderId: string) {
  return db.all<NodeRow>(
    `SELECT ${WITH_COUNTS} FROM nodes n WHERE n.parent_id = ? AND n.trashed_at IS NULL
     ORDER BY n.kind = 'file', n.name COLLATE NOCASE`,
    folderId,
  );
}

export async function getNodeWithCounts(db: Db, id: string) {
  return db.first<NodeRow>(`SELECT ${WITH_COUNTS} FROM nodes n WHERE n.id = ?`, id);
}

export async function recentFiles(db: Db, limit: number) {
  return db.all<NodeRow & { parent_name: string }>(
    `SELECT n.*, p.name AS parent_name FROM nodes n JOIN nodes p ON p.id = n.parent_id
     WHERE n.kind = 'file' AND n.trashed_at IS NULL
     ORDER BY n.updated_at DESC LIMIT ?`,
    limit,
  );
}

// Folders from the top of the tree down to `id`, both included.
export async function ancestors(db: Db, id: string) {
  return db.all<{ id: string; name: string }>(
    `WITH RECURSIVE up(id, parent_id, name, depth) AS (
       SELECT id, parent_id, name, 0 FROM nodes WHERE id = ?
       UNION ALL
       SELECT n.id, n.parent_id, n.name, up.depth + 1 FROM nodes n JOIN up ON n.id = up.parent_id
     )
     SELECT id, name FROM up ORDER BY depth DESC`,
    id,
  );
}

export async function isInside(db: Db, id: string, ancestorId: string) {
  return (await ancestors(db, id)).some((a) => a.id === ancestorId);
}

// Returns `name`, or "name (2).ext" and so on if a live sibling already uses it.
export async function freeName(db: Db, parentId: string, name: string, exceptId?: string) {
  const taken = new Set(
    (
      await db.all<{ name: string }>(
        "SELECT name FROM nodes WHERE parent_id = ? AND trashed_at IS NULL AND id != ?",
        parentId,
        exceptId ?? "",
      )
    ).map((r) => r.name.toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = withSuffix(name, n);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export async function insertNode(
  db: Db,
  node: { id: string; parentId: string; name: string; kind: "file" | "folder"; size?: number; mime?: string | null },
) {
  const now = Date.now();
  await db.run(
    `INSERT INTO nodes (id, parent_id, name, kind, size, mime, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    node.id,
    node.parentId,
    node.name,
    node.kind,
    node.size ?? 0,
    node.mime ?? null,
    now,
    now,
  );
  await touch(db, node.parentId);
  return (await getNode(db, node.id))!;
}

export async function touch(db: Db, id: string) {
  await db.run("UPDATE nodes SET updated_at = ? WHERE id = ?", Date.now(), id);
}

export async function trashNode(db: Db, id: string) {
  const now = Date.now();
  // Do not go into child folders that are already in the trash. They keep their own trash entry.
  await db.run(
    `WITH RECURSIVE sub(id) AS (
       SELECT ?
       UNION ALL
       SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id WHERE n.trashed_at IS NULL
     )
     UPDATE nodes SET trashed_at = ?, trash_root = (id = ?) WHERE id IN (SELECT id FROM sub)`,
    id,
    now,
    id,
  );
}

export async function restoreNode(db: Db, node: NodeRow) {
  const parent = node.parent_id ? await getNode(db, node.parent_id) : null;
  const parentId = parent && parent.trashed_at === null ? parent.id : ROOT_ID;
  const name = await freeName(db, parentId, node.name);
  await db.run("UPDATE nodes SET parent_id = ?, name = ? WHERE id = ?", parentId, name, node.id);
  await db.run(
    `WITH RECURSIVE sub(id) AS (
       SELECT ?
       UNION ALL
       SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id
       WHERE n.trashed_at = ? AND n.trash_root = 0
     )
     UPDATE nodes SET trashed_at = NULL, trash_root = 0 WHERE id IN (SELECT id FROM sub)`,
    node.id,
    node.trashed_at,
  );
  await touch(db, parentId);
}

export async function deleteForever(db: Db, blobs: BlobStore, id: string) {
  const files = await db.all<{ id: string }>(
    `${SUBTREE} SELECT n.id FROM nodes n JOIN sub ON n.id = sub.id WHERE n.kind = 'file'`,
    id,
  );
  await blobs.delete(files.map((f) => f.id));
  await db.run(`${SUBTREE} DELETE FROM nodes WHERE id IN (SELECT id FROM sub)`, id);
}

export function publicNode(n: NodeRow) {
  return {
    id: n.id,
    parentId: n.parent_id,
    name: n.name,
    kind: n.kind,
    size: n.size,
    mime: n.mime,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    trashedAt: n.trashed_at,
    childCount: n.child_count ?? null,
    shared: (n.share_count ?? 0) > 0,
  };
}
