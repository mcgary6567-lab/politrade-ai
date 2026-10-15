/** Core API smoke test: login gate, seeded demo data, filters, insights, alert status. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "politrade-"));
process.env.DB_PATH = path.join(dir, "test.db");
process.env.NODE_ENV = "test";
process.env.ADMIN_EMAIL = "admin@politrade.ai";
process.env.ADMIN_PASSWORD = "politrade123";
process.env.ANTHROPIC_API_KEY = "";
process.env.GEMINI_API_KEY = "";

let server: Server, base = "";
async function call(tok: string, method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}

before(async () => {
  const { app } = await import("../src/index.js");
  const { seedDemo } = await import("../src/seed.js");
  await seedDemo();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test("trades require sign-in", async () => {
  assert.equal((await call("", "GET", "/api/trades")).status, 401);
});

test("login then read seeded trades", async () => {
  const r = await call("", "POST", "/api/auth/login", { email: "admin@politrade.ai", password: "politrade123" });
  assert.equal(r.status, 200);
  const tok = r.data.token;
  assert.ok(tok);

  const trades = await call(tok, "GET", "/api/trades?limit=10");
  assert.equal(trades.status, 200);
  assert.ok(trades.data.total >= 40, "demo trades seeded");
  assert.ok(trades.data.rows[0].politician && trades.data.rows[0].issuer);

  // filter by type
  const buys = await call(tok, "GET", "/api/trades?type=buy");
  assert.ok(buys.data.rows.every((t: any) => t.tx_type === "buy"));

  const pols = await call(tok, "GET", "/api/politicians");
  assert.ok(pols.data.rows.length >= 1 && pols.data.rows[0].trades >= 1);

  const iss = await call(tok, "GET", "/api/issuers");
  assert.ok(iss.data.rows.length >= 1);

  const ins = await call(tok, "GET", "/api/insights");
  assert.ok(ins.data.totals.trades >= 40);
  assert.ok(ins.data.topIssuers.length >= 1 && ins.data.byParty.length >= 1);

  const st = await call(tok, "GET", "/api/alerts/status");
  assert.equal(st.status, 200);
  assert.equal(st.data.channels.telegram, false); // unconfigured in test
});

test("wrong password is rejected", async () => {
  assert.equal((await call("", "POST", "/api/auth/login", { email: "admin@politrade.ai", password: "nope" })).status, 401);
});

test("watchlist add/list/delete", async () => {
  const tok = (await call("", "POST", "/api/auth/login", { email: "admin@politrade.ai", password: "politrade123" })).data.token;
  assert.equal((await call(tok, "POST", "/api/watchlist", { kind: "ticker", value: "AAPL" })).status, 200);
  const list = await call(tok, "GET", "/api/watchlist");
  assert.ok(list.data.rows.length === 1);
  assert.equal((await call(tok, "DELETE", `/api/watchlist/${list.data.rows[0].id}`)).status, 200);
  assert.equal((await call(tok, "GET", "/api/watchlist")).data.rows.length, 0);
});

test("free plan sees only 3 trades; the rest are Pro-locked (feed + detail)", async () => {
  // admin is Pro: full feed
  const admin = (await call("", "POST", "/api/auth/login", { email: "admin@politrade.ai", password: "politrade123" })).data.token;
  const full = await call(admin, "GET", "/api/trades?limit=200");
  assert.equal(full.data.plan, "pro");
  assert.ok(full.data.rows.length > 3, "admin gets the full feed");
  assert.equal(full.data.locked, 0, "nothing locked for Pro");

  // a brand-new signup is Free
  const su = await call("", "POST", "/api/auth/signup", { first_name: "Free", last_name: "User", email: "free@test.pk", password: "test1234", accept: true });
  assert.equal(su.status, 200, JSON.stringify(su.data));
  const free = su.data.token;
  assert.equal(su.data.user.pro, false, "new user is not Pro");

  const feed = await call(free, "GET", "/api/trades?limit=50");
  assert.equal(feed.data.plan, "free");
  assert.equal(feed.data.rows.length, 3, "free sees exactly 3 trades");
  assert.equal(feed.data.free_visible, 3);
  assert.equal(feed.data.locked, feed.data.total - 3, "the rest are locked");
  assert.ok(feed.data.total > 3, "there are more trades than shown");

  // the 3 visible trades (top of the feed) open; a locked one does not
  const visibleId = feed.data.rows[0].id;
  assert.equal((await call(free, "GET", `/api/trades/${visibleId}`)).status, 200, "a visible trade opens");
  const lockedId = full.data.rows.map((t: any) => t.id).find((id: number) => !feed.data.rows.some((r: any) => r.id === id));
  assert.ok(lockedId, "found a trade outside the free 3");
  const det = await call(free, "GET", `/api/trades/${lockedId}`);
  assert.equal(det.status, 402, "a locked trade is refused for Free");
  assert.equal(det.data.locked, true);

  // Pro can open that same trade
  assert.equal((await call(admin, "GET", `/api/trades/${lockedId}`)).status, 200, "Pro opens any trade");

  // CSV stays Pro-only
  assert.equal((await call(free, "GET", "/api/trades.csv")).status, 402, "CSV is Pro-only");
});

test("a politician's trade history: Free sees only the latest trade, Pro sees all", async () => {
  const admin = (await call("", "POST", "/api/auth/login", { email: "admin@politrade.ai", password: "politrade123" })).data.token;
  const free = (await call("", "POST", "/api/auth/signup", { first_name: "Free", last_name: "Two", email: "free2@test.pk", password: "test1234", accept: true })).data.token;

  // pick a politician that has several trades
  const pols = await call(admin, "GET", "/api/politicians");
  const polId = pols.data.rows.find((p: any) => p.trades > 1)?.id ?? pols.data.rows[0].id;

  const pro = await call(admin, "GET", `/api/politicians/${polId}`);
  assert.equal(pro.data.plan, "pro");
  assert.equal(pro.data.tradesLocked, 0, "nothing locked for Pro");
  assert.ok(pro.data.trades.length > 1, "Pro gets the full history");

  const f = await call(free, "GET", `/api/politicians/${polId}`);
  assert.equal(f.data.plan, "free");
  assert.equal(f.data.trades.length, 1, "Free sees exactly one trade");
  assert.equal(f.data.tradesTotal, pro.data.trades.length, "total reflects the real history");
  assert.equal(f.data.tradesLocked, pro.data.trades.length - 1, "the rest are locked");
});
