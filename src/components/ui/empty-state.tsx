import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-card relative flex flex-col items-center justify-center overflow-hidden rounded-2xl px-6 py-14 text-center",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 h-44 w-44 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-glow-blue">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>
      <h3 className="max-w-md text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

