import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** A small dialog that asks for one line of text, e.g. a folder name. */
export function PromptDialog({
  open,
  title,
  initial = "",
  placeholder,
  confirm,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  confirm: string;
  onSubmit: (value: string) => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initial);
    // Select the name without its extension, like a file manager does.
    requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      const dot = initial.lastIndexOf(".");
      el.focus();
      el.setSelectionRange(0, dot > 0 ? dot : initial.length);
    });
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await onSubmit(v);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogTitle>{title}</DialogTitle>
          <Input ref={input} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim() || busy}>
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
