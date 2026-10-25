import { Archive, File, FileText, Folder, Image, Music, Sheet, Video } from "lucide-react";
import { type FileKind, fileKind } from "@/lib/format";
import { cn } from "@/lib/utils";

const BG: Record<FileKind, string> = {
  folder: "bg-mark-folder",
  image: "bg-mark-image",
  video: "bg-mark-video",
  audio: "bg-mark-audio",
  document: "bg-mark-document",
  pdf: "bg-mark-pdf",
  sheet: "bg-mark-sheet",
  archive: "bg-mark-archive",
  other: "bg-mark-other",
};

const ICON = { folder: Folder, image: Image, video: Video, audio: Music, document: FileText, sheet: Sheet, archive: Archive, other: File };

const SIZE = {
  24: { box: "size-6 rounded-lg", icon: "size-3.5", pdf: "text-[7px]" },
  32: { box: "size-8 rounded-[10px]", icon: "size-4", pdf: "text-[9px]" },
  40: { box: "size-10 rounded-xl", icon: "size-5", pdf: "text-[11px]" },
  48: { box: "size-12 rounded-[14px]", icon: "size-6", pdf: "text-[12px]" },
} as const;

/** The colored square that marks a file type. The only color in the interface. */
export function FileMark({
  node,
  kind,
  size = 40,
  className,
}: {
  node?: { kind: string; mime: string | null; name: string };
  kind?: FileKind;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const k = kind ?? fileKind(node!);
  const s = SIZE[size];
  const Icon = k === "pdf" ? null : ICON[k];
  return (
    <span className={cn("mark inline-flex shrink-0 items-center justify-center text-white", BG[k], s.box, className)}>
      {Icon ? <Icon className={s.icon} strokeWidth={2} /> : <span className={cn("font-bold tracking-wide", s.pdf)}>PDF</span>}
    </span>
  );
}
