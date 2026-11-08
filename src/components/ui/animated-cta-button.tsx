import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCtaButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * Primary CTA with an animated conic-gradient border beam (electric blue -> violet -> warm orange).
 * Honors `prefers-reduced-motion` via global CSS media rules.
 */
export function AnimatedCtaButton({
  href,
  children,
  className,
}: AnimatedCtaButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex h-12 overflow-hidden rounded-2xl p-[1.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-[-1000%] animate-border-spin bg-[conic-gradient(from_90deg_at_50%_50%,#3B82F6_0%,#8B5CF6_45%,#F97316_75%,#3B82F6_100%)]"
      />
      <span className="relative inline-flex h-full w-full items-center justify-center gap-2 rounded-[14.5px] bg-[#0B1020] px-7 text-base font-semibold text-white transition-colors duration-200 group-hover:bg-[#111831]">
        {children}
      </span>
    </Link>
  );
}

