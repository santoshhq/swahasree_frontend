import { createContext, useContext } from 'react'
import type { ManagerAction, ManagerPermissions, ManagerSection } from './adminSession'

// Who is using the admin panel. The layout (AdminLayout) provides it and keeps a manager's
// tick boxes fresh; pages ask useCan() before showing an add, edit or delete control.
// Hiding is only for a clear screen: the backend refuses anything not ticked either way.
export type AdminAccess = { isOwner: boolean; permissions: ManagerPermissions }

export const AdminAccessContext = createContext<AdminAccess>({ isOwner: true, permissions: {} })

export const useAdminAccess = () => useContext(AdminAccessContext)

export function allowed(access: AdminAccess, section: ManagerSection, action: ManagerAction = 'view'): boolean {
  return access.isOwner || !!access.permissions[section]?.[action]
}

/** What the signed-in person may do in a section: { view, create, edit, delete }. The owner may do everything. */
export function useCan(section: ManagerSection): Record<ManagerAction, boolean> {
  const access = useAdminAccess()
  return {
    view: allowed(access, section, 'view'),
    create: allowed(access, section, 'create'),
    edit: allowed(access, section, 'edit'),
    delete: allowed(access, section, 'delete'),
  }
}
