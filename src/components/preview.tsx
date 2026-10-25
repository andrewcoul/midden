import { ChevronLeft, ChevronRight, Download, Link2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FileMark } from "@/components/file-mark";
import { Button } from "@/components/ui/button";
import type { ContentUrl } from "@/lib/api";
import { canPreview, fileKind, formatBytes, formatDate } from "@/lib/format";
import type { Node } from "@/lib/types";

const TEXT_LIMIT = 512 * 1024;

/** Full-screen viewer on the dark satin backdrop. Arrow keys move between files, Esc closes. */
export function Preview({
  items,
  index,
  contentUrl,
  folderName,
  onIndex,
  onClose,
  onShare,
}: {
  items: Node[];
  index: number;
  contentUrl: ContentUrl;
  folderName?: string;
  onIndex: (i: number) => void;
  onClose: () => void;
  onShare?: (node: Node) => void;
}) {
  const node = items[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, items.length, onClose, onIndex]);

  if (!node) return null;
  return (
    <div role="dialog" aria-modal aria-label={node.name} className="satin-dark fixed inset-0 z-50 flex flex-col text-white">
      <header className="flex h-[72px] shrink-0 items-center gap-3 px-6">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex size-10 items-center justify-center rounded-full bg-white/8 shadow-[inset_0_1px_0_rgb(255_255_255/6%)] hover:bg-white/14"
        >
          <X className="size-[18px]" />
        </button>
        <FileMark node={node} size={32} className="shadow-[inset_0_0_0_1px_rgb(255_255_255/8%)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{node.name}</div>
          <div className="truncate text-[13px] text-white/56">
            {formatBytes(node.size)} · {formatDate(node.updatedAt)}
            {folderName ? ` · ${folderName}` : ""}
          </div>
        </div>
        {onShare && (
          <Button
            onClick={() => onShare(node)}
            className="bg-white/10 bg-none text-white shadow-[inset_0_1px_0_rgb(255_255_255/8%)] hover:bg-white/16 hover:bg-none"
          >
            <Link2 />
            Share
          </Button>
        )}
        <Button asChild className="bg-white bg-none text-foreground shadow-[0_1px_2px_rgb(0_0_0/30%)] hover:bg-white/90 hover:bg-none">
          <a href={contentUrl(node, true)} download>
            <Download />
            Download
          </a>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-between gap-6 px-6">
        <NavButton dir="prev" disabled={index === 0} onClick={() => onIndex(index - 1)} />
        <div className="flex h-full min-w-0 flex-1 items-center justify-center py-2">
          <Stage key={node.id} node={node} url={contentUrl(node)} downloadUrl={contentUrl(node, true)} />
        </div>
        <NavButton dir="next" disabled={index >= items.length - 1} onClick={() => onIndex(index + 1)} />
      </div>

      <footer className="flex h-[72px] shrink-0 items-center justify-center">
        <span className="rounded-full bg-white/8 px-4 py-2 text-[13px] text-white/64">
          {index + 1} of {items.length} · ← → to move · Esc to close
        </span>
      </footer>
    </div>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Previous file" : "Next file"}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white/8 shadow-[inset_0_1px_0_rgb(255_255_255/6%)] hover:bg-white/14 disabled:invisible"
    >
      <Icon className="size-5" />
    </button>
  );
}

const MEDIA = "max-h-full max-w-full rounded-[20px] shadow-[0_0_0_1px_rgb(255_255_255/6%),0_32px_64px_-24px_rgb(0_0_0/60%)]";

function Stage({ node, url, downloadUrl }: { node: Node; url: string; downloadUrl: string }) {
  const kind = fileKind(node);
  if (!canPreview(node)) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <FileMark node={node} size={48} />
        <div className="text-lg font-medium">No preview for this file</div>
        <Button asChild variant="secondary">
          <a href={downloadUrl} download>
            <Download />
            Download {formatBytes(node.size)}
          </a>
        </Button>
      </div>
    );
  }
  if (kind === "image") return <img src={url} alt={node.name} className={`${MEDIA} object-contain`} />;
  if (kind === "video") return <video src={url} controls autoPlay className={`${MEDIA} bg-black`} />;
  if (kind === "audio")
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <FileMark node={node} size={48} />
        <audio src={url} controls autoPlay className="w-full" />
      </div>
    );
  if (kind === "pdf") return <iframe src={url} title={node.name} className="h-full w-full max-w-5xl rounded-[20px] bg-white" />;
  return <TextStage url={url} size={node.size} />;
}

function TextStage({ url, size }: { url: string; size: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const headers: HeadersInit = size > TEXT_LIMIT ? { Range: `bytes=0-${TEXT_LIMIT - 1}` } : {};
    fetch(url, { headers, signal: ctrl.signal, credentials: "same-origin" })
      .then((r) => r.text())
      .then(setText)
      .catch(() => {});
    return () => ctrl.abort();
  }, [url, size]);
  return (
    <pre className="h-full w-full max-w-4xl overflow-auto rounded-[20px] bg-white p-8 font-mono text-[13px] leading-5 whitespace-pre-wrap text-foreground">
      {text ?? "Loading…"}
      {text !== null && size > TEXT_LIMIT && "\n\n… (first 512 KB shown)"}
    </pre>
  );
}
