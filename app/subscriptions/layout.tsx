import type { ReactNode } from "react";
import "./subscriptions-route.css";

export default function SubscriptionsLayout({ children }: { children: ReactNode }) {
  return <div className="subscriptions-route">{children}</div>;
}
