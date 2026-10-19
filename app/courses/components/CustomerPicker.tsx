"use client";

import { useEffect, useRef, useState } from "react";
import { BGLookup } from "@/components/bodygate-ui";

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

  return (
    <BGLookup
      selectedLabel={selected?.full_name}
      onClear={() => onSelect(null)}
      query={query}
      onQueryChange={updateQuery}
      placeholder="Cerca cliente per nome, telefono o email..."
      open={query.trim().length >= 2}
      loading={searching}
      options={results.map((customer) => ({ id: customer.id, title: customer.full_name, subtitle: customer.phone }))}
      onPick={(option) => {
        const customer = results.find((item) => item.id === option.id);
        if (!customer) return;
        onSelect(customer);
        setResults([]);
      }}
      emptyLabel="Nessun cliente trovato."
    />
  );
}
