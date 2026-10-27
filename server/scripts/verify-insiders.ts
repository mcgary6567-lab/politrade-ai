// one-off: parse a real EDGAR day (first N Form 4 filings) and print what we would store
import { parseFormIndex, parseForm4 } from "../src/insiders.js";
const UA = { "user-agent": "Hillradar AI info@hillradar.com" };
const day = process.argv[2]; const N = Number(process.argv[3] ?? 80);
const d = new Date(day + "T12:00:00Z"); const q = Math.floor(d.getUTCMonth() / 3) + 1;
const idxUrl = `https://www.sec.gov/Archives/edgar/daily-index/${d.getUTCFullYear()}/QTR${q}/form.${day.replace(/-/g, "")}.idx`;
const r = await fetch(idxUrl, { headers: UA }); console.log("index", r.status, idxUrl);
const filings = parseFormIndex(await r.text()); console.log("Form 4 filings in index:", filings.length);
let parsed = 0, withXml = 0, trades: any[] = [];
for (const f of filings.slice(0, N)) {
  await new Promise((r) => setTimeout(r, 160));
  const t = await (await fetch("https://www.sec.gov/Archives/" + f.file, { headers: UA })).text();
  if (/<ownershipDocument>/i.test(t)) withXml++;
  const rows = parseForm4(t, f.file.split("/").pop()!.replace(".txt", "")); parsed++; trades.push(...rows);
}
console.log(`fetched ${parsed}, with ownershipDocument ${withXml}, open-market trades ${trades.length} (buys ${trades.filter(t=>t.tx_type==="buy").length}, sells ${trades.filter(t=>t.tx_type==="sell").length})`);
console.log("missing ticker:", trades.filter(t => !t.ticker).length, "missing price:", trades.filter(t => t.price == null).length, "missing date:", trades.filter(t => !t.tx_date).length);
for (const t of trades.slice(0, 12)) console.log(` ${t.tx_type.padEnd(4)} ${String(t.ticker).padEnd(6)} ${t.insider.slice(0,28).padEnd(28)} ${t.role.slice(0,24).padEnd(24)} ${t.shares} @ ${t.price} = ${t.value} on ${t.tx_date} 10b5-1=${t.plan_10b5_1}`);
