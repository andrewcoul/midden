import { Download, Ellipsis, FolderOpen, Link2, PanelRightClose, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { describe } from "@/components/file-list";
import { FileMark } from "@/components/file-mark";
import { ItemMenuContent, useItemActions } from "@/components/item-actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ownerContentUrl } from "@/lib/api";
import { canPreview, fileKind } from "@/lib/format";
import type { Node } from "@/lib/types";
import { cn } from "@/lib/utils";

const TEXT_PEEK = 4 * 1024;

const longDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The right panel: a preview and the details of the selected item. With no selection, it shows the
 * open folder. On small screens it is an overlay that shows only when an item is selected.
 */
export function DetailsPanel({
  node,
  location,
  isOpenFolder,
  overlay,
  onOpen,
  onClose,
  className,
}: {
  className?: string;
  node: Node;
  /** The folder path that holds the node, e.g. "My Drive / Family". */
  location: string | null;
  /** True when the node is the folder on screen, not a selected item. */
  isOpenFolder: boolean;
  /** Small screens: show as a sheet over the list. */
  overlay: boolean;
  onOpen: (node: Node) => void;
  onClose: () => void;
}) {
  const actions = useItemActions();
  const isRoot = node.id === "root";

  return (
    <>
      {overlay && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        aria-label="Details"
        className={cn(
          "flex w-[376px] shrink-0 flex-col bg-app shadow-[inset_1px_0_0_var(--border)]",
          overlay &&
            "fixed inset-y-3 right-3 z-40 w-[min(376px,calc(100vw-24px))] rounded-[20px] shadow-[0_0_0_1px_rgb(0_0_0/6%),0_24px_48px_-16px_rgb(0_0_0/30%)] lg:hidden",
          className,
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 pr-3 pl-6 shadow-[inset_0_-1px_0_var(--border)]">
          <span className="flex-1 text-[15px] font-medium">{isOpenFolder ? "This folder" : "Preview"}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={overlay ? "Close" : "Hide panel"}
                onClick={onClose}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {overlay ? <X className="size-[18px]" /> : <PanelRightClose className="size-[18px]" strokeWidth={1.75} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{overlay ? "Close" : "Hide panel"}</TooltipContent>
          </Tooltip>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <Media key={node.id} node={node} onOpen={() => onOpen(node)} />

          <div className="flex flex-col gap-1">
            <h2 className="text-xl leading-7 font-semibold tracking-[-0.025em] [overflow-wrap:anywhere]">{node.name}</h2>
            <p className="text-sm text-muted-foreground">{describe(node)}</p>
          </div>

          {!isRoot && (
            <div className="flex items-center gap-2">
              {node.kind === "file" ? (
                <Button className="flex-1" onClick={() => actions.download(node)}>
                  <Download /> Download
                </Button>
              ) : (
                !isOpenFolder && (
                  <Button className="flex-1" onClick={() => onOpen(node)}>
                    <FolderOpen /> Open
                  </Button>
                )
              )}
              <Button variant="secondary" className="flex-1" onClick={() => actions.share(node)}>
                <Link2 /> Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%)] hover:bg-accent data-[state=open]:bg-accent"
                  >
                    <Ellipsis className="size-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <ItemMenuContent node={node} />
              </DropdownMenu>
            </div>
          )}

          <dl className="flex flex-col pt-4 shadow-[inset_0_1px_0_var(--border)]">
            {location && <Detail label="Location">{location}</Detail>}
            {node.kind === "folder" && <Detail label="Items">{(node.childCount ?? 0).toLocaleString()}</Detail>}
            {!isRoot && <Detail label="Modified">{longDate(node.updatedAt)}</Detail>}
            {!isRoot && <Detail label="Added">{longDate(node.createdAt)}</Detail>}
            {!isRoot && (
              <Detail label="Sharing">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", node.shared ? "bg-mark-document" : "bg-subtle")} />
                  {node.shared ? "Anyone with the link" : "Only you"}
                </span>
              </Detail>
            )}
          </dl>
        </div>
      </aside>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-2 text-sm">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const BOX = "flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-[inset_0_0_0_1px_rgb(0_0_0/6%)]";

/** The preview box. A click on a file that can show full screen opens it. */
function Media({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const kind = fileKind(node);
  const url = ownerContentUrl(node);
  const open = (child: ReactNode, label = `Open ${node.name}`) => (
    <button type="button" aria-label={label} onClick={onOpen} className={cn(BOX, "cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring/20")}>
      {child}
    </button>
  );

  if (node.kind === "folder") return <div className={BOX}><FileMark node={node} size={48} /></div>;
  if (!canPreview(node)) return <div className={BOX}><FileMark node={node} size={48} /></div>;
  if (kind === "image") return open(<img src={url} alt="" className="size-full object-cover" />);
  if (kind === "video") return <video src={url} controls preload="metadata" className={cn(BOX, "bg-black object-contain")} />;
  if (kind === "audio")
    return (
      <div className={cn(BOX, "flex-col gap-6 px-6")}>
        <FileMark node={node} size={48} />
        <audio src={url} controls preload="none" className="w-full" />
      </div>
    );
  if (kind === "pdf") return open(<FileMark node={node} size={48} />);
  return open(<TextPeek url={url} />);
}

function TextPeek({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(url, { headers: { Range: `bytes=0-${TEXT_PEEK - 1}` }, signal: ctrl.signal, credentials: "same-origin" })
      .then((r) => r.text())
      .then(setText)
      .catch(() => {});
    return () => ctrl.abort();
  }, [url]);
  return (
    <pre className="size-full overflow-hidden p-4 text-left font-mono text-[11px] leading-4 whitespace-pre-wrap text-muted-foreground [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
      {text ?? ""}
    </pre>
  );
}
