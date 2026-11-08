import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-blue-600 dark:text-blue-300",
        violet:
          "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
        warning:
          "border-orange-500/35 bg-orange-500/15 text-orange-700 dark:text-orange-300",
        destructive:
          "border-destructive/35 bg-destructive/15 text-destructive dark:text-red-400",
        success:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        demo: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 uppercase tracking-wider font-mono text-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

