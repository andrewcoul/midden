import { createFileRoute } from "@tanstack/react-router";
import { FolderView } from "@/components/folder-view";
import { validateFolderSearch } from "@/lib/folder-search";

export const Route = createFileRoute("/_app/")({
  validateSearch: validateFolderSearch,
  component: RootFolder,
});

function RootFolder() {
  const { sel, file } = Route.useSearch();
  return <FolderView folderId="root" selectedId={sel} fileId={file} />;
}
