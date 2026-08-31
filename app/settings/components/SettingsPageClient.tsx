"use client";

import { useEffect, useMemo, useState } from "react";
import MembershipFeeSettings from "./MembershipFeeSettings";
import SubscriptionPlansSettings from "./SubscriptionPlansSettings";

type Branch = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
};

export default function SettingsPageClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    setLoading(true);

    const response = await fetch("/api/settings/branches", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);

    if (response.ok && result?.ok) {
      setBranches(result.branches);
      if (result.branches.length > 0) setSelectedBranchId(result.branches[0].id);
    }

    setLoading(false);
  }

  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId);
  }, [branches, selectedBranchId]);

  const tabs = [
    ["general", "Generale"],
    ["membership", "Quota associativa"],
    ["plans", "Abbonamenti"],
    ["certificates", "Certificati"],
    ["access", "Accessi tornello"],
    ["notifications", "Notifiche"],
    ["branding", "Branding"],
    ["audit", "Audit log"],
  ];

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-card">Caricamento impostazioni...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <style jsx>{`
        .settings-page {
          padding: 32px;
          color: var(--text);
          background: var(--bg);
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 22px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #5b3df5;
          font-size: 12px;
          font-weight: 900;
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
          color: var(--muted);
          font-size: 15px;
        }

        .branch-card,
        .panel,
        .loading-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 1px 2px rgba(21, 22, 28, 0.04), 0 18px 45px -18px rgba(21, 22, 28, 0.14);
        }

        .branch-card {
          min-width: 360px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        select,
        input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-soft);
          color: var(--text);
          padding: 14px 15px;
          font-size: 14px;
          outline: none;
        }

        select:focus,
        input:focus {
          border-color: var(--accent);
        }

        .branch-meta {
          margin-top: 12px;
          color: var(--muted);
          font-size: 13px;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 24px;
        }

        .tab {
          border: 1px solid var(--border);
          background: var(--bg-soft);
          color: var(--muted);
          border-radius: 999px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.2s;
        }

        .tab:hover {
          color: var(--text);
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .tab-active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
          box-shadow: 0 12px 30px rgba(91, 61, 245, 0.22);
        }

        .panel h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 950;
          color: var(--text);
        }

        .panel p {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-top: 22px;
        }

        .mini-card {
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 18px;
        }

        .mini-label {
          color: var(--muted);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .mini-value {
          color: var(--text);
          font-size: 18px;
          font-weight: 950;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-top: 22px;
        }

        .setting-box {
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 18px;
        }

        .setting-title {
          font-size: 16px;
          font-weight: 950;
          margin-bottom: 6px;
          color: var(--text);
        }

        .setting-text {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .badge {
          display: inline-flex;
          width: fit-content;
          margin-top: 12px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(31, 157, 107, 0.1);
          color: var(--success);
          border: 1px solid rgba(31, 157, 107, 0.3);
          font-size: 12px;
          font-weight: 900;
        }

        .badge-red {
          background: rgba(214, 49, 74, 0.1);
          color: var(--danger);
          border-color: rgba(214, 49, 74, 0.3);
        }

        @media (max-width: 1100px) {
          .header,
          .settings-grid,
          .cards-grid {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .branch-card {
            min-width: 100%;
          }
        }
      `}</style>

      <div className="header">
        <div>
          <div className="eyebrow">BodyGate Control Center</div>
          <h1>Impostazioni gestionale</h1>
          <div className="subtitle">
            Configura sede, abbonamenti, quota associativa, certificati,
            accessi, notifiche e branding senza modificare codice.
          </div>
        </div>

        <div className="branch-card">
          <label>Sede attiva</label>

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

          <div className="branch-meta">
            {selectedBranch
              ? `${selectedBranch.address || "Indirizzo non inserito"} ${
                  selectedBranch.city ? `· ${selectedBranch.city}` : ""
                }`
              : "Nessuna sede selezionata"}
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`tab ${activeTab === key ? "tab-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="panel">
          <h2>Panoramica impostazioni</h2>
          <p>
            Questa sezione diventerà il centro operativo di BodyGate. Da qui
            potrai gestire le regole principali del gestionale, senza dover
            modificare manualmente il codice.
          </p>

          <div className="cards-grid">
            <div className="mini-card">
              <div className="mini-label">Sedi attive</div>
              <div className="mini-value">{branches.length}</div>
            </div>

            <div className="mini-card">
              <div className="mini-label">Sede selezionata</div>
              <div className="mini-value">
                {selectedBranch?.name || "Nessuna"}
              </div>
            </div>

            <div className="mini-card">
              <div className="mini-label">Modalità</div>
              <div className="mini-value">Premium</div>
            </div>
          </div>

          <div className="settings-grid">
            <InfoBox
              title="Gestione clienti"
              text="Anagrafica, foto cliente, certificato medico, note interne, accessi e timeline attività."
              status="Attiva"
            />

            <InfoBox
              title="Accessi tornello"
              text="Controllo accessi tramite badge, abbonamento, quota associativa, certificato medico e blocchi manuali."
              status="Attiva"
            />

            <InfoBox
              title="Pagamenti"
              text="Base già pronta per storico pagamenti, ricevute e metodi di pagamento."
              status="In sviluppo"
              red
            />

            <InfoBox
              title="Notifiche"
              text="Avvisi su scadenze abbonamenti, certificati, quote associative e clienti bloccati."
              status="In sviluppo"
              red
            />
          </div>
        </div>
      )}

      {activeTab === "membership" && selectedBranchId && (
        <MembershipFeeSettings branchId={selectedBranchId} />
      )}

      {activeTab === "plans" && selectedBranchId && (
        <SubscriptionPlansSettings branchId={selectedBranchId} />
      )}

      {activeTab === "certificates" && (
        <div className="panel">
          <h2>Certificati medici</h2>
          <p>
            Qui configureremo le regole dei certificati medici: validità,
            obbligatorietà, alert di scadenza e blocco automatico accesso.
          </p>

          <div className="settings-grid">
            <InfoBox
              title="Certificato obbligatorio"
              text="Senza certificato valido il cliente non potrà accedere dal tornello."
              status="Consigliato"
            />

            <InfoBox
              title="Data inizio e fine validità"
              text="Ogni certificato deve avere una data di inizio e una data di fine validità."
              status="Attiva"
            />

            <InfoBox
              title="Alert scadenza"
              text="Notifica automatica quando il certificato sta per scadere."
              status="Prossimo step"
              red
            />

            <InfoBox
              title="Archivio file"
              text="Upload e consultazione PDF, JPG o PNG del certificato medico."
              status="Attiva"
            />
          </div>
        </div>
      )}

      {activeTab === "access" && (
        <div className="panel">
          <h2>Accessi tornello</h2>
          <p>
            Regole operative per consentire o bloccare l’accesso fisico alla
            palestra.
          </p>

          <div className="settings-grid">
            <InfoBox
              title="Abbonamento attivo"
              text="Il cliente deve avere almeno un abbonamento valido."
              status="Attiva"
            />

            <InfoBox
              title="Quota associativa valida"
              text="La quota associativa deve essere valida per consentire accesso."
              status="Attiva"
            />

            <InfoBox
              title="Certificato medico valido"
              text="Il certificato medico deve essere presente e non scaduto."
              status="Attiva"
            />

            <InfoBox
              title="Blocco manuale"
              text="Un operatore può bloccare manualmente un cliente."
              status="Attiva"
            />
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="panel">
          <h2>Notifiche</h2>
          <p>
            Qui creeremo il sistema notifiche automatiche per la dashboard.
          </p>

          <div className="settings-grid">
            <InfoBox
              title="Abbonamento in scadenza"
              text="Avviso automatico alcuni giorni prima della scadenza."
              status="Da collegare"
              red
            />

            <InfoBox
              title="Certificato in scadenza"
              text="Avviso automatico prima della scadenza del certificato medico."
              status="Da collegare"
              red
            />

            <InfoBox
              title="Quota associativa scaduta"
              text="Avviso automatico quando la quota annuale non è più valida."
              status="Da collegare"
              red
            />

            <InfoBox
              title="Accessi negati"
              text="Notifica quando un cliente tenta l’accesso ma viene bloccato."
              status="Da collegare"
              red
            />
          </div>
        </div>
      )}

      {activeTab === "branding" && (
        <div className="panel">
          <h2>Branding BodyGate</h2>
          <p>
            Qui potremo configurare nome palestra, colori, logo, tema grafico e
            personalizzazione della piattaforma.
          </p>

          <div className="settings-grid">
            <div className="setting-box">
              <label>Nome gestionale</label>
              <input value="BodyGate" readOnly />
            </div>

            <div className="setting-box">
              <label>Colore principale</label>
              <input value="Viola Platinum" readOnly />
            </div>

            <InfoBox
              title="Tema Platinum"
              text="Interfaccia chiara, bianca e viola coerente con Body Energy."
              status="Attiva"
            />

            <InfoBox
              title="Logo palestra"
              text="In seguito potremo caricare logo personalizzato della sede."
              status="Prossimo step"
              red
            />
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="panel">
          <h2>Audit log</h2>
          <p>
            Qui visualizzeremo tutte le modifiche importanti fatte dagli
            operatori: rinnovi, blocchi, modifiche cliente, certificati e
            pagamenti.
          </p>

          <div className="settings-grid">
            <InfoBox
              title="Timeline cliente"
              text="Già integrata nella scheda cliente."
              status="Attiva"
            />

            <InfoBox
              title="Registro modifiche"
              text="Prossimo step: salvataggio operatore, azione, data e dettagli."
              status="Da sviluppare"
              red
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({
  title,
  text,
  status,
  red = false,
}: {
  title: string;
  text: string;
  status: string;
  red?: boolean;
}) {
  return (
    <div className="setting-box">
      <div className="setting-title">{title}</div>
      <div className="setting-text">{text}</div>
      <div className={`badge ${red ? "badge-red" : ""}`}>{status}</div>
    </div>
  );
}