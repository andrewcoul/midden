import type { ByteRange } from "./types";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", bmp: "image/bmp", ico: "image/x-icon", svg: "image/svg+xml", heic: "image/heic",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", opus: "audio/ogg",
  pdf: "application/pdf", zip: "application/zip", json: "application/json",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", log: "text/plain", html: "text/html",
  css: "text/css", js: "text/javascript", ts: "text/plain", tsx: "text/plain", jsx: "text/plain",
  py: "text/x-python", go: "text/plain", rs: "text/plain", sh: "text/x-shellscript", yml: "text/yaml",
  yaml: "text/yaml", toml: "text/plain", xml: "text/xml", sql: "text/plain", c: "text/plain", h: "text/plain",
  cpp: "text/plain", java: "text/plain", ini: "text/plain", conf: "text/plain",
};

export function guessMime(name: string, given?: string | null) {
  if (given && given !== "application/octet-stream") return given;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

// The browser can show these types inline without the risk of running scripts from our origin.
const INLINE_OK = /^(image\/(png|jpeg|gif|webp|avif|bmp|x-icon|svg\+xml)|video\/.+|audio\/.+|application\/pdf)$/;

export function servedType(mime: string | null) {
  const m = mime ?? "application/octet-stream";
  if (INLINE_OK.test(m)) return m;
  // Show text as plain text. HTML, JS, and similar types never run.
  if (m.startsWith("text/") || m === "application/json") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export function contentDisposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Returns undefined for no range, null for a range that is not valid.
export function parseRange(header: string | undefined, size: number): ByteRange | null | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { offset: start, length: end - start + 1 };
}

export function validateName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > 255 || name === "." || name === "..") return null;
  if (/[\/\\\x00-\x1f]/.test(name)) return null;
  return name;
}

export function withSuffix(name: string, n: number) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} (${n})`;
  return `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
}
