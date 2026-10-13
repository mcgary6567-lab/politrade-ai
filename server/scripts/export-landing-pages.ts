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

const SITE = process.env.SITE_URL ?? "https://hillradar.com";
const META: Record<string, { title: string; desc: string; crumb: string }> = {
  faq: { title: "Help Center & FAQ — Congress Stock Trades Tracker | Hillradar AI", crumb: "Help Center & FAQ", desc: "Answers on where Hillradar AI's congressional trade data comes from, filing speed, AI Scanning, the Investment Plan, Free vs Pro pricing and alerts." },
  terms: { title: "Terms & Conditions | Hillradar AI", crumb: "Terms & Conditions", desc: "Terms for using Hillradar AI: accounts, Free and Pro plans, billing and refunds, acceptable use, data sources, no financial advice, liability, governing law." },
  privacy: { title: "Privacy Policy | Hillradar AI", crumb: "Privacy Policy", desc: "What Hillradar AI collects, how it is used and protected, cookies, retention, your rights and how to reach us. We never sell personal data." },
  disclaimer: { title: "Disclaimer — Not Financial Advice | Hillradar AI", crumb: "Disclaimer", desc: "Hillradar AI republishes public STOCK Act disclosures for research and education. Not financial advice; known data limitations, no warranty, corrections." },
  contact: { title: "Contact Us | Hillradar AI", crumb: "Contact Us", desc: "Reach Hillradar AI for account help, Pro membership, data corrections, press and partnerships. Most messages get a reply within one business day." },
};
const out = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(path.join(out, "index.html"))) { console.error("usage: export-landing-pages.ts <path to the hillradar-landing checkout>"); process.exit(1); }
const pages = ["faq", "terms", "privacy", "disclaimer", "contact"] as const;
const local = new Set(pages);

for (const kind of pages) {
  let html = legalPage(kind);
  html = html
    // sibling public pages live next to this file
    .replace(/href="\/(faq|terms|privacy|disclaimer|contact)(#[^"]*)?"/g, (_m, p, h = "") => (local.has(p) ? `href="/${p}/${h}"` : _m))
    .replace(/href="\/help"/g, 'href="/faq/"')
    // brand / home links go to the landing root
    .replace(/href="\/"/g, 'href="/"')
    .replace(/← Back to the app/g, "← Back to home")
    // icons from the landing assets
    .replace(/src="\/icon\.svg"/g, 'src="/assets/logo.svg"')
    .replace(/src="\/icon-192\.png"/g, 'src="/assets/icon-192.png"')
    .replace(/href="\/favicon\.png"/g, 'href="/assets/favicon.png"')
    // app links (/settings, /signup, /login, /invest …) are rewritten at runtime by app.js using config.js
    .replace("</body>", '<div class="cookie" id="cookie" hidden style="position:fixed;left:12px;right:12px;bottom:12px;z-index:40;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:#121a2e;border:1px solid #223052;border-radius:14px;padding:12px 14px;font-size:.88rem;color:#c3ccdd;max-width:720px;margin:0 auto"><span>We use cookies for analytics and, where shown, advertising. See our <a href="/privacy/">Privacy Policy</a>.</span><button type="button" id="cookie-ok" class="btn">OK</button></div>\n<script src="/config.js"></script>\n<script src="/app.js" defer></script>\n</body>');
  // SEO head: canonical, strong description, robots, social cards, breadcrumb + WebPage schema
  const m = META[kind]; const url = `${SITE}/${kind}/`;
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${m.title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${m.desc}">`)
    .replace('<link rel="icon" href="/assets/favicon.png">', `<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="theme-color" content="#0a0f1c">
<link rel="icon" href="/assets/favicon.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:site_name" content="Hillradar AI"><meta property="og:type" content="article"><meta property="og:url" content="${url}"><meta property="og:title" content="${m.title}"><meta property="og:description" content="${m.desc}"><meta property="og:image" content="${SITE}/assets/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${m.title}"><meta name="twitter:description" content="${m.desc}"><meta name="twitter:image" content="${SITE}/assets/og-image.png">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [
  { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: m.crumb, item: url }] },
  { "@type": "WebPage", "@id": `${url}#webpage`, url, name: m.title, description: m.desc, isPartOf: { "@id": `${SITE}/#website` }, publisher: { "@id": `${SITE}/#org` }, inLanguage: "en-US", dateModified: new Date().toISOString().slice(0, 10) },
] }).replace(/</g, "\\u003c")}</script>`)
    .replace('<img src="/assets/logo.svg" width="42" height="42" alt="">', '<img src="/assets/logo.svg" width="42" height="42" alt="Hillradar AI logo">')
    // legal nav gets a Blog link and the back link goes to the site root
    .replace('<nav class="nav">', '<nav class="nav">');
  fs.mkdirSync(path.join(out, kind), { recursive: true });
  fs.writeFileSync(path.join(out, kind, "index.html"), html);
  console.log(`wrote ${kind}/index.html (${(html.length / 1024).toFixed(1)} KB)`);
}
try { fs.unlinkSync(process.env.DB_PATH!); fs.unlinkSync(process.env.DB_PATH! + "-wal"); fs.unlinkSync(process.env.DB_PATH! + "-shm"); } catch {}
