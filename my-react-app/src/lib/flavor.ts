import type { FlavorField, FlavorSelection, ProductCustomization } from './types'

export const FLAVOR_LEVELS = ['Low', 'Medium', 'High'] as const
export const FLAVOR_FIELDS = ['spicy_level', 'oil_level', 'salt_level'] as const
export const FLAVOR_LABELS: Record<FlavorField, string> = { spicy_level: 'Spice', oil_level: 'Oil', salt_level: 'Salt' }
export const enabledFlavors = (settings?: ProductCustomization) => FLAVOR_FIELDS.filter((field) => settings?.[field])

export function flavorSummary(selection?: FlavorSelection) {
  return FLAVOR_FIELDS.flatMap((field) => selection?.[field] ? [`${FLAVOR_LABELS[field]}: ${selection[field]}`] : []).join(', ')
}
