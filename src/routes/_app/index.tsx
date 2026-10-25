import { createFileRoute } from "@tanstack/react-router";
import { FolderView } from "@/components/folder-view";

export const Route = createFileRoute("/_app/")({
  validateSearch: (s: Record<string, unknown>): { file?: string } => (typeof s.file === "string" ? { file: s.file } : {}),
  component: () => <FolderView folderId="root" fileId={Route.useSearch().file} />,
});
