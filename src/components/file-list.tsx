import type { ReactNode } from "react";
import { FileMark } from "@/components/file-mark";
import { Mascot } from "@/components/squirrel";
import type { UploadItem } from "@/hooks/use-uploads";
import type { ContentUrl } from "@/lib/api";
import { fileKind, formatBytes, formatDate, KIND_LABEL } from "@/lib/format";
import type { Node } from "@/lib/types";
import { cn } from "@/lib/utils";

export type View = "list" | "grid";

export function describe(node: Node) {
  const kind = fileKind(node);
  if (node.kind === "folder") {
    const n = node.childCount ?? 0;
    return [`Folder · ${n} item${n === 1 ? "" : "s"}`, node.shared && "shared"].filter(Boolean).join(" · ");
  }
  return [KIND_LABEL[kind], formatBytes(node.size), node.shared && "shared"].filter(Boolean).join(" · ");
}

export function FileList({
  items,
  view,
  uploads = [],
  contentUrl,
  onOpen,
  actions,
  meta,
}: {
  items: Node[];
  view: View;
  uploads?: UploadItem[];
  contentUrl: ContentUrl;
  onOpen: (node: Node) => void;
  /** Buttons that show on hover, e.g. download / share / menu. */
  actions?: (node: Node) => ReactNode;
  /** Second line under the name. Defaults to type and size. */
  meta?: (node: Node) => ReactNode;
}) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
        {items.map((node) => (
          <GridCard key={node.id} node={node} contentUrl={contentUrl} onOpen={onOpen} actions={actions?.(node)} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {uploads.map((u) => (
        <UploadRow key={u.id} item={u} />
      ))}
      {items.map((node) => (
        <div
          key={node.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(node)}
          onKeyDown={(e) => e.key === "Enter" && onOpen(node)}
          className="group/row flex h-16 cursor-default items-center gap-4 rounded-xl px-3 outline-none hover:bg-accent focus-visible:bg-accent has-[[data-state=open]]:bg-accent"
        >
          <FileMark node={node} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] leading-6 font-medium">{node.name}</span>
            <span className="truncate text-[13px] leading-4 text-muted-foreground">{meta ? meta(node) : describe(node)}</span>
          </div>
          <span className="w-28 shrink-0 text-right text-[13px] text-subtle group-hover/row:hidden group-focus-visible/row:hidden group-has-[[data-state=open]]/row:hidden">
            {formatDate(node.updatedAt)}
          </span>
          {actions && (
            <div
              className="hidden shrink-0 items-center gap-1 group-hover/row:flex group-focus-visible/row:flex group-has-[[data-state=open]]/row:flex"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions(node)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GridCard({
  node,
  contentUrl,
  onOpen,
  actions,
}: {
  node: Node;
  contentUrl: ContentUrl;
  onOpen: (node: Node) => void;
  actions?: ReactNode;
}) {
  const image = fileKind(node) === "image";
  return (
    <div className="group/card relative flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onOpen(node)}
        className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-app shadow-[inset_0_0_0_1px_rgb(0_0_0/6%)] outline-none transition-shadow hover:shadow-[inset_0_0_0_1px_rgb(0_0_0/6%),0_12px_24px_-12px_rgb(0_0_0/30%)] focus-visible:ring-2 focus-visible:ring-ring/20"
      >
        {image ? (
          <img src={contentUrl(node)} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <FileMark node={node} size={48} />
        )}
      </button>
      {actions && (
        <div className="absolute top-3 right-3 hidden gap-1 group-hover/card:flex has-[[data-state=open]]:flex">{actions}</div>
      )}
      <div className="flex min-w-0 flex-col px-1">
        <span className="truncate text-[15px] leading-6 font-medium">{node.name}</span>
        <span className="truncate text-[13px] leading-4 text-muted-foreground">
          {node.kind === "folder" ? describe(node) : formatBytes(node.size)}
        </span>
      </div>
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const pct = item.size ? Math.round((item.loaded / item.size) * 100) : 100;
  const failed = item.status === "error";
  return (
    <div className="flex h-16 items-center gap-4 rounded-xl px-3">
      <FileMark node={{ kind: "file", mime: item.mime, name: item.name }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[15px] leading-6 font-medium">{item.name}</span>
        <div className="h-1 w-60 max-w-full rounded-full bg-muted">
          <div
            className={cn("h-1 rounded-full transition-[width]", failed ? "bg-destructive" : "bg-foreground")}
            style={{ width: `${failed ? 100 : pct}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-xs font-medium",
          failed ? "bg-[#fdecea] text-destructive" : "bg-[#fdf1e7] text-[#a4471a]",
        )}
      >
        <span className={cn("size-1.5 rounded-full", failed ? "bg-destructive" : "bg-mark-video")} />
        {failed ? "Failed" : item.status === "queued" ? "Waiting" : `Uploading · ${pct}%`}
      </span>
    </div>
  );
}

export function EmptyFolder({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <Mascot size={96} className="mb-2" />
      {children}
    </div>
  );
}
