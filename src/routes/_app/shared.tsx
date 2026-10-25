import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Link2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyFolder } from "@/components/file-list";
import { FileMark } from "@/components/file-mark";
import { Page } from "@/components/page";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, shareUrl } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/shared")({ component: SharedPage });

function SharedPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["shares"], queryFn: api.listShares });
  const remove = useMutation({
    mutationFn: api.deleteShare,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      qc.invalidateQueries({ queryKey: ["folder"] });
      toast("Link removed");
    },
  });
  const items = q.data?.items ?? [];
  const btn = "inline-flex size-8 items-center justify-center rounded-full bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%)] hover:bg-accent";

  return (
    <Page
      icon={<Link2 className="size-[18px]" />}
      crumb="Shared links"
      title="Shared links"
      subtitle={q.data ? `${items.length} active link${items.length === 1 ? "" : "s"}` : " "}
    >
      {q.data && items.length === 0 ? (
        <EmptyFolder>
          <p className="text-lg font-medium">No shared links</p>
          <p className="text-[15px] text-muted-foreground">Share a file or folder to get a link you can send.</p>
        </EmptyFolder>
      ) : (
        <div className="flex flex-col">
          {items.map((s) => {
            const expired = s.expiresAt !== null && s.expiresAt < Date.now();
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  s.kind === "folder"
                    ? navigate({ to: "/f/$folderId", params: { folderId: s.nodeId } })
                    : navigate({ to: "/f/$folderId", params: { folderId: s.parentId ?? "root" }, search: { file: s.nodeId } })
                }
                className="group/row flex h-16 items-center gap-4 rounded-xl px-3 hover:bg-accent"
              >
                <FileMark node={{ kind: s.kind, mime: s.mime, name: s.name }} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] leading-6 font-medium">{s.name}</span>
                  <span className="flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                    {s.hasPassword && <Lock className="size-3" />}
                    {[
                      s.hasPassword && "Password",
                      s.trashed ? "In trash" : expired ? "Expired" : s.expiresAt ? `Expires ${formatDate(s.expiresAt)}` : "Never expires",
                      `${s.downloads} download${s.downloads === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Copy link"
                        className={btn}
                        onClick={async () => {
                          await navigator.clipboard.writeText(shareUrl(s.id));
                          toast.success("Link copied");
                        }}
                      >
                        <Copy className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Copy link</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Remove link" className={btn} onClick={() => remove.mutate(s.id)}>
                        <Trash2 className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove link</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
