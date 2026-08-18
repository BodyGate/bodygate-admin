/** Runtime navigation model for the isolated Platinum laboratory.
 *
 * This configuration describes presentation only. It is not an authorization
 * boundary and must never be used by middleware or server-side access checks.
 */
export const PLATINUM_ROLES = ["reception", "direction", "administrator"] as const
export type PlatinumRole = (typeof PLATINUM_ROLES)[number]

export const PLATINUM_GROUPS = ["operations", "services", "direction", "administration"] as const
export type PlatinumGroup = (typeof PLATINUM_GROUPS)[number]

export const PLATINUM_GROUP_LABELS: Record<PlatinumGroup, string> = {
  operations: "Operatività",
  services: "Servizi",
  direction: "Direzione",
  administration: "Amministrazione",
}

export type PlatinumNavigationItem = {
  id: string
  label: string
  shortLabel: string
  href: string
  icon: "dashboard" | "reception" | "customers" | "access" | "payments" | "subscriptions" | "notifications" | "training" | "reports" | "accounting" | "staff" | "settings" | "system" | "credentials" | "debug" | "audit"
  group: PlatinumGroup
  permission: string
  roles: readonly PlatinumRole[]
  desktopPlacement: "primary" | "child"
  mobilePlacement: "bottom" | "more" | "hidden"
  children: readonly PlatinumNavigationItem[]
}

const allRoles = PLATINUM_ROLES
const leaders: readonly PlatinumRole[] = ["direction", "administrator"]
const administrators: readonly PlatinumRole[] = ["administrator"]

export const PLATINUM_NAVIGATION: readonly PlatinumNavigationItem[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard", href: "/", icon: "dashboard", group: "operations", permission: "dashboard.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "bottom", children: [] },
  { id: "reception", label: "Reception", shortLabel: "Reception", href: "/reception", icon: "reception", group: "operations", permission: "reception.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "bottom", children: [] },
  { id: "customers", label: "Clienti", shortLabel: "Clienti", href: "/customers", icon: "customers", group: "operations", permission: "customers.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "bottom", children: [] },
  { id: "access-control", label: "Accessi", shortLabel: "Accessi", href: "/access-control", icon: "access", group: "operations", permission: "access.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "bottom", children: [
    { id: "access-logs", label: "Registro ingressi", shortLabel: "Ingressi", href: "/access-logs", icon: "access", group: "operations", permission: "access.logs.view", roles: allRoles, desktopPlacement: "child", mobilePlacement: "hidden", children: [] },
    { id: "credentials", label: "Credenziali", shortLabel: "Credenziali", href: "/badges", icon: "credentials", group: "operations", permission: "credentials.view", roles: allRoles, desktopPlacement: "child", mobilePlacement: "hidden", children: [] },
    { id: "access-debug", label: "Debug Center", shortLabel: "Debug", href: "/access-control/debug", icon: "debug", group: "operations", permission: "access.debug", roles: administrators, desktopPlacement: "child", mobilePlacement: "hidden", children: [] },
    { id: "credentials-audit", label: "Audit credenziali", shortLabel: "Audit", href: "/access-control/credentials-audit", icon: "audit", group: "operations", permission: "credentials.audit", roles: administrators, desktopPlacement: "child", mobilePlacement: "hidden", children: [] },
  ] },
  { id: "payments", label: "Incassi", shortLabel: "Incassi", href: "/payments", icon: "payments", group: "operations", permission: "payments.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "subscriptions", label: "Abbonamenti", shortLabel: "Abbonamenti", href: "/subscriptions", icon: "subscriptions", group: "operations", permission: "subscriptions.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "notifications", label: "Scadenze e notifiche", shortLabel: "Scadenze", href: "/notifications", icon: "notifications", group: "operations", permission: "notifications.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "training", label: "Training", shortLabel: "Training", href: "/training", icon: "training", group: "services", permission: "training.view", roles: allRoles, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "reports", label: "Report", shortLabel: "Report", href: "/analytics", icon: "reports", group: "direction", permission: "reports.view", roles: leaders, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "accounting", label: "Contabilità", shortLabel: "Contabilità", href: "/accounting", icon: "accounting", group: "direction", permission: "accounting.view", roles: leaders, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "staff", label: "Staff", shortLabel: "Staff", href: "/system/staff", icon: "staff", group: "administration", permission: "staff.manage", roles: administrators, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "settings", label: "Configurazione", shortLabel: "Configura", href: "/settings", icon: "settings", group: "administration", permission: "settings.manage", roles: administrators, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
  { id: "system", label: "Sistema", shortLabel: "Sistema", href: "/system", icon: "system", group: "administration", permission: "system.manage", roles: administrators, desktopPlacement: "primary", mobilePlacement: "more", children: [] },
] as const

export function navigationForRole(role: PlatinumRole) {
  return PLATINUM_NAVIGATION.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    children: item.children.filter((child) => child.roles.includes(role)),
  }))
}
