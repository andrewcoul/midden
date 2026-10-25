import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUp, Download, Ellipsis, LayoutGrid, Link2, List, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyFolder, FileList, type View } from "@/components/file-list";
import { FileMark } from "@/components/file-mark";
import { ItemMenuContent, useItemActions } from "@/components/item-actions";
import { PillTabs } from "@/components/pill-tabs";
import { Preview } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { filesFromDrop, filesFromInput, useUploads } from "@/hooks/use-uploads";
import { useView } from "@/hooks/use-view";
import { api, ownerContentUrl } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { Node } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FolderView({ folderId, fileId }: { folderId: string; fileId?: string }) {
  const navigate = useNavigate();
  const actions = useItemActions();
  const uploads = useUploads();
  const [view, setView] = useView();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const q = useQuery({ queryKey: ["folder", folderId], queryFn: () => api.folder(folderId) });
  const data = q.data;
  const files = useMemo(() => data?.children.filter((c) => c.kind === "file") ?? [], [data]);
  const previewIndex = fileId ? files.findIndex((f) => f.id === fileId) : -1;
  const pending = uploads.items.filter((u) => u.parentId === folderId && (u.status === "uploading" || u.status === "queued" || u.status === "error"));

  const open = (node: Node) =>
    node.kind === "folder"
      ? navigate({ to: "/f/$folderId", params: { folderId: node.id } })
      : navigate({ to: ".", search: { file: node.id }, replace: !!fileId });
  const closePreview = () => navigate({ to: ".", search: {}, replace: true });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const count = data?.children.length ?? 0;
  const isRoot = folderId === "root";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        uploads.add(await filesFromDrop(e.dataTransfer), folderId);
      }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 pr-4 pl-6 shadow-[inset_0_-1px_0_var(--border)]">
        <FileMark kind="folder" size={24} />
        <nav className="flex min-w-0 flex-1 items-center gap-2 text-[15px]">
          {data?.path.map((p, i) => {
            const last = i === data.path.length - 1;
            return (
              <span key={p.id} className="flex min-w-0 items-center gap-2">
                {i > 0 && <span className="text-subtle">/</span>}
                {last ? (
                  <span className="truncate font-medium">{p.name}</span>
                ) : (
                  <Link
                    to={p.id === "root" ? "/" : "/f/$folderId"}
                    params={p.id === "root" ? undefined : { folderId: p.id }}
                    className="truncate text-muted-foreground hover:text-foreground"
                  >
                    {p.name}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
        <PillTabs
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: <List className="size-4" />, title: "List" },
            { value: "grid", label: <LayoutGrid className="size-4" />, title: "Grid" },
          ]}
        />
        {!isRoot && data && (
          <>
            <Button variant="secondary" size="sm" onClick={() => actions.share(data.folder)}>
              <Link2 /> Share
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Folder actions">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <ItemMenuContent node={data.folder} />
            </DropdownMenu>
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-10 pb-32 sm:px-12">
          <div className="flex flex-col gap-2 px-3">
            <h1 className="text-[40px] leading-[48px] font-medium tracking-[-0.04em]">{data?.folder.name ?? " "}</h1>
            <p className="text-[15px] text-muted-foreground">
              {data
                ? [
                    `${count} item${count === 1 ? "" : "s"}`,
                    totalBytes > 0 && formatBytes(totalBytes),
                    data.folder.shared && "anyone with the link can view",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : " "}
            </p>
          </div>

          {q.isError ? (
            <p className="px-3 text-muted-foreground">{(q.error as Error).message}</p>
          ) : data && count === 0 && pending.length === 0 ? (
            <EmptyFolder>
              <p className="text-lg font-medium">This folder is empty</p>
              <p className="text-[15px] text-muted-foreground">Drop files here, or use the box below.</p>
            </EmptyFolder>
          ) : (
            <FileList
              items={data?.children ?? []}
              view={view}
              uploads={pending}
              contentUrl={ownerContentUrl}
              onOpen={open}
              actions={(node) => <RowActions node={node} />}
            />
          )}
        </div>
      </div>

      <Composer folderId={folderId} folderName={data?.folder.name ?? "My Drive"} />

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-2xl bg-background/80 shadow-[inset_0_0_0_2px_#0a0a0a] backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3">
            <div className="ink inline-flex size-12 items-center justify-center rounded-full text-white">
              <ArrowUp className="size-5" />
            </div>
            <p className="text-lg font-medium">Drop to upload to {data?.folder.name ?? "this folder"}</p>
          </div>
        </div>
      )}

      {previewIndex >= 0 && (
        <Preview
          items={files}
          index={previewIndex}
          contentUrl={ownerContentUrl}
          folderName={data?.folder.name}
          onIndex={(i) => navigate({ to: ".", search: { file: files[i].id }, replace: true })}
          onClose={closePreview}
          onShare={actions.share}
        />
      )}
    </div>
  );
}

function RowActions({ node }: { node: Node }) {
  const actions = useItemActions();
  const btn =
    "inline-flex size-8 items-center justify-center rounded-full bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%)] hover:bg-accent";
  return (
    <>
      {node.kind === "file" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="Download" className={btn} onClick={() => actions.download(node)}>
              <Download className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Download</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Share link" className={btn} onClick={() => actions.share(node)}>
            <Link2 className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Share link</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="More actions" className={cn(btn, "data-[state=open]:bg-accent")}>
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <ItemMenuContent node={node} />
      </DropdownMenu>
    </>
  );
}

const URL_RE = /^https?:\/\/\S+$/i;

/** The pill at the bottom: pick files, paste a link to import, or type a name for a new folder. */
function Composer({ folderId, folderName }: { folderId: string; folderName: string }) {
  const qc = useQueryClient();
  const uploads = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const isUrl = URL_RE.test(text.trim());

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName)) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) {
      input.current?.click();
      return;
    }
    setBusy(true);
    try {
      if (URL_RE.test(value)) {
        const node = await api.importUrl(folderId, value);
        toast.success(`Saved ${node.name}`);
      } else {
        const node = await api.createFolder(folderId, value);
        toast.success(`Created folder ${node.name}`);
      }
      setText("");
      qc.invalidateQueries({ queryKey: ["folder", folderId] });
      qc.invalidateQueries({ queryKey: ["recent"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="absolute inset-x-6 bottom-6 mx-auto flex h-14 max-w-4xl items-center gap-3 rounded-full bg-background px-2 shadow-[0_0_0_1px_rgb(0_0_0/7%),0_4px_12px_-6px_rgb(0_0_0/10%)] sm:inset-x-12"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Upload files"
            onClick={() => input.current?.click()}
            className="stone inline-flex size-10 shrink-0 items-center justify-center rounded-full"
          >
            <Plus className="size-[18px]" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Upload files</TooltipContent>
      </Tooltip>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Drop files, paste a link, or name a new folder in ${folderName}`}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="submit"
            disabled={busy}
            aria-label={!text.trim() ? "Upload files" : isUrl ? "Save link" : "Create folder"}
            className="ink inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60"
          >
            <ArrowUp className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{!text.trim() ? "Upload files" : isUrl ? "Save link here" : "Create folder"}</TooltipContent>
      </Tooltip>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          uploads.add(filesFromInput(e.target.files), folderId);
          e.target.value = "";
        }}
      />
    </form>
  );
}
