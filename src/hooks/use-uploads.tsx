import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, uploadFile } from "@/lib/api";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  parentId: string;
  loaded: number;
  status: "queued" | "uploading" | "done" | "error" | "canceled";
  error?: string;
}

/** A file plus the folder path it had inside a dropped or picked folder. */
export interface PickedFile {
  file: File;
  dirs: string[];
}

interface UploadsApi {
  items: UploadItem[];
  add: (files: PickedFile[], parentId: string) => Promise<void>;
  cancel: (id: string) => void;
  clearFinished: () => void;
}

const UploadsContext = createContext<UploadsApi | null>(null);
const CONCURRENCY = 2;

export function UploadsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  // Work for each pending upload. Kept out of React state so starting an upload is not a state side effect.
  const jobs = useRef(new Map<string, { file: File; parentId: string }>());
  const controllers = useRef(new Map<string, AbortController>());
  const queue = useRef<string[]>([]);
  const running = useRef(0);

  const patch = useCallback((id: string, p: Partial<UploadItem>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const run = useCallback(
    async (id: string, job: { file: File; parentId: string }) => {
      const ctrl = new AbortController();
      controllers.current.set(id, ctrl);
      patch(id, { status: "uploading" });
      try {
        await uploadFile(job.file, job.parentId, (loaded) => patch(id, { loaded }), ctrl.signal);
        patch(id, { status: "done", loaded: job.file.size });
        qc.invalidateQueries({ queryKey: ["folder", job.parentId] });
        qc.invalidateQueries({ queryKey: ["recent"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      } catch (err) {
        if (ctrl.signal.aborted) patch(id, { status: "canceled" });
        else patch(id, { status: "error", error: (err as Error).message });
      } finally {
        jobs.current.delete(id);
        controllers.current.delete(id);
      }
    },
    [patch, qc],
  );

  const pump = useCallback(() => {
    while (running.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      const job = jobs.current.get(id);
      if (!job) continue;
      running.current++;
      void run(id, job).finally(() => {
        running.current--;
        pump();
      });
    }
  }, [run]);

  const add = useCallback(
    async (picked: PickedFile[], parentId: string) => {
      if (!picked.length) return;
      // Create each folder path once, then upload files into it.
      const folderIds = new Map<string, string>([["", parentId]]);
      try {
        const paths = [...new Set(picked.map((p) => p.dirs.join("/")))].sort();
        for (const path of paths) {
          const parts = path ? path.split("/") : [];
          for (let i = 1; i <= parts.length; i++) {
            const key = parts.slice(0, i).join("/");
            if (folderIds.has(key)) continue;
            const parent = folderIds.get(parts.slice(0, i - 1).join("/"))!;
            const folder = await api.createFolder(parent, parts[i - 1]);
            folderIds.set(key, folder.id);
          }
        }
        if (folderIds.size > 1) qc.invalidateQueries({ queryKey: ["folder", parentId] });
      } catch (err) {
        toast.error(`Could not create folders: ${(err as Error).message}`);
        return;
      }
      const next: UploadItem[] = picked.map(({ file, dirs }) => {
        const id = crypto.randomUUID();
        const target = folderIds.get(dirs.join("/"))!;
        jobs.current.set(id, { file, parentId: target });
        queue.current.push(id);
        return {
          id,
          name: file.name,
          size: file.size,
          mime: file.type,
          parentId: target,
          loaded: 0,
          status: "queued",
        };
      });
      setItems((list) => [...next, ...list.filter((it) => it.status !== "done")]);
      pump();
    },
    [pump, qc],
  );

  const cancel = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      queue.current = queue.current.filter((q) => q !== id);
      jobs.current.delete(id);
      patch(id, { status: "canceled" });
    },
    [patch],
  );

  const clearFinished = useCallback(() => {
    setItems((list) => list.filter((it) => it.status === "uploading" || it.status === "queued"));
  }, []);

  const value = useMemo(() => ({ items, add, cancel, clearFinished }), [items, add, cancel, clearFinished]);
  return <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>;
}

export function useUploads() {
  const ctx = useContext(UploadsContext);
  if (!ctx) throw new Error("useUploads needs UploadsProvider");
  return ctx;
}

/** Reads files and whole folders from a drop event. */
export async function filesFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = [...dt.items]
    .map((item) => (item.kind === "file" ? item.webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return [...dt.files].map((file) => ({ file, dirs: [] }));

  const out: PickedFile[] = [];
  async function walk(entry: FileSystemEntry, dirs: string[]) {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, dirs });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches until it returns an empty list.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, [...dirs, entry.name]);
      }
    }
  }
  for (const entry of entries) await walk(entry, []);
  return out;
}

/** Reads files from an <input type="file">, keeping folder paths from webkitdirectory pickers. */
export function filesFromInput(list: FileList | null): PickedFile[] {
  return [...(list ?? [])].map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
    const dirs = rel ? rel.split("/").slice(0, -1) : [];
    return { file, dirs };
  });
}
