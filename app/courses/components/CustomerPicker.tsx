"use client";

import { useEffect, useRef, useState } from "react";
import { BGInput } from "@/components/bodygate-ui";

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
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--bg-soft)",
        }}
      >
        <span style={{ fontWeight: 700 }}>{selected.full_name}</span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Cambia
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <BGInput
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder="Cerca cliente per nome, telefono o email..."
      />
      {query.trim().length >= 2 && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--bg-elevated, #fff)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
          }}
        >
          {searching ? (
            <div style={{ padding: 12, fontSize: 13, color: "var(--muted)" }}>Ricerca...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: "var(--muted)" }}>Nessun cliente trovato.</div>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onSelect(customer);
                  setResults([]);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <div style={{ fontWeight: 600 }}>{customer.full_name}</div>
                {customer.phone && <div style={{ fontSize: 12, color: "var(--muted)" }}>{customer.phone}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
