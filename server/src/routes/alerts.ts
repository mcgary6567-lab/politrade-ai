import { Router } from "express";
import { z } from "zod";
import { all, get, run } from "../db.js";
import { config } from "../config.js";
import { ingestFromFeed, fireAlert } from "../ingest.js";
import { sendAlert } from "../notify.js";

export const alerts = Router();

/** Channel + feed status for the settings/insights UI (never leaks secrets). */
alerts.get("/alerts/status", (_req, res) => {
  res.json({
    channels: {
      telegram: Boolean(config.telegram.token && config.telegram.chatId),
      whatsapp: Boolean(config.wa.token && config.wa.phoneNumberId && config.wa.to),
      email: Boolean(config.email.webhookUrl && config.email.to),
    },
    feed: { configured: Boolean(config.dataFeedUrl), cron: config.ingestCron },
    ai: Boolean(config.anthropicKey || config.geminiKey),
    recent: all("SELECT a.channel,a.ok,a.info,a.created_at,tr.id trade_id FROM alerts_sent a JOIN trades tr ON tr.id=a.trade_id ORDER BY a.id DESC LIMIT 20"),
  });
});

/** Personal watchlist (alert me when these politicians / tickers / parties trade). */
alerts.get("/watchlist", (req, res) => {
  res.json({ rows: all("SELECT * FROM watchlist WHERE user_id=? ORDER BY id DESC", req.user!.id) });
});
alerts.post("/watchlist", (req, res) => {
  const b = z.object({ kind: z.enum(["politician", "ticker", "party", "any"]), value: z.string().min(1) }).parse(req.body);
  run("INSERT INTO watchlist(user_id,kind,value,created_at) VALUES(?,?,?,?)", req.user!.id, b.kind, b.value, new Date().toISOString());
  res.json({ ok: true });
});
alerts.delete("/watchlist/:id", (req, res) => {
  run("DELETE FROM watchlist WHERE id=? AND user_id=?", req.params.id, req.user!.id);
  res.json({ ok: true });
});

/** Admin: pull the feed now. */
alerts.post("/ingest/run", async (req, res) => {
  if (req.user!.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try { res.json(await ingestFromFeed()); } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/** Admin: send a test alert to the configured channels (optionally for a real trade id). */
alerts.post("/alerts/test", async (req, res) => {
  if (req.user!.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const id = Number(req.body?.trade_id);
  if (id && get("SELECT 1 FROM trades WHERE id=?", id)) return res.json(await fireAlert(id));
  res.json(await sendAlert(`<b>${config.brandName}</b>\nThis is a test alert. Channels are wired correctly.`, `${config.brandName}: test alert`));
});
