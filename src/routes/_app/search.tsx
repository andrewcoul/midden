import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { EmptyFolder, FileList } from "@/components/file-list";
import { Page } from "@/components/page";
import { api } from "@/lib/api";
import { describe } from "@/components/file-list";

export const Route = createFileRoute("/_app/search")({
  validateSearch: (s: Record<string, unknown>): { q: string } => ({ q: typeof s.q === "string" ? s.q : "" }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const res = useQuery({ queryKey: ["search", q], queryFn: () => api.search(q), enabled: !!q });
  const items = res.data?.items ?? [];

  return (
    <Page
      icon={<Search className="size-[18px]" />}
      crumb="Search"
      title={q ? `“${q}”` : "Search"}
      subtitle={res.data ? `${items.length} result${items.length === 1 ? "" : "s"}` : " "}
    >
      {res.data && items.length === 0 ? (
        <EmptyFolder>
          <p className="text-lg font-medium">Nothing found</p>
          <p className="text-[15px] text-muted-foreground">Try a shorter part of the name.</p>
        </EmptyFolder>
      ) : (
        <FileList
          items={items}
          meta={(n) => `${describe(n)} · in ${n.parentName}`}
          onOpen={(n) =>
            n.kind === "folder"
              ? navigate({ to: "/f/$folderId", params: { folderId: n.id } })
              : navigate({ to: "/f/$folderId", params: { folderId: n.parentId ?? "root" }, search: { sel: n.id } })
          }
        />
      )}
    </Page>
  );
}
