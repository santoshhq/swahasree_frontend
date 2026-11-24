
// The illustrated range under the home page banner
// (one square per illustration; the labels are written out so they stay sharp and readable).
// The keys are the backend's RangeTile (models/categories_model.py): the admin links a category to
// a picture when creating or editing it, and the picture then opens that category.
export type RangeTileKey =
  | 'combo-deals' | 'dry-fruits-nuts' | 'flour-atta-suji' | 'health-foods' | 'pulses-dal'
  | 'oils-ghee' | 'ready-to-cook' | 'rice-products' | 'salts-sugar' | 'spices-masalas'

export const RANGE_TILES: { key: RangeTileKey; label: string; icon: string }[] = [
  { key: 'combo-deals', label: 'Combo & Deals', icon: '/favicon-96x96.png' },
  { key: 'dry-fruits-nuts', label: 'Dry Fruits & Nuts', icon: '/favicon-96x96.png' },
  { key: 'flour-atta-suji', label: 'Flour / Atta & Suji', icon: '/favicon-96x96.png' },
  { key: 'health-foods', label: 'Health Foods', icon: '/favicon-96x96.png' },
  { key: 'pulses-dal', label: 'Pulses & Dal', icon: '/favicon-96x96.png' },
  { key: 'oils-ghee', label: 'Oils & Ghee', icon: '/favicon-96x96.png' },
  { key: 'ready-to-cook', label: 'Ready To Cook', icon: '/favicon-96x96.png' },
  { key: 'rice-products', label: 'Rice & Rice Products', icon: '/favicon-96x96.png' },
  { key: 'salts-sugar', label: 'Salts & Sugar', icon: '/favicon-96x96.png' },
  { key: 'spices-masalas', label: 'Spices & Masalas', icon: '/favicon-96x96.png' },
]
