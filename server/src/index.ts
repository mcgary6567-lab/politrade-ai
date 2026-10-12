import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import cron from "node-cron";
import { z } from "zod";
import { config, aiEnabled, APP_VERSION } from "./config.js";
import { migrate } from "./db.js";
import { seedAdmin, login, requireAuth } from "./auth.js";
import { data } from "./routes/data.js";
import { alerts } from "./routes/alerts.js";
import { ingestFromFeed, stats } from "./ingest.js";
import { seedDemo } from "./seed.js";
import { legalPage } from "./legal.js";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

migrate();
seedAdmin();

app.get("/api/health", (_req, res) => res.json({ ok: true, version: APP_VERSION, ai: aiEnabled(), ...stats() }));
app.get("/api/branding", (_req, res) => res.json({
  name: config.brandName, version: APP_VERSION, contact: config.contactEmail, social: config.social,
}));

app.post("/api/auth/login", (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: "Email and password required" });
  const r = login(b.data.email, b.data.password);
  if (!r) return res.status(401).json({ error: "Wrong email or password" });
  res.json(r);
});

// public legal pages
app.get("/privacy", (_req, res) => res.type("html").send(legalPage("privacy")));
app.get("/terms", (_req, res) => res.type("html").send(legalPage("terms")));
app.get("/disclaimer", (_req, res) => res.type("html").send(legalPage("disclaimer")));
app.get("/contact", (_req, res) => res.type("html").send(legalPage("contact")));

// everything below requires sign-in
const api = express.Router();
api.use(requireAuth);
api.get("/me", (req, res) => res.json({ user: req.user }));
api.use(data);
api.use(alerts);
app.use("/api", api);

// serve the built web app in production
const webDist = path.resolve(config.webDist);
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

if (process.env.NODE_ENV !== "test") {
  (async () => {
    if (config.demoData) await seedDemo();
    app.listen(config.port, () => {
      console.log(`${config.brandName} API on http://localhost:${config.port}  (AI: ${aiEnabled() ? "on" : "off"})`);
    });
    if (config.scheduler && config.dataFeedUrl) {
      cron.schedule(config.ingestCron, () => {
        ingestFromFeed().then((r) => console.log(`[ingest] fetched ${r.fetched}, added ${r.added}`)).catch((e) => console.error("[ingest]", e.message));
      });
      console.log(`[ingest] scheduled (${config.ingestCron}) from ${config.dataFeedUrl}`);
    }
  })();
}
