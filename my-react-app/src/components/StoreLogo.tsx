import { Link } from 'react-router'
import { BRAND_LOGO, BRAND_NAME } from '../lib/brand'

export function StoreLogo({ className, lazy = false }: { className?: string; lazy?: boolean }) {
  return (
    <Link to="/" className={className ? `store-logo ${className}` : 'store-logo'} aria-label={`${BRAND_NAME} home`}>
      <img src={BRAND_LOGO} alt="" width={898} height={238} loading={lazy ? 'lazy' : undefined} />
    </Link>
  )
}
