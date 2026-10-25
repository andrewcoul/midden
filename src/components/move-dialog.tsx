import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { FileMark } from "@/components/file-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { Node } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Browse folders and pick where to move an item. */
export function MoveDialog({
  node,
  onMove,
  onClose,
}: {
  node: Node | null;
  onMove: (node: Node, folderId: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [at, setAt] = useState("root");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (node) setAt(node.parentId ?? "root");
  }, [node]);
  const folder = useQuery({ queryKey: ["folder", at], queryFn: () => api.folder(at), enabled: !!node });
  const folders = folder.data?.children.filter((c) => c.kind === "folder") ?? [];
  const here = at === node?.parentId;
  const inside = !!folder.data?.path.some((p) => p.id === node?.id);

  return (
    <Dialog open={!!node} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="truncate">Move {node?.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1">
            {folder.data?.path.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-subtle">/</span>}
                <button type="button" className="hover:text-foreground" onClick={() => setAt(p.id)}>
                  {p.name}
                </button>
              </span>
            ))}
          </DialogDescription>
        </div>
        <div className="-mx-2 flex max-h-80 min-h-40 flex-col overflow-y-auto">
          {folders.length === 0 && !folder.isLoading && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No folders here</p>
          )}
          {folders.map((f) => {
            const self = f.id === node?.id;
            return (
              <button
                key={f.id}
                type="button"
                disabled={self}
                onClick={() => setAt(f.id)}
                className={cn(
                  "flex h-14 items-center gap-3 rounded-xl px-2 text-left hover:bg-accent disabled:opacity-40",
                )}
              >
                <FileMark kind="folder" size={32} />
                <span className="flex-1 truncate text-[15px] font-medium">{f.name}</span>
                <ChevronRight className="size-4 text-subtle" />
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || here || inside || !node}
            onClick={async () => {
              if (!node) return;
              setBusy(true);
              try {
                await onMove(node, at);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
