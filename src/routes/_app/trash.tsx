import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { describe, EmptyFolder } from "@/components/file-list";
import { FileMark } from "@/components/file-mark";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Node } from "@/lib/types";

export const Route = createFileRoute("/_app/trash")({ component: TrashPage });

function TrashPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["trash"], queryFn: api.listTrash });
  const [confirm, setConfirm] = useState<Node | "all" | null>(null);
  const items = q.data?.items ?? [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["trash"] });
    qc.invalidateQueries({ queryKey: ["folder"] });
    qc.invalidateQueries({ queryKey: ["usage"] });
    qc.invalidateQueries({ queryKey: ["recent"] });
  };
  const btn = "inline-flex size-8 items-center justify-center rounded-full bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%)] hover:bg-accent";

  return (
    <Page
      icon={<Trash2 className="size-[18px]" />}
      crumb="Trash"
      title="Trash"
      subtitle={q.data ? `${items.length} item${items.length === 1 ? "" : "s"} · deleting here is permanent` : " "}
      actions={
        items.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setConfirm("all")}>
            Empty trash
          </Button>
        )
      }
    >
      {q.data && items.length === 0 ? (
        <EmptyFolder>
          <p className="text-lg font-medium">Trash is empty</p>
          <p className="text-[15px] text-muted-foreground">Items you delete stay here until you remove them for good.</p>
        </EmptyFolder>
      ) : (
        <div className="flex flex-col">
          {items.map((n) => (
            <div key={n.id} className="group/row flex h-16 items-center gap-4 rounded-xl px-3 hover:bg-accent">
              <FileMark node={n} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-6 font-medium">{n.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {describe(n)} · deleted {formatDate(n.trashedAt ?? n.updatedAt)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Restore"
                      className={btn}
                      onClick={async () => {
                        await api.restore(n.id);
                        refresh();
                        toast(`Restored ${n.name}`);
                      }}
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Restore</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Delete forever" className={btn} onClick={() => setConfirm(n)}>
                      <Trash2 className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete forever</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "all" ? "Empty trash?" : `Delete ${confirm?.name ?? ""} forever?`}
        description={
          confirm === "all"
            ? `All ${items.length} items in the trash will be deleted. You cannot undo this.`
            : "This item will be deleted. You cannot undo this."
        }
        confirm="Delete forever"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const target = confirm;
          setConfirm(null);
          if (target === "all") await api.emptyTrash();
          else if (target) await api.deleteForever(target.id);
          refresh();
        }}
      />
    </Page>
  );
}
