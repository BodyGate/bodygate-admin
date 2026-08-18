export const ROUTE_CLASSIFICATIONS = [
  "primary",
  "secondary",
  "contextual",
  "public",
  "technical",
  "lab",
  "prototype",
  "legacy-redirect",
  "placeholder",
] as const;

export type RouteClassification = (typeof ROUTE_CLASSIFICATIONS)[number];

export type RouteManifestEntry = {
  path: string;
  id: string;
  label: string;
  classification: RouteClassification;
  domain: string;
  audience: "operator" | "administrator" | "staff" | "customer" | "developer";
  risk: "low" | "medium" | "high" | "critical";
  ownership: string;
  status: "active" | "redirect" | "placeholder";
  visibility: "authenticated" | "public" | "restricted";
  notes: string;
};

export const ROUTE_MANIFEST = [
  { path: "/", id: "dashboard", label: "Dashboard", classification: "primary", domain: "operations", audience: "operator", risk: "high", ownership: "Operations", status: "active", visibility: "authenticated", notes: "Operational overview and live activity." },
  { path: "/access", id: "access-legacy", label: "Legacy access", classification: "legacy-redirect", domain: "access-control", audience: "operator", risk: "critical", ownership: "Access Control", status: "redirect", visibility: "authenticated", notes: "Existing compatibility redirect; behavior is governed elsewhere." },
  { path: "/access-control", id: "access-control", label: "Access control", classification: "primary", domain: "access-control", audience: "operator", risk: "critical", ownership: "Access Control", status: "active", visibility: "authenticated", notes: "Primary access-control workspace." },
  { path: "/access-control/credentials-audit", id: "credentials-audit", label: "Credentials audit", classification: "secondary", domain: "access-control", audience: "administrator", risk: "critical", ownership: "Security", status: "active", visibility: "restricted", notes: "Audit view for access credentials." },
  { path: "/access-control/debug", id: "access-control-debug", label: "Access debug", classification: "technical", domain: "access-control", audience: "developer", risk: "critical", ownership: "Access Control", status: "active", visibility: "restricted", notes: "Technical diagnostics for access-control operators." },
  { path: "/access-denied", id: "access-denied", label: "Access denied", classification: "contextual", domain: "security", audience: "staff", risk: "medium", ownership: "Security", status: "active", visibility: "authenticated", notes: "Authorization failure destination." },
  { path: "/access-logs", id: "access-logs", label: "Access logs", classification: "primary", domain: "access-control", audience: "operator", risk: "critical", ownership: "Access Control", status: "active", visibility: "authenticated", notes: "Operational access and attendance history." },
  { path: "/accounting", id: "accounting", label: "Accounting", classification: "primary", domain: "finance", audience: "administrator", risk: "critical", ownership: "Finance", status: "active", visibility: "restricted", notes: "Accounting operations and financial controls." },
  { path: "/analytics", id: "analytics", label: "Analytics", classification: "secondary", domain: "reporting", audience: "administrator", risk: "medium", ownership: "Operations", status: "active", visibility: "authenticated", notes: "Business and operational analytics." },
  { path: "/badges", id: "badges", label: "Badges", classification: "primary", domain: "credentials", audience: "operator", risk: "critical", ownership: "Access Control", status: "active", visibility: "authenticated", notes: "Badge and physical credential management." },
  { path: "/customers", id: "customers", label: "Customers", classification: "primary", domain: "customers", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Customer registry and workflows." },
  { path: "/customers/new", id: "customer-new", label: "New customer", classification: "contextual", domain: "customers", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Customer onboarding workflow." },
  { path: "/customers/[id]", id: "customer-detail", label: "Customer detail", classification: "contextual", domain: "customers", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Dynamic customer record." },
  { path: "/customers/[id]/contract", id: "customer-contract", label: "Customer contract", classification: "contextual", domain: "customers", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Contract workflow for a customer." },
  { path: "/customers/[id]/contract/print", id: "customer-contract-print", label: "Print customer contract", classification: "contextual", domain: "customers", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Printable contract representation." },
  { path: "/customers/[id]/edit", id: "customer-edit", label: "Edit customer", classification: "contextual", domain: "customers", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Customer record editing workflow." },
  { path: "/customers/[id]/receipt/[receiptId]", id: "customer-receipt", label: "Customer receipt", classification: "contextual", domain: "finance", audience: "operator", risk: "critical", ownership: "Finance", status: "active", visibility: "authenticated", notes: "Dynamic receipt for a customer transaction." },
  { path: "/login", id: "login", label: "Login", classification: "public", domain: "authentication", audience: "staff", risk: "critical", ownership: "Security", status: "active", visibility: "public", notes: "Staff authentication entry point." },
  { path: "/mobile/[token]", id: "customer-mobile", label: "Customer mobile", classification: "public", domain: "mobile-access", audience: "customer", risk: "critical", ownership: "Digital Credentials", status: "active", visibility: "public", notes: "Token-scoped customer mobile experience." },
  { path: "/notifications", id: "notifications", label: "Notifications", classification: "secondary", domain: "communications", audience: "operator", risk: "medium", ownership: "Operations", status: "active", visibility: "authenticated", notes: "Operational notification center." },
  { path: "/pass/[token]", id: "mobile-pass", label: "Mobile Pass", classification: "public", domain: "mobile-access", audience: "customer", risk: "critical", ownership: "Digital Credentials", status: "active", visibility: "public", notes: "Token-scoped digital access pass." },
  { path: "/payments", id: "payments", label: "Payments", classification: "primary", domain: "finance", audience: "operator", risk: "critical", ownership: "Finance", status: "active", visibility: "authenticated", notes: "Payment, installment and balance operations." },
  { path: "/reception", id: "reception", label: "Reception", classification: "primary", domain: "operations", audience: "operator", risk: "critical", ownership: "Front Desk", status: "active", visibility: "authenticated", notes: "Front-desk operational workspace." },
  { path: "/settings", id: "settings", label: "Settings", classification: "primary", domain: "administration", audience: "administrator", risk: "critical", ownership: "Platform", status: "active", visibility: "restricted", notes: "Administrative settings hub." },
  { path: "/settings/modules", id: "settings-modules", label: "Module settings", classification: "placeholder", domain: "administration", audience: "administrator", risk: "high", ownership: "Platform", status: "placeholder", visibility: "restricted", notes: "Existing placeholder page; not a planned manifest entry." },
  { path: "/settings/permissions", id: "settings-permissions", label: "Permission settings", classification: "secondary", domain: "security", audience: "administrator", risk: "critical", ownership: "Security", status: "active", visibility: "restricted", notes: "Role and permission administration." },
  { path: "/settings/pricing", id: "settings-pricing", label: "Pricing settings", classification: "secondary", domain: "finance", audience: "administrator", risk: "critical", ownership: "Finance", status: "active", visibility: "restricted", notes: "Pricing and commercial configuration." },
  { path: "/staff-mobile/[token]", id: "staff-mobile", label: "Staff mobile", classification: "public", domain: "mobile-access", audience: "staff", risk: "critical", ownership: "Digital Credentials", status: "active", visibility: "public", notes: "Token-scoped staff mobile experience." },
  { path: "/subscriptions", id: "subscriptions", label: "Subscriptions", classification: "primary", domain: "subscriptions", audience: "operator", risk: "critical", ownership: "CRM", status: "active", visibility: "authenticated", notes: "Customer subscription operations." },
  { path: "/subscriptions/plans", id: "subscription-plans", label: "Subscription plans", classification: "secondary", domain: "subscriptions", audience: "administrator", risk: "critical", ownership: "CRM", status: "active", visibility: "restricted", notes: "Subscription plan administration." },
  { path: "/system", id: "system", label: "System", classification: "primary", domain: "administration", audience: "administrator", risk: "critical", ownership: "Platform", status: "active", visibility: "restricted", notes: "System administration workspace." },
  { path: "/system/audit", id: "system-audit", label: "System audit", classification: "secondary", domain: "security", audience: "administrator", risk: "critical", ownership: "Security", status: "active", visibility: "restricted", notes: "System-level audit trail." },
  { path: "/system/staff", id: "system-staff", label: "Staff administration", classification: "secondary", domain: "identity", audience: "administrator", risk: "critical", ownership: "Security", status: "active", visibility: "restricted", notes: "Staff identity administration." },
  { path: "/test-gate", id: "test-gate", label: "Gate test", classification: "technical", domain: "hardware", audience: "developer", risk: "critical", ownership: "Access Control", status: "active", visibility: "restricted", notes: "Technical gate and hardware verification route." },
  { path: "/training", id: "training", label: "Training", classification: "primary", domain: "training", audience: "staff", risk: "medium", ownership: "Training", status: "active", visibility: "authenticated", notes: "Training operations workspace." },
  { path: "/training/clients", id: "training-clients", label: "Training clients", classification: "secondary", domain: "training", audience: "staff", risk: "high", ownership: "Training", status: "active", visibility: "authenticated", notes: "Client training overview." },
  { path: "/training/library", id: "training-library", label: "Exercise library", classification: "secondary", domain: "training", audience: "staff", risk: "low", ownership: "Training", status: "active", visibility: "authenticated", notes: "Exercise library." },
  { path: "/training/library/[id]", id: "training-library-detail", label: "Exercise detail", classification: "contextual", domain: "training", audience: "staff", risk: "low", ownership: "Training", status: "active", visibility: "authenticated", notes: "Dynamic exercise detail." },
  { path: "/training/programs", id: "training-programs", label: "Training programs", classification: "secondary", domain: "training", audience: "staff", risk: "medium", ownership: "Training", status: "active", visibility: "authenticated", notes: "Training program registry." },
  { path: "/training/programs/[id]", id: "training-program-detail", label: "Training program detail", classification: "contextual", domain: "training", audience: "staff", risk: "medium", ownership: "Training", status: "active", visibility: "authenticated", notes: "Dynamic training program workspace." },
  { path: "/training/sessions", id: "training-sessions", label: "Training sessions", classification: "secondary", domain: "training", audience: "staff", risk: "medium", ownership: "Training", status: "active", visibility: "authenticated", notes: "Training session operations." },
  { path: "/ui-lab", id: "ui-lab", label: "UI Lab", classification: "lab", domain: "design-system", audience: "developer", risk: "low", ownership: "Design System", status: "active", visibility: "restricted", notes: "Internal component evaluation route." },
  { path: "/ui-lab/platinum", id: "ui-lab-platinum", label: "Platinum UI Lab", classification: "lab", domain: "design-system", audience: "developer", risk: "low", ownership: "Design System", status: "active", visibility: "restricted", notes: "Present Platinum Foundation reference route." },
  { path: "/v2/customers", id: "v2-customers", label: "Customers V2", classification: "prototype", domain: "customers", audience: "developer", risk: "high", ownership: "CRM", status: "active", visibility: "restricted", notes: "Existing BodyGate V2 customer prototype." },
] as const satisfies readonly RouteManifestEntry[];
