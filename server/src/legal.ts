import { config } from "./config.js";
import { integ } from "./settings.js";

/** Inline icons (no external requests): keys used by the section headers below. */
const I: Record<string, string> = {
  shield: '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
  scale: '<path d="M12 3v18M4 7h16M6 7l-3 7a4 4 0 0 0 6 0zM18 7l-3 7a4 4 0 0 0 6 0z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  cookie: '<path d="M21 12a9 9 0 1 1-9-9 3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3 3z"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="15" r="1"/><circle cx="9" cy="16" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  chart: '<path d="M3 20h18M6 16V9M11 16V4M16 16v-6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  x: '<path d="M4 4l16 16M20 4L4 20"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.5M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
  github: '<path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.8 2.8 5.8 3.1 5.8 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l2 2M19 3l2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  rocket: '<path d="M5 15l-2 6 6-2M14 4c3 0 6 3 6 6l-8 8-4-4z"/><circle cx="15" cy="9" r="1.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17v.5"/>',
};
export const ic = (k: string, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k] ?? I.info}</svg>`;

const UPDATED = "October 12, 2026";

type Section = { id: string; icon: string; title: string; html: string };

type LayoutOpts = { css?: string; script?: string; heroExtra?: string; headExtra?: string; sectionsLabel?: string };
function layout(title: string, lead: string, sections: Section[], kind: string, opts: LayoutOpts = {}): string {
  const name = integ.brandName();
  const nav = [["faq", "Briefing Room"], ["terms", "Terms"], ["privacy", "Privacy"], ["disclaimer", "Disclaimer"], ["contact", "Contact"]]
    .map(([k, l]) => `<a href="/${k}" class="${k === kind ? "on" : ""}">${l}</a>`).join("");
  const toc = sections.map((s, i) => `<li><a href="#${s.id}"><span>${i + 1}</span>${s.title}</a></li>`).join("");
  const body = sections.map((s, i) => `<section id="${s.id}"><h2><span class="ico">${ic(s.icon)}</span><span class="num">${i + 1}.</span> ${s.title}</h2>${s.html}</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · ${name}</title><meta name="description" content="${title} for ${name}."><link rel="icon" href="/favicon.png">
