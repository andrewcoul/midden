import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUp, Ellipsis, Link2, PanelRightOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NewMenu } from "@/components/app-shell";
import { DetailsPanel } from "@/components/details-panel";
import { EmptyFolder, FileList } from "@/components/file-list";
import { FileMark } from "@/components/file-mark";
import { ItemMenuContent, useItemActions } from "@/components/item-actions";
import { Preview } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { filesFromDrop, useUploads } from "@/hooks/use-uploads";
import { api, ownerContentUrl } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { Node } from "@/lib/types";

/** Shows or hides the details panel on wide screens, remembered in this browser. */
function usePanelOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (localStorage.getItem("midden:panel") === "closed") setOpen(false);
  }, []);
  return [
    open,
    (next) => {
      setOpen(next);
      localStorage.setItem("midden:panel", next ? "open" : "closed");
    },
  ];
}

export function FolderView({ folderId, selectedId, fileId }: { folderId: string; selectedId?: string; fileId?: string }) {
  const navigate = useNavigate();
  const actions = useItemActions();
  const uploads = useUploads();
  const [panelOpen, setPanelOpen] = usePanelOpen();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const q = useQuery({ queryKey: ["folder", folderId], queryFn: () => api.folder(folderId) });
  const data = q.data;
  const files = useMemo(() => data?.children.filter((c) => c.kind === "file") ?? [], [data]);
  const selected = selectedId ? data?.children.find((c) => c.id === selectedId) : undefined;
  const previewIndex = fileId ? files.findIndex((f) => f.id === fileId) : -1;
  const pending = uploads.items.filter((u) => u.parentId === folderId && (u.status === "uploading" || u.status === "queued" || u.status === "error"));

  const select = (node: Node | null) =>
    navigate({ to: ".", search: node ? { sel: node.id } : {}, replace: true });
  const open = (node: Node) =>
    node.kind === "folder"
      ? navigate({ to: "/f/$folderId", params: { folderId: node.id } })
      : navigate({ to: ".", search: { sel: node.id, file: node.id } });
  const closePreview = () => navigate({ to: ".", search: selectedId ? { sel: selectedId } : {}, replace: true });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const count = data?.children.length ?? 0;
  const isRoot = folderId === "root";
  const names = data?.path.map((p) => p.name) ?? [];
  const panelNode = selected ?? data?.folder;

  return (
    <div className="flex min-h-0 flex-1">
      <div
        className="relative flex min-w-0 flex-1 flex-col"
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
          {/* The sidebar, and its New button, are hidden on small screens. */}
          <NewMenu align="end">
            <Button size="icon-sm" aria-label="New" className="md:hidden">
              <Plus />
            </Button>
          </NewMenu>
          {!panelOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Show panel" className="hidden lg:inline-flex" onClick={() => setPanelOpen(true)}>
                  <PanelRightOpen strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show panel</TooltipContent>
            </Tooltip>
          )}
        </header>

        {/* A click on empty space clears the selection. */}
        <div className="min-h-0 flex-1 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && select(null)}>
          <div
            className="flex w-full flex-col gap-6 px-4 pt-8 pb-16 sm:px-8"
            onClick={(e) => e.target === e.currentTarget && select(null)}
          >
            <div className="flex flex-col gap-2 px-3">
              <h1 className="text-[32px] leading-10 font-medium tracking-[-0.035em]">{data?.folder.name ?? " "}</h1>
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
                <p className="text-[15px] text-muted-foreground">Drop files here, or use New.</p>
              </EmptyFolder>
            ) : (
              <FileList
                items={data?.children ?? []}
                uploads={pending}
                selectedId={selected?.id}
                onSelect={select}
                onOpen={open}
              />
            )}
          </div>
        </div>

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
      </div>

      {panelNode && panelOpen && (
        <DetailsPanel
          className="hidden lg:flex"
          node={panelNode}
          isOpenFolder={!selected}
          location={selected ? names.join(" / ") : names.slice(0, -1).join(" / ") || null}
          overlay={false}
          onOpen={open}
          onClose={() => setPanelOpen(false)}
        />
      )}
      {selected && (
        <DetailsPanel
          node={selected}
          isOpenFolder={false}
          location={names.join(" / ")}
          overlay
          onOpen={open}
          onClose={() => select(null)}
        />
      )}

      {previewIndex >= 0 && (
        <Preview
          items={files}
          index={previewIndex}
          contentUrl={ownerContentUrl}
          folderName={data?.folder.name}
          onIndex={(i) => navigate({ to: ".", search: { sel: files[i].id, file: files[i].id }, replace: true })}
          onClose={closePreview}
          onShare={actions.share}
        />
      )}
    </div>
  );
}
