export const BRAND_NAME = 'Swahasree'
export const BRAND_RED = '#e51e25'
export const BRAND_LOGO = '/brand/swahasree-logo-red-gold.webp'
export const BRAND_LOGO_SIZE = { width: 1200, height: 287 }
export const BRAND_MARK = '/favicon-96x96.png?v=red-gold'
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'info@swahasree.com'
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE?.trim() || ''
export const SUPPORT_PHONE_DISPLAY = SUPPORT_PHONE
const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER?.trim() || '+91 93922 39402'
export const WHATSAPP_DIGITS = whatsappNumber.replace(/\D/g, '')
export const WHATSAPP_URL = WHATSAPP_DIGITS ? `https://wa.me/${WHATSAPP_DIGITS}` : ''
export const WHATSAPP_DISPLAY = WHATSAPP_DIGITS ? `+${whatsappNumber.replace(/^\+/, '')}` : ''