<style>
:root{--bg:#0a0f1c;--card:#121a2e;--line:#223052;--ink:#e7ecf5;--mute:#8a96ad;--gold:#e7b23c;--buy:#22c58b;--sell:#f26a6a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--gold);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:5;background:rgba(10,15,28,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.bar{display:flex;align-items:center;gap:14px;height:60px}.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.1rem;color:var(--ink)}
.brand b{color:var(--gold)}.nav{margin-left:auto;display:flex;gap:4px}.nav a{padding:7px 11px;border-radius:9px;font-size:.9rem;font-weight:600;color:#cdd6e6}.nav a.on,.nav a:hover{background:rgba(231,178,60,.14);color:var(--gold);text-decoration:none}
.hero{padding:44px 0 26px;border-bottom:1px solid var(--line)}.hero h1{margin:0 0 8px;font-size:2rem;line-height:1.2}.hero p{margin:0;color:var(--mute);max-width:720px}
.meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:.78rem;color:#cdd6e6}
.grid{display:grid;grid-template-columns:260px 1fr;gap:34px;padding:30px 0 70px}
aside{position:sticky;top:76px;align-self:start}aside h3{margin:0 0 10px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
aside ol{list-style:none;margin:0;padding:0;border-left:2px solid var(--line)}aside li a{display:flex;gap:10px;padding:6px 12px;color:#cdd6e6;font-size:.9rem}aside li a span{color:var(--gold);font-family:ui-monospace,monospace;font-size:.8rem}aside li a:hover{color:var(--gold);text-decoration:none}
section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin-bottom:16px;scroll-margin-top:80px}
section h2{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:1.15rem}.ico{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:rgba(231,178,60,.12);color:var(--gold);flex:none}.num{color:var(--mute);font-family:ui-monospace,monospace;font-size:.9rem}
section p{margin:8px 0;color:#d5dced}section ul,section ol{margin:8px 0 8px 2px;padding-left:22px}section li{margin:6px 0;color:#d5dced}section li::marker{color:var(--gold)}
.note{display:flex;gap:10px;background:rgba(231,178,60,.07);border:1px solid rgba(231,178,60,.3);border-radius:12px;padding:12px 14px;margin:12px 0;font-size:.93rem}.note.warn{background:rgba(242,106,106,.07);border-color:rgba(242,106,106,.35)}
.note svg{flex:none;color:var(--gold);margin-top:2px}.note.warn svg{color:var(--sell)}
table{width:100%;border-collapse:collapse;font-size:.92rem;margin:10px 0}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0}.card{border:1px solid var(--line);border-radius:14px;padding:16px;background:rgba(255,255,255,.02)}.card h4{margin:0 0 6px;display:flex;align-items:center;gap:8px;font-size:1rem}.card p{margin:0;color:var(--mute);font-size:.9rem}
.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:10px 14px;color:var(--ink);font-weight:600}.btn:hover{border-color:var(--gold);text-decoration:none}.btn.gold{background:var(--gold);color:#0a0f1c;border-color:var(--gold)}
footer{border-top:1px solid var(--line);padding:22px 0;color:var(--mute);font-size:.85rem}footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:860px){.grid{grid-template-columns:1fr;gap:18px}aside{position:static}aside ol{display:flex;flex-wrap:wrap;gap:6px;border-left:0}aside li a{border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:.82rem;gap:6px}aside li a small{display:none}.nav a{padding:6px 8px;font-size:.82rem}.hero h1{font-size:1.5rem}}
@media(max-width:600px){.bar{flex-wrap:wrap;height:auto;min-height:56px;padding:8px 0}.nav{margin-left:0;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.nav a{white-space:nowrap}.hero{padding:28px 0 20px}section{padding:16px 14px}table{display:block;overflow-x:auto}}
${opts.css ?? ""}</style>${opts.headExtra ?? ""}</head><body>
<header><div class="wrap bar"><a class="brand" href="/"><img src="/icon-192.png" width="30" height="30" alt="" style="border-radius:8px">${name.replace(/ AI$/, "")} <b>AI</b></a><nav class="nav">${nav}</nav></div></header>
<div class="wrap"><div class="hero"><h1>${title}</h1><p>${lead}</p><div class="meta"><span class="chip">${ic("clock", 14)} Last updated ${UPDATED}</span><span class="chip">${ic("file", 14)} ${sections.length} ${opts.sectionsLabel ?? "sections"}</span><span class="chip">${ic("globe", 14)} Applies worldwide</span></div>${opts.heroExtra ?? ""}</div>
<div class="grid"><aside><h3>On this page</h3><ol>${toc}</ol></aside><main>${body}</main></div></div>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${integ.companyName()} · ${name}. Data from public US congressional disclosures (STOCK Act).</span><span><a href="/">← Back to the app</a></span></div></footer>
${opts.script ?? ""}</body></html>`;
}

const note = (html: string, warn = false) => `<div class="note${warn ? " warn" : ""}">${ic(warn ? "alert" : "info", 18)}<div>${html}</div></div>`;

export function legalPage(kind: "privacy" | "terms" | "disclaimer" | "contact" | "faq"): string {
  const name = integ.brandName(), co = integ.companyName(), mail = integ.contactEmail(), law = integ.jurisdiction();
  const url = config.publicUrl.replace(/^https?:\/\//, "");

  if (kind === "faq") return faqPage(name, co, mail, law);

  if (kind === "terms") return layout("Terms & Conditions", `The agreement between you and ${co} for using ${name} — the website, the installable app, alerts and the API. Please read it; by creating an account you accept it.`, [
    { id: "acceptance", icon: "file", title: "Acceptance of these terms", html: `
      <p>These Terms &amp; Conditions ("Terms") govern your access to and use of ${name} at <b>${url}</b>, including the installable app, email / Telegram / WhatsApp alerts and any related services (together, the "Service"), operated by <b>${co}</b> ("we", "us").</p>
      <ul><li>By registering, signing in or using the Service you confirm that you have read, understood and agree to these Terms and to our <a href="/privacy">Privacy Policy</a> and <a href="/disclaimer">Disclaimer</a>, which form part of these Terms.</li>
      <li>If you do not agree, do not use the Service.</li>
      <li>If you use the Service on behalf of a company, you confirm you are authorised to bind that company.</li></ul>` },
    { id: "eligibility", icon: "user", title: "Eligibility & accounts", html: `
      <ul><li>You must be at least <b>18 years old</b> and legally able to enter into contracts.</li>
      <li>Accounts are created by you or by an administrator. You are responsible for keeping your password confidential and for all activity under your account. Tell us immediately at <a href="mailto:${mail}">${mail}</a> if you suspect unauthorised use.</li>
      <li>One person per account. Sharing an account, reselling access or scraping the Service on behalf of others is not permitted.</li>
      <li>We may suspend or close accounts that breach these Terms, with or without notice.</li></ul>` },
    { id: "plans", icon: "card", title: "Plans, payment & renewal", html: `
      <table><tr><th>Plan</th><th>Price</th><th>Includes</th></tr>
      <tr><td><b>Free</b></td><td>$0</td><td>Browse trades, politicians and issuers for the most recent 30 days; 1 watchlist item; the #1 AI signal.</td></tr>
      <tr><td><b>Pro</b></td><td>$300 per year</td><td>Full history since 2014, every AI signal with reasons and thesis, instant Telegram / WhatsApp / email alerts, unlimited watchlist, CSV export, track-record leaderboard, priority support.</td></tr></table>
      <ul><li>Prices are in US dollars and exclude any taxes you may owe. Current prices are always shown in the app; we may change prices for future periods with notice.</li>
      <li>Pro is billed <b>annually in advance</b>. Access starts when payment is confirmed and lasts 12 months. Unless you cancel before the renewal date, your plan renews for another year at the then-current price (where automatic billing is in place).</li>
      <li><b>Refunds:</b> you may request a full refund within <b>14 days</b> of your first Pro payment if you have not exported data or received more than 10 alerts. After that, payments are non-refundable except where the law requires otherwise.</li>
      <li>Cancelling stops the next renewal; you keep Pro features until the end of the paid period.</li>
      <li>If a payment fails or is reversed, we may downgrade the account to Free until it is settled.</li></ul>` },
    { id: "use", icon: "ban", title: "Acceptable use", html: `
      <p>You agree <b>not</b> to:</p>
      <ul><li>Copy, scrape, crawl or bulk-download the Service or its data except through features we provide (e.g. CSV export for your own research).</li>
      <li>Resell, redistribute or publicly republish our signals, scores, theses or compiled datasets, or build a competing service from them.</li>
      <li>Reverse-engineer, probe or disrupt the Service, bypass plan limits or access controls, or use automated tools that place unreasonable load on it.</li>
      <li>Use the Service for market manipulation, insider dealing, harassment of any lawmaker, or any unlawful purpose.</li>
      <li>Upload malicious code, or misrepresent your identity or affiliation.</li></ul>
      <p>You may quote small excerpts with attribution and a link to ${name}.</p>` },
    { id: "data", icon: "db", title: "Data sources & intellectual property", html: `
      <ul><li>Trade records originate from <b>public US government disclosures</b> filed under the STOCK Act (US House Clerk and US Senate Office of Public Records) and from public-domain datasets derived from them. These records are public information.</li>
      <li>Our compilation, normalisation, scores, signals, AI-generated notes, design, code and trademarks are the property of ${co} and protected by copyright and other laws. You receive a limited, revocable, non-exclusive licence to use the Service for personal or internal business research.</li>
      <li>Lawmaker photos and biographical data come from public-domain sources (United States Congress / the unitedstates project).</li>
      <li>Company names and tickers belong to their respective owners and are used for identification only.</li></ul>` },
    { id: "advice", icon: "alert", title: "No financial advice", html: `
      ${note(`<b>${name} is a research tool, not an adviser.</b> Nothing on the Service — including "AI Signals", scores, track records, theses or alerts — is investment, legal, tax or accounting advice, a recommendation, or an offer or solicitation to buy or sell any security.`, true)}
      <ul><li>Signals are statistical summaries of public filings. They do not know the future, do not account for your situation, and can be wrong.</li>
      <li>Lawmakers may file up to 45 days after a trade; prices may already have moved.</li>
      <li>You alone are responsible for your investment decisions. Consider consulting a licensed professional.</li></ul>
      <p>See the full <a href="/disclaimer">Disclaimer</a>.</p>` },
    { id: "availability", icon: "refresh", title: "Availability & changes", html: `
      <ul><li>We aim for high availability but the Service is provided <b>"as is" and "as available"</b>. Data feeds, third-party messaging platforms (Telegram, Meta/WhatsApp, email providers) and AI providers may be interrupted or change without notice.</li>
      <li>We may add, modify or remove features, and update these Terms. Material changes will be announced in the app or by email; continued use after the effective date means you accept the new Terms.</li>
      <li>We may suspend the Service for maintenance or security reasons.</li></ul>` },
    { id: "liability", icon: "scale", title: "Warranties & limitation of liability", html: `
      <ul><li>We make no warranty that the data is accurate, complete, current or fit for a particular purpose, or that the Service will be uninterrupted or error-free.</li>
      <li>To the fullest extent permitted by law, ${co} and its owners, staff and suppliers are <b>not liable</b> for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, investments, data or goodwill arising from your use of (or inability to use) the Service or reliance on its content.</li>
      <li>Our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim, or <b>US $100</b> if you paid nothing.</li>
      <li>Some jurisdictions do not allow certain exclusions; in that case they apply to the extent permitted.</li></ul>` },
    { id: "indemnity", icon: "shield", title: "Indemnity", html: `<p>You agree to indemnify and hold harmless ${co} from claims, losses and expenses (including reasonable legal fees) arising from your breach of these Terms, your misuse of the Service, or your violation of any law or third-party right.</p>` },
    { id: "termination", icon: "x", title: "Termination", html: `
      <ul><li>You may close your account at any time from Settings or by emailing <a href="mailto:${mail}">${mail}</a>.</li>
      <li>We may suspend or terminate access for breach of these Terms, suspected fraud or abuse, legal requirements, or discontinuation of the Service.</li>
      <li>Sections on intellectual property, no advice, liability, indemnity and governing law survive termination.</li></ul>` },
    { id: "law", icon: "globe", title: "Governing law & disputes", html: `
      <ul><li>These Terms are governed by the laws of <b>${law || "the United States of America"}</b>, without regard to conflict-of-law rules. The Service is operated for a US audience; if you access it from elsewhere you are responsible for compliance with your local laws.</li>
      <li>Before starting any formal proceeding, you agree to contact us first so we can try to resolve the matter informally within 30 days.</li>
      <li>Any dispute that cannot be resolved informally will be brought in the state or federal courts located in the United States, and you consent to their jurisdiction. Where permitted by law, claims must be brought individually and not as part of a class action.</li>
      <li>If any provision is found unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver.</li>
      <li>These Terms, the Privacy Policy and the Disclaimer are the entire agreement between you and ${co} regarding the Service.</li></ul>` },
    { id: "contact", icon: "mail", title: "Contact", html: `<p>Questions about these Terms: <a href="mailto:${mail}">${mail}</a> · <a href="/contact">Contact page</a>.</p>` },
  ], "terms");

  if (kind === "privacy") return layout("Privacy Policy", `How ${co} collects, uses and protects your information when you use ${name}. We keep the minimum needed to run the service and never sell your data.`, [
    { id: "summary", icon: "spark", title: "In short", html: `
      <div class="cards">
        <div class="card"><h4>${ic("user", 18)} What we keep</h4><p>Email, name, a hashed password, your plan, watchlist and the alert channels you add.</p></div>
        <div class="card"><h4>${ic("ban", 18)} What we don't do</h4><p>No selling of data, no advertising networks, no tracking across other sites.</p></div>
        <div class="card"><h4>${ic("bell", 18)} Alerts</h4><p>Only to the channels you connect yourself; switch them off any time in Settings.</p></div>
        <div class="card"><h4>${ic("lock", 18)} Control</h4><p>Edit or delete your data in Settings, or email us to delete the account entirely.</p></div>
      </div>` },
    { id: "collect", icon: "db", title: "Information we collect", html: `
      <table><tr><th>Category</th><th>Examples</th><th>Why</th></tr>
      <tr><td>Account</td><td>Email address, display name, password (stored only as a bcrypt hash), plan, sign-in times</td><td>To create and secure your account and apply your plan</td></tr>
      <tr><td>Preferences</td><td>Watchlist (politicians, tickers, parties), alert on/off switches</td><td>To decide which filings and signals to send you</td></tr>
      <tr><td>Alert channels</td><td>Telegram chat ID, WhatsApp number, alert email — <b>only if you add them</b></td><td>To deliver alerts where you asked</td></tr>
      <tr><td>Usage &amp; technical</td><td>IP address and browser type in server logs, error logs, the pages you request</td><td>Security, abuse prevention, keeping the service running</td></tr>
      <tr><td>Device storage</td><td>A sign-in token and recently viewed data in your browser / installed app (for offline use)</td><td>So the app opens quickly and works without internet</td></tr></table>
      <p>We do <b>not</b> collect payment card numbers ourselves; if you pay online, the payment provider processes your card under its own policy and tells us only that the payment succeeded.</p>
      <p>The lawmaker trade data shown in the app is <b>public government information</b> about public officials, not personal data about you.</p>` },
    { id: "use", icon: "chart", title: "How we use it", html: `
      <ul><li>Provide, personalise and secure the Service (sign-in, plan limits, watchlist, offline cache).</li>
      <li>Send the alerts you asked for, and transactional messages about your account (e.g. password changes, renewal notices).</li>
      <li>Investigate abuse, fraud or outages, and comply with legal obligations.</li>
      <li>Improve the Service using aggregated, de-identified statistics (e.g. "how many members use Telegram").</li></ul>
      <p>We do not use your personal data for profiling that has legal effects on you, and we do not sell or rent it.</p>` },
    { id: "share", icon: "send", title: "Who we share it with", html: `
      <p>Only the service providers needed to run ${name}, each bound to use data solely for that purpose:</p>
      <ul><li><b>Hosting</b> — the cloud provider that runs our servers and stores the database.</li>
      <li><b>Messaging</b> — Telegram (Bot API) if you connect Telegram; Meta Platforms (WhatsApp Cloud API) if you add a WhatsApp number; our email delivery provider if you add an alert email. Each receives only what is needed to deliver your message.</li>
      <li><b>AI providers</b> — when AI notes are enabled, a short description of a public trade (not your personal data) is sent to the AI provider to write the summary.</li>
      <li><b>Payment provider</b> — if you pay online.</li>
      <li><b>Legal</b> — if required by law, court order, or to protect rights, safety or the integrity of the Service.</li></ul>
      <p>We never share your email, number or watchlist with lawmakers, data vendors, advertisers or other members.</p>` },
    { id: "cookies", icon: "cookie", title: "Cookies & local storage", html: `
      <ul><li>We do not use advertising or third-party tracking cookies.</li>
      <li>Your browser keeps a <b>sign-in token</b> (so you stay logged in), small UI preferences, and — for offline use — copies of the pages and data you recently loaded. Clearing site data in your browser removes them.</li>
      <li>Fonts may be loaded from Google Fonts; Google may see your IP address when they are fetched.</li></ul>` },
    { id: "retention", icon: "clock", title: "Retention", html: `
      <ul><li>Account data is kept while your account is active. Delete your account and we remove your profile, watchlist and alert channels within 30 days; backups roll off within 90 days.</li>
      <li>Alert delivery logs are kept for up to 12 months for troubleshooting, then deleted.</li>
      <li>Server logs containing IP addresses are kept for up to 90 days.</li>
      <li>We may keep records required for tax, accounting or legal purposes for the statutory period.</li></ul>` },
    { id: "security", icon: "lock", title: "Security", html: `
      <ul><li>Passwords are hashed with bcrypt and never stored in plain text.</li><li>All traffic is encrypted with HTTPS; API keys and tokens are stored masked and only on the server.</li>
      <li>Access to production systems is limited to authorised staff.</li><li>No system is perfectly secure; if we discover a breach affecting you, we will notify you without undue delay as required by law.</li></ul>` },
    { id: "rights", icon: "user", title: "Your rights & choices", html: `
      <ul><li><b>Access / correct:</b> see and edit your profile, email, password, channels and watchlist in <a href="/settings">Settings</a>.</li>
      <li><b>Opt out of alerts:</b> switch off trade or signal alerts, disconnect Telegram, or remove your number / email in Settings.</li>
      <li><b>Export:</b> Pro members can export trades to CSV; email us for a copy of your account data.</li>
      <li><b>Delete:</b> email <a href="mailto:${mail}">${mail}</a> from your account address and we will delete the account.</li>
      <li>Depending on where you live (e.g. EU/UK GDPR, California CCPA), you may have additional rights such as portability, restriction, objection and the right to complain to a supervisory authority. We honour these requests and do not discriminate for exercising them.</li></ul>` },
    { id: "transfers", icon: "globe", title: "International transfers", html: `<p>Our servers may be located outside your country. Where required we rely on standard contractual safeguards for transfers. By using the Service you understand that your data may be processed in those locations.</p>` },
    { id: "children", icon: "ban", title: "Children", html: `<p>${name} is not intended for anyone under 18 and we do not knowingly collect data from children. If you believe a child has created an account, contact us and we will delete it.</p>` },
    { id: "changes", icon: "refresh", title: "Changes to this policy", html: `<p>We may update this policy from time to time. The "Last updated" date above shows the current version; significant changes will be announced in the app or by email.</p>` },
    { id: "contact", icon: "mail", title: "Contact", html: `<p>Privacy questions or requests: <a href="mailto:${mail}">${mail}</a>${integ.companyAddress() ? ` · ${co}, ${integ.companyAddress()}` : ""}.</p>` },
  ], "privacy");

  if (kind === "disclaimer") return layout("Disclaimer", `Please read this before relying on anything you see in ${name}. It explains where the data comes from, what the AI signals are — and what they are not.`, [
    { id: "advice", icon: "alert", title: "Not financial advice", html: `
      ${note(`<b>${name} does not provide investment, financial, legal or tax advice.</b> Every page, chart, score, "AI Signal", track record, thesis and alert is general information for research and education only.`, true)}
      <ul><li>Nothing here is a recommendation, solicitation or offer to buy, sell or hold any security, nor an endorsement of any lawmaker's trading.</li>
      <li>We do not know your financial situation, goals or risk tolerance. Information that is useful to one person may be unsuitable for another.</li>
      <li>Before making any investment decision, do your own research and consider consulting a licensed financial adviser.</li>
      <li>Investing involves risk, including the possible loss of all capital. <b>Past performance — of a lawmaker, a ticker or a signal — is not a guarantee of future results.</b></li></ul>` },
    { id: "sources", icon: "db", title: "Where the data comes from", html: `
      <ul><li>Trades are <b>self-reported</b> by members of Congress in Periodic Transaction Reports required by the STOCK Act, published by the <b>US House Clerk</b> and the <b>US Senate Office of Public Records</b>.</li>
      <li>We ingest those filings via public-domain datasets that parse the official documents, and refresh them on a schedule. A link to the original filing is kept with each trade where available.</li>
      <li>Lawmaker names, parties, states and photos come from the public <i>unitedstates/congress-legislators</i> and <i>unitedstates/images</i> projects.</li>
      <li>${name} is an independent product. It is <b>not affiliated with, endorsed by, or sponsored by</b> the US Congress, any government body, any lawmaker, or any company mentioned.</li></ul>` },
    { id: "limits", icon: "clock", title: "Known limitations of disclosure data", html: `
      <ul><li><b>Delay:</b> lawmakers may file up to 45 days after a trade, and some file late. By the time a trade is public, the price may have moved.</li>
      <li><b>Ranges, not amounts:</b> filings disclose dollar <i>ranges</i> (e.g. $15,001 – $50,000). Our "volume" figures use the upper bound of each range and are estimates.</li>
      <li><b>Ownership:</b> many trades are by a spouse, dependent child or a joint account, or by a manager without the lawmaker's direction.</li>
      <li><b>Parsing errors:</b> official filings are PDFs and web forms; automated parsing can mis-read a ticker, date or amount. Amended filings may not be reflected immediately.</li>
      <li><b>Coverage:</b> some assets (bonds, funds, private holdings) have no ticker and are excluded from stock-level analysis.</li></ul>` },
    { id: "signals", icon: "spark", title: "What AI Signals and track records are", html: `
      <ul><li>A <b>signal</b> is a statistical summary: how many lawmakers bought or sold a ticker in a window, how much, from which parties, how recently, and how the buyers' past disclosed trades performed. These factors are combined into a 0–100 score. The weights are our own design and may change.</li>
      <li>A <b>track record</b> (hit rate, average excess return) is computed from the historical performance of a lawmaker's disclosed buys over 6 months versus the market, using a public research dataset. It is backward-looking, based on small samples for many members, and ignores transaction costs, taxes and timing.</li>
      <li><b>AI theses</b> are generated by a language model from the facts above (or a template when AI is off). They can be inaccurate, incomplete or out of date and are not reviewed by a human analyst.</li>
      <li>Historically, only about half of congressional buys beat the market over 6 months. A signal increases attention, not certainty.</li></ul>
      ${note(`Treat every signal as a <b>starting point for your own research</b>, never as an instruction.`)}` },
    { id: "accuracy", icon: "shield", title: "No warranty", html: `<p>All information is provided <b>"as is"</b> without warranty of any kind, express or implied, including accuracy, completeness, timeliness, merchantability or fitness for a particular purpose. ${co} is not liable for any loss or damage arising from reliance on the Service. See the <a href="/terms">Terms &amp; Conditions</a> for the full limitation of liability.</p>` },
    { id: "third", icon: "globe", title: "Third-party links & platforms", html: `<p>Links to official filings, company sites or social platforms are provided for convenience. We do not control and are not responsible for their content, availability or privacy practices. Alerts are delivered through Telegram, WhatsApp (Meta) and email providers subject to their own terms.</p>` },
    { id: "corrections", icon: "refresh", title: "Corrections", html: `<p>If you believe a trade, name or figure is wrong, email <a href="mailto:${mail}">${mail}</a> with a link to the official filing and we will review it promptly.</p>` },
  ], "disclaimer");

  // contact
  const soc = [
    ["x", "X / Twitter", integ.socialX()], ["linkedin", "LinkedIn", integ.socialLinkedin()], ["send", "Telegram", integ.socialTelegram()], ["github", "GitHub", integ.socialGithub()],
  ].filter(([, , u]) => u);
  return layout("Contact Us", `We're happy to help with your account, Pro membership, data corrections, partnerships or press. Most messages get a reply within one business day.`, [
    { id: "reach", icon: "mail", title: "Ways to reach us", html: `
      <div class="cards">
        <div class="card"><h4>${ic("mail", 18)} Email</h4><p><a href="mailto:${mail}">${mail}</a><br>Account, billing, corrections, anything.</p></div>
        <div class="card"><h4>${ic("spark", 18)} Pro membership</h4><p>Want Pro ($300 / year)? <a href="mailto:${mail}?subject=Upgrade%20to%20Pro">Email us</a> with your account email and we will activate it the same day.</p></div>
        <div class="card"><h4>${ic("alert", 18)} Data correction</h4><p>Spotted a wrong trade? <a href="mailto:${mail}?subject=Data%20correction">Send the filing link</a> and we will fix it.</p></div>
        <div class="card"><h4>${ic("help", 18)} Press & partnerships</h4><p><a href="mailto:${mail}?subject=Partnership">${mail}</a></p></div>
      </div>
      ${integ.companyAddress() ? `<p><b>${co}</b> · ${integ.companyAddress()}</p>` : ""}` },
    { id: "social", icon: "globe", title: "Follow us", html: soc.length ? `<p style="display:flex;flex-wrap:wrap;gap:10px">${soc.map(([k, l, u]) => `<a class="btn" href="${u}" target="_blank" rel="noreferrer">${ic(k, 18)} ${l}</a>`).join("")}</p>` : `<p>Social links will appear here once they are set by the administrator.</p>` },
    { id: "faq", icon: "help", title: "Quick answers", html: `
      <p>The <a href="/faq"><b>Briefing Room</b></a> (our Help Center &amp; FAQ) answers 30+ questions about data, AI signals, plans, alerts and the app. The most common ones:</p>
      <ul><li><b>How fresh is the data?</b> New filings are imported several times a day; most appear within hours of publication by Congress.</li>
      <li><b>Why can't I see trades older than 30 days?</b> That is the Free plan window. Pro unlocks the full history since 2014.</li>
      <li><b>How do alerts work?</b> Connect Telegram, add a WhatsApp number or email in <a href="/settings">Settings</a>; Pro members receive new filings that match their watchlist and new AI signals.</li>
      <li><b>Can I cancel?</b> Yes — email us before your renewal date; you keep Pro until the end of the paid year. 14-day refund on first purchase (see <a href="/terms#plans">Terms</a>).</li>
      <li><b>Is this financial advice?</b> No. Please read the <a href="/disclaimer">Disclaimer</a>.</li></ul>` },
    { id: "legal", icon: "file", title: "Legal documents", html: `<p style="display:flex;flex-wrap:wrap;gap:10px"><a class="btn" href="/terms">${ic("file", 18)} Terms &amp; Conditions</a><a class="btn" href="/privacy">${ic("lock", 18)} Privacy Policy</a><a class="btn" href="/disclaimer">${ic("alert", 18)} Disclaimer</a></p>` },
  ], "contact");
}

