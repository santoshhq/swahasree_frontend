# Swahasree storefront

The storefront and the admin and manager panels share the Swahasree FastAPI backend.

## Local development

Start the backend on port 6767, then run `npm ci` and `npm run dev` here. Vite forwards `/api` to the backend. Set `API_PROXY_TARGET` if FastAPI runs at another address.

Put the backend's public Google OAuth client ID in `VITE_GOOGLE_CLIENT_ID` in `.env.local`. Google must allow the storefront's origin. For a deployment that uses the bundled nginx proxy, keep `VITE_API_URL` unset. Set it only when the browser needs to use a separate API origin.

The support email defaults to `info@swahasree.com`. Optional storefront settings are `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_WHATSAPP_NUMBER` and `VITE_SITE_URL`. Set `VITE_SELLER_LEGAL_NAME`, `VITE_SELLER_ADDRESS` (separate lines with `|`) and `VITE_SELLER_GSTIN` for printed invoices.

Run `npm run build` for a production build. Set `SITEMAP_API` to the chosen backend URL if the sitemap should include the current catalog and blog.

## Demo catalog

The three test products use images in `public/brand`. The backend's `scripts/seed_demo_products.py --apply` seeds them in the configured test database. If the test database has no store owner, rerun the script after creating the Swahasree owner to attach the demo products to that owner.
