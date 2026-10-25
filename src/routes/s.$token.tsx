import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Eye, LayoutGrid, List, Lock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Logo } from "@/components/squirrel";
import { describe, EmptyFolder, FileList } from "@/components/file-list";
import { FileMark } from "@/components/file-mark";
import { PillTabs } from "@/components/pill-tabs";
import { Preview } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useView } from "@/hooks/use-view";
import { api, shareContentUrl } from "@/lib/api";
import { canPreview, formatDate } from "@/lib/format";
import type { Node, PublicShare } from "@/lib/types";

export const Route = createFileRoute("/s/$token")({
  validateSearch: (s: Record<string, unknown>): { f?: string; file?: string } => ({
    ...(typeof s.f === "string" ? { f: s.f } : {}),
    ...(typeof s.file === "string" ? { file: s.file } : {}),
  }),
  head: () => ({ meta: [{ title: "Shared with you · midden" }] }),
  component: SharedPage,
});

function SharedPage() {
  const { token } = Route.useParams();
  const share = useQuery({ queryKey: ["public", token], queryFn: () => api.publicShare(token), retry: false });

  if (share.isPending) return <div className="satin min-h-dvh" />;
  if (share.isError)
    return (
      <Shell>
        <Center>
          <p className="text-lg font-medium">{(share.error as Error).message}</p>
          <p className="text-[15px] text-muted-foreground">Ask the person who sent it for a new link.</p>
        </Center>
      </Shell>
    );
  if (share.data.locked) return <Unlock token={token} />;
  return (
    <Shell expires={share.data.expiresAt} kind={share.data.root!.kind}>
      {share.data.root!.kind === "file" ? <SharedFile token={token} node={share.data.root!} /> : <SharedFolder token={token} share={share.data} />}
    </Shell>
  );
}

function Shell({ children, expires, kind }: { children: ReactNode; expires?: number | null; kind?: string }) {
  return (
    <div className="satin flex h-dvh p-3 sm:p-6">
      <div className="window flex min-w-0 flex-1 flex-col overflow-hidden rounded-[20px]">
        <header className="flex h-14 shrink-0 items-center gap-3 px-6 shadow-[inset_0_-1px_0_var(--border)]">
          <Logo size={28} />
          <span className="text-base font-semibold tracking-[-0.03em]">midden</span>
          <span className="flex-1 truncate text-sm text-muted-foreground">
            {kind ? `· a ${kind} was shared with you` : ""}
          </span>
          {expires ? <span className="text-[13px] text-subtle">Link expires {formatDate(expires)}</span> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">{children}</div>;
}

function Unlock({ token }: { token: string }) {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="satin flex min-h-dvh items-center justify-center p-6">
      <form
        className="window flex w-full max-w-[400px] flex-col items-center gap-8 rounded-3xl px-8 pt-10 pb-8"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.unlockShare(token, password);
            qc.invalidateQueries({ queryKey: ["public", token] });
          } catch (err) {
            setError((err as Error).message);
            setPassword("");
          }
        }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="ink inline-flex size-14 items-center justify-center rounded-full text-white">
            <Lock className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] leading-9 font-medium tracking-[-0.035em]">This link is protected</h1>
            <p className="text-[15px] text-muted-foreground">Enter the password you were given.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Input type="password" autoFocus aria-label="Password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="px-1 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={!password}>
            Open
          </Button>
        </div>
      </form>
    </div>
  );
}

function SharedFile({ token, node }: { token: string; node: Node }) {
  const url = shareContentUrl(token);
  const [open, setOpen] = useState(false);
  return (
    <Center>
      <FileMark node={node} size={48} />
      <p className="mt-2 max-w-full truncate text-2xl font-medium tracking-[-0.03em]">{node.name}</p>
      <p className="text-[15px] text-muted-foreground">{describe(node)}</p>
      <div className="mt-6 flex gap-2">
        {canPreview(node) && (
          <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
            <Eye /> Preview
          </Button>
        )}
        <Button asChild size="lg">
          <a href={url(node, true)} download>
            <Download /> Download
          </a>
        </Button>
      </div>
      {open && <Preview items={[node]} index={0} contentUrl={url} onIndex={() => {}} onClose={() => setOpen(false)} />}
    </Center>
  );
}

function SharedFolder({ token, share }: { token: string; share: PublicShare }) {
  const navigate = useNavigate();
  const { f, file } = Route.useSearch();
  const [view, setView] = useView("midden:share-view");
  const folderId = f ?? share.root!.id;
  const q = useQuery({ queryKey: ["public", token, folderId], queryFn: () => api.publicFolder(token, folderId) });
  const data = q.data;
  const files = data?.children.filter((c) => c.kind === "file") ?? [];
  const idx = file ? files.findIndex((x) => x.id === file) : -1;
  const url = shareContentUrl(token);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-10 pb-16 sm:px-12">
        <div className="flex items-end justify-between gap-4 px-3">
          <div className="flex min-w-0 flex-col gap-2">
            {data && data.path.length > 1 && (
              <nav className="flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
                {data.path.slice(0, -1).map((p) => (
                  <span key={p.id} className="flex items-center gap-2">
                    <Link
                      to="/s/$token"
                      params={{ token }}
                      search={p.id === share.root!.id ? {} : { f: p.id }}
                      className="hover:text-foreground"
                    >
                      {p.name}
                    </Link>
                    <span className="text-subtle">/</span>
                  </span>
                ))}
              </nav>
            )}
            <h1 className="truncate text-[40px] leading-[48px] font-medium tracking-[-0.04em]">{data?.folder.name ?? " "}</h1>
            <p className="text-[15px] text-muted-foreground">
              {data ? `${data.children.length} item${data.children.length === 1 ? "" : "s"}` : " "}
            </p>
          </div>
          <PillTabs
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: <List className="size-4" />, title: "List" },
              { value: "grid", label: <LayoutGrid className="size-4" />, title: "Grid" },
            ]}
          />
        </div>
        {data && data.children.length === 0 ? (
          <EmptyFolder>
            <p className="text-lg font-medium">This folder is empty</p>
          </EmptyFolder>
        ) : (
          <FileList
            items={data?.children ?? []}
            view={view}
            contentUrl={url}
            onOpen={(n) =>
              n.kind === "folder"
                ? navigate({ to: "/s/$token", params: { token }, search: { f: n.id } })
                : navigate({ to: "/s/$token", params: { token }, search: { f, file: n.id } })
            }
            actions={(n) =>
              n.kind === "file" ? (
                <a
                  href={url(n, true)}
                  download
                  aria-label={`Download ${n.name}`}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%)] hover:bg-accent"
                >
                  <Download className="size-4" />
                </a>
              ) : null
            }
          />
        )}
      </div>
      {idx >= 0 && (
        <Preview
          items={files}
          index={idx}
          contentUrl={url}
          folderName={data?.folder.name}
          onIndex={(i) => navigate({ to: "/s/$token", params: { token }, search: { f, file: files[i].id }, replace: true })}
          onClose={() => navigate({ to: "/s/$token", params: { token }, search: f ? { f } : {}, replace: true })}
        />
      )}
    </div>
  );
}
