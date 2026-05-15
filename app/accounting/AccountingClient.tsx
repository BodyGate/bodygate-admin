"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Branch = {
  id: string;
  name: string;
  city?: string | null;
};

type Entry = {
  id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  direction: "income" | "expense";
  category: string;
  description?: string | null;
  amount: number;
  payment_method?: string | null;
  entry_date: string;
  source?: string | null;
  operator_name?: string | null;
  created_at: string;
};

export default function AccountingClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("Abbonamenti");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (selectedBranchId) loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  async function loadBranches() {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    setBranches(data || []);

    if (data && data.length > 0) {
      setSelectedBranchId(data[0].id);
    }

    setLoading(false);
  }

  async function loadEntries() {
    setLoading(true);

    const { data, error } = await supabase
      .from("accounting_entries")
      .select("*")
      .eq("branch_id", selectedBranchId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Errore prima nota:", error);
      setEntries([]);
    } else {
      setEntries(data || []);
    }

    setLoading(false);
  }

  async function addEntry() {
    if (!selectedBranchId) return alert("Seleziona una sede.");
    if (!category.trim()) return alert("Inserisci la categoria.");
    if (!amount || Number(amount) <= 0) return alert("Inserisci un importo valido.");

    setSaving(true);

    const { error } = await supabase.from("accounting_entries").insert({
      branch_id: selectedBranchId,
      direction,
      category: category.trim(),
      description: description.trim() || null,
      amount: Number(amount),
      payment_method: paymentMethod,
      entry_date: entryDate,
      source: "manual",
      operator_name: "Operatore",
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Errore salvataggio movimento.");
      return;
    }

    setDescription("");
    setAmount("");
    await loadEntries();
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (dateFrom && entry.entry_date < dateFrom) return false;
      if (dateTo && entry.entry_date > dateTo) return false;
      return true;
    });
  }, [entries, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const income = filteredEntries
      .filter((e) => e.direction === "income")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const expense = filteredEntries
      .filter((e) => e.direction === "expense")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [filteredEntries]);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  const categories =
    direction === "income"
      ? [
          "Abbonamenti",
          "Quote associative",
          "Personal training",
          "Vendita integratori",
          "Servizi extra",
          "Altro incasso",
        ]
      : [
          "Affitto",
          "Utenze",
          "Pulizie",
          "Manutenzione",
          "Attrezzature",
          "Fornitori",
          "Rimborsi",
          "Varie",
        ];

  function paymentLabel(value?: string | null) {
    switch (value) {
      case "cash":
        return "Contanti";
      case "card":
        return "Carta";
      case "bank_transfer":
        return "Bonifico";
      case "klarna":
        return "Klarna";
      case "scalapay":
        return "Scalapay";
      default:
        return value || "-";
    }
  }

  function directionLabel(value: "income" | "expense") {
    return value === "income" ? "Entrata" : "Uscita";
  }

  function exportCsv() {
    const header = [
      "Data",
      "Tipo",
      "Categoria",
      "Descrizione",
      "Metodo pagamento",
      "Operatore",
      "Importo",
    ];

    const rows = filteredEntries.map((entry) => [
      entry.entry_date,
      directionLabel(entry.direction),
      entry.category,
      entry.description || "",
      paymentLabel(entry.payment_method),
      entry.operator_name || "Operatore",
      Number(entry.amount || 0).toFixed(2).replace(".", ","),
    ]);

    const csvContent = [header, ...rows]
      .map((row) =>
        row
          .map((field) => `"${String(field).replaceAll('"', '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `prima-nota-${dateFrom || "inizio"}-${dateTo || "oggi"}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function printReport() {
    const rowsHtml = filteredEntries
      .map(
        (entry) => `
          <tr>
            <td>${new Date(entry.entry_date).toLocaleDateString("it-IT")}</td>
            <td>${directionLabel(entry.direction)}</td>
            <td>${entry.category}</td>
            <td>${entry.description || "-"}</td>
            <td>${paymentLabel(entry.payment_method)}</td>
            <td>${entry.operator_name || "Operatore"}</td>
            <td class="${entry.direction === "income" ? "green" : "red"}">
              ${entry.direction === "income" ? "+" : "-"}€ ${Number(entry.amount || 0).toFixed(2)}
            </td>
          </tr>
        `
      )
      .join("");

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      alert("Popup bloccato. Consenti i popup per stampare il report.");
      return;
    }

    reportWindow.document.write(`
      <html>
        <head>
          <title>Prima Nota BodyGate</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #111;
            }
            h1 {
              margin-bottom: 4px;
            }
            .subtitle {
              color: #555;
              margin-bottom: 24px;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .box {
              border: 1px solid #ddd;
              border-radius: 12px;
              padding: 14px;
            }
            .label {
              font-size: 11px;
              text-transform: uppercase;
              color: #777;
              margin-bottom: 6px;
            }
            .value {
              font-size: 22px;
              font-weight: bold;
            }
            .green {
              color: #15803d;
            }
            .red {
              color: #b91c1c;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th, td {
              border-bottom: 1px solid #ddd;
              text-align: left;
              padding: 9px;
              vertical-align: top;
            }
            th {
              background: #f3f4f6;
              text-transform: uppercase;
              font-size: 11px;
            }
            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Prima Nota</h1>
          <div class="subtitle">
            ${selectedBranch?.name || "BodyGate"} · Periodo:
            ${dateFrom || "inizio"} / ${dateTo || "oggi"}
          </div>

          <div class="summary">
            <div class="box">
              <div class="label">Entrate</div>
              <div class="value green">€ ${totals.income.toFixed(2)}</div>
            </div>
            <div class="box">
              <div class="label">Uscite</div>
              <div class="value red">€ ${totals.expense.toFixed(2)}</div>
            </div>
            <div class="box">
              <div class="label">Saldo</div>
              <div class="value ${totals.balance >= 0 ? "green" : "red"}">
                € ${totals.balance.toFixed(2)}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Descrizione</th>
                <th>Metodo</th>
                <th>Operatore</th>
                <th>Importo</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="7">Nessun movimento nel periodo selezionato.</td></tr>`}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    reportWindow.document.close();
  }

  return (
    <div className="accounting-page">
      <style jsx>{`
        .accounting-page {
          min-height: 100vh;
          background: #050505;
          color: #ffffff;
          padding: 32px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 22px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #ef4444;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 34px;
          font-weight: 950;
          letter-spacing: -0.8px;
        }

        .subtitle {
          margin-top: 8px;
          color: #a3a3a3;
          font-size: 15px;
        }

        .branch-card,
        .panel,
        .summary-card,
        .tools-card {
          background: linear-gradient(135deg, #141414, #080808);
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        }

        .branch-card {
          min-width: 340px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        input,
        select {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #303030;
          background: #050505;
          color: #ffffff;
          padding: 14px 15px;
          font-size: 14px;
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: #ef4444;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }

        .summary-label {
          color: #737373;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .summary-value {
          font-size: 28px;
          font-weight: 950;
        }

        .green {
          color: #4ade80;
        }

        .red {
          color: #fb7185;
        }

        .tools-card {
          margin-bottom: 24px;
        }

        .tools-grid {
          display: grid;
          grid-template-columns: 1fr 1fr auto auto;
          gap: 14px;
          align-items: end;
        }

        .export-btn,
        .print-btn {
          border: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
          transition: 0.2s;
        }

        .export-btn {
          background: #ffffff;
          color: #000000;
        }

        .print-btn {
          background: #ef4444;
          color: #ffffff;
        }

        .export-btn:hover,
        .print-btn:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        .layout {
          display: grid;
          grid-template-columns: 390px 1fr;
          gap: 24px;
        }

        h2 {
          margin: 0 0 18px;
          font-size: 22px;
          font-weight: 950;
        }

        .form-grid {
          display: grid;
          gap: 15px;
        }

        .direction-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 8px;
        }

        .direction-btn {
          border: 1px solid #303030;
          border-radius: 16px;
          padding: 14px;
          background: #101010;
          color: #a3a3a3;
          font-weight: 950;
          cursor: pointer;
        }

        .direction-btn.active-income {
          background: rgba(34, 197, 94, 0.14);
          color: #4ade80;
          border-color: rgba(34, 197, 94, 0.35);
        }

        .direction-btn.active-expense {
          background: rgba(239, 68, 68, 0.14);
          color: #fb7185;
          border-color: rgba(239, 68, 68, 0.35);
        }

        .save-btn {
          margin-top: 8px;
          width: 100%;
          border: none;
          border-radius: 16px;
          padding: 15px;
          background: #ef4444;
          color: white;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          transition: 0.2s;
        }

        .save-btn:hover {
          transform: translateY(-1px);
          background: #f87171;
        }

        .save-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .entry-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          background: #080808;
          border: 1px solid #262626;
          border-radius: 18px;
          padding: 16px;
        }

        .entry-title {
          font-size: 15px;
          font-weight: 950;
          margin-bottom: 6px;
        }

        .entry-desc {
          color: #a3a3a3;
          font-size: 13px;
          line-height: 1.45;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .pill {
          display: inline-flex;
          width: fit-content;
          padding: 6px 9px;
          border-radius: 999px;
          background: #171717;
          border: 1px solid #303030;
          color: #a3a3a3;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .amount-box {
          text-align: right;
          min-width: 130px;
        }

        .amount {
          font-size: 22px;
          font-weight: 950;
          margin-bottom: 8px;
        }

        .direction-badge {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .income {
          color: #4ade80;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.32);
        }

        .expense {
          color: #fb7185;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.32);
        }

        .empty {
          color: #737373;
          font-size: 14px;
          padding: 14px 0;
        }

        @media (max-width: 1100px) {
          .header,
          .layout,
          .summary-grid,
          .tools-grid {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .branch-card {
            min-width: 100%;
          }

          .entry-row {
            grid-template-columns: 1fr;
          }

          .amount-box {
            text-align: left;
          }
        }
      `}</style>

      <div className="header">
        <div>
          <div className="eyebrow">BodyGate Amministrazione</div>
          <h1>Prima Nota</h1>
          <div className="subtitle">
            Registro entrate, uscite, cassa giornaliera, export Excel e PDF.
          </div>
        </div>

        <div className="branch-card">
          <label>Sede</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} {branch.city ? `- ${branch.city}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tools-card">
        <div className="tools-grid">
          <div>
            <label>Dal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label>Al</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <button className="export-btn" onClick={exportCsv}>
            Esporta Excel
          </button>

          <button className="print-btn" onClick={printReport}>
            Esporta PDF
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">Entrate periodo</div>
          <div className="summary-value green">€ {totals.income.toFixed(2)}</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Uscite periodo</div>
          <div className="summary-value red">€ {totals.expense.toFixed(2)}</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Saldo periodo</div>
          <div className={`summary-value ${totals.balance >= 0 ? "green" : "red"}`}>
            € {totals.balance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="layout">
        <div className="panel">
          <h2>Nuovo movimento</h2>

          <div className="direction-tabs">
            <button
              className={`direction-btn ${direction === "income" ? "active-income" : ""}`}
              onClick={() => {
                setDirection("income");
                setCategory("Abbonamenti");
              }}
            >
              Entrata
            </button>

            <button
              className={`direction-btn ${direction === "expense" ? "active-expense" : ""}`}
              onClick={() => {
                setDirection("expense");
                setCategory("Affitto");
              }}
            >
              Uscita
            </button>
          </div>

          <div className="form-grid">
            <div>
              <label>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Descrizione</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Es. Abbonamento mensile Mario Rossi"
              />
            </div>

            <div>
              <label>Importo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <label>Metodo pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="cash">Contanti</option>
                <option value="card">Carta</option>
                <option value="bank_transfer">Bonifico</option>
                <option value="klarna">Klarna</option>
                <option value="scalapay">Scalapay</option>
              </select>
            </div>

            <div>
              <label>Data movimento</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>

            <button className="save-btn" onClick={addEntry} disabled={saving}>
              {saving ? "Salvataggio..." : "Registra movimento"}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Movimenti recenti</h2>

          {loading && <div className="empty">Caricamento movimenti...</div>}

          {!loading && filteredEntries.length === 0 && (
            <div className="empty">Nessun movimento nel periodo selezionato.</div>
          )}

          {!loading && filteredEntries.length > 0 && (
            <div className="list">
              {filteredEntries.map((entry) => (
                <div className="entry-row" key={entry.id}>
                  <div>
                    <div className="entry-title">{entry.category}</div>

                    <div className="entry-desc">
                      {entry.description || "Movimento registrato manualmente"}
                    </div>

                    <div className="meta">
                      <span className="pill">
                        {new Date(entry.entry_date).toLocaleDateString("it-IT")}
                      </span>
                      <span className="pill">
                        {paymentLabel(entry.payment_method)}
                      </span>
                      <span className="pill">
                        {entry.operator_name || "Operatore"}
                      </span>
                    </div>
                  </div>

                  <div className="amount-box">
                    <div className={`amount ${entry.direction === "income" ? "green" : "red"}`}>
                      {entry.direction === "income" ? "+" : "-"}€{" "}
                      {Number(entry.amount || 0).toFixed(2)}
                    </div>

                    <div className={`direction-badge ${entry.direction === "income" ? "income" : "expense"}`}>
                      {entry.direction === "income" ? "Entrata" : "Uscita"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}