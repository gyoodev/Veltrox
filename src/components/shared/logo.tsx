import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  compact?: boolean;
}

export function Logo({ href = "/", className, compact = false }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5 group", className)}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-veltrox-gradient shadow-glow-blue transition-transform duration-200 group-hover:scale-105">
        <svg
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          className="h-5 w-5 text-white"
        >
          <path
            d="M5.5 7L14 21.5L22.5 7H18.2L14 14.6L9.8 7H5.5Z"
            fill="currentColor"
          />
          <path
            d="M11.5 7L14 11.4L16.5 7H11.5Z"
            fill="#FDBA74"
          />
        </svg>
      </span>
      {!compact ? (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Veltrox
        </span>
      ) : null}
    </span>
  );

  return (
    <Link
      href={href}
      aria-label="Veltrox"
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  );
}

