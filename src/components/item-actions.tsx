import { useQueryClient } from "@tanstack/react-query";
import { Download, FolderInput, Link2, Pencil, Trash2 } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoveDialog } from "@/components/move-dialog";
import { PromptDialog } from "@/components/prompt-dialog";
import { ShareDialog } from "@/components/share-dialog";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { api, ownerContentUrl } from "@/lib/api";
import type { Node } from "@/lib/types";

interface Actions {
  share: (node: Node) => void;
  rename: (node: Node) => void;
  move: (node: Node) => void;
  trash: (node: Node) => void;
  download: (node: Node) => void;
  newFolder: (parentId: string) => void;
  /** Asks for a URL and saves that file in the folder. */
  saveLink: (parentId: string) => void;
}

const ActionsContext = createContext<Actions | null>(null);

export function ItemActionsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [sharing, setSharing] = useState<Node | null>(null);
  const [renaming, setRenaming] = useState<Node | null>(null);
  const [moving, setMoving] = useState<Node | null>(null);
  const [newIn, setNewIn] = useState<string | null>(null);
  const [linkIn, setLinkIn] = useState<string | null>(null);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["folder"] });
    qc.invalidateQueries({ queryKey: ["recent"] });
    qc.invalidateQueries({ queryKey: ["search"] });
  }, [qc]);

  const trash = useCallback(
    async (node: Node) => {
      try {
        await api.trash(node.id);
        refresh();
        qc.invalidateQueries({ queryKey: ["trash"] });
        toast(`Moved ${node.name} to trash`, {
          action: {
            label: "Undo",
            onClick: async () => {
              await api.restore(node.id);
              refresh();
              qc.invalidateQueries({ queryKey: ["trash"] });
            },
          },
        });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [qc, refresh],
  );

  const value = useMemo<Actions>(
    () => ({
      share: setSharing,
      rename: setRenaming,
      move: setMoving,
      trash,
      download: (node) => {
        const a = document.createElement("a");
        a.href = ownerContentUrl(node, true);
        a.download = node.name;
        a.click();
      },
      newFolder: setNewIn,
      saveLink: setLinkIn,
    }),
    [trash],
  );

  return (
    <ActionsContext.Provider value={value}>
      {children}
      <ShareDialog node={sharing} onClose={() => setSharing(null)} />
      <PromptDialog
        open={!!renaming}
        title="Rename"
        confirm="Rename"
        initial={renaming?.name}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          try {
            await api.update(renaming!.id, { name });
            refresh();
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
      <PromptDialog
        open={!!newIn}
        title="New folder"
        confirm="Create"
        initial="Untitled folder"
        onClose={() => setNewIn(null)}
        onSubmit={async (name) => {
          await api.createFolder(newIn!, name);
          qc.invalidateQueries({ queryKey: ["folder", newIn] });
        }}
      />
      <PromptDialog
        open={!!linkIn}
        title="Save from link"
        confirm="Save"
        placeholder="https://example.com/photo.jpg"
        onClose={() => setLinkIn(null)}
        onSubmit={async (url) => {
          try {
            const node = await api.importUrl(linkIn!, url);
            toast.success(`Saved ${node.name}`);
            qc.invalidateQueries({ queryKey: ["folder", linkIn] });
            qc.invalidateQueries({ queryKey: ["recent"] });
            qc.invalidateQueries({ queryKey: ["usage"] });
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
      <MoveDialog
        node={moving}
        onClose={() => setMoving(null)}
        onMove={async (node, folderId) => {
          try {
            await api.update(node.id, { parentId: folderId });
            refresh();
            toast(`Moved ${node.name}`);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </ActionsContext.Provider>
  );
}

export function useItemActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useItemActions needs ItemActionsProvider");
  return ctx;
}

/** Menu content for one file or folder. Wrap it in a DropdownMenu. */
export function ItemMenuContent({ node }: { node: Node }) {
  const a = useItemActions();
  return (
    <DropdownMenuContent align="end" className="w-52">
      {node.kind === "file" && (
        <DropdownMenuItem onSelect={() => a.download(node)}>
          <Download /> Download
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => a.share(node)}>
        <Link2 /> Share link
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => a.rename(node)}>
        <Pencil /> Rename
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => a.move(node)}>
        <FolderInput /> Move
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => a.trash(node)}>
        <Trash2 /> Move to trash
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
