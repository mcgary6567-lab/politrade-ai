import { all, get } from "./db.js";
import { integ } from "./settings.js";
import { config } from "./config.js";
import { ic } from "./legal.js";

/**
 * Public marketing page (server-rendered, no JS needed).
 * Positioned as a public-records / transparency tool: what lawmakers disclose, searchable.
 * Deliberately free of return claims, "buy this" language or profit figures so the page
 * reads as data journalism, not investment advice.
 */
let cache: { at: number; html: string } | null = null;

const money = (a?: number | null, b?: number | null) => {
  const f = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`);
  if (a == null && b == null) return "—";
  if (a != null && b != null && a !== b) return `${f(a)}–${f(b)}`;
  return f((a ?? b) as number);
};
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const party = (p?: string) => (p?.startsWith("Rep") ? "r" : p?.startsWith("Dem") ? "d" : "i");
const ago = (d?: string | null) => {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : d;
};

export function landingPage(): string {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.html;
  const name = integ.brandName(), co = integ.companyName(), mail = integ.contactEmail();
  const short = name.replace(/\s*AI$/i, "");
  const url = config.publicUrl;
  const stats = get(`SELECT COUNT(*) trades, COUNT(DISTINCT politician_id) politicians, COUNT(DISTINCT issuer_id) issuers,
      MIN(tx_date) first_date, MAX(published_date) last_pub FROM trades`) ?? {};
  const latest = all(`SELECT tr.tx_type, tr.tx_date, tr.published_date, tr.amount_min, tr.amount_max, p.name politician, p.party, p.chamber, p.state, i.ticker, i.name issuer
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id
      WHERE i.ticker IS NOT NULL ORDER BY tr.published_date DESC, tr.id DESC LIMIT 6`);
  const active = all(`SELECT p.name, p.party, p.chamber, p.state, p.ext_id, COUNT(*) n FROM trades tr JOIN politicians p ON p.id=tr.politician_id
      WHERE tr.published_date >= date('now','-90 days') GROUP BY p.id ORDER BY n DESC LIMIT 6`);
  const popular = all(`SELECT i.ticker, i.name, COUNT(DISTINCT tr.politician_id) pols, COUNT(*) n FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      WHERE tr.published_date >= date('now','-90 days') AND i.ticker IS NOT NULL GROUP BY i.id ORDER BY pols DESC, n DESC LIMIT 6`);
  const n = (x: number) => Number(x || 0).toLocaleString("en-US");
  const since = (stats.first_date ?? "2014").slice(0, 4);

  const features: [string, string, string][] = [
    ["search", "Every disclosed trade, searchable", `Filter ${n(stats.trades)} filings by lawmaker, company, party, chamber, state, trade type, amount and date. Export to CSV.`],
    ["user", "Lawmaker profiles", "Photo, party, chamber, state, every filing on record, which companies they trade most and how late they file."],
    ["db", "Company view", "Pick any ticker and see which members of Congress have bought or sold it, when, and how much."],
    ["spark", "Activity clusters", "When several lawmakers file trades in the same company within weeks, we flag it and explain why in plain English."],
    ["bell", "Instant alerts", "Follow the lawmakers and companies you care about. Get a Telegram, WhatsApp or email message the moment a matching filing is published."],
    ["phone", "Works everywhere", "Installs on Android, iPhone and desktop as an app, loads in under a second and keeps working offline."],
  ];

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} — Congress stock trade tracker · public STOCK Act disclosures</title>
<meta name="description" content="See every stock trade US senators and representatives disclose under the STOCK Act. ${n(stats.trades)} filings since ${since}, ${n(stats.politicians)} lawmakers, updated daily from the official records. Free to search.">
<link rel="canonical" href="${url}/"><link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0a0f1c">
<meta property="og:title" content="${esc(name)} — what is Congress trading?"><meta property="og:description" content="Every disclosed congressional stock trade, from the official filings, searchable and free."><meta property="og:type" content="website"><meta property="og:url" content="${url}/"><meta property="og:image" content="${url}/icon-512.png">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name, url, applicationCategory: "ReferenceApplication", operatingSystem: "Web, Android, iOS", description: "Searchable database of stock trades disclosed by members of the US Congress under the STOCK Act.", offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" }, { "@type": "Offer", price: "300", priceCurrency: "USD", name: "Pro (per year)" }], publisher: { "@type": "Organization", name: co, email: mail } }).replace(/</g, "\\u003c")}</script>
<style>
:root{--bg:#0a0f1c;--card:#121a2e;--line:#223052;--ink:#e7ecf5;--mute:#8a96ad;--gold:#e7b23c;--buy:#22c58b;--sell:#f26a6a;--d:#4ea1ff;--r:#f26a6a}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--gold);text-decoration:none}img{max-width:100%}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:5;background:rgba(10,15,28,.88);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar{display:flex;align-items:center;gap:14px;height:62px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.15rem;color:var(--ink)}.brand b{color:var(--gold)}
.nav{margin-left:auto;display:flex;gap:4px;align-items:center}.nav a{padding:8px 12px;border-radius:10px;font-size:.92rem;font-weight:600;color:#cdd6e6}.nav a:hover{background:rgba(255,255,255,.05)}.nav a{white-space:nowrap}.nav .s{display:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:12px 18px;color:var(--ink);font-weight:700;transition:.15s}.btn:hover{border-color:var(--gold)}
.btn.gold{background:var(--gold);color:#0a0f1c;border-color:var(--gold)}.btn.gold:hover{filter:brightness(1.08)}.btn.sm{padding:8px 13px;font-size:.9rem}
.hero{padding:64px 0 36px;display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(231,178,60,.4);background:rgba(231,178,60,.08);border-radius:999px;padding:5px 12px;font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold)}
h1{font-size:clamp(2rem,4.6vw,3.3rem);line-height:1.08;margin:18px 0 14px;letter-spacing:-.02em}h1 em{font-style:normal;color:var(--gold)}
.lead{font-size:1.15rem;color:#c3ccdd;max-width:560px;margin:0 0 24px}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.ctas small{color:var(--mute);font-size:.85rem}
.proof{display:flex;flex-wrap:wrap;gap:22px;margin-top:28px}.proof div b{display:block;font-size:1.5rem;font-family:ui-monospace,Menlo,monospace;color:#fff}.proof div span{font-size:.82rem;color:var(--mute)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.panel .ph{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.panel .ph span.live{display:inline-flex;align-items:center;gap:6px;color:var(--buy)}.panel .ph span.live i{width:7px;height:7px;border-radius:50%;background:var(--buy);box-shadow:0 0 0 4px rgba(34,197,139,.2)}
.row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid rgba(34,48,82,.6);font-size:.9rem}.row:last-child{border-bottom:0}
.pill{font-size:.68rem;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:7px}.pill.buy{background:rgba(34,197,139,.15);color:var(--buy)}.pill.sell{background:rgba(242,106,106,.15);color:var(--sell)}.pill.exchange{background:rgba(138,150,173,.2);color:#cdd6e6}
.row .who{min-width:0}.row .who b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .who small{color:var(--mute)}.row .amt{text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:.85rem}.row .amt small{display:block;color:var(--mute);font-family:Inter,system-ui;font-size:.75rem}
.tk{font-family:ui-monospace,Menlo,monospace;font-weight:700;color:var(--gold)}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}.dot.d{background:var(--d)}.dot.r{background:var(--r)}.dot.i{background:#a78bfa}
.strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.015);padding:16px 0}.strip .wrap{display:flex;flex-wrap:wrap;gap:10px 28px;justify-content:center;align-items:center;color:var(--mute);font-size:.85rem}.strip .wrap span{display:inline-flex;align-items:center;gap:8px}.strip svg{color:var(--gold)}
section{padding:64px 0}h2{font-size:clamp(1.5rem,3vw,2.1rem);letter-spacing:-.01em;margin:0 0 8px}.sub{color:var(--mute);margin:0 0 30px;max-width:640px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}.card .ico{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:rgba(231,178,60,.12);color:var(--gold);margin-bottom:14px}.card h3{margin:0 0 6px;font-size:1.05rem}.card p{margin:0;color:var(--mute);font-size:.93rem}
.steps{counter-reset:s}.steps .card{position:relative;padding-left:70px}.steps .card::before{counter-increment:s;content:counter(s);position:absolute;left:22px;top:22px;width:34px;height:34px;border-radius:50%;background:var(--gold);color:#0a0f1c;font-weight:800;display:grid;place-items:center}
.list{margin:0;padding:0;list-style:none}.list li{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(34,48,82,.6);font-size:.93rem}.list li:last-child{border:0}.list li span:last-child{color:var(--mute);font-family:ui-monospace,Menlo,monospace;font-size:.85rem;white-space:nowrap}
.plans{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:860px;margin:0 auto}.plan{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px}.plan.pro{border-color:rgba(231,178,60,.55);background:linear-gradient(180deg,rgba(231,178,60,.08),var(--card) 40%)}
.plan .pn{font-size:.8rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}.plan.pro .pn{color:var(--gold)}.plan .pp{font-size:2.2rem;font-weight:800;margin:6px 0 2px}.plan .pp small{font-size:.95rem;color:var(--mute);font-weight:500}.plan ul{margin:16px 0 20px;padding:0;list-style:none}.plan li{display:flex;gap:10px;padding:6px 0;font-size:.93rem;color:#d5dced}.plan li svg{flex:none;color:var(--buy);margin-top:4px}.plan li.no{color:var(--mute)}.plan li.no svg{color:var(--mute)}
.aud{display:flex;flex-wrap:wrap;gap:10px}.aud span{border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:.9rem;color:#cdd6e6}
.faq details{border-bottom:1px solid var(--line);padding:4px 0}.faq summary{cursor:pointer;padding:12px 0;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:12px}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";color:var(--gold);font-size:1.3rem;line-height:1}.faq details[open] summary::after{content:"–"}.faq p{margin:0 0 14px;color:#c3ccdd}
.final{text-align:center;background:linear-gradient(135deg,rgba(231,178,60,.14),rgba(78,161,255,.08));border:1px solid rgba(231,178,60,.35);border-radius:22px;padding:48px 24px}
.disc{border:1px solid var(--line);border-radius:14px;padding:14px 16px;color:var(--mute);font-size:.83rem;display:flex;gap:10px;align-items:flex-start}.disc svg{flex:none;color:var(--gold);margin-top:2px}
footer{border-top:1px solid var(--line);padding:26px 0 36px;color:var(--mute);font-size:.85rem}footer .wrap{display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;align-items:center}footer nav{display:flex;flex-wrap:wrap;gap:6px 16px}
@media(max-width:900px){.hero{grid-template-columns:1fr;padding-top:40px}.grid3{grid-template-columns:1fr 1fr}.grid2,.plans{grid-template-columns:1fr}.nav a.hide{display:none}}
@media(max-width:600px){.nav .l{display:none}.nav .s{display:inline}.nav a{padding:8px 9px}.bar{gap:8px}.brand{font-size:1.05rem}.grid3{grid-template-columns:1fr}section{padding:44px 0}.ctas .btn{width:100%}.proof{gap:16px}}
</style></head><body>
<header><div class="wrap bar"><a class="brand" href="/"><img src="/icon-192.png" width="32" height="32" alt="" style="border-radius:9px">${esc(short)} <b>AI</b></a>
<nav class="nav"><a class="hide" href="#features">Features</a><a class="hide" href="#data">Data</a><a class="hide" href="#pricing">Pricing</a><a class="hide" href="/faq">FAQ</a><a href="/login">Sign in</a><a class="btn gold sm" href="/signup"><span class="l">Create free account</span><span class="s">Get started</span></a></nav></div></header>

<main class="wrap">
<div class="hero">
  <div>
    <span class="eyebrow">${ic("shield", 14)} Public records · STOCK Act disclosures</span>
    <h1>See what members of <em>Congress</em> are trading.</h1>
    <p class="lead">Every stock trade US senators and representatives are required to disclose, pulled from the official filings into one fast, searchable place. Who bought what, when, and how late they told the public.</p>
    <div class="ctas"><a class="btn gold" href="/signup">${ic("user", 18)} Create a free account</a><a class="btn" href="/login">Sign in</a><small>No card needed · takes 30 seconds</small></div>
    <div class="proof"><div><b>${n(stats.trades)}</b><span>disclosed trades since ${since}</span></div><div><b>${n(stats.politicians)}</b><span>senators &amp; representatives</span></div><div><b>${n(stats.issuers)}</b><span>companies &amp; assets</span></div><div><b>${esc(ago(stats.last_pub) || "daily")}</b><span>latest filing published</span></div></div>
  </div>
  <div class="panel"><div class="ph"><span>Latest filings</span><span class="live"><i></i> Live from the record</span></div>
  ${latest.map((t: any) => `<div class="row"><span class="pill ${t.tx_type}">${t.tx_type.toUpperCase()}</span><div class="who"><b><span class="tk">${esc(t.ticker)}</span> · ${esc(t.issuer)}</b><small><span class="dot ${party(t.party)}"></span>${esc(t.politician)} · ${esc(t.chamber ?? "")}${t.state ? " · " + esc(t.state) : ""}</small></div><div class="amt">${money(t.amount_min, t.amount_max)}<small>filed ${esc(ago(t.published_date))}</small></div></div>`).join("")}
  <div class="row" style="justify-content:center;display:flex"><a href="/signup" style="font-weight:700;font-size:.9rem">See all ${n(stats.trades)} trades →</a></div></div>
</div>
</main>

<div class="strip"><div class="wrap"><span>${ic("file", 16)} House Clerk &amp; Senate eFD filings</span><span>${ic("refresh", 16)} Updated several times a day</span><span>${ic("db", 16)} Full record since ${since}</span><span>${ic("globe", 16)} Independent · non-partisan</span><span>${ic("lock", 16)} No ads, no data resale</span></div></div>

<main class="wrap">
<section id="features"><h2>Everything the filings contain, none of the PDF reading.</h2><p class="sub">Lawmakers file Periodic Transaction Reports as documents. ${esc(short)} turns them into structured data you can search, follow and get alerted on.</p>
<div class="grid3">${features.map(([i, t, d]) => `<div class="card"><div class="ico">${ic(i, 20)}</div><h3>${t}</h3><p>${d}</p></div>`).join("")}</div></section>

<section id="data"><h2>Right now in Congress</h2><p class="sub">A live sample of the last 90 days. Sign in free to see the full record, filters and profiles.</p>
<div class="grid2">
 <div class="card"><h3 style="margin-bottom:12px">${ic("user", 16)} Most active lawmakers</h3><ul class="list">${active.map((p: any) => `<li><span><span class="dot ${party(p.party)}"></span>${esc(p.name)} <small style="color:var(--mute)">${esc(p.chamber ?? "")}${p.state ? " · " + esc(p.state) : ""}</small></span><span>${p.n} filings</span></li>`).join("") || "<li>Loading…</li>"}</ul></div>
 <div class="card"><h3 style="margin-bottom:12px">${ic("db", 16)} Companies traded by the most lawmakers</h3><ul class="list">${popular.map((i: any) => `<li><span><span class="tk">${esc(i.ticker)}</span> ${esc(i.name)}</span><span>${i.pols} lawmakers</span></li>`).join("") || "<li>Loading…</li>"}</ul></div>
</div></section>

<section><h2>How it works</h2><p class="sub">From a filing on a government website to a message on your phone, in three steps.</p>
<div class="grid3 steps"><div class="card"><h3>We collect the filings</h3><p>Several times a day we read the official House and Senate disclosure records and the congressional directory, and add every new transaction with its lawmaker, company, amount band and dates.</p></div>
<div class="card"><h3>You follow who matters to you</h3><p>Add lawmakers or companies to your watchlist. Browse by party, chamber, state, trade type or amount. Export what you need.</p></div>
<div class="card"><h3>You hear about it first</h3><p>Pro members get a Telegram, WhatsApp or email message the moment a matching filing is published, plus a note when several lawmakers file trades in the same company.</p></div></div></section>

<section><h2>Built for people who read the record</h2><p class="sub">Used by journalists, researchers, voters and self-directed investors who want the primary source, not a headline.</p>
<div class="aud"><span>Newsrooms &amp; reporters</span><span>Academic researchers</span><span>Government-transparency advocates</span><span>Constituents checking their representative</span><span>Investors doing their own homework</span><span>Policy &amp; compliance teams</span></div></section>

<section id="pricing"><h2 style="text-align:center">Simple pricing</h2><p class="sub" style="text-align:center;margin-left:auto;margin-right:auto">Search is free. Pro is for people who want the whole record and instant alerts.</p>
<div class="plans">
 <div class="plan"><div class="pn">Free</div><div class="pp">$0</div><ul>
  <li>${ic("shield", 16)} Every trade filed in the last 30 days</li><li>${ic("shield", 16)} Lawmaker and company profiles</li><li>${ic("shield", 16)} 1 watchlist item</li><li>${ic("shield", 16)} Install as an app, works offline</li><li class="no">${ic("x", 16)} Full history since ${since}</li><li class="no">${ic("x", 16)} Alerts and CSV export</li></ul><a class="btn" href="/signup" style="width:100%">Create free account</a></div>
 <div class="plan pro"><div class="pn">Pro</div><div class="pp">$300 <small>/ year · $25 a month</small></div><ul>
  <li>${ic("shield", 16)} Full record since ${since}, every new filing</li><li>${ic("shield", 16)} Instant Telegram, WhatsApp and email alerts</li><li>${ic("shield", 16)} Activity-cluster notes with plain-English reasons</li><li>${ic("shield", 16)} Unlimited watchlist and CSV export</li><li>${ic("shield", 16)} Lawmaker filing-record leaderboard</li><li>${ic("shield", 16)} Priority support · 14-day refund</li></ul><a class="btn gold" href="/signup?plan=pro" style="width:100%">Start with Pro</a></div>
</div></section>

<section class="faq" style="max-width:820px;margin:0 auto"><h2>Questions</h2>
<details><summary>Where does the data come from?</summary><p>From the public disclosures members of Congress must file under the STOCK Act with the Clerk of the House and the Secretary of the Senate, as published in open datasets built from those filings, plus the official congressional directory for names, parties and photos. Every trade traces back to an official filing.</p></details>
<details><summary>Is this legal and is it affiliated with Congress?</summary><p>Yes, it is legal: these records are published precisely so the public can read them. ${esc(short)} is independent and not affiliated with any government body, party or lawmaker.</p></details>
<details><summary>How fast do new filings appear?</summary><p>Usually within hours of publication. Note that the law gives lawmakers up to 45 days to file after a trade; we show that delay on every record and mark late filings.</p></details>
<details><summary>Is this investment advice?</summary><p>No. ${esc(short)} is a research and transparency tool about public records. Nothing on this site is a recommendation to buy or sell anything. Read our <a href="/disclaimer">Disclaimer</a>.</p></details>
<details><summary>Can I cancel Pro?</summary><p>Yes. Cancel any time before renewal and keep Pro until the end of the paid year. First-time Pro payments are refundable within 14 days.</p></details>
<p style="margin-top:18px"><a href="/faq">All 40+ answers in the Briefing Room →</a></p></section>

<section><div class="final"><h2 style="margin-bottom:8px">Start reading the record today</h2><p class="sub" style="margin:0 auto 22px">Free account, no card, 30 seconds.</p><div class="ctas" style="justify-content:center"><a class="btn gold" href="/signup">${ic("user", 18)} Create a free account</a><a class="btn" href="/login">Sign in</a></div></div></section>

<div class="disc" style="margin-bottom:30px">${ic("info", 18)}<span><b>${esc(name)}</b> republishes and organises public congressional disclosure records for research, journalism and education. It is not a broker, adviser or investment service and provides no financial advice. Amounts are the ranges lawmakers report. Filing data can contain errors or be amended by the filer. Not affiliated with the US Government or any lawmaker. <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/disclaimer">Disclaimer</a></span></div>
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(co)} · ${esc(name)}</span><nav><a href="/faq">Briefing Room</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/disclaimer">Disclaimer</a><a href="/contact">Contact</a><a href="mailto:${esc(mail)}">${esc(mail)}</a></nav></div></footer>
</body></html>`;
  cache = { at: Date.now(), html };
  return html;
}
export const bumpLanding = () => { cache = null; };
