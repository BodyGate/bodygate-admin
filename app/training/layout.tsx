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
        width: "100%",
        minWidth: 0,
        minHeight: "calc(100vh - 76px)",
        background: "#020617",
      }}
    >
      <TrainingSidebar />

      <main
        style={{
          flex: 1,
          width: "100%",
          minWidth: 0,
          overflowX: "hidden",
          overflowY: "auto",
          background:
            "radial-gradient(circle at top, rgba(37,99,235,0.15), transparent 35%), #020617",
        }}
      >
        {children}
      </main>
    </div>
  );
}
