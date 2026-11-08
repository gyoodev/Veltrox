"use client";

import { Check, ChevronDown, Plus, Search, Sparkles, X } from "lucide-react";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ComboboxGroup {
  title: string;
  items: string[];
}

export interface CarSelectComboboxProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  disabledReason?: string;
  // Either groups or flat items:
  groups?: ComboboxGroup[];
  items?: string[];
  // Fallback / Other option:
  otherOptionLabel: string;
  customInputLabel: string;
  customInputPlaceholder: string;
  formatCustomPrompt?: (query: string) => string;
  noResultsText?: string;
  badgeText?: string;
  error?: string | null;
  className?: string;
}

export function CarSelectCombobox({
  id: explicitId,
  label,
  value,
  onChange,
  placeholder = "Изберете...",
  searchPlaceholder = "Търси...",
  disabled = false,
  disabledReason,
  groups,
  items,
  otherOptionLabel,
  customInputLabel,
  customInputPlaceholder,
  formatCustomPrompt = (q) => `Използвай "${q}"`,
  noResultsText = "Няма намерени резултати",
  badgeText,
  error,
  className,
}: CarSelectComboboxProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  // Flatten all items from groups or items prop for fast lookup:
  const allAvailableItems = useMemo(() => {
    if (groups && groups.length > 0) {
      const set = new Set<string>();
      for (const g of groups) {
        for (const item of g.items) {
          set.add(item);
        }
      }
      return Array.from(set);
    }
    return items ?? [];
  }, [groups, items]);

  // Determine if the current value is recognized in the predefined list
  const isValueInCatalog = useMemo(() => {
    if (!value) return false;
    const lower = value.trim().toLowerCase();
    return allAvailableItems.some((item) => item.toLowerCase() === lower);
  }, [value, allAvailableItems]);

  // Synchronize custom mode if the initial or incoming value is not in catalog and not empty
  useEffect(() => {
    if (value && value.trim().length > 0 && !isValueInCatalog) {
      setIsCustomMode(true);
    }
  }, [value, isValueInCatalog]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
    }
  }, [isOpen]);

  // Filter items based on search query
  const trimmedSearch = search.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!groups) return null;
    if (!trimmedSearch) return groups;

    return groups
      .map((g) => ({
        title: g.title,
        items: g.items.filter((item) =>
          item.toLowerCase().includes(trimmedSearch)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, trimmedSearch]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!trimmedSearch) return items;
    return items.filter((item) => item.toLowerCase().includes(trimmedSearch));
  }, [items, trimmedSearch]);

  const hasAnyMatches = useMemo(() => {
    if (filteredGroups) {
      return filteredGroups.some((g) => g.items.length > 0);
    }
    return filteredItems.length > 0;
  }, [filteredGroups, filteredItems]);

  const handleSelectItem = (item: string) => {
    onChange(item);
    setIsCustomMode(false);
    setIsOpen(false);
  };

  const handleChooseCustomOption = (initialText = "") => {
    setIsCustomMode(true);
    setIsOpen(false);
    if (initialText) {
      onChange(initialText);
    }
    setTimeout(() => {
      customInputRef.current?.focus();
    }, 50);
  };

  const handleSwitchBackToCatalog = () => {
    setIsCustomMode(false);
    onChange("");
    setIsOpen(true);
  };

  return (
    <div className={cn("space-y-1.5", className)} ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {badgeText ? (
          <span className="text-[11px] font-normal text-muted-foreground">
            {badgeText}
          </span>
        ) : null}
      </div>

      {isCustomMode ? (
        <div className="space-y-1.5 animate-in fade-in-50">
          <div className="relative">
            <Input
              id={id}
              ref={customInputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={customInputPlaceholder}
              className={cn("pr-20", error && "border-destructive")}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSwitchBackToCatalog}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
              title="Избери от списъка"
            >
              Списък
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{customInputLabel}</span>
            <button
              type="button"
              onClick={handleSwitchBackToCatalog}
              className="underline hover:text-foreground text-[11px]"
            >
              Отвори каталога
            </button>
          </p>
        </div>
      ) : (
        <div className="relative">
          <button
            id={id}
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-surface/80 px-3.5 py-2 text-sm text-foreground shadow-sm transition-colors",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              disabled && "cursor-not-allowed opacity-50 bg-muted/40",
              error && "border-destructive focus:ring-destructive",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {value || (disabled ? disabledReason || placeholder : placeholder)}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 opacity-60 transition-transform duration-200",
                isOpen && "rotate-180 text-primary opacity-100"
              )}
            />
          </button>

          {isOpen && !disabled && (
            <div
              className={cn(
                "absolute left-0 top-full z-50 mt-1.5 w-full rounded-2xl border border-border bg-popover/95 p-2 text-popover-foreground shadow-2xl backdrop-blur-xl",
                "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
              )}
              role="listbox"
            >
              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 pl-8 pr-7 text-xs rounded-lg bg-surface/90"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (trimmedSearch.length > 0) {
                        // If exact match found, select it; otherwise custom
                        const matched = allAvailableItems.find(
                          (it) => it.toLowerCase() === trimmedSearch
                        );
                        if (matched) {
                          handleSelectItem(matched);
                        } else {
                          handleChooseCustomOption(search.trim());
                        }
                      }
                    }
                  }}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Options List */}
              <div className="max-h-56 overflow-y-auto overscroll-contain pr-1 space-y-2 text-sm">
                {/* Render Grouped */}
                {filteredGroups ? (
                  <>
                    {filteredGroups.map((group) => (
                      <div key={group.title} className="space-y-0.5">
                        <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                          {group.title.includes("Популярни") ? (
                            <Sparkles className="h-3 w-3 text-amber-500" />
                          ) : null}
                          <span>{group.title}</span>
                        </div>
                        {group.items.map((item) => {
                          const isSelected =
                            value.trim().toLowerCase() ===
                            item.trim().toLowerCase();
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              className={cn(
                                "relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pl-8 pr-3 text-left text-xs sm:text-sm outline-none transition-colors",
                                "hover:bg-secondary/80 hover:text-foreground focus:bg-secondary focus:text-foreground",
                                isSelected &&
                                  "bg-primary/10 text-primary font-medium"
                              )}
                            >
                              {isSelected ? (
                                <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
                                  <Check className="h-4 w-4 text-primary" />
                                </span>
                              ) : null}
                              <span className="truncate">{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </>
                ) : null}

                {/* Render Flat List */}
                {!filteredGroups && items ? (
                  <div className="space-y-0.5">
                    {filteredItems.map((item) => {
                      const isSelected =
                        value.trim().toLowerCase() ===
                        item.trim().toLowerCase();
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          className={cn(
                            "relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pl-8 pr-3 text-left text-xs sm:text-sm outline-none transition-colors",
                            "hover:bg-secondary/80 hover:text-foreground focus:bg-secondary focus:text-foreground",
                            isSelected &&
                              "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          {isSelected ? (
                            <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
                              <Check className="h-4 w-4 text-primary" />
                            </span>
                          ) : null}
                          <span className="truncate">{item}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* No Matches Found */}
                {!hasAnyMatches ? (
                  <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                    <p>{noResultsText}</p>
                  </div>
                ) : null}
              </div>

              {/* Bottom Actions: Custom Entry / Fast Add */}
              <div className="mt-1.5 border-t border-border/80 pt-1.5 space-y-1">
                {trimmedSearch.length > 0 && !hasAnyMatches ? (
                  <button
                    type="button"
                    onClick={() => handleChooseCustomOption(search.trim())}
                    className="flex w-full items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="truncate">{formatCustomPrompt(search)}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleChooseCustomOption(search.trim())}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{otherOptionLabel}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

