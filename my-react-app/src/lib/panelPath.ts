import { getAdminSession, type AdminSession } from './adminSession'

// The admin panel lives at two addresses with the same pages: the store owner's at /admin/...,
// a store manager's at /manager/... . Links are written once, as /admin/..., and go through panel().

export const OWNER_BASE = '/admin'
export const MANAGER_BASE = '/manager'

/** /admin for the owner, /manager for a store manager. */
export function panelBase(session: AdminSession | null = getAdminSession()): string {
  return session?.role === 'manager' ? MANAGER_BASE : OWNER_BASE
}

/** An /admin/... address as the signed-in person's own: panel('/admin/orders') is /manager/orders for a manager. */
export function panel(path: string, session: AdminSession | null = getAdminSession()): string {
  return path.replace(/^\/admin(?=\/|\?|$)/, panelBase(session))
}

/** Either address written the owner's way, so one set of rules can describe both: /manager/orders → /admin/orders. */
export const asOwnerPath = (path: string) => path.replace(/^\/manager(?=\/|\?|$)/, OWNER_BASE)
