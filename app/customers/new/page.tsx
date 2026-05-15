import Link from "next/link";
import CustomerForm from "../../components/CustomerForm";

export default function NewCustomerPage() {
  return (
    <main style={{ display: "grid", gap: "24px" }}>
      <div>
        <Link
          href="/customers"
          style={{
            color: "var(--accent)",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          ← Torna ai clienti
        </Link>

        <div
          style={{
            color: "var(--muted)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            marginTop: "28px",
          }}
        >
          BODYGATE CUSTOMERS
        </div>

        <h1
          style={{
            margin: "12px 0 0 0",
            fontSize: "54px",
            lineHeight: 1,
          }}
        >
          Nuovo cliente
        </h1>

        <div
          style={{
            marginTop: "14px",
            color: "var(--muted)",
            fontSize: "18px",
          }}
        >
          Crea una nuova anagrafica cliente e prepara badge, abbonamento e accesso.
        </div>
      </div>

      <CustomerForm />
    </main>
  );
}