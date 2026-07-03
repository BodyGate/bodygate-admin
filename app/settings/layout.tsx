import type { ReactNode } from "react";
import "./settings-route.css";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="settings-route">{children}</div>;
}
