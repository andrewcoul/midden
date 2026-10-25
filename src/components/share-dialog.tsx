import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FileMark } from "@/components/file-mark";
import { PillTabs } from "@/components/pill-tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, shareUrl } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Node } from "@/lib/types";

const EXPIRY = [
  { value: "0", label: "Never" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

export function ShareDialog({ node, onClose }: { node: Node | null; onClose: () => void }) {
  return (
    <Dialog open={!!node} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]" showCloseButton>
        {node && <ShareBody node={node} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareBody({ node }: { node: Node }) {
  const qc = useQueryClient();
  const shares = useQuery({ queryKey: ["shares"], queryFn: api.listShares });
  const existing = shares.data?.items.filter((s) => s.nodeId === node.id) ?? [];
  const link = existing[0];

  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]["value"]>("7");
  const [copied, setCopied] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shares"] });
    qc.invalidateQueries({ queryKey: ["folder"] });
  };
  const create = useMutation({
    mutationFn: () => api.createShare(node.id, usePassword ? password : "", Number(expiry)),
    onSuccess: async (s) => {
      refresh();
      await copy(s.id);
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteShare(id),
    onSuccess: () => {
      refresh();
      toast("Link removed");
    },
  });

  async function copy(id: string) {
    await navigator.clipboard.writeText(shareUrl(id));
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <div className="flex items-center gap-4 pr-8">
        <FileMark node={node} />
        <div className="min-w-0">
          <DialogTitle className="truncate">Share {node.name}</DialogTitle>
          <DialogDescription>People with the link can view and download.</DialogDescription>
        </div>
      </div>

      {link ? (
        <>
          <div className="flex gap-2">
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-input px-4">
              <Link2 className="size-4 shrink-0 text-subtle" />
              <span className="truncate text-sm">{shareUrl(link.id).replace(/^https?:\/\//, "")}</span>
            </div>
            <Button size="lg" onClick={() => copy(link.id)}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-border rounded-2xl bg-app text-[15px]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">Password</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {link.hasPassword && <Lock className="size-3.5" />}
                {link.hasPassword ? "Required" : "Not required"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">Expires</span>
              <span className="text-muted-foreground">{link.expiresAt ? formatDate(link.expiresAt) : "Never"}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[13px] text-subtle">
                Created {formatDate(link.createdAt)} · {link.downloads} download{link.downloads === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="self-start text-sm font-medium text-destructive hover:underline"
                onClick={() => remove.mutate(link.id)}
              >
                Remove link
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border rounded-2xl bg-app">
            <div className="flex flex-col gap-3 p-4">
              <label className="flex items-center justify-between text-[15px] font-medium">
                Require a password
                <Switch checked={usePassword} onCheckedChange={setUsePassword} />
              </label>
              {usePassword && (
                <Input
                  type="password"
                  autoFocus
                  placeholder="Password for this link"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 bg-background shadow-[0_0_0_1px_rgb(0_0_0/8%)]"
                />
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[15px] font-medium">Expires</span>
              <PillTabs value={expiry} onChange={setExpiry} options={[...EXPIRY]} className="bg-[#ececeb]" />
            </div>
          </div>
          <Button
            size="lg"
            disabled={create.isPending || (usePassword && !password)}
            onClick={() => create.mutate()}
          >
            <Link2 />
            Create link
          </Button>
        </>
      )}
    </>
  );
}
