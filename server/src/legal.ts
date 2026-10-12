import { config } from "./config.js";

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ${config.brandName}</title>
<style>body{font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#0d1322;color:#e7ecf5}
main{max-width:760px;margin:0 auto;padding:40px 20px 70px}h1{font-size:1.7rem;color:#f0c24b}h2{font-size:1.1rem;margin-top:1.6em;color:#cdd6e6}
a{color:#f0c24b}.muted{color:#8a96ad;font-size:.92rem}code{background:#182238;padding:1px 5px;border-radius:4px}</style></head>
<body><main>${body}<p class=muted style="margin-top:40px"><a href="/">← Back to ${config.brandName}</a></p></main></body></html>`;

export function legalPage(kind: "privacy" | "terms" | "disclaimer" | "contact"): string {
  const name = config.brandName;
  if (kind === "disclaimer") return page("Disclaimer", `
    <h1>Disclaimer</h1>
    <p>${name} aggregates <b>publicly disclosed</b> financial transactions of US federal lawmakers, published under the STOCK Act (US House &amp; Senate financial disclosures). The data originates from official government filings and third-party public datasets.</p>
    <h2>Not financial advice</h2>
    <p>Nothing on ${name} is investment, legal or tax advice, a recommendation, or an offer to buy or sell any security. Disclosures are self-reported, may contain errors, are often filed weeks after the trade, and report only broad dollar ranges. Do your own research and consult a licensed professional before investing.</p>
    <h2>Accuracy</h2>
    <p>We provide the information "as is" with no warranty of accuracy, completeness or timeliness. ${name} is an independent project and is not affiliated with, endorsed by, or sponsored by any government body, lawmaker, or the companies listed.</p>`);
  if (kind === "privacy") return page("Privacy Policy", `
    <h1>Privacy Policy</h1>
    <p>${name} keeps the minimum needed to run the service.</p>
    <h2>What we store</h2><ul>
    <li><b>Your account:</b> email and a hashed password, so you can sign in.</li>
    <li><b>Your watchlist &amp; alert settings:</b> the politicians, tickers or parties you choose to follow.</li>
    <li><b>Public trade data:</b> lawmaker disclosures from public sources — this is public information, not personal data about you.</li></ul>
    <h2>Alerts</h2><p>If you enable alerts, we send messages to the channels you configure (Telegram, WhatsApp, email). We do not sell your data or share it for advertising.</p>
    <h2>Your choices</h2><p>You can delete your watchlist entries at any time and request account deletion at <a href="mailto:${config.contactEmail}">${config.contactEmail}</a>.</p>`);
  if (kind === "terms") return page("Terms of Service", `
    <h1>Terms of Service</h1>
    <p>By using ${name} you agree to these terms.</p>
    <h2>Use of the service</h2><p>${name} provides information for research and educational purposes only. You may not use it for unlawful purposes or attempt to disrupt the service. Access is provided "as is" and may change or stop at any time.</p>
    <h2>No advice &amp; no liability</h2><p>See our <a href="/disclaimer">Disclaimer</a>. To the maximum extent permitted by law, ${name} is not liable for any loss arising from use of the information provided.</p>
    <h2>Data sources</h2><p>Trade data derives from public government disclosures and public datasets. ${name} does not guarantee accuracy or timeliness.</p>`);
  return page("Contact Us", `
    <h1>Contact Us</h1>
    <p>Questions, corrections or feedback about ${name}?</p>
    <p>Email: <a href="mailto:${config.contactEmail}">${config.contactEmail}</a></p>
    ${config.social.x ? `<p>X / Twitter: <a href="${config.social.x}">${config.social.x}</a></p>` : ""}
    ${config.social.telegram ? `<p>Telegram: <a href="${config.social.telegram}">${config.social.telegram}</a></p>` : ""}
    <p class=muted>We aim to reply within a few business days.</p>`);
}
