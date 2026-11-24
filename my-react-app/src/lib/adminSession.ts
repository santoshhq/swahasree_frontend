import { readStored, writeStored } from './storage'

// Kept apart from the customer session: an admin signing in never touches a shopper's bag or orders.
const KEY = 'swahasree_admin_session'

// What a store manager may do in each admin section (the owner ticks these on the Managers page).
// Sections with fewer actions simply leave the others out (e.g. orders has no create or delete).
export type ManagerAction = 'view' | 'create' | 'edit' | 'delete'
export type ManagerSection =
  | 'dashboard' | 'customers' | 'orders' | 'reviews' | 'products'
  | 'categories' | 'coupons' | 'offers' | 'free_shipping' | 'banners' | 'announcements' | 'enquiries' | 'blogs'
export type ManagerPermissions = Partial<Record<ManagerSection, Partial<Record<ManagerAction, boolean>>>>

// role "admin": the store owner, allowed everything. role "manager": staff, allowed what permissions say.
// adminId is the store's id in both cases (a manager's token carries their store's id).
export type AdminSession = {
  token: string
  adminId: string
  email: string
  expiresAt: number
  role: 'admin' | 'manager'
  managerId?: string
  loginId?: string
  permissions?: ManagerPermissions
}

// Reads the store id, email, role and expiry the backend put in the JWT.
// For display and URLs only: the server checks the signature (and a manager's access) on every request.
function readToken(token: string): Omit<AdminSession, 'token' | 'permissions'> | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.sub) return null
    const role = payload.role === 'manager' ? 'manager' : 'admin'
    return {
      adminId: String(payload.sub),
      email: String(payload.email ?? ''),
      expiresAt: Number(payload.exp) * 1000,
      role,
      ...(role === 'manager' ? { managerId: String(payload.manager_id ?? ''), loginId: String(payload.login_id ?? '') } : {}),
    }
  } catch {
    return null
  }
}

export function saveAdminSession(token: string, permissions?: ManagerPermissions): AdminSession | null {
  const info = readToken(token)
  if (!info) return null
  const session: AdminSession = { token, ...info, ...(info.role === 'manager' ? { permissions: permissions ?? {} } : {}) }
  writeStored(KEY, session)
  return session
}

/** A manager's tick boxes changed (the panel re-reads them as they move around). */
export function updateManagerPermissions(permissions: ManagerPermissions) {
  const session = getAdminSession()
  if (session?.role === 'manager') writeStored(KEY, { ...session, permissions })
}

export function getAdminSession(): AdminSession | null {
  const session = readStored<AdminSession | null>(KEY, null)
  // The token lasts a day; an expired one would only fail on the first request.
  // Sessions saved before adminId or role were stored are dropped too, so the user signs in once more.
  if (!session || !session.adminId || !session.role || session.expiresAt <= Date.now()) {
    if (session) writeStored(KEY, null)
    return null
  }
  return session
}

export function clearAdminSession() {
  writeStored(KEY, null)
}

/** Where to sign in again: managers have their own page. With nobody signed in, the address
 * tells: someone on a /manager/... page is a manager. */
export function signInPath(session: AdminSession | null = getAdminSession()): string {
  if (session) return session.role === 'manager' ? '/manager-login' : '/admin-login'
  return typeof window !== 'undefined' && /^\/manager(\/|$)/.test(window.location.pathname) ? '/manager-login' : '/admin-login'
}
