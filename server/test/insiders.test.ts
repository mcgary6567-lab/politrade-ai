/** SEC Form 4 parsing (insider trades) + the /api/insiders endpoints. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "politrade-ins-"));
process.env.DB_PATH = path.join(dir, "test.db");
process.env.NODE_ENV = "test";
process.env.ADMIN_EMAIL = "admin@politrade.ai";
process.env.ADMIN_PASSWORD = "politrade123";
process.env.ANTHROPIC_API_KEY = "";
process.env.GEMINI_API_KEY = "";

// trimmed real-world shape of an EDGAR full-submission .txt carrying a Form 4
const FORM4 = `<SEC-DOCUMENT>0001045810-26-000201.txt : 20261023
<DOCUMENT>
<TYPE>4
<TEXT>
<XML>
<?xml version="1.0"?>
<ownershipDocument>
    <schemaVersion>X0508</schemaVersion>
    <documentType>4</documentType>
    <periodOfReport>2026-10-21</periodOfReport>
    <aff10b5One>1</aff10b5One>
    <issuer>
        <issuerCik>0001045810</issuerCik>
        <issuerName>NVIDIA CORP</issuerName>
        <issuerTradingSymbol>NVDA</issuerTradingSymbol>
    </issuer>
    <reportingOwner>
        <reportingOwnerId>
            <rptOwnerCik>0001197647</rptOwnerCik>
            <rptOwnerName>HUANG JEN HSUN</rptOwnerName>
        </reportingOwnerId>
        <reportingOwnerRelationship>
            <isDirector>1</isDirector>
            <isOfficer>1</isOfficer>
            <isTenPercentOwner>0</isTenPercentOwner>
            <isOther>0</isOther>
            <officerTitle>President and CEO</officerTitle>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <securityTitle><value>Common Stock</value></securityTitle>
            <transactionDate><value>2026-10-21</value></transactionDate>
            <transactionCoding>
                <transactionFormType>4</transactionFormType>
                <transactionCode>S</transactionCode>
                <equitySwapInvolved>0</equitySwapInvolved>
                <footnoteId id="F1"/>
            </transactionCoding>
            <transactionAmounts>
                <transactionShares><value>75,000</value></transactionShares>
                <transactionPricePerShare><value>182.50</value><footnoteId id="F2"/></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
            <postTransactionAmounts><sharesOwnedFollowingTransaction><value>800000000</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
            <ownershipNature><directOrIndirectOwnership><value>I</value></directOrIndirectOwnership></ownershipNature>
        </nonDerivativeTransaction>
        <nonDerivativeTransaction>
            <securityTitle><value>Common Stock</value></securityTitle>
            <transactionDate><value>2026-10-21</value></transactionDate>
            <transactionCoding><transactionFormType>4</transactionFormType><transactionCode>F</transactionCode><equitySwapInvolved>0</equitySwapInvolved></transactionCoding>
            <transactionAmounts><transactionShares><value>1200</value></transactionShares><transactionPricePerShare><value>182.00</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts>
        </nonDerivativeTransaction>
        <nonDerivativeTransaction>
            <securityTitle><value>Common Stock</value></securityTitle>
            <transactionDate><value>2026-10-22</value></transactionDate>
            <transactionCoding><transactionFormType>4</transactionFormType><transactionCode>P</transactionCode><equitySwapInvolved>0</equitySwapInvolved></transactionCoding>
            <transactionAmounts><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>180</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
            <ownershipNature><directOrIndirectOwnership><value>D</value></directOrIndirectOwnership></ownershipNature>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
</ownershipDocument>
</XML>
</TEXT>
</DOCUMENT>
</SEC-DOCUMENT>`;

const INDEX = `Description:           Daily Index of EDGAR Dissemination Feed by Form Type
Last Data Received:    October 23, 2026

Form Type   Company Name                                                  CIK         Date Filed  File Name
---------------------------------------------------------------------------------------------------------------------------------------------
4           NVIDIA CORP                                                   1045810     20261023    edgar/data/1045810/0001045810-26-000201.txt
4           HUANG JEN HSUN                                                1197647     20261023    edgar/data/1045810/0001045810-26-000201.txt
4/A         SOME CO                                                       123         20261023    edgar/data/123/0000000123-26-000001.txt
424B2       BANK                                                          456         20261023    edgar/data/456/0000000456-26-000001.txt
40-F        CANADA CO                                                     789         20261023    edgar/data/789/0000000789-26-000001.txt
4           APPLE INC                                                     320193      20261023    edgar/data/320193/0000320193-26-000101.txt
`;

let server: Server, base = "", tok = "";
async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}

before(async () => {
  const { app } = await import("../src/index.js");
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  tok = (await call("POST", "/api/auth/login", { email: "admin@politrade.ai", password: "politrade123" })).data.token;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test("parseForm4 keeps open-market buys and sells only", async () => {
  const { parseForm4 } = await import("../src/insiders.js");
  const rows = parseForm4(FORM4, "0001045810-26-000201");
  assert.equal(rows.length, 2, "tax-withholding (F) row is skipped");
  const [sell, buy] = rows;
  assert.equal(sell.ticker, "NVDA");
  assert.equal(sell.issuer_name, "NVIDIA CORP");
  assert.equal(sell.insider, "Jen Hsun Huang");
  assert.equal(sell.role, "President and CEO");
  assert.equal(sell.is_director, 1);
  assert.equal(sell.tx_type, "sell");
  assert.equal(sell.shares, 75000);
  assert.equal(sell.price, 182.5);
  assert.equal(sell.value, 13687500);
  assert.equal(sell.direct, 0);
  assert.equal(sell.plan_10b5_1, 1);
  assert.equal(buy.tx_type, "buy");
  assert.equal(buy.tx_date, "2026-10-22");
  assert.equal(buy.raw_id, "0001045810-26-000201#2");
});

test("parseFormIndex lists each Form 4 once and skips 4/A, 424B, 40-F", async () => {
  const { parseFormIndex } = await import("../src/insiders.js");
  const r = parseFormIndex(INDEX);
  assert.deepEqual(r.map((x) => x.file), ["edgar/data/1045810/0001045810-26-000201.txt", "edgar/data/320193/0000320193-26-000101.txt"]);
  assert.equal(r[0].date, "2026-10-23");
});

test("insiderName reorders EDGAR last-first names", async () => {
  const { insiderName } = await import("../src/insiders.js");
  assert.equal(insiderName("HUANG JEN HSUN"), "Jen Hsun Huang");
  assert.equal(insiderName("SMITH JOHN A JR"), "John A Smith Jr.");
  assert.equal(insiderName("Berkshire Hathaway Inc"), "Berkshire Hathaway Inc");
});

test("/api/insiders lists stored trades; storing twice does not duplicate", async () => {
  const { parseForm4, storeInsiderTrades } = await import("../src/insiders.js");
  const rows = parseForm4(FORM4, "0001045810-26-000201");
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(storeInsiderTrades(rows, today), 2);
  assert.equal(storeInsiderTrades(rows, today), 0);
  const all = await call("GET", "/api/insiders");
  assert.equal(all.status, 200);
  assert.equal(all.data.total, 2);
  const sells = await call("GET", "/api/insiders?type=sell&ticker=nvda");
  assert.equal(sells.data.rows.length, 1);
  assert.equal(sells.data.rows[0].insider, "Jen Hsun Huang");
  const big = await call("GET", "/api/insiders?min_value=1000000");
  assert.equal(big.data.total, 1);
  const sum = await call("GET", "/api/insiders/summary?days=30");
  assert.equal(sum.status, 200);
  assert.equal(sum.data.totals.trades, 2);
  assert.equal(sum.data.topSells[0].ticker, "NVDA");
});

test("/api/insiders requires sign-in", async () => {
  const saved = tok; tok = "";
  assert.equal((await call("GET", "/api/insiders")).status, 401);
  tok = saved;
});