type QA = { q: string; a: string; tags?: string };
type Group = { id: string; icon: string; title: string; blurb: string; items: QA[] };

function faqPage(name: string, co: string, mail: string, law: string): string {
  const groups: Group[] = [
    { id: "start", icon: "rocket", title: "Getting started", blurb: "What the service is and how to begin in two minutes.", items: [
      { q: `What is ${name}?`, a: `<p>${name} is a research tool that tracks the stock trades US senators and representatives are legally required to disclose under the <b>STOCK Act</b>. It turns tens of thousands of filings into a searchable database, politician and company profiles, performance track records, and <b>AI Signals</b> that highlight where several lawmakers are buying at the same time.</p><p>It is built for investors, journalists and researchers who want to follow "political smart money" without reading PDF filings by hand.</p>` },
      { q: "How do I create an account?", a: `<p>Click <b>Create a free account</b> on the sign-in page, enter your first name, last name, email and a password (8+ characters), accept the Terms and you are in. No credit card is needed for Free.</p>` },
      { q: "What is the fastest way to get value on day one?", a: `<ol><li>Open <b>Home</b> — the dashboard shows today's top AI signals, the latest filings and who is most active.</li><li>Open <b>Invest Plan</b> — see what following the signals would have been worth historically and run the profit calculator with your own numbers.</li><li>Add a stock or lawmaker to your <b>watchlist</b> in Settings and connect Telegram so you are told the moment a matching filing lands (Pro).</li></ol>` },
      { q: "Do I need to install anything?", a: `<p>No. It works in any modern browser. If you want it on your home screen, the footer has one-tap <b>Android</b>, <b>iPhone</b> and <b>Desktop</b> install guides — it installs as an app (PWA) and keeps working offline with the last data you loaded.</p>` },
    ]},
    { id: "data", icon: "db", title: "Data & accuracy", blurb: "Where every number comes from and what its limits are.", items: [
      { q: "Where does the trade data come from?", a: `<p>From the <b>official public disclosures</b> members of Congress file with the Clerk of the House and the Secretary of the Senate (Periodic Transaction Reports), as collected in public-domain and openly licensed datasets built from those filings. We also use the official <b>congress-legislators</b> directory for names, parties, chambers, states and photos.</p><p>We do not scrape commercial trackers. Every trade can be traced back to an official filing.</p>`, tags: "source official stock act" },
      { q: "How far back does the history go?", a: `<p>Filings since <b>2014</b> — more than <b>57,000</b> transactions from <b>350+</b> current and former lawmakers, and growing every day.</p>` },
      { q: "How quickly do new filings appear?", a: `<p>The feed is refreshed <b>several times a day</b>. A trade normally shows up within hours of Congress publishing the filing. Keep in mind the law itself gives lawmakers up to <b>45 days</b> to file after a trade, so the "Delay" column tells you how old a trade was when it became public — late filings (over 45 days) are marked in red.</p>` },
      { q: "Why are amounts shown as ranges like $15,001 – $50,000?", a: `<p>Because that is how the law requires lawmakers to report them. Filings only state a band, never an exact dollar figure. Where we show a total "volume", it is an upper-bound estimate built from those bands and labelled as such.</p>` },
      { q: "What do Owner values like \"self\", \"spouse\" or \"joint\" mean?", a: `<p>Who holds the asset according to the filing: the member themselves, their spouse, a dependent child, or a joint account. All of them must be disclosed and all are included.</p>` },
      { q: "Some trades have no ticker or say \"—\". Why?", a: `<p>Lawmakers also report bonds, funds, private companies, crypto and other assets that have no stock ticker. We keep those trades (switch <b>All assets</b> on the dashboard) but they are excluded from stock-only statistics and signals.</p>` },
      { q: "How are hit rate, excess return and track record calculated?", a: `<p>For every disclosed <b>buy</b> we look at the stock's price <b>6 months after the trade date</b> and compare it with the S&amp;P 500 over the same window.</p><ul><li><b>Hit rate</b> = share of a lawmaker's buys that beat the market.</li><li><b>Excess return</b> = average 6-month return minus the market's return.</li><li><b>Track record</b> on a profile combines both with the number of trades behind them — a 70% hit rate on 4 trades means little; on 150 trades it matters.</li></ul><p>These are historical measurements, not forecasts.</p>` },
      { q: "I found a mistake. How do I report it?", a: `<p>Email <a href="mailto:${mail}?subject=Data%20correction">${mail}</a> with the lawmaker, date and ideally a link to the official filing. We review corrections within one business day. See the <a href="/disclaimer">Disclaimer</a> for known limitations of disclosure data.</p>` },
    ]},
    { id: "signals", icon: "spark", title: "AI Signals & Invest Plan", blurb: "How the signals are built, what the numbers mean, and what they are not.", items: [
      { q: "What is an AI Signal?", a: `<p>A signal is a stock where the <b>pattern of congressional buying</b> looks unusually strong right now. For each ticker in the window (default 90 days) we score:</p><ul><li>how many different lawmakers bought it, and how recently;</li><li>whether buyers come from <b>both parties</b> (bipartisan clusters have historically been more reliable);</li><li>the <b>track record</b> of the people buying — a buy by someone with a 65% hit rate counts more than one by someone with 40%;</li><li>how past congressional buys of that same stock have performed;</li><li>sell-side pressure, which lowers the score.</li></ul><p>The result is a score out of 100 with a confidence tier (high / medium / watch), the reasons in plain English and, when AI insight is enabled, a short thesis.</p>` },
      { q: "What does the back-test on the Invest Plan page actually measure?", a: `<p>We take every disclosed stock buy since 2014 with a known 6-month outcome (about 21,500 trades) and compare four rules, equal-weighted and before costs:</p><table><tr><th>Rule</th><th>Avg 6-month return</th><th>Beat market</th></tr><tr><td>Market (S&amp;P 500)</td><td>+9.3%</td><td>—</td></tr><tr><td>Any congressional buy</td><td>+9.3%</td><td>46%</td></tr><tr><td>Cluster buys (2+ lawmakers within 45 days)</td><td>+10.9%</td><td>47%</td></tr><tr><td><b>Smart clusters</b> (cluster + a buyer with ≥55% track record) — the rule our signals use</td><td><b>+17.1%</b></td><td><b>60%</b></td></tr></table><p>The exact figures are recomputed from the live database and shown on the page itself.</p>` },
      { q: "Is the +17% figure guaranteed or a prediction?", a: `<p><b>No.</b> It is a historical average with real caveats, which we print on the page: it applies today's track records to past trades (which flatters results), it ignores fees, taxes and the filing delay, and averages hide big winners and losers. Past performance never guarantees future results. Treat it as evidence that the approach has been worth studying, not as a promise.</p>`, tags: "guarantee risk" },
      { q: "How does the profit calculator work?", a: `<p>You set a starting amount, a monthly contribution and a time horizon. The calculator compounds your money monthly at two historical rates — the market's and the smart-cluster rule's — and shows both paths side by side, plus the difference. It also shows how many months of that historical edge would cover the <b>$300 / year</b> Pro price at your numbers. It is a what-if tool, not a forecast.</p>` },
      { q: "What is the model portfolio on Invest Plan?", a: `<p>It splits a chosen amount across the current <b>buy signals</b>, weighted by signal score, so you can see what a signal-following allocation would look like today. Free members see the #1 position; Pro members see all of them with the reasons and top buyers behind each.</p>` },
      { q: "Is any of this financial advice?", a: `<p>No. ${name} provides research and education about public records. We are not a broker or investment adviser, we do not know your situation, and nothing here is a recommendation to buy or sell anything. Please read the <a href="/disclaimer">Disclaimer</a> and decide for yourself or with a licensed adviser.</p>`, tags: "advice legal" },
    ]},
    { id: "plans", icon: "card", title: "Plans & billing", blurb: "Free vs Pro, pricing, refunds and cancellation.", items: [
      { q: "What is the difference between Free and Pro?", a: `<table><tr><th></th><th>Free</th><th>Pro — $300 / year</th></tr><tr><td>Trades, politicians, issuers</td><td>Last 30 days</td><td>Full history since 2014</td></tr><tr><td>AI Signals</td><td>#1 signal only</td><td>Every signal + reasons + AI thesis</td></tr><tr><td>Invest Plan</td><td>Back-test, calculator, #1 position</td><td>Full model portfolio</td></tr><tr><td>Alerts (Telegram / WhatsApp / Email)</td><td>—</td><td>Instant, on watchlist filings and new signals</td></tr><tr><td>Watchlist</td><td>1 item</td><td>Unlimited</td></tr><tr><td>CSV export</td><td>—</td><td>Yes</td></tr><tr><td>Track-record leaderboard</td><td>—</td><td>Yes</td></tr><tr><td>Support</td><td>Email</td><td>Priority</td></tr></table>` },
      { q: "How much does Pro cost and how is it billed?", a: `<p><b>$300 per year</b>, billed annually in advance in US dollars. There is no monthly plan — the yearly price works out to $25 a month and keeps the service independent of ads and data resale.</p>` },
      { q: "How do I upgrade?", a: `<p>Click <b>Upgrade to Pro</b> anywhere in the app or email <a href="mailto:${mail}?subject=Upgrade%20to%20Pro">${mail}</a> with your account email. We activate Pro on your account as soon as payment is confirmed; your plan badge in the header changes to <b>PRO</b>.</p>` },
      { q: "Can I get a refund?", a: `<p>Yes — a <b>full refund within 14 days</b> of your first Pro payment, provided you have not exported data or received more than 10 alerts. After that, payments are non-refundable except where the law requires otherwise. Details are in the <a href="/terms#plans">Terms</a>.</p>` },
      { q: "How do I cancel?", a: `<p>Email us before your renewal date. Cancelling stops the next renewal; you keep every Pro feature until the end of the year you paid for, then the account moves to Free — nothing is deleted.</p>` },
      { q: "Do you offer team or company accounts?", a: `<p>Yes, for newsrooms, funds and research teams. Email <a href="mailto:${mail}?subject=Team%20plan">${mail}</a> with the number of seats and we will send a quote.</p>` },
    ]},
    { id: "alerts", icon: "bell", title: "Alerts & watchlist", blurb: "Getting told the moment something happens.", items: [
      { q: "What alerts can I receive?", a: `<ul><li><b>Trade alerts</b> — a lawmaker files a trade in a stock or a politician on your watchlist.</li><li><b>Signal alerts</b> — a new AI buy signal forms, or an existing one gets materially stronger (higher tier or more buyers).</li></ul><p>You choose which of the two you want in <a href="/settings">Settings</a>. Delivery is a Pro feature; Free members can set everything up in advance.</p>` },
      { q: "How do I connect Telegram?", a: `<p>Settings → Alert channels → <b>Connect Telegram</b>. You get a one-time code and a link to our bot; send the code to the bot and the channel shows as <b>connected</b> within a few seconds. Use <b>Send test</b> to confirm.</p>` },
      { q: "How do WhatsApp and email alerts work?", a: `<p>Add your WhatsApp number (international format, e.g. +1…) or an alert email in Settings and save. WhatsApp requires the administrator to have enabled a WhatsApp provider on the server; if a channel says "not enabled on this server yet", email us.</p>` },
      { q: "Why did I not receive an alert?", a: `<ol><li>Check that your plan is <b>Pro</b> — alerts are only delivered to Pro members.</li><li>Check the channel is <b>connected</b> and the alert type is ticked in Settings.</li><li>Use <b>Send test</b>; if the test arrives, the earlier filing simply did not match your watchlist.</li><li>Alerts are only sent for filings published in the last 30 days, so historical imports never flood you.</li></ol>` },
      { q: "How many items can I watch?", a: `<p>Free: 1 stock or lawmaker. Pro: unlimited.</p>` },
    ]},
    { id: "app", icon: "phone", title: "App, devices & offline", blurb: "Install it, use it on the go, and what works without internet.", items: [
      { q: "How do I install the app on my phone?", a: `<p><b>Android (Chrome):</b> tap <b>Android</b> in the footer, or Chrome menu → <i>Install app</i>.<br><b>iPhone (Safari):</b> tap the Share button → <i>Add to Home Screen</i>.<br><b>Desktop (Chrome / Edge):</b> click the install icon in the address bar or <b>Desktop</b> in the footer.</p><p>Installed, it opens full-screen with its own icon like any native app and updates itself automatically.</p>` },
      { q: "Does it work offline?", a: `<p>Yes, for reading. Pages and the data you have already opened are kept on the device, so Home, Trades, profiles and signals you looked at still open on a plane or in the subway, with an "offline" bar at the top. Searching new data, saving settings and alerts need a connection and resume automatically when you are back online.</p>` },
      { q: "Is there a native App Store / Play Store version?", a: `<p>The installable web app is the official app on all platforms today and gets every feature first. Store listings may follow; installing from the footer gives you the same experience now without waiting for store approval.</p>` },
      { q: "Which browsers are supported?", a: `<p>Current versions of Chrome, Edge, Safari, Firefox and Samsung Internet on Android, iOS, Windows, macOS and Linux. The interface adapts from a 4-inch phone to a 4K monitor.</p>` },
    ]},
    { id: "account", icon: "key", title: "Account & security", blurb: "Sign-in options, PIN, passwords and your data.", items: [
      { q: "What is the 4-digit PIN sign-in?", a: `<p>A faster way to sign in on your own devices: email + a 4-digit PIN instead of your full password. Set or change it in Settings (your current password is required). Your password keeps working, and the PIN locks for <b>15 minutes after 5 wrong attempts</b>. Do not use a PIN on shared computers.</p>` },
      { q: "I forgot my password.", a: `<p>If you set a PIN, sign in with email + PIN and set a new password in Settings. Otherwise email <a href="mailto:${mail}?subject=Password%20reset">${mail}</a> from your account address and we will send a reset.</p>` },
      { q: "How do I change my email, name or password?", a: `<p>Settings → Account. Changing the email or password asks for your current password as a safety check. Changes apply immediately.</p>` },
      { q: "How is my data protected?", a: `<p>Passwords and PINs are stored only as salted hashes, all traffic is encrypted with HTTPS, sign-in sessions use signed tokens that expire, and alert credentials are stored masked. We collect the minimum needed to run the service and never sell personal data — see the <a href="/privacy">Privacy Policy</a>.</p>` },
      { q: "How do I delete my account?", a: `<p>Email <a href="mailto:${mail}?subject=Delete%20my%20account">${mail}</a> from your account address. We delete the account, watchlist and alert channels within 30 days and confirm by email.</p>` },
    ]},
    { id: "legal", icon: "scale", title: "Legal & company", blurb: "The short version of the fine print.", items: [
      { q: "Who operates the service and which law applies?", a: `<p>${name} is operated by <b>${co}</b>. The Terms are governed by the laws of <b>${law}</b>. Full details, including dispute resolution, are in the <a href="/terms#law">Terms &amp; Conditions</a>.</p>` },
      { q: "Is tracking congressional trades legal?", a: `<p>Yes. The STOCK Act of 2012 requires these disclosures precisely so the public can see them. We republish public records, add analysis, and never access any private information.</p>` },
      { q: "Are you affiliated with Congress or any lawmaker?", a: `<p>No. ${name} is an independent service and is not affiliated with, endorsed by or connected to any government body, political party or lawmaker. Photos come from the official public congressional image repository.</p>` },
      { q: "Can I use the data in an article, newsletter or research paper?", a: `<p>Yes, with attribution to ${name} and a link. Bulk redistribution or reselling of the database is not permitted; Pro members may export CSV for their own analysis. For commercial data licensing, email us.</p>` },
    ]},
  ];

  const esc = (t: string) => t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const sections: Section[] = groups.map((g) => ({
    id: g.id, icon: g.icon, title: g.title,
    html: `<p class="blurb">${g.blurb}</p>` + g.items.map((it, i) => `<details class="qa" id="${g.id}-${i + 1}" data-t="${esc(it.q + " " + it.a + " " + (it.tags ?? "")).toLowerCase().replace(/"/g, "&quot;")}"><summary><span class="q">${it.q}</span><span class="chev">${ic("x", 16)}</span></summary><div class="a">${it.a}<a class="perma" href="#${g.id}-${i + 1}">#</a></div></details>`).join(""),
  }));
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: groups.flatMap((g) => g.items.map((it) => ({ "@type": "Question", name: esc(it.q), acceptedAnswer: { "@type": "Answer", text: esc(it.a) } }))) }).replace(/</g, "\\u003c");
  const css = `
.blurb{color:var(--mute);margin:0 0 10px!important}
.qa{border-top:1px solid var(--line);scroll-margin-top:90px}.qa:first-of-type{border-top:0}
.qa summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:13px 2px;font-weight:600;color:var(--ink)}.qa summary::-webkit-details-marker{display:none}
.qa .q{flex:1}.qa summary:hover .q{color:var(--gold)}.qa .chev{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.04);color:var(--mute);transform:rotate(45deg);transition:transform .2s}
.qa[open] .chev{transform:rotate(0);color:var(--gold);background:rgba(231,178,60,.12)}.qa .a{position:relative;padding:0 2px 14px 2px;color:#d5dced}.qa .a p:first-child{margin-top:0}
.qa .perma{position:absolute;right:0;bottom:12px;color:var(--mute);font-size:.8rem;opacity:0;transition:opacity .2s}.qa:hover .perma{opacity:1}
.qa[hidden]{display:none}
.search{margin-top:20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}.search label{position:relative;flex:1;min-width:240px}.search svg.i{position:absolute;left:14px;top:14px;color:var(--mute)}
.search input{width:100%;padding:12px 14px 12px 42px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;outline:none}.search input:focus{border-color:var(--gold)}
.search .btn{padding:9px 13px;font-size:.9rem}.count{color:var(--mute);font-size:.88rem}
.cta{display:flex;flex-wrap:wrap;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(231,178,60,.12),rgba(34,197,139,.08));border:1px solid rgba(231,178,60,.35);border-radius:16px;padding:18px 20px;margin-top:6px}
.cta b{font-size:1.05rem}.cta p{margin:2px 0 0;color:var(--mute)}.cta .btns{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}
aside li a small{margin-left:auto;color:var(--mute);font-family:ui-monospace,monospace;font-size:.75rem}
.nores{display:none;background:var(--card);border:1px dashed var(--line);border-radius:14px;padding:20px;text-align:center;color:var(--mute)}
@media(max-width:600px){.cta .btns{margin-left:0}}`;
  const heroExtra = `<div class="search"><label>${ic("search", 18).replace("<svg", '<svg class="i"')}<input id="q" type="search" placeholder="Search ${total} answers — try &quot;refund&quot;, &quot;Telegram&quot;, &quot;hit rate&quot;…" autocomplete="off"></label><a class="btn" href="#" id="expand">Expand all</a><span class="count" id="count">${total} answers in ${groups.length} topics</span></div>`;
  const script = `<script>
(function(){var q=document.getElementById('q'),all=[].slice.call(document.querySelectorAll('.qa')),secs=[].slice.call(document.querySelectorAll('main section')),count=document.getElementById('count'),exp=document.getElementById('expand'),nores=document.getElementById('nores'),total=all.length,open=false;
function filter(){var t=q.value.trim().toLowerCase(),n=0;all.forEach(function(d){var hit=!t||d.dataset.t.indexOf(t)>-1;d.hidden=!hit;if(hit){n++;if(t)d.open=true;}});secs.forEach(function(s){s.style.display=s.querySelector('.qa:not([hidden])')?'':'none';});count.textContent=t?(n+' of '+total+' answers match'):(total+' answers in '+secs.length+' topics');nores.style.display=n?'none':'block';}
q.addEventListener('input',filter);exp.addEventListener('click',function(e){e.preventDefault();open=!open;all.forEach(function(d){d.open=open;});exp.textContent=open?'Collapse all':'Expand all';});
if(location.hash){var el=document.querySelector(location.hash);if(el&&el.classList.contains('qa')){el.open=true;el.scrollIntoView();}}
var p=new URLSearchParams(location.search).get('q');if(p){q.value=p;filter();}})();
</script>`;
  const html = layout("The Briefing Room", `<b style="color:var(--gold)">Help Center &amp; FAQ.</b> Straight answers about the data, the AI signals, plans, alerts and the app. Can't find it? Email <a href="mailto:${mail}">${mail}</a> — we reply within one business day.`, sections, "faq", {
    css, heroExtra, script, sectionsLabel: "topics", headExtra: `<script type="application/ld+json">${ld}</script>`,
  });
  // per-topic counts in the sidebar + a closing CTA + empty state
  return html
    .replace(/<li><a href="#([a-z]+)"><span>(\d+)<\/span>([^<]+)<\/a><\/li>/g, (m, id, n, t) => { const g = groups.find((x) => x.id === id); return `<li><a href="#${id}"><span>${n}</span>${t}<small>${g?.items.length ?? ""}</small></a></li>`; })
    .replace("</main>", `<div class="nores" id="nores">No answer matches that search. Try a shorter word, or <a href="mailto:${mail}">ask us directly</a>.</div><div class="cta">${ic("help", 28)}<div><b>Still have a question?</b><p>Real humans answer, usually within one business day.</p></div><div class="btns"><a class="btn gold" href="mailto:${mail}?subject=Question">${ic("mail", 16)} Email support</a><a class="btn" href="/contact">${ic("globe", 16)} Contact page</a></div></div></main>`);
}
