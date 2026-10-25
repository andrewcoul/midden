export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function formatDate(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export type FileKind =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "pdf"
  | "sheet"
  | "archive"
  | "other";

const TEXT_EXT = /\.(txt|md|csv|log|json|ya?ml|toml|ini|conf|xml|html?|css|s?css|[cm]?[jt]sx?|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|bash|zsh|sql|lua|swift|env)$/i;
const SHEET = /spreadsheet|excel|\/csv|numbers/;
const ARCHIVE = /zip|tar|gzip|7z|rar|compressed|x-bzip/;

export function fileKind(node: { kind: string; mime: string | null; name: string }): FileKind {
  if (node.kind === "folder") return "folder";
  const m = node.mime ?? "";
  if (m.startsWith("image/") && m !== "image/heic") return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (SHEET.test(m) || /\.(xlsx?|ods|csv|numbers)$/i.test(node.name)) return "sheet";
  if (ARCHIVE.test(m) || /\.(zip|tar|gz|tgz|7z|rar)$/i.test(node.name)) return "archive";
  if (m.startsWith("text/") || m === "application/json" || TEXT_EXT.test(node.name) || /word|document|rtf/.test(m))
    return "document";
  return "other";
}

export const KIND_LABEL: Record<FileKind, string> = {
  folder: "Folder",
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  pdf: "PDF",
  sheet: "Spreadsheet",
  archive: "Archive",
  other: "File",
};

/** Browsers can play or show these inline. */
export function canPreview(node: { kind: string; mime: string | null; name: string }) {
  const k = fileKind(node);
  if (k === "image" || k === "pdf" || k === "audio") return true;
  if (k === "video") return /mp4|webm|ogg|quicktime/.test(node.mime ?? "");
  return k === "document" && node.mime !== null && !/word|rtf/.test(node.mime);
}
