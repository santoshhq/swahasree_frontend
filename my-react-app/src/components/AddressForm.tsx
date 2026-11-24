import { useState, type KeyboardEvent } from 'react'
import { ApiError, addAddress, updateAddress } from '../lib/api'
import type { AddressInput, AddressType, CountryName, SavedAddress } from '../lib/types'
import { useAuth } from '../state/auth'
import { ADDRESS_TYPES, COUNTRIES, DEFAULT_COUNTRY, STATES_BY_COUNTRY, matchState } from '../lib/addresses'

type Draft = {
  address_type: AddressType
  full_name: string
  mobile_number: string
  alternative_mobilenumber: string
  House_number_building_street: string
  Area_or_locality: string
  Landmark: string
  City_or_town: string
  PIN_code: string
  Country: CountryName
  State: string
  is_default: boolean
}
type TextField = Exclude<keyof Draft, 'address_type' | 'is_default' | 'Country'>

function toDraft(a: SavedAddress | null, name: string): Draft {
  const country = a?.Country ?? DEFAULT_COUNTRY
  return {
    address_type: a?.address_type ?? 'home',
    full_name: a?.full_name ?? name,
    mobile_number: a?.mobile_number ?? '',
    alternative_mobilenumber: a?.alternative_mobilenumber ?? '',
    House_number_building_street: a?.House_number_building_street ?? '',
    Area_or_locality: a?.Area_or_locality ?? '',
    Landmark: a?.Landmark ?? '',
    City_or_town: a?.City_or_town ?? '',
    PIN_code: a?.PIN_code ?? '',
    Country: country,
    // A state saved in another spelling is picked again from the list.
    State: matchState(country, a?.State),
    is_default: a?.is_default ?? false,
  }
}

// Same rules as the backend, checked here first so mistakes show next to the field.
function validate(d: Draft): Partial<Record<TextField, string>> {
  const errors: Partial<Record<TextField, string>> = {}
  if (!d.full_name.trim()) errors.full_name = 'Enter the name of the person receiving the order'
  if (!/^[6-9]\d{9}$/.test(d.mobile_number)) errors.mobile_number = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9'
  if (d.alternative_mobilenumber && !/^[6-9]\d{9}$/.test(d.alternative_mobilenumber)) {
    errors.alternative_mobilenumber = 'Enter a 10-digit mobile number, or leave this empty'
  }
  if (!d.House_number_building_street.trim()) errors.House_number_building_street = 'Enter your house number, building and street'
  if (!d.City_or_town.trim()) errors.City_or_town = 'Enter your city or town'
  if (!d.State) errors.State = 'Choose your state'
  if (!/^[1-9]\d{5}$/.test(d.PIN_code)) errors.PIN_code = 'Enter a 6-digit PIN code'
  return errors
}

type Props = {
  token: string
  // The address being edited; null adds a new one.
  address: SavedAddress | null
  // Prefills the name on a new address (the Google account's name).
  defaultName?: string
  // The very first address is always the default, so the checkbox is left out.
  isFirst?: boolean
  onSaved: (address: SavedAddress) => void
  // Left out when there's nothing to go back to (a new customer's first address).
  onCancel?: () => void
}

