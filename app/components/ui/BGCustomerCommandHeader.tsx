"use client";

import type { ReactNode } from "react";

type BGCustomerHeaderAction = {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onClick: () => void;
};

type BGCustomerCommandHeaderProps = {
  customerName: string;
  initials: string;
  photoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  badgeCode?: string | null;
  controllerCode?: string | null;
  accessAllowed: boolean;
  actions: BGCustomerHeaderAction[];
  children: ReactNode;
};

export default function BGCustomerCommandHeader({
  customerName,
  initials,
  photoUrl,
  phone,
  email,
  badgeCode,
  controllerCode,
  accessAllowed,
  actions,
  children,
}: BGCustomerCommandHeaderProps) {
  return (
    <header className="command-center bg-customer-command-header">
      <div className="command-main">
        <div className="profile-area">
          {photoUrl ? (
            <img className="avatar" src={photoUrl} alt={customerName} />
          ) : (
            <div className="avatar-placeholder">{initials}</div>
          )}
          <div>
            <h1>{customerName}</h1>
            <div className="contact-line">
              <span>{phone || "Telefono mancante"}</span>
              <span>·</span>
              <span>{email || "Email mancante"}</span>
            </div>
            <div className="badge-line">
              <span className="mini-badge">Badge {badgeCode || "-"}</span>
              <span className="mini-badge">Controller {controllerCode || "-"}</span>
              <span className={`badge-status ${accessAllowed ? "ok" : "ko"}`}>
                {accessAllowed ? "Accesso attivo" : "Accesso bloccato"}
              </span>
            </div>
          </div>
        </div>

        <div className="command-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`command-action ${action.variant || "secondary"}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </header>
  );
}
