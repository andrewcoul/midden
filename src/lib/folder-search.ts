/** Search values of a folder page: `sel` is the item in the details panel, `file` is the full-screen preview. */
export type FolderSearch = { sel?: string; file?: string };

export function validateFolderSearch(s: Record<string, unknown>): FolderSearch {
  return {
    ...(typeof s.sel === "string" ? { sel: s.sel } : {}),
    ...(typeof s.file === "string" ? { file: s.file } : {}),
  };
}
