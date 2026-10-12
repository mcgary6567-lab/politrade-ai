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
