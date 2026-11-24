import { HomeIcon, PinIcon, WorkIcon } from '../components/Icons'
import type { AddressType, CountryName } from './types'

// Where the store delivers: India only for now (Shiprocket is set up for domestic delivery).
// The backend checks the same names (config/locations.py); keep them in step.
export const COUNTRIES: CountryName[] = ['India']
export const DEFAULT_COUNTRY: CountryName = 'India'

// India's states and union territories.
const INDIA_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

export const STATES_BY_COUNTRY: Record<CountryName, string[]> = { India: INDIA_STATES }

/** The listed spelling of a saved state ("telangana" -> "Telangana"), or '' when the country doesn't have it. */
export function matchState(country: CountryName, state: string | null | undefined): string {
  const wanted = (state ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return STATES_BY_COUNTRY[country].find((s) => s.toLowerCase() === wanted) ?? ''
}

export const ADDRESS_TYPES: { id: AddressType; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'work', label: 'Work', icon: WorkIcon },
  { id: 'other', label: 'Other', icon: PinIcon },
]
