import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { FolderPlus, FolderUp, HardDrive, Link2, LogOut, Plus, Search, Trash2, Upload } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Logo } from "@/components/squirrel";
import { FileMark } from "@/components/file-mark";
import { useItemActions } from "@/components/item-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { filesFromInput, useUploads } from "@/hooks/use-uploads";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="satin flex h-dvh p-3 sm:p-6">
      <div className="window flex min-w-0 flex-1 overflow-hidden rounded-[20px]">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

/** The folder the user is in, so "New" and uploads go there. */
export function useCurrentFolderId() {
  const params = useParams({ strict: false }) as { folderId?: string };
  return params.folderId ?? "root";
}

function Sidebar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const folderId = useCurrentFolderId();
  const actions = useItemActions();
  const uploads = useUploads();
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: Infinity });

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 bg-app p-4 shadow-[inset_-1px_0_0_var(--border)] md:flex">
      <div className="flex h-10 items-center gap-2 px-2">
        <Logo size={32} />
        <span className="flex-1 text-lg font-semibold tracking-[-0.03em]">midden</span>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent data-[state=open]:bg-accent">
                <Plus className="size-[18px]" strokeWidth={1.75} />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>New</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => actions.newFolder(folderId)}>
              <FolderPlus /> New folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => filesInput.current?.click()}>
              <Upload /> Upload files
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => folderInput.current?.click()}>
              <FolderUp /> Upload folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={filesInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            uploads.add(filesFromInput(e.target.files), folderId);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            uploads.add(filesFromInput(e.target.files), folderId);
            e.target.value = "";
          }}
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
        }}
        className="flex h-10 items-center gap-2 rounded-xl bg-input px-3 focus-within:bg-background focus-within:shadow-[0_0_0_1px_#0a0a0a,0_0_0_4px_rgb(10_10_10/8%)]"
      >
        <Search className="size-4 text-subtle" />
        <input
          id="global-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
        />
        <kbd className="text-xs font-medium text-subtle">/</kbd>
      </form>

      <nav className="flex flex-col">
        <NavItem to="/" icon={HardDrive} label="My Drive" match={(p) => p === "/" || p.startsWith("/f/")} />
        <NavItem to="/shared" icon={Link2} label="Shared links" />
        <NavItem to="/trash" icon={Trash2} label="Trash" />
      </nav>

      <Recent />

      <div className="flex h-10 items-center gap-2 px-2">
        <Storage />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Log out"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={async () => {
                await api.logout();
                qc.clear();
                // Access keeps its own session. Its logout path ends that session too.
                window.location.href = me.data?.method === "access" ? "/cdn-cgi/access/logout" : "/";
              }}
            >
              <LogOut className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{me.data?.email ? `Log out ${me.data.email}` : "Log out"}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  match,
}: {
  to: "/" | "/shared" | "/trash";
  icon: typeof HardDrive;
  label: string;
  match?: (path: string) => boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = match ? match(path) : path === to;
  return (
    <Link
      to={to}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-accent",
        active && "bg-accent font-medium",
      )}
    >
      <Icon className={cn("size-[18px]", active ? "text-foreground" : "text-muted-foreground")} strokeWidth={1.75} />
      {label}
    </Link>
  );
}

function Recent() {
  const uploads = useUploads();
  const recent = useQuery({ queryKey: ["recent"], queryFn: api.recent });
  const active = uploads.items.filter((u) => u.status === "uploading" || u.status === "queued");
  const busyNames = new Set(active.map((u) => u.name));
  const files = (recent.data?.items ?? []).filter((n) => !busyNames.has(n.name)).slice(0, 6 - Math.min(active.length, 3));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-2 pb-1 text-[13px] font-medium text-subtle">Recent</div>
      <div className="flex min-h-0 flex-col overflow-y-auto">
        {active.slice(0, 3).map((u) => {
          const pct = u.size ? Math.round((u.loaded / u.size) * 100) : 0;
          return (
            <div key={u.id} className="flex h-14 items-center gap-3 rounded-xl px-2">
              <FileMark node={{ kind: "file", mime: u.mime, name: u.name }} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{u.name}</span>
                  <span className="shrink-0 text-xs text-mark-video">{u.status === "queued" ? "…" : `${pct}%`}</span>
                </div>
                <span className="truncate text-[13px] text-muted-foreground">Uploading…</span>
              </div>
            </div>
          );
        })}
        {files.map((n) => (
          <Link
            key={n.id}
            to="/f/$folderId"
            params={{ folderId: n.parentId ?? "root" }}
            search={{ file: n.id }}
            className="flex h-14 items-center gap-3 rounded-xl px-2 hover:bg-accent"
          >
            <FileMark node={n} size={32} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{n.name}</span>
                <span className="shrink-0 text-xs text-subtle">{formatDate(n.updatedAt)}</span>
              </div>
              <span className="truncate text-[13px] text-muted-foreground">
                {formatBytes(n.size)} · {n.parentName}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Storage() {
  const usage = useQuery({ queryKey: ["usage"], queryFn: api.usage });
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-[13px] font-medium">{usage.data ? formatBytes(usage.data.bytes) : "—"}</span>
      <span className="text-xs text-muted-foreground">
        {usage.data ? `${usage.data.files.toLocaleString()} files` : " "}
      </span>
    </div>
  );
}
