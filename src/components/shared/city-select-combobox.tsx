"use client";

import {
  Check,
  ChevronDown,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import React, {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import {
  matchesCity,
  REGIONAL_CITIES,
  SORTED_BULGARIAN_CITIES,
} from "@/lib/data/bulgarian-cities";
import { cn } from "@/lib/utils";

export interface CitySelectComboboxProps {
  id?: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

export function CitySelectCombobox({
  id: explicitId,
  value,
  onChange,
  placeholder = "Изберете град...",
  searchPlaceholder = "Търсене на град (на кирилица или латиница)...",
  disabled = false,
  error,
  className,
}: CitySelectComboboxProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "regional">("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [open]);

  // Filtered lists
  const filteredRegional = useMemo(() => {
    return REGIONAL_CITIES.filter((city) => matchesCity(city, search));
  }, [search]);

  const filteredAll = useMemo(() => {
    return SORTED_BULGARIAN_CITIES.filter((city) => matchesCity(city, search));
  }, [search]);

  const displayedCities = activeTab === "regional" ? filteredRegional : filteredAll;

  const exactMatchFound = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return SORTED_BULGARIAN_CITIES.some((c) => c.toLowerCase() === q);
  }, [search]);

  const handleSelectCity = (city: string) => {
    onChange(city);
    setOpen(false);
  };

  const handleSelectCustom = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background/60 px-3.5 py-2 text-sm text-foreground shadow-xs transition-all",
          "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary",
          open && "border-primary ring-2 ring-primary/20",
          error && "border-destructive focus-visible:ring-destructive",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          {value ? (
            <span className="font-medium text-foreground">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0 ml-2">
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange("");
                }
              }}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Изчисти"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180 text-primary"
            )}
          />
        </span>
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border bg-popover/95 backdrop-blur-md p-2 shadow-2xl animate-in fade-in-0 zoom-in-95"
          style={{ minWidth: "280px" }}
        >
          {/* Search Bar */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-9 pr-8 text-xs bg-secondary/40 border-border/70 rounded-xl placeholder:text-muted-foreground/70"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (displayedCities.length > 0 && displayedCities[0]) {
                    handleSelectCity(displayedCities[0]);
                  } else if (search.trim()) {
                    handleSelectCustom();
                  }
                }
              }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Quick Filter Tabs */}
          {!search && (
            <div className="flex items-center gap-1 mb-2 px-1">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors",
                  activeTab === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                Всички градове ({SORTED_BULGARIAN_CITIES.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("regional")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors",
                  activeTab === "regional"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                Областни ({REGIONAL_CITIES.length})
              </button>
            </div>
          )}

          {/* Cities List */}
          <div className="max-h-60 overflow-y-auto overscroll-contain space-y-0.5 pr-1 scrollbar-thin">
            {displayedCities.length > 0 ? (
              displayedCities.map((city) => {
                const isSelected = value.toLowerCase() === city.toLowerCase();
                const isRegional = REGIONAL_CITIES.includes(city as never);

                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-primary/20 text-primary font-semibold"
                        : "hover:bg-secondary/70 text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{city}</span>
                      {isRegional && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-secondary text-muted-foreground border border-border/50">
                          Областен
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Няма намерени градове за &ldquo;{search}&rdquo;
              </div>
            )}

            {/* Custom Input Option if user typed something not strictly in the list */}
            {search.trim().length > 1 && !exactMatchFound ? (
              <div className="border-t border-border/70 pt-1.5 mt-1">
                <button
                  type="button"
                  onClick={handleSelectCustom}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">
                    Използвай &ldquo;<strong>{search.trim()}</strong>&rdquo;
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
