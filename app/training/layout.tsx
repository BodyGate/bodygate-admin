import type { ReactNode } from "react";
import TrainingSidebar from "../components/training/TrainingSidebar";

export default function TrainingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#020617",
      }}
    >
      <TrainingSidebar />

      <main
        style={{
          flex: 1,
          overflow: "auto",
          background:
            "radial-gradient(circle at top, rgba(37,99,235,0.15), transparent 35%), #020617",
        }}
      >
        {children}
      </main>
    </div>
  );
}