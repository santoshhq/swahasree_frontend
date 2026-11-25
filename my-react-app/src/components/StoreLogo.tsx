import { Link } from 'react-router'
import { BRAND_LOGO, BRAND_LOGO_SIZE, BRAND_NAME } from '../lib/brand'

export function StoreLogo({ className, lazy = false }: { className?: string; lazy?: boolean }) {
  return (
    <Link to="/" className={className ? `store-logo ${className}` : 'store-logo'} aria-label={`${BRAND_NAME} home`}>
      <img src={BRAND_LOGO} alt="" {...BRAND_LOGO_SIZE} loading={lazy ? 'lazy' : undefined} />
    </Link>
  )
}
