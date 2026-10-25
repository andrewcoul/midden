import type { FolderListing, Me, Node, PublicShare, ShareLink } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const HEADERS = { "X-Requested-With": "midden" };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? HEADERS : { ...HEADERS, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/s/") && path !== "/api/login") {
      window.dispatchEvent(new Event("midden:logged-out"));
    }
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  me: () => request<Me>("GET", "/api/me"),
  login: (password: string) => request("POST", "/api/login", { password }),
  logout: () => request("POST", "/api/logout"),

  folder: (id: string) => request<FolderListing>("GET", `/api/folders/${id}`),
  node: (id: string) => request<{ node: Node; path: FolderListing["path"] }>("GET", `/api/nodes/${id}`),
  createFolder: (parentId: string, name: string) => request<Node>("POST", "/api/folders", { parentId, name }),
  update: (id: string, patch: { name?: string; parentId?: string }) =>
    request<Node>("PATCH", `/api/nodes/${id}`, patch),
  trash: (id: string) => request("POST", `/api/nodes/${id}/trash`),
  restore: (id: string) => request<Node>("POST", `/api/nodes/${id}/restore`),
  deleteForever: (id: string) => request("DELETE", `/api/nodes/${id}`),
  listTrash: () => request<{ items: Node[] }>("GET", "/api/trash"),
  emptyTrash: () => request("DELETE", "/api/trash"),
  search: (q: string) => request<{ items: Node[] }>("GET", `/api/search?q=${encodeURIComponent(q)}`),
  usage: () => request<{ files: number; bytes: number }>("GET", "/api/usage"),
  recent: () => request<{ items: Node[] }>("GET", "/api/recent"),
  importUrl: (parentId: string, url: string) => request<Node>("POST", "/api/import", { parentId, url }),

  listShares: () => request<{ items: ShareLink[] }>("GET", "/api/shares"),
  createShare: (nodeId: string, password: string, expiresInDays: number) =>
    request<{ id: string }>("POST", "/api/shares", { nodeId, password, expiresInDays }),
  deleteShare: (id: string) => request("DELETE", `/api/shares/${id}`),

  publicShare: (token: string) => request<PublicShare>("GET", `/api/s/${token}`),
  unlockShare: (token: string, password: string) => request("POST", `/api/s/${token}/unlock`, { password }),
  publicFolder: (token: string, id: string) => request<FolderListing>("GET", `/api/s/${token}/folders/${id}`),
};

export type ContentUrl = (node: Node, download?: boolean) => string;

export const ownerContentUrl: ContentUrl = (node, download) =>
  `/api/files/${node.id}/content${download ? "?download=1" : ""}`;

export const shareContentUrl =
  (token: string): ContentUrl =>
  (node, download) =>
    `/api/s/${token}/files/${node.id}/content${download ? "?download=1" : ""}`;

export const shareUrl = (id: string) => `${location.origin}/s/${id}`;

// ---------- Uploads ----------

function send(
  method: string,
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("X-Requested-With", "midden");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const SINGLE_LIMIT = 10 * 1024 * 1024;

export async function uploadFile(
  file: File,
  parentId: string,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<Node> {
  if (file.size <= SINGLE_LIMIT) {
    const qs = new URLSearchParams({ parentId, name: file.name, mime: file.type });
    return send("PUT", `/api/upload?${qs}`, file, onProgress, signal);
  }

  const { id, partSize, parts } = await request<{ id: string; partSize: number; parts: number }>(
    "POST",
    "/api/uploads",
    { parentId, name: file.name, size: file.size, mime: file.type },
  );
  const loaded = new Array<number>(parts).fill(0);
  const report = () => onProgress(loaded.reduce((a, b) => a + b, 0));
  const done: { partNumber: number; etag: string }[] = [];
  let next = 1;

  async function worker() {
    while (next <= parts) {
      const n = next++;
      const blob = file.slice((n - 1) * partSize, Math.min(n * partSize, file.size));
      for (let attempt = 1; ; attempt++) {
        try {
          const part = await send("PUT", `/api/uploads/${id}/parts/${n}`, blob, (l) => {
            loaded[n - 1] = l;
            report();
          }, signal);
          done.push(part);
          break;
        } catch (err) {
          if (signal.aborted || attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
  }

  try {
    await Promise.all([worker(), worker(), worker()]);
    return await request<Node>("POST", `/api/uploads/${id}/complete`, { parts: done });
  } catch (err) {
    request("DELETE", `/api/uploads/${id}`).catch(() => {});
    throw err;
  }
}