export function AddressForm({ token, address, defaultName = '', isFirst = false, onSaved, onCancel }: Props) {
  const { signOut } = useAuth()
  const [draft, setDraft] = useState<Draft>(() => toDraft(address, defaultName))
  const [errors, setErrors] = useState<Partial<Record<TextField, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const idPrefix = `address-${address?.address_id ?? 'new'}`

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }))
    if (field in errors) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  // The states follow the country; one the new country doesn't have is cleared.
  const setCountry = (country: CountryName) => {
    setDraft((d) => ({ ...d, Country: country, State: matchState(country, d.State) }))
  }

  const save = async () => {
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`${idPrefix}-${Object.keys(found)[0]}`)?.focus()
      return
    }
    const body: AddressInput = {
      address_type: draft.address_type,
      full_name: draft.full_name.trim(),
      mobile_number: draft.mobile_number,
      alternative_mobilenumber: draft.alternative_mobilenumber || null,
      House_number_building_street: draft.House_number_building_street.trim(),
      Area_or_locality: draft.Area_or_locality.trim() || null,
      Landmark: draft.Landmark.trim() || null,
      City_or_town: draft.City_or_town.trim(),
      PIN_code: draft.PIN_code,
      Country: draft.Country,
      State: draft.State,
      is_default: isFirst || draft.is_default,
    }
    setSaving(true)
    setSaveError(null)
    try {
      const result = address ? await updateAddress(token, address.address_id, body) : await addAddress(token, body)
      onSaved(result.address)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) signOut('expired')
      else { setSaveError((err as Error).message); setSaving(false) }
    }
  }

  // This sits inside the checkout form: Enter saves the address instead of placing the order.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      save()
    }
  }

  const field = (name: TextField, label: string, props: Record<string, unknown> = {}) => (
    <div className={`field${errors[name] ? ' field--error' : ''}`}>
      <label htmlFor={`${idPrefix}-${name}`}>{label}</label>
      <input
        id={`${idPrefix}-${name}`}
        value={draft[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${idPrefix}-${name}-error` : undefined}
        {...props}
      />
      {errors[name] && <p className="field__error" id={`${idPrefix}-${name}-error`}>{errors[name]}</p>}
    </div>
  )
  const digits = (name: TextField, max: number) => ({
    inputMode: 'numeric',
    maxLength: max,
    onChange: (e: { target: { value: string } }) => set(name, e.target.value.replace(/\D/g, '').slice(0, max)),
  })

  return (
    <div className="address-form" role="group" aria-label={address ? 'Edit address' : 'New address'} onKeyDown={onKeyDown}>
      <div className="address-form__types" role="radiogroup" aria-label="Address type">
        {ADDRESS_TYPES.map(({ id, label, icon: Icon }) => (
          <label key={id} className={`address-chip${draft.address_type === id ? ' is-on' : ''}`}>
            <input type="radio" name={`${idPrefix}-type`} checked={draft.address_type === id} onChange={() => set('address_type', id)} />
            <Icon size={16} />
            {label}
          </label>
        ))}
      </div>

      <div className="field-row">
        {field('full_name', 'Full name', { autoComplete: 'name' })}
        {field('mobile_number', 'Mobile number', { type: 'tel', autoComplete: 'tel-national', ...digits('mobile_number', 10) })}
      </div>
      {field('alternative_mobilenumber', 'Alternative mobile number (optional)', { type: 'tel', ...digits('alternative_mobilenumber', 10) })}
      {field('House_number_building_street', 'House number, building and street', { autoComplete: 'address-line1' })}
      <div className="field-row">
        {field('Area_or_locality', 'Area or locality (optional)', { autoComplete: 'address-line2' })}
        {field('Landmark', 'Landmark (optional)')}
      </div>
      <div className="field-row">
        {field('City_or_town', 'City or town', { autoComplete: 'address-level2' })}
        {field('PIN_code', 'PIN code', { autoComplete: 'postal-code', ...digits('PIN_code', 6) })}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-Country`}>Country</label>
          <select id={`${idPrefix}-Country`} value={draft.Country} onChange={(e) => setCountry(e.target.value as CountryName)} autoComplete="country-name">
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className={`field${errors.State ? ' field--error' : ''}`}>
          <label htmlFor={`${idPrefix}-State`}>State</label>
          <select id={`${idPrefix}-State`} value={draft.State} onChange={(e) => set('State', e.target.value)} aria-invalid={!!errors.State} autoComplete="address-level1">
            <option value="">Choose…</option>
            {STATES_BY_COUNTRY[draft.Country].map((s) => <option key={s}>{s}</option>)}
          </select>
          {errors.State && <p className="field__error">{errors.State}</p>}
        </div>
      </div>

      {!isFirst && !address?.is_default && (
        <label className="address-form__default">
          <input type="checkbox" checked={draft.is_default} onChange={(e) => set('is_default', e.target.checked)} />
          Make this my default address
        </label>
      )}

      {saveError && <p className="notice notice--warn" role="alert">{saveError}</p>}
      <div className="address-form__actions">
        <button type="button" className="address-form__save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : address ? 'Save changes' : 'Save address'}
        </button>
        {onCancel && <button type="button" className="text-button" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </div>
  )
}
