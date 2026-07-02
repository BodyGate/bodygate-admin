import ReceptionDashboard from "../components/ReceptionDashboard";

export default function ReceptionPage() {
  return (
    <div className="reception-page-shell">
      <ReceptionDashboard />

      <style>{`
        .reception-page-shell,
        .reception-page-shell main,
        .reception-page-shell main > div,
        .reception-page-shell .reception-panel,
        .reception-page-shell .reception-panel * {
          min-width: 0;
          max-width: 100%;
        }

        .reception-page-shell main > div {
          align-items: start !important;
        }

        .reception-page-shell .reception-panel {
          align-self: start !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 20px !important;
        }

        .reception-page-shell .reception-panel h2,
        .reception-page-shell .reception-panel p,
        .reception-page-shell .reception-panel strong,
        .reception-page-shell .reception-panel span,
        .reception-page-shell .reception-panel a,
        .reception-page-shell .reception-panel button {
          overflow-wrap: anywhere;
        }

        @media (max-width: 1200px) {
          .reception-page-shell main > div:nth-of-type(1) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .reception-page-shell main > div:nth-of-type(2) {
            grid-template-columns: 1fr !important;
          }

          .reception-page-shell main > div:nth-of-type(3) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .reception-page-shell main > div:nth-of-type(1),
          .reception-page-shell main > div:nth-of-type(3) {
            grid-template-columns: 1fr !important;
          }

          .reception-page-shell .reception-panel {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
