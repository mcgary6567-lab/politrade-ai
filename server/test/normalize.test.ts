/** Feed normaliser: real-world record shapes (House/Senate open datasets, FMP API) map to our trade shape. */
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "politrade-norm-"));
process.env.DB_PATH = path.join(dir, "t.db");
process.env.NODE_ENV = "test";
const { normalizeFeedRow, nameKey, normType } = await import("../src/ingest.js");

test("house stock-watcher row", () => {
  const t = normalizeFeedRow({ disclosure_year: 2024, disclosure_date: "03/15/2024", transaction_date: "2024-02-20", owner: "joint", ticker: "NVDA",
    asset_description: "NVIDIA Corporation", type: "sale_partial", amount: "$15,001 - $50,000", representative: "Hon. Jane Q. Example", district: "CA12", ptr_link: "https://disclosures-clerk.house.gov/x.pdf", cap_gains_over_200_usd: false })!;
  assert.equal(t.politician.name, "Rep. Jane Q. Example");
  assert.equal(t.politician.chamber, "House"); assert.equal(t.politician.state, "CA");
  assert.equal(normType(t.tx_type), "sell"); assert.equal(t.tx_date, "2024-02-20"); assert.equal(t.published_date, "2024-03-15");
  assert.equal(t.amount_min, 15001); assert.equal(t.amount_max, 50000); assert.equal(t.owner, "joint");
  assert.ok(t.raw_id && t.raw_id.length === 40, "stable hash id");
});

test("senate stock-watcher row", () => {
  const t = normalizeFeedRow({ transaction_date: "01/05/2024", owner: "Spouse", ticker: "--", asset_description: "Some Municipal Bond", asset_type: "Municipal Security",
    type: "Purchase", amount: "$1,001 - $15,000", comment: "--", senator: "John A Sample", ptr_link: "https://efdsearch.senate.gov/x", disclosure_date: "02/01/2024" })!;
  assert.equal(t.politician.name, "Sen. John A Sample"); assert.equal(t.politician.chamber, "Senate");
  assert.equal(t.issuer.ticker, undefined, "-- ticker dropped but trade kept"); assert.equal(t.issuer.name, "Some Municipal Bond");
  assert.equal(t.owner, "spouse"); assert.equal(normType(t.tx_type), "buy");
});

test("FMP-style row + chamber hint from URL", () => {
  const t = normalizeFeedRow({ firstName: "Nancy", lastName: "Sample", office: "Sample, Nancy (Senator)", district: "CA", dateRecieved: "2025-03-02", transactionDate: "2025-02-10",
    owner: "Self", assetDescription: "Apple Inc", assetType: "Stock", type: "Purchase", amount: "$250,001 - $500,000", symbol: "AAPL", link: "https://efd/x" }, "Senate")!;
  assert.equal(t.politician.name, "Sen. Nancy Sample"); assert.equal(t.politician.state, "CA");
  assert.equal(t.published_date, "2025-03-02"); assert.equal(t.issuer.ticker, "AAPL"); assert.equal(t.amount_max, 500000);
});

test("name keys unify spellings; junk rows dropped; >$50M band", () => {
  assert.equal(nameKey("Hon. Nancy Pelosi"), "nancy pelosi");
  assert.equal(nameKey("Pelosi, Nancy"), "nancy pelosi");
  assert.equal(nameKey("Rep. Nancy P. Pelosi Jr."), "nancy pelosi");
  assert.equal(normalizeFeedRow({ representative: "X", asset_description: "Exempt", type: "purchase" }), null);
  assert.equal(normalizeFeedRow({ type: "purchase", ticker: "AAPL" }), null, "no name");
  const big = normalizeFeedRow({ senator: "A B", asset_description: "Z", type: "Sale (Full)", amount: "Over $50,000,000" })!;
  assert.equal(big.amount_min, 50000001);
});

test("LuxAlgo daily row + history member row map to the same content hash when they describe one filing", () => {
  const a = normalizeFeedRow({ id: "senate:abc:0", chamber: "senate", member: { name: "David H McCormick", bioguideId: "M001243", party: "Republican", state: "PA" },
    filedAt: "2026-08-27", transactedAt: "2026-08-19", ticker: "AAPL", assetDescription: "Apple Inc", assetType: "stock", side: "buy",
    amountRange: { min: 50001, max: 100000, text: "$50,001 - $100,000" }, owner: "spouse", provenance: { sourceUrl: "https://efdsearch.senate.gov/x" } })!;
  const b = normalizeFeedRow({ tx_date: "2026-08-19", filing_date: "2026-08-27", ticker: "AAPL", asset_name: "Apple Inc", side: "buy", owner: "Spouse",
    amount_raw: "$50,001 -\n$100,000", source_url: "https://efdsearch.senate.gov/x", name: "David McCormick", chamber: "Senate", party: "Republican", state: "PA" })!;
  assert.equal(a.politician.name, "Sen. David H McCormick"); assert.equal(a.politician.ext_id, "M001243"); assert.equal(a.politician.state, "PA");
  assert.equal(a.amount_min, 50001); assert.equal(b.amount_max, 100000); assert.equal(b.owner, "spouse");
  assert.equal(a.raw_id, b.raw_id, "deduped across sources");
  assert.equal(normalizeFeedRow({ name: "Cisneros, Jr., Gilbert Ray", chamber: "House", side: "sell", asset_name: "X", tx_date: "2020-01-01" })!.politician.name, "Rep. Gilbert Ray Cisneros Jr.");
});
