"use client";

import { useEffect, useRef, useState } from "react";
import {
  BGInput,
  BGLookup,
  BGLookupMenu,
  BGLookupMessage,
  BGLookupOption,
  BGLookupSelected,
} from "@/components/bodygate-ui";

type CustomerOption = { id: string; full_name: string; phone?: string | null };

type Props = {
  selected: CustomerOption | null;
  onSelect: (customer: CustomerOption | null) => void;
};

export default function CustomerPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevSelected, setPrevSelected] = useState(selected);

  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (!selected) {
      setQuery("");
      setResults([]);
    }
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) setResults([]);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const response = await fetch(
        `/api/customers/list?q=${encodeURIComponent(query.trim())}&status=active&limit=10`,
        { cache: "no-store" },
      );
      const result = await response.json().catch(() => null);
      setResults(result?.ok ? result.customers : []);
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (selected) {
    return <BGLookupSelected label={selected.full_name} onClear={() => onSelect(null)} />;
  }

  return (
    <BGLookup>
      <BGInput
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder="Cerca cliente per nome, telefono o email..."
      />
      {query.trim().length >= 2 && (
        <BGLookupMenu>
          {searching ? (
            <BGLookupMessage>Ricerca...</BGLookupMessage>
          ) : results.length === 0 ? (
            <BGLookupMessage>Nessun cliente trovato.</BGLookupMessage>
          ) : (
            results.map((customer) => (
              <BGLookupOption
                key={customer.id}
                label={customer.full_name}
                meta={customer.phone}
                onSelect={() => {
                  onSelect(customer);
                  setResults([]);
                }}
              />
            ))
          )}
        </BGLookupMenu>
      )}
    </BGLookup>
  );
}
