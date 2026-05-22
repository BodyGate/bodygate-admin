"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartItem = {
  label: string;
  consentiti: number;
  negati: number;
};

type Props = {
  data: ChartItem[];
};

export default function AccessChartPanel({ data }: Props) {
  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Andamento accessi</h2>
          <p style={subtitleStyle}>Accessi consentiti e negati negli ultimi giorni.</p>
        </div>
      </div>

      <div style={chartWrapStyle}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="consentiti" name="Consentiti" radius={[8, 8, 0, 0]} />
            <Bar dataKey="negati" name="Negati" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "18px",
};

const titleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "22px",
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  marginTop: "8px",
  fontSize: "14px",
};

const chartWrapStyle: React.CSSProperties = {
  width: "100%",
  height: "260px",
};