import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CountryInfo {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

export interface CustomerSuggestion {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

const COUNTRIES: CountryInfo[] = [
  { code: "BD", dialCode: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "IN", dialCode: "+91", flag: "🇮🇳", name: "India" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "USA/Canada" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "UK" },
  { code: "MY", dialCode: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "AE", dialCode: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "SA", dialCode: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "PK", dialCode: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
];

function detectCountry(digits: string): CountryInfo {
  const bd = COUNTRIES[0]; // default Bangladesh

  if (!digits || digits.length === 0) return bd;

  // Local BD format: starts with 01
  if (/^01[3-9]/.test(digits)) return bd;

  // International prefixes
  if (digits.startsWith("880")) return bd;
  if (digits.startsWith("91")) return COUNTRIES[1]; // India
  if (digits.startsWith("1") && !digits.startsWith("1\d{10,}".replace(/\\d/, ""))) return COUNTRIES[2]; // US
  if (digits.startsWith("44")) return COUNTRIES[3]; // UK
  if (digits.startsWith("60")) return COUNTRIES[4]; // MY
  if (digits.startsWith("971")) return COUNTRIES[5]; // UAE
  if (digits.startsWith("966")) return COUNTRIES[6]; // SA
  if (digits.startsWith("92")) return COUNTRIES[7]; // PK
  if (digits.startsWith("65")) return COUNTRIES[8]; // SG
  if (digits.startsWith("61")) return COUNTRIES[9]; // AU

  return bd;
}

/** Normalize phone to digits-only for DB lookup, trying with and without country code */
function getSearchVariants(digits: string, country: CountryInfo): string[] {
  const variants: string[] = [digits];
  const dialDigits = country.dialCode.replace("+", "");

  // If user typed with country code prefix, also search local version
  if (digits.startsWith(dialDigits)) {
    const local = digits.slice(dialDigits.length);
    if (local.length > 0) variants.push(local);
    // For BD: add "0" prefix to local
    if (country.code === "BD" && !local.startsWith("0")) {
      variants.push("0" + local);
    }
  }

  // If user typed local BD format (01xxx), also search with +880
  if (country.code === "BD" && digits.startsWith("0")) {
    variants.push("880" + digits.slice(1));
    variants.push("+880" + digits.slice(1));
  }

  // Also try with + prefix
  variants.push("+" + digits);
  variants.push(country.dialCode + digits);

  return [...new Set(variants)];
}

interface UsePhoneAutoFillReturn {
  country: CountryInfo;
  setCountry: (c: CountryInfo) => void;
  countries: CountryInfo[];
  suggestions: CustomerSuggestion[];
  isSearching: boolean;
  onPhoneChange: (rawInput: string) => string; // returns cleaned phone value
  lookupPhone: (phone: string) => void;
  clearSuggestions: () => void;
}

export function usePhoneAutoFill(): UsePhoneAutoFillReturn {
  const [country, setCountry] = useState<CountryInfo>(COUNTRIES[0]);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  const lookupPhone = useCallback((phone: string) => {
    if (searchTimer) clearTimeout(searchTimer);

    const digits = phone.replace(/[^0-9+]/g, "");
    if (digits.length < 4) {
      setSuggestions([]);
      return;
    }

    const detectedCountry = detectCountry(digits.replace("+", ""));
    setCountry(detectedCountry);

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const variants = getSearchVariants(digits.replace("+", ""), detectedCountry);

        // Search customers with any of the variants using ilike patterns
        let allResults: CustomerSuggestion[] = [];
        for (const v of variants.slice(0, 4)) {
          const { data } = await supabase
            .from("customers")
            .select("id, name, address, phone")
            .is("deleted_at", null)
            .ilike("phone", `%${v}%`)
            .limit(5);
          if (data) allResults.push(...data);
        }

        // Deduplicate by id
        const seen = new Set<string>();
        const unique = allResults.filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });

        setSuggestions(unique.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    setSearchTimer(timer);
  }, [searchTimer]);

  const onPhoneChange = useCallback((rawInput: string): string => {
    const cleaned = rawInput.replace(/[^0-9+\s-]/g, "");
    const digits = cleaned.replace(/[^0-9]/g, "");
    const detected = detectCountry(digits);
    setCountry(detected);
    return cleaned;
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimer) clearTimeout(searchTimer);
    };
  }, [searchTimer]);

  return {
    country,
    setCountry,
    countries: COUNTRIES,
    suggestions,
    isSearching,
    onPhoneChange,
    lookupPhone,
    clearSuggestions,
  };
}
