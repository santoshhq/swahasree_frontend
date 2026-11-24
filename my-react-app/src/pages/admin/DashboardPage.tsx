import { Link } from 'react-router'
import { StatusPill } from '../../components/StatusPill'
import { ErrorState, Loading, ProductImage } from '../../components/ui'
import { getDashboard } from '../../lib/adminApi'
import { ORDER_STEPS, STATUS_LABELS, money, orderDate, plural } from '../../lib/format'
import type { OrderStatus } from '../../lib/types'
import { useFetch } from '../../lib/useFetch'
import { AdminPageHead, Panel, StatTile } from './AdminUi'
import { panel } from '../../lib/panelPath'

const ALL_STATUSES: OrderStatus[] = [...ORDER_STEPS, 'cancelled', 'returned']

export function DashboardPage() {
  const dashboard = useFetch((signal) => getDashboard(signal), 'admin-dashboard')

  if (dashboard.loading && !dashboard.data) return <Loading label="Loading your store…" />
  if (dashboard.error) return <ErrorState message={dashboard.error.message} onRetry={dashboard.reload} />
  const d = dashboard.data
  if (!d) return null

  const storeName = d.admin.store_name?.trim()
  const toConfirm = d.orders_by_status.placed ?? 0
  const busiest = Math.max(1, ...ALL_STATUSES.map((s) => d.orders_by_status[s] ?? 0))

  return (
    <>
      <AdminPageHead
        title={`Welcome to ${storeName || 'your store'}`}
        subtitle={toConfirm ? <><strong>{toConfirm}</strong> new {toConfirm === 1 ? 'order is' : 'orders are'} waiting to be confirmed.</> : 'No new orders are waiting for you.'}
        actions={toConfirm ? <Link to={panel('/admin/orders?status=placed')} className="admin-button">Review new orders</Link> : undefined}
      />

      <div className="stats">
        <StatTile tone="forest" label="Orders today" value={d.today.count} detail={`${money(d.today.total)} in order value`} />
        <StatTile tone="gold" label="Cash to collect (COD)" value={money(d.to_collect.total)} detail={`from ${d.to_collect.count} open ${d.to_collect.count === 1 ? 'order' : 'orders'}`} />
        <StatTile label="Collected this month" value={money(d.collected_this_month.total)} detail={plural(d.collected_this_month.count, 'order')} />
        <StatTile label="Products for sale" value={`${d.products.active} / ${d.products.total}`} detail={`${d.categories} categories, ${d.active_coupons} live coupons`} />
      </div>

      <div className="dash-grid">
        <Panel title="Recent orders" actions={<Link to={panel('/admin/orders')} className="panel__link">All orders</Link>} className="dash-grid__wide">
          {d.recent_orders.length ? (
            <div className="table-wrap">
              <table className="table table--cards">
                <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Status</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {d.recent_orders.map((o) => (
                    <tr key={o.order_id}>
                      <td className="cell-main"><Link to={panel(`/admin/orders/${o.order_id}`)} className="table__strong">{o.order_number}</Link></td>
                      <td data-label="Customer">{o.customer.full_name}<span className="table__sub">{o.customer.mobile_number}</span></td>
                      <td data-label="Placed">{orderDate(o.created_at)}</td>
                      <td className="cell-aside"><StatusPill status={o.status} /></td>
                      <td className="num" data-label="Total">{money(o.pricing.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel__empty">Orders will show up here as soon as customers start buying.</p>
          )}
        </Panel>

        <Panel title="Orders by status">
          <ul className="status-bars">
            {ALL_STATUSES.map((s) => {
              const n = d.orders_by_status[s] ?? 0
              return (
                <li key={s}>
                  <Link to={panel(`/admin/orders?status=${s}`)} className="status-bars__row">
                    <span className="status-bars__label">{STATUS_LABELS[s]}</span>
                    <span className="status-bars__track"><span className={`status-bars__fill status-bars__fill--${s}`} style={{ width: n ? `${Math.max(2, (n / busiest) * 100)}%` : 0 }} /></span>
                    <span className="status-bars__count">{n}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title={`Low stock (${d.low_stock_threshold} or fewer)`} actions={<Link to={panel('/admin/products')} className="panel__link">All products</Link>}>
          {d.low_stock.length ? (
            <ul className="dashboard-stock-list">
              {d.low_stock.map((row) => {
                const stockState = row.stock_qty === 0 ? 'out' : row.stock_qty <= 2 ? 'critical' : 'low'
                return (
                  <li className="dashboard-stock-row" key={`${row.product_id}|${row.variant_name}`}>
                    <ProductImage src={row.image} alt="" className="dashboard-stock-row__image" />
                    <Link
                      to={panel(`/admin/products/${row.product_id}/edit`)}
                      className="dashboard-stock-row__details"
                      title={`${row.product_name} — ${row.variant_name}`}
                    >
                      <span className="dashboard-stock-row__name">{row.product_name}</span>
                      <span className="dashboard-stock-row__variant">{row.variant_name}</span>
                    </Link>
                    <span
                      className={`dashboard-stock-badge dashboard-stock-badge--${stockState}`}
                      aria-label={row.stock_qty === 0 ? '0 left, out of stock' : `${row.stock_qty} left, ${stockState === 'critical' ? 'critical' : 'low stock'}`}
                    >
                      {row.stock_qty === 0 ? 'Out of stock' : `${row.stock_qty} left`}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="panel__empty">Every product has more than {d.low_stock_threshold} in stock.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
