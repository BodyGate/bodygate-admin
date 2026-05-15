"use client";

type Props = {
  customer: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    birth_date?: string | null;
    birth_place?: string | null;
    city?: string | null;
    address?: string | null;
    street_number?: string | null;
    document_type?: string | null;
    document_number?: string | null;
    email: string | null;
    phone: string | null;
    badge_code: string | null;
    subscription_expiry: string | null;
    created_at: string;
  };
};

export default function CustomerContract({ customer }: Props) {
  const today = new Date().toLocaleDateString("it-IT");

  const fullName =
    customer.full_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "____________________________";

  const birthDate = customer.birth_date
    ? new Date(customer.birth_date).toLocaleDateString("it-IT")
    : "________________";

  return (
    <div style={pageStyle}>
      <div style={topRowStyle}>
        <h1 style={brandStyle}>BODY ENERGY</h1>

        <h2 style={mainTitleStyle}>
          DICHIARAZIONE LIBERATORIA DI RESPONSABILITÀ
        </h2>

        <div style={dateBoxStyle}>Data: {today}</div>
      </div>

      <div style={textStyle}>
        Il/la sottoscritto/a <Field value={fullName} /> Nato/a il{" "}
        <Field value={birthDate} /> a{" "}
        <Field value={customer.birth_place || "________________"} />
      </div>

      <div style={textStyle}>
        Residente a <Field value={customer.city || "________________"} /> in{" "}
        <Field value={customer.address || "________________"} /> n.{" "}
        <Field value={customer.street_number || "______"} />
      </div>

      <div style={textStyle}>
        Documento d'identità{" "}
        <Field value={customer.document_type || "________________"} /> n°.{" "}
        <Field value={customer.document_number || "________________"} />
      </div>

      <div style={textStyle}>
        e-mail: <Field value={customer.email || "________________"} /> Cellulare:{" "}
        <Field value={customer.phone || "________________"} />
      </div>

      <div style={textStyle}>
        In qualità di: accompagnatore/genitore di{" "}
        <Field value="________________________________" /> nato a:{" "}
        <Field value="________________" /> il <Field value="________________" />{" "}
        residente a <Field value="________________" /> in via{" "}
        <Field value="________________" /> n. <Field value="______" />
      </div>

      <div style={textStyle}>
        Per l’attività sportiva: <Field value="Sala pesi / Fitness" />
      </div>

      <h3 style={declareStyle}>DICHIARA</h3>

      <Paragraph>
        1. Con la presente di voler tesserare: □ Se stesso/a; □ Il
        minore/amministrato presso codesta società Body Energy Associazione
        Sportiva Dilettantistica, accettandone fin da subito le norme interne,
        prendendo visione dello statuto e del regolamento sociale, di approvarne
        il contenuto e di impegnarmi ad osservarli insieme alle delibere adottate
        dagli organi della società, nonché del CONI, della Federazione e/o Ente
        di Promozione sportiva cui la Body Energy è affiliata.
      </Paragraph>

      <Paragraph>
        2. Dichiaro inoltre con la sottoscrizione della presente, di essere a
        conoscenza che le attività organizzate all’interno della palestra Body
        Energy Associazione Sportiva Dilettantistica, nessuna esclusa, sono
        coperte da polizza assicurativa e dei limiti dell’assicurazione offerta
        ai propri tesserati.
      </Paragraph>

      <Paragraph>
        Dichiaro, pertanto, di sollevare ed esonerare da ogni responsabilità
        civile e penale codesta spettabile società Body Energy Associazione
        Sportiva Dilettantistica, ed il suo legale rappresentante, da qualsivoglia
        responsabilità derivanti da sinistri occorsi all’interno dei luoghi della
        palestra per mia colpa o negligenza, riguardo la mia persona, per danni
        personali e/o procurati da altri e/o a cose a causa di un mio
        comportamento non conforme alle norme.
      </Paragraph>

      <Paragraph>
        3. Dichiaro infine di avere attentamente letto e valutato il contenuto
        del presente documento e di avere compreso chiaramente il significato di
        ogni singolo punto prima di sottoscriverlo e di rinunciare a qualsiasi
        richiesta di risarcimento danni e di rimborso presenti o futuri nei
        confronti della società Body Energy Associazione Sportiva Dilettantistica
        e del suo legale rappresentante per sinistri che non dovessero essere
        coperti da assicurazione.
      </Paragraph>

      <div style={signatureLineStyle}>
        Il/la dichiarante, ___________________________________________
      </div>

      <Paragraph>
        Confermo di aver letto e compreso la presente dichiarazione liberatoria
        prima di apporvi la mia firma e sono consapevole che, firmando la
        presente, rinuncio a determinati diritti legali.
      </Paragraph>

      <div style={signatureLineStyle}>
        Il/la dichiarante, ___________________________________________
      </div>

      <h3 style={privacyTitleStyle}>TRATTAMENTO DEI DATI PERSONALI</h3>

      <Paragraph>
        Ai sensi del Decreto Legislativo 30 giugno 2003 n. 196 e ss.mm.ii,
        recepito dal D.Lgs. 101/2018 e del GDPR Regolamento UE 2016/679, il
        sottoscritto dichiara di autorizzare la BODY ENERGY Associazione
        Sportiva Dilettantistica all’utilizzo in esclusiva di tutte le immagini
        video e fotografiche che verranno prodotte, allo scopo di divulgare la
        sopracitata attività sul sito Internet o brochure illustrative. Fornisce
        inoltre il consenso al trattamento dei propri dati personali da parte
        della stessa ASD per le sue finalità istituzionali e amministrative.
      </Paragraph>

      <div style={signatureLineStyle}>
        Autorizzo firma ___________________________________________
      </div>
    </div>
  );
}

function Field({ value }: { value: string }) {
  return <span style={fieldStyle}>{value}</span>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p style={paragraphStyle}>{children}</p>;
}

const pageStyle: React.CSSProperties = {
  background: "white",
  color: "black",
  width: "210mm",
  minHeight: "297mm",
  margin: "0 auto",
  padding: "16mm 18mm",
  fontFamily: "Arial, Helvetica, sans-serif",
  boxSizing: "border-box",
  fontSize: "12px",
  lineHeight: 1.35,
};

const topRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "18px",
  textAlign: "center",
};

const brandStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const mainTitleStyle: React.CSSProperties = {
  margin: "6px 0 4px",
  fontSize: "15px",
  fontWeight: 900,
};

const dateBoxStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#333",
};

const textStyle: React.CSSProperties = {
  marginBottom: "7px",
};

const fieldStyle: React.CSSProperties = {
  display: "inline-block",
  minWidth: "120px",
  borderBottom: "1px solid #000",
  padding: "0 4px 1px",
  fontWeight: 700,
};

const declareStyle: React.CSSProperties = {
  textAlign: "center",
  margin: "14px 0 8px",
  fontSize: "14px",
  fontWeight: 900,
};

const paragraphStyle: React.CSSProperties = {
  margin: "0 0 8px",
  textAlign: "justify",
};

const signatureLineStyle: React.CSSProperties = {
  margin: "14px 0",
  fontWeight: 700,
};

const privacyTitleStyle: React.CSSProperties = {
  margin: "18px 0 8px",
  fontSize: "14px",
  fontWeight: 900,
};