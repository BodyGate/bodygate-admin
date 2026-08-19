"use client";

import { useEffect, useMemo, useState } from "react";

type StaffRole = {
  id: string;
  role_key: string;
  role_name: string;
};

type StaffPassFallback = {
  passUrl: string;
  whatsappWebUrl: string | null;
};

type StaffUser = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  role_id: string | null;
  role_name?: string | null;
  role_key?: string | null;
};

export default function StaffManagerClient() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingPassId, setSendingPassId] = useState<string | null>(null);
  const [staffPassFallback, setStaffPassFallback] =
    useState<StaffPassFallback | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");

  const activeStaff = useMemo(
    () => staff.filter((user) => user.is_active).length,
    [staff]
  );

  async function loadData() {
    setLoading(true);

    const res = await fetch("/api/staff/list", {
      cache: "no-store",
    });

    const json = await res.json();

    if (json.ok) {
      setStaff(json.staff || []);
      setRoles(json.roles || []);

      if (!roleId && json.roles?.[0]?.id) {
        setRoleId(json.roles[0].id);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createStaffUser(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !phone.trim() || !roleId) {
      alert("Compila nome, email, telefono e ruolo.");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role_id: roleId,
      }),
    });

    const json = await res.json();

    setSaving(false);

    if (!json.ok) {
      alert(json.error || "Errore durante la creazione.");
      return;
    }

    setFullName("");
    setEmail("");
    setPhone("");
    await loadData();
  }

  async function updateStaffUser(id: string, payload: Partial<StaffUser>) {
    const res = await fetch("/api/staff/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        ...payload,
      }),
    });

    const json = await res.json();

    if (!json.ok) {
      alert(json.error || "Errore durante l'aggiornamento.");
      return;
    }

    await loadData();
  }

  function copyPassUrl(passUrl: string) {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(passUrl).catch(() => undefined);
  }

  async function sendStaffPass(staffUserId: string) {
    setSendingPassId(staffUserId);
    setStaffPassFallback(null);

    const res = await fetch("/api/staff-mobile/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staff_user_id: staffUserId,
      }),
    });

    const json = await res.json();

    setSendingPassId(null);

    if (!json.ok) {
      alert(json.error || "Errore invio Staff Pass");
      return;
    }

    const passUrl = json.pass_url || "";
    const whatsappDesktopUrl = json.whatsapp_desktop_url;
    const whatsappWebUrl = json.whatsapp_web_url || json.whatsapp_url || null;

    if (passUrl) {
      copyPassUrl(passUrl);
    }

    if (whatsappDesktopUrl) {
      window.open(whatsappDesktopUrl, "_blank");
    }

    window.setTimeout(() => {
      setStaffPassFallback({
        passUrl,
        whatsappWebUrl,
      });
    }, 1000);
  }

  return (
    <main className="staff-manager-runtime" style={styles.page}>
      <section className="staff-manager-runtime__hero" style={styles.hero}>
        <div>
          <p style={styles.kicker}>Sistema</p>
          <h1 style={styles.title}>Staff e Ruoli</h1>
          <p style={styles.subtitle}>
            Gestisci amministrazione, receptionist e istruttori di BodyGate.
            Per ora tutti i ruoli hanno accesso completo.
          </p>
        </div>

        <div className="staff-manager-runtime__stat" style={styles.statBox}>
          <span style={styles.statNumber}>{activeStaff}</span>
          <span style={styles.statLabel}>Staff attivi</span>
        </div>
      </section>

      <section className="staff-manager-runtime__grid" style={styles.grid}>
        <form onSubmit={createStaffUser} style={styles.card}>
          <h2 style={styles.cardTitle}>Nuovo utente staff</h2>

          <label style={styles.label}>
            Nome e cognome
            <input
              style={styles.input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Es. Giuseppe Pisacane"
            />
          </label>

          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@bodygate.it"
              type="email"
            />
          </label>

          <label style={styles.label}>
            Telefono WhatsApp
            <input
              style={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="393791216571"
            />
          </label>

          <label style={styles.label}>
            Ruolo
            <select
              style={styles.input}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role_name}
                </option>
              ))}
            </select>
          </label>

          <button disabled={saving} style={styles.button}>
            {saving ? "Salvataggio..." : "Crea utente staff"}
          </button>
        </form>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Elenco staff</h2>

          {staffPassFallback ? (
            <div style={styles.fallbackBox}>
              <strong style={styles.fallbackTitle}>
                Staff Mobile Pass pronto
              </strong>
              <p style={styles.fallbackText}>
                Se WhatsApp Desktop non si è aperto, usa il link web oppure
                copia il pass e invialo manualmente.
              </p>
              <div style={styles.fallbackActions}>
                {staffPassFallback.whatsappWebUrl ? (
                  <a
                    href={staffPassFallback.whatsappWebUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.fallbackLink}
                  >
                    Apri WhatsApp Web
                  </a>
                ) : null}

                {staffPassFallback.passUrl ? (
                  <>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => copyPassUrl(staffPassFallback.passUrl)}
                    >
                      Copia pass_url
                    </button>
                    <code style={styles.passUrlCode}>
                      {staffPassFallback.passUrl}
                    </code>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {loading ? (
            <p style={styles.muted}>Caricamento staff...</p>
          ) : staff.length === 0 ? (
            <p style={styles.muted}>Nessun utente staff creato.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nome</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Telefono</th>
                    <th style={styles.th}>Ruolo</th>
                    <th style={styles.th}>Stato</th>
                    <th style={styles.th}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((user) => (
                    <tr key={user.id}>
                      <td style={styles.td}>{user.full_name}</td>
                      <td style={styles.td}>{user.email}</td>
                      <td style={styles.td}>{user.phone || "—"}</td>
                      <td style={styles.td}>
                        <select
                          style={styles.smallInput}
                          value={user.role_id || ""}
                          onChange={(e) =>
                            updateStaffUser(user.id, {
                              role_id: e.target.value,
                            })
                          }
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.role_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            background: user.is_active
                              ? "rgba(34,197,94,.14)"
                              : "rgba(239,68,68,.14)",
                            color: user.is_active ? "#4ade80" : "#f87171",
                          }}
                        >
                          {user.is_active ? "Attivo" : "Disattivato"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            style={styles.secondaryButton}
                            onClick={() =>
                              updateStaffUser(user.id, {
                                is_active: !user.is_active,
                              })
                            }
                          >
                            {user.is_active ? "Disattiva" : "Attiva"}
                          </button>

                          <button
                            style={styles.whatsappButton}
                            disabled={sendingPassId === user.id}
                            onClick={() => sendStaffPass(user.id)}
                          >
                            {sendingPassId === user.id
                              ? "Invio..."
                              : "Staff Pass"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "#f8fafc",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    padding: 28,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(239,68,68,.22), rgba(15,23,42,.95))",
    border: "1px solid rgba(255,255,255,.08)",
    marginBottom: 24,
  },
  kicker: {
    color: "#f87171",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    color: "#cbd5e1",
    maxWidth: 720,
    marginTop: 10,
  },
  statBox: {
    minWidth: 150,
    borderRadius: 22,
    background: "rgba(15,23,42,.72)",
    border: "1px solid rgba(255,255,255,.08)",
    padding: 20,
    textAlign: "center",
  },
  statNumber: {
    display: "block",
    fontSize: 36,
    fontWeight: 900,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 24,
  },
  card: {
    borderRadius: 24,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    padding: 22,
    height: "fit-content",
  },
  cardWide: {
    borderRadius: 24,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    padding: 22,
    overflow: "hidden",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: 18,
    fontSize: 20,
  },
  label: {
    display: "grid",
    gap: 8,
    marginBottom: 14,
    color: "#cbd5e1",
    fontSize: 14,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(2,6,23,.9)",
    color: "#fff",
    padding: "12px 14px",
    outline: "none",
  },
  smallInput: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(2,6,23,.9)",
    color: "#fff",
    padding: "8px 10px",
    outline: "none",
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: 16,
    background: "linear-gradient(135deg, #ef4444, #991b1b)",
    color: "#fff",
    padding: "13px 16px",
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 8,
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 12,
    background: "rgba(255,255,255,.06)",
    color: "#fff",
    padding: "8px 12px",
    cursor: "pointer",
  },
  whatsappButton: {
    border: "1px solid rgba(34,197,94,.35)",
    borderRadius: 12,
    background: "rgba(34,197,94,.12)",
    color: "#4ade80",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  fallbackBox: {
    border: "1px solid rgba(34,197,94,.28)",
    borderRadius: 18,
    background: "rgba(34,197,94,.10)",
    padding: 16,
    marginBottom: 18,
  },
  fallbackTitle: {
    display: "block",
    color: "#86efac",
    marginBottom: 8,
  },
  fallbackText: {
    color: "#cbd5e1",
    margin: "0 0 12px",
  },
  fallbackActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  fallbackLink: {
    borderRadius: 12,
    background: "rgba(34,197,94,.18)",
    color: "#86efac",
    padding: "8px 12px",
    fontWeight: 800,
    textDecoration: "none",
  },
  passUrlCode: {
    color: "#e2e8f0",
    background: "rgba(2,6,23,.62)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 10,
    padding: "7px 10px",
    wordBreak: "break-all",
  },
  muted: {
    color: "#94a3b8",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#94a3b8",
    fontSize: 13,
    borderBottom: "1px solid rgba(255,255,255,.08)",
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    color: "#e5e7eb",
    fontSize: 14,
  },
  badge: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
};