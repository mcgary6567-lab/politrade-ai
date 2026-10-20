/**
 * Export the lawmaker list for the marketing site's per-lawmaker pages (/congress/<slug>/).
 * Writes <landing>/tools/lawmakers-export.json with the most active disclosed traders and their
 * REAL figures from the database. The landing build (tools/build-lawmakers.mjs) turns each row
 * into a page; tools/lawmakers.mjs merges this file with data.json and extra-lawmakers.json.
 *
 *   DB_PATH=/path/to/prod.db npx tsx scripts/export-lawmakers.ts <path-to-hillradar-landing-checkout> [limit] [minTrades]
 *
 * Defaults: limit 150, minTrades 20. Lower minTrades / raise limit to emit more lawmakers
 * (e.g. so recognisable names like Nancy Pelosi, who trade in size but not high frequency, are
 * included). minTrades keeps very thin pages out of the index.
 *
 * Run tools/build-lawmakers.mjs then tools/build-blog.mjs in the landing checkout afterwards.
 */
import fs from "node:fs";
import path from "node:path";

// db.js opens the DB from config (DB_PATH) at import time, so point DB_PATH at the real DB first.
const { all } = await import("../src/db.js");

const out = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(path.join(out, "tools", "lawmakers.mjs"))) {
  console.error("usage: DB_PATH=/path/to/prod.db npx tsx scripts/export-lawmakers.ts <path to the hillradar-landing checkout> [limit] [minTrades]");
  process.exit(1);
}
const limit = Number.parseInt(process.argv[3] ?? "150", 10);
const minTrades = Number.parseInt(process.argv[4] ?? "20", 10);

const rows = all(
  `SELECT p.name, p.party, p.chamber, p.state,
          COUNT(*)                                            AS n,
          SUM(CASE WHEN tr.tx_type = 'buy'  THEN 1 ELSE 0 END) AS buys,
          SUM(CASE WHEN tr.tx_type = 'sell' THEN 1 ELSE 0 END) AS sells,
          MIN(tr.tx_date)                                     AS first,
          MAX(tr.tx_date)                                     AS last
     FROM trades tr
     JOIN politicians p ON p.id = tr.politician_id
    WHERE tr.tx_date IS NOT NULL AND p.name IS NOT NULL
    GROUP BY p.id
   HAVING n >= ?
    ORDER BY n DESC
    LIMIT ?`,
  minTrades, limit,
);

const clean = rows
  .filter((r: any) => r.party && r.chamber && r.state && r.first && r.last)
  .map((r: any) => ({
    name: String(r.name).trim(),
    party: r.party,
    chamber: r.chamber,
    state: r.state,
    n: Number(r.n),
    buys: Number(r.buys),
    sells: Number(r.sells),
    first: String(r.first).slice(0, 10),
    last: String(r.last).slice(0, 10),
  }));

const file = path.join(out, "tools", "lawmakers-export.json");
fs.writeFileSync(file, JSON.stringify(clean, null, 2) + "\n");
console.log(`wrote ${clean.length} lawmakers to ${path.relative(process.cwd(), file)} (limit ${limit}, minTrades ${minTrades})`);
if (clean.length) console.log(`  range: ${clean[0].name} (${clean[0].n}) … ${clean[clean.length - 1].name} (${clean[clean.length - 1].n})`);
