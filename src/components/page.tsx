import type { ReactNode } from "react";

/** Header bar + big title, for pages that are not folders. */
export function Page({
  icon,
  crumb,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: ReactNode;
  crumb: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 pr-4 pl-6 shadow-[inset_0_-1px_0_var(--border)]">
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-[15px] font-medium">{crumb}</span>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-10 pb-16 sm:px-12">
          <div className="flex flex-col gap-2 px-3">
            <h1 className="text-[40px] leading-[48px] font-medium tracking-[-0.04em]">{title}</h1>
            {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
