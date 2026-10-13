# Landing page (static)

Hillradar marketing / Google Ads landing page. Plain HTML, CSS and JS. No build step.

## Files
- `index.html` – the page
- `styles.css` – all styling
- `app.js` – fills live numbers and latest filings from the app's public API, rewrites app links
- `config.js` – **edit this**: `APP_URL` (where the app runs) and `API_URL` (same server)
- `assets/` – icons

## Deploy
Upload the folder to any static host (cPanel/Hostinger `public_html`, Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3).
Point your domain at it. Done.

## Live data
`app.js` calls `API_URL + /api/public/landing` (read-only, no auth, CORS open). If the API is unreachable the static
fallback numbers in the HTML stay, so the page never looks broken.

## Ads
Final URL: the root of this domain. Links to sign-up keep `?plan=` and `utm_*` parameters.
