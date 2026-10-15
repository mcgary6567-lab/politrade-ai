/** Ticker → sector map + bond/treasury detection. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sectorFor } from "../src/sectors.js";

test("known tickers map to their sector", () => {
  assert.equal(sectorFor("MSFT"), "Technology");
  assert.equal(sectorFor("aapl"), "Technology"); // case-insensitive
  assert.equal(sectorFor("NVDA"), "Semiconductors");
  assert.equal(sectorFor("JPM"), "Financials");
  assert.equal(sectorFor("UNH"), "Health Care");
  assert.equal(sectorFor("XOM"), "Energy");
  assert.equal(sectorFor("DIS"), "Communication Services");
  assert.equal(sectorFor("TSLA"), "Consumer Discretionary");
  assert.equal(sectorFor("SPY"), "ETF / Index");
  assert.equal(sectorFor("BRK.B"), "Financials"); // dotted ticker
});

test("treasuries/bonds are detected from the name when there is no ticker", () => {
  assert.equal(sectorFor(null, "U.S. Treasury Bill 0.0% Int Mat"), "Bonds & Treasuries");
  assert.equal(sectorFor(undefined, "California Municipal Bond"), "Bonds & Treasuries");
});

test("unknown tickers return undefined (left blank, not guessed)", () => {
  assert.equal(sectorFor("ZZZZ"), undefined);
  assert.equal(sectorFor(null, "Some Private LLC"), undefined);
});
