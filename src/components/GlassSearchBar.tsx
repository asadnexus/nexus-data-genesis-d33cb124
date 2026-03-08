import { useState, useRef, useEffect } from "react";
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortOption {
  label: string;
  value: string;
}

interface GlassSearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (value: string) => void;
  onSortDirectionChange?: (dir: "asc" | "desc") => void;
  className?: string;
}

export function GlassSearchBar({
  placeholder = "What are you looking for?",
  value,
  onChange,
  sortOptions,
  sortValue,
  sortDirection = "asc",
  onSortChange,
  onSortDirectionChange,
  className,
}: GlassSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative rounded-2xl transition-all duration-500 ease-out",
          "bg-card/60 backdrop-blur-xl",
          "border border-border/30",
          "shadow-[0_8px_32px_rgba(0,0,0,0.3),0_2px_8px_rgba(0,0,0,0.2)]",
          focused && "shadow-[0_12px_48px_rgba(0,0,0,0.4),0_0_0_1px_hsl(var(--secondary)/0.3),0_0_24px_hsl(var(--secondary)/0.1)]",
          focused && "scale-[1.01]",
          "hover:shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
          "hover:border-border/50",
        )}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-3 px-5 py-4">
          {/* Search icon */}
          <Search
            className={cn(
              "h-5 w-5 shrink-0 transition-colors duration-300",
              focused ? "text-secondary" : "text-card-foreground/60"
            )}
          />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent border-none outline-none",
              "text-card-foreground placeholder:text-card-foreground/40",
              "text-sm font-medium tracking-wide",
              "transition-all duration-300",
            )}
          />

          {/* Sort controls */}
          {sortOptions && sortOptions.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={sortValue}
                onChange={(e) => onSortChange?.(e.target.value)}
                className="bg-background/40 border border-border/40 rounded-lg text-xs text-card-foreground px-2 py-1.5 outline-none cursor-pointer hover:border-border/70 transition-colors"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onSortDirectionChange?.(sortDirection === "asc" ? "desc" : "asc")}
                className={cn(
                  "p-1.5 rounded-lg transition-all duration-200",
                  "bg-background/40 border border-border/40",
                  "hover:border-border/70 hover:bg-background/60",
                  "text-card-foreground/60 hover:text-card-foreground"
                )}
                title={sortDirection === "asc" ? "Ascending" : "Descending"}
              >
                {sortDirection === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); inputRef.current?.focus(); }}
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200",
                "hover:bg-background/40",
                "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
