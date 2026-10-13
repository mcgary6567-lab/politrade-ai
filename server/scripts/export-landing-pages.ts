/**
 * Export the public pages (FAQ, Terms, Privacy, Disclaimer, Contact) as static HTML into the landing folder,
 * so the marketing site on hillradar.com serves them itself. Only sign-in / sign-up / in-app links point at the app.
 *   usage: npx tsx scripts/export-landing-pages.ts <path-to-hillradar-landing-checkout>
 */
import fs from "node:fs";
import path from "node:path";
process.env.DB_PATH ??= path.join(process.cwd(), ".export-tmp.db");
const { migrate } = await import("../src/db.js");
migrate();
const { legalPage } = await import("../src/legal.js");

const out = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(path.join(out, "index.html"))) { console.error("usage: export-landing-pages.ts <path to the hillradar-landing checkout>"); process.exit(1); }
const pages = ["faq", "terms", "privacy", "disclaimer", "contact"] as const;
const local = new Set(pages);

for (const kind of pages) {
  let html = legalPage(kind);
  html = html
    // sibling public pages live next to this file
    .replace(/href="\/(faq|terms|privacy|disclaimer|contact)(#[^"]*)?"/g, (_m, p, h = "") => (local.has(p) ? `href="${p}.html${h}"` : _m))
    .replace(/href="\/help"/g, 'href="faq.html"')
    // brand / home links go to the landing root
    .replace(/href="\/"/g, 'href="./"')
    .replace(/← Back to the app/g, "← Back to home")
    // icons from the landing assets
    .replace(/src="\/icon\.svg"/g, 'src="assets/logo.svg"')
    .replace(/src="\/icon-192\.png"/g, 'src="assets/icon-192.png"')
    .replace(/href="\/favicon\.png"/g, 'href="assets/favicon.png"')
    // app links (/settings, /signup, /login, /invest …) are rewritten at runtime by app.js using config.js
    .replace("</body>", '<script src="config.js"></script>\n<script src="app.js" defer></script>\n</body>');
  fs.writeFileSync(path.join(out, `${kind}.html`), html);
  console.log(`wrote ${kind}.html (${(html.length / 1024).toFixed(1)} KB)`);
}
try { fs.unlinkSync(process.env.DB_PATH!); fs.unlinkSync(process.env.DB_PATH! + "-wal"); fs.unlinkSync(process.env.DB_PATH! + "-shm"); } catch {}
