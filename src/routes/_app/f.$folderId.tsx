import { createFileRoute } from "@tanstack/react-router";
import { FolderView } from "@/components/folder-view";

export const Route = createFileRoute("/_app/f/$folderId")({
  validateSearch: (s: Record<string, unknown>): { file?: string } => (typeof s.file === "string" ? { file: s.file } : {}),
  component: FolderPage,
});

function FolderPage() {
  const { folderId } = Route.useParams();
  const { file } = Route.useSearch();
  return <FolderView key={folderId} folderId={folderId} fileId={file} />;
}
