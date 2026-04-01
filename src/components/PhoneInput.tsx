import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import type { CountryInfo, CustomerSuggestion } from "@/hooks/usePhoneAutoFill";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  country: CountryInfo;
  countries: CountryInfo[];
  onCountryChange: (c: CountryInfo) => void;
  suggestions: CustomerSuggestion[];
  isSearching: boolean;
  onSuggestionSelect: (customer: CustomerSuggestion) => void;
  onPhoneInput: (phone: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  country,
  countries,
  onCountryChange,
  suggestions,
  isSearching,
  onSuggestionSelect,
  onPhoneInput,
  placeholder = "Phone number",
  required,
  className = "",
}: PhoneInputProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
  }, [suggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    onPhoneInput(val);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex">
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 rounded-l-md border border-r-0 px-2 text-sm whitespace-nowrap"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
            color: "white",
            minWidth: "90px",
          }}
        >
          <span className="text-base">{country.flag}</span>
          <span className="text-xs text-muted-foreground">{country.dialCode}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`rounded-l-none ${className}`}
          style={{
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        />
      </div>

      {/* Country dropdown */}
      {dropdownOpen && (
        <div
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border shadow-lg"
          style={{
            background: "rgba(30,30,45,0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          {countries.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onCountryChange(c);
                setDropdownOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
            >
              <span>{c.flag}</span>
              <span className="text-muted-foreground">{c.dialCode}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Customer suggestions */}
      {showSuggestions && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg"
          style={{
            background: "rgba(30,30,45,0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-white/10">
            {isSearching ? "Searching..." : "Matching customers"}
          </div>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSuggestionSelect(s);
                setShowSuggestions(false);
              }}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {s.phone} {s.address ? `· ${s.address}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
