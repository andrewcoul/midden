import { cn } from "@/lib/utils";

/** Segmented control: gray track, the selected option is a white pill. */
export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex h-8 items-center rounded-full bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
            value === o.value && "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/8%)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
