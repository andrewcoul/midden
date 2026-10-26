import { createFileRoute } from "@tanstack/react-router";
import { FolderView } from "@/components/folder-view";
import { validateFolderSearch } from "@/lib/folder-search";

export const Route = createFileRoute("/_app/f/$folderId")({
  validateSearch: validateFolderSearch,
  component: FolderPage,
});

function FolderPage() {
  const { folderId } = Route.useParams();
  const { sel, file } = Route.useSearch();
  return <FolderView key={folderId} folderId={folderId} selectedId={sel} fileId={file} />;
}
