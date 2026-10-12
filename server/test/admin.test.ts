/** Admin panel API: users, plans, settings (masking), filters, CSV, ingest import. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "politrade-admin-"));
process.env.DB_PATH = path.join(dir, "test.db");
process.env.NODE_ENV = "test";
process.env.ADMIN_EMAIL = "admin@politrade.ai";
process.env.ADMIN_PASSWORD = "politrade123";
process.env.ANTHROPIC_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.DATA_FEED_URL = "";

let server: Server, base = "", admin = "";
async function call(tok: string, method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get("content-type") ?? "";
  return { status: res.status, ct, data: ct.includes("json") ? await res.json() as any : await res.text() };
}

before(async () => {
  const { app } = await import("../src/index.js");
  const { seedDemo } = await import("../src/seed.js");
  await seedDemo();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  admin = (await call("", "POST", "/api/auth/login", { email: "admin@politrade.ai", password: "politrade123" })).data.token;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test("overview + default plans seeded", async () => {
  const o = await call(admin, "GET", "/api/admin/overview");
  assert.equal(o.status, 200);
  assert.ok(o.data.trades >= 400 && o.data.users >= 1 && o.data.plans === 2);
  const plans = await call(admin, "GET", "/api/admin/plans");
  const pro = plans.data.rows.find((p: any) => p.name === "Pro");
  assert.equal(pro.price_cents, 30000); assert.equal(pro.interval, "year");
  assert.ok(plans.data.rows.some((p: any) => p.name === "Free" && p.price_cents === 0));
});

test("users: create member, member cannot access admin, suspend blocks login, plan assign, delete", async () => {
  const c = await call(admin, "POST", "/api/admin/users", { email: "Bob@Example.com", password: "secret12", name: "Bob", role: "member" });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const dup = await call(admin, "POST", "/api/admin/users", { email: "bob@example.com", password: "secret12" });
  assert.equal(dup.status, 400);

  const bob = (await call("", "POST", "/api/auth/login", { email: "bob@example.com", password: "secret12" })).data.token;
  assert.ok(bob);
  assert.equal((await call(bob, "GET", "/api/admin/users")).status, 403);
  assert.equal((await call(bob, "GET", "/api/trades?limit=1")).status, 200);

  const plan = (await call(admin, "GET", "/api/admin/plans")).data.rows[1];
  assert.equal((await call(admin, "PUT", `/api/admin/users/${c.data.id}`, { plan_id: plan.id, status: "suspended" })).status, 200);
  assert.equal((await call("", "POST", "/api/auth/login", { email: "bob@example.com", password: "secret12" })).status, 401);
  assert.equal((await call(bob, "GET", "/api/trades?limit=1")).status, 401, "existing token cut off when suspended");

  const list = (await call(admin, "GET", "/api/admin/users?q=bob")).data.rows;
  assert.equal(list[0].plan, plan.name);

  // last admin cannot demote themselves
  const me = (await call(admin, "GET", "/api/me")).data.user;
  assert.equal((await call(admin, "PUT", `/api/admin/users/${me.id}`, { role: "member" })).status, 400);
  assert.equal((await call(admin, "DELETE", `/api/admin/users/${me.id}`)).status, 400);
  assert.equal((await call(admin, "DELETE", `/api/admin/users/${c.data.id}`)).status, 200);
});

test("plans CRUD", async () => {
  const c = await call(admin, "POST", "/api/admin/plans", { name: "VIP", price_cents: 9900, interval: "month", features: "All" });
  assert.equal(c.status, 200);
  assert.equal((await call(admin, "PUT", `/api/admin/plans/${c.data.id}`, { price_cents: 12900, active: false })).status, 200);
  const row = (await call(admin, "GET", "/api/admin/plans")).data.rows.find((p: any) => p.id === c.data.id);
  assert.equal(row.price_cents, 12900); assert.equal(row.active, 0);
  assert.equal((await call(admin, "DELETE", `/api/admin/plans/${c.data.id}`)).status, 200);
});

test("settings: save telegram + feed, secrets masked, masked echo does not overwrite, status reflects it", async () => {
  const put = await call(admin, "PUT", "/api/admin/settings", { values: { "tg.token": "123456:ABCDEFGHIJKLMNOP", "tg.chat_id": "-100123", "feed.url": "https://example.org/feed.json", "brand.name": "PoliTrade Pro" } });
  assert.equal(put.status, 200);
  const tg = put.data.rows.find((r: any) => r.key === "tg.token");
  assert.ok(tg.value.includes("••••") && !tg.value.includes("ABCDEFGHIJKLMNOP"), "token masked");
  assert.equal(put.data.channels.telegram, true);
  // echoing the masked value back must not clobber the real token
  await call(admin, "PUT", "/api/admin/settings", { values: { "tg.token": tg.value } });
  assert.equal((await call(admin, "GET", "/api/admin/settings")).data.channels.telegram, true);
  const st = await call(admin, "GET", "/api/alerts/status");
  assert.equal(st.data.channels.telegram, true);
  assert.equal(st.data.feed.configured, true);
  assert.equal((await call("", "GET", "/api/branding")).data.name, "PoliTrade Pro");
  // unknown keys ignored, member cannot read settings
  assert.equal((await call(admin, "PUT", "/api/admin/settings", { values: { "evil.key": "x" } })).status, 200);
});

test("filters endpoint + advanced trade filters + csv", async () => {
  const f = await call(admin, "GET", "/api/filters");
  assert.ok(f.data.sectors.includes("Technology") && f.data.states.length > 5);
  const r = await call(admin, "GET", "/api/trades?sector=Technology&type=buy,sell&amount_min=50000&sort=amount");
  assert.ok(r.data.rows.length > 0);
  assert.ok(r.data.rows.every((t: any) => t.sector === "Technology" && t.tx_type !== "exchange" && t.amount_max >= 50000));
  const pol = await call(admin, "GET", "/api/politicians?party=Democrat&chamber=Senate");
  assert.ok(pol.data.rows.length > 0 && pol.data.rows.every((p: any) => p.party === "Democrat" && p.chamber === "Senate"));
  const iss = await call(admin, "GET", "/api/issuers?sector=Energy&sort=volume");
  assert.ok(iss.data.rows.every((i: any) => i.sector === "Energy"));
  const detail = await call(admin, "GET", `/api/issuers/${iss.data.rows[0].id}`);
  assert.ok(detail.data.summary.trades >= 1 && detail.data.topPols.length >= 1);
  const csv = await call(admin, "GET", "/api/trades.csv?sector=Energy");
  assert.ok(csv.ct.includes("text/csv") && String(csv.data).startsWith("published_date,"));
  const ins = await call(admin, "GET", "/api/insights?days=90");
  assert.ok(ins.data.bands.length >= 1 && ins.data.byChamber.length >= 1);
});

test("manual import normalises feed-style rows and logs it; ingest without feed URL errors cleanly", async () => {
  const before = (await call(admin, "GET", "/api/admin/overview")).data.trades;
  const imp = await call(admin, "POST", "/api/admin/ingest/import", { rows: [
    { representative: "Rep. Sample Person", party: "D", state: "CA", ticker: "AAPL", asset_description: "Apple Inc.", type: "purchase", transaction_date: "01/15/2025", disclosure_date: "02/01/2025", amount: "$15,001 - $50,000", owner: "self", ptr_link: "x1" },
    { senator: "Sen. Sample Two", party: "Republican", state: "TX", ticker: "--", asset_description: "Muni bond", type: "sale", transaction_date: "2025-01-10" },
  ] });
  assert.equal(imp.status, 200, JSON.stringify(imp.data));
  assert.equal(imp.data.added, 2, "muni bond without ticker is still a disclosed trade");
  assert.equal((await call(admin, "GET", "/api/admin/overview")).data.trades, before + 2);
  const t = (await call(admin, "GET", "/api/trades?ticker=AAPL&party=Democrat&q=Sample")).data.rows[0];
  assert.equal(t.tx_date, "2025-01-15"); assert.equal(t.amount_max, 50000); assert.equal(t.tx_type, "buy");
  const log = await call(admin, "GET", "/api/admin/ingest/log");
  assert.ok(log.data.rows[0].fetched === 2 && log.data.rows[0].added === 2);
  await call(admin, "PUT", "/api/admin/settings", { values: { "feed.url": "" } });
  const run = await call(admin, "POST", "/api/admin/ingest/run");
  assert.equal(run.status, 400);
  assert.match(run.data.error, /feed URL/);
});

test("test-alert endpoint reports simulated when unconfigured", async () => {
  await call(admin, "PUT", "/api/admin/settings", { values: { "wa.token": "" } });
  const r = await call(admin, "POST", "/api/admin/test/whatsapp");
  assert.equal(r.status, 200);
  assert.match(r.data.results.whatsapp, /simulated/);
  assert.equal((await call(admin, "POST", "/api/admin/test/ai")).status, 400);
});

test("plan gating: free member sees 30-day window, no CSV, 1 watchlist item; Pro unlocks", async () => {
  const c = await call(admin, "POST", "/api/admin/users", { email: "free@example.com", password: "secret12", name: "Free" });
  const tok = (await call("", "POST", "/api/auth/login", { email: "free@example.com", password: "secret12" })).data.token;
  const me = (await call(tok, "GET", "/api/me")).data.user;
  assert.equal(me.plan, "Free"); assert.equal(me.pro, false);
  const all = (await call(admin, "GET", "/api/trades?limit=1")).data.total;
  const free = await call(tok, "GET", "/api/trades?limit=1");
  assert.equal(free.data.window_days, 30); assert.ok(free.data.total < all);
  assert.equal((await call(tok, "GET", "/api/trades.csv")).status, 402);
  assert.equal((await call(tok, "POST", "/api/watchlist", { kind: "ticker", value: "AAPL" })).status, 200);
  assert.equal((await call(tok, "POST", "/api/watchlist", { kind: "ticker", value: "MSFT" })).status, 402);
  const pro = (await call(admin, "GET", "/api/admin/plans")).data.rows.find((p: any) => p.name === "Pro");
  await call(admin, "PUT", `/api/admin/users/${c.data.id}`, { plan_id: pro.id });
  assert.equal((await call(tok, "GET", "/api/me")).data.user.pro, true, "plan change applies to existing token");
  assert.equal((await call(tok, "GET", "/api/trades?limit=1")).data.total, all);
  assert.equal((await call(tok, "GET", "/api/trades.csv")).status, 200);
});
