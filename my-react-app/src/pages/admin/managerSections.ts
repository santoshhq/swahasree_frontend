import type { ReactElement } from 'react'
import type { ManagerAction, ManagerPermissions, ManagerSection } from '../../lib/adminSession'
import {
  AnnouncementIcon, BlogIcon, BoxIcon, CustomersIcon, DashboardIcon, EnquiriesIcon, FreeShippingIcon, ImageIcon, OffersIcon, OrdersIcon, ReviewsIcon, TagIcon, TicketIcon,
} from './AdminIcons'

export const ACTIONS: ManagerAction[] = ['view', 'create', 'edit', 'delete']
export const ACTION_LABELS: Record<ManagerAction, string> = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' }

type Icon = (props: { size?: number; className?: string }) => ReactElement

export type SectionInfo = { key: ManagerSection; label: string; icon: Icon; actions: ManagerAction[]; note?: string }

// The sections a manager can be let into, grouped like the admin menu, with the actions each one
// has (the same as the backend's models/manager_model.py). An action a section doesn't have shows as "—".
export const SECTION_GROUPS: { heading: string; sections: SectionInfo[] }[] = [
  { heading: 'Overview', sections: [
    { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, actions: ['view'] },
  ] },
  { heading: 'Sales', sections: [
    { key: 'orders', label: 'Orders', icon: OrdersIcon, actions: ['view', 'edit'], note: 'Edit: confirm, book courier, cancel' },
    { key: 'customers', label: 'Customers', icon: CustomersIcon, actions: ['view'] },
    { key: 'coupons', label: 'Coupons', icon: TicketIcon, actions: ACTIONS },
    { key: 'offers', label: 'Offers', icon: OffersIcon, actions: ACTIONS },
    { key: 'free_shipping', label: 'Free shipping', icon: FreeShippingIcon, actions: ACTIONS },
    { key: 'enquiries', label: 'Bulk order enquiries', icon: EnquiriesIcon, actions: ['view', 'edit', 'delete'], note: 'Edit: mark as read' },
  ] },
  { heading: 'Catalogue', sections: [
    { key: 'products', label: 'Products', icon: BoxIcon, actions: ACTIONS, note: 'Edit includes price and stock' },
    { key: 'categories', label: 'Categories', icon: TagIcon, actions: ACTIONS },
    { key: 'reviews', label: 'Reviews', icon: ReviewsIcon, actions: ['view', 'edit'], note: 'Edit: approve, reject, reply' },
  ] },
  { heading: 'Store', sections: [
    { key: 'banners', label: 'Home page banners', icon: ImageIcon, actions: ACTIONS },
    { key: 'announcements', label: 'Announcement bar', icon: AnnouncementIcon, actions: ACTIONS },
    { key: 'blogs', label: 'Blog', icon: BlogIcon, actions: ACTIONS, note: 'Edit includes publishing and unpublishing' },
  ] },
]

export const SECTIONS: SectionInfo[] = SECTION_GROUPS.flatMap((g) => g.sections)

/** The tick boxes in the shape the backend saves: every action of every section, true or false. */
export function fullPermissions(p: ManagerPermissions): ManagerPermissions {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, Object.fromEntries(s.actions.map((a) => [a, !!p[s.key]?.[a]]))]))
}

export const sectionsWithAccess = (p: ManagerPermissions) => SECTIONS.filter((s) => p[s.key]?.view)

/** Whether a section allows more than looking: any of create, edit or delete. */
export const canChange = (p: ManagerPermissions, key: ManagerSection) => !!(p[key]?.create || p[key]?.edit || p[key]?.delete)

/** "View, edit" for a section, in action order. */
export function actionsText(p: ManagerPermissions, s: SectionInfo): string {
  const on = s.actions.filter((a) => p[s.key]?.[a]).map((a) => ACTION_LABELS[a].toLowerCase())
  return on.length ? on.join(', ').replace(/^./, (c) => c.toUpperCase()) : 'No access'
}
