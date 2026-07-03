import type { ReactNode } from "react";
import "./payments-route.css";

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return <div className="payments-route">{children}</div>;
}
