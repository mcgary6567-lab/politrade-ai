import { Router } from "express";
import { z } from "zod";
import { all, get, run } from "../db.js";
import { integ, aiOn } from "../settings.js";
import { channelStatus } from "../notify.js";

export const alerts = Router();

/** Channel + feed status for the dashboard (never leaks secrets). */
alerts.get("/alerts/status", (_req, res) => {
  res.json({
    channels: channelStatus(),
    feed: { configured: Boolean(integ.feedUrl()), cron: integ.feedCron(), enabled: integ.alertsEnabled() },
    ai: aiOn(),
    lastIngest: get("SELECT started_at, finished_at, fetched, added, error, source FROM ingest_log ORDER BY id DESC LIMIT 1") ?? null,
    trades: get("SELECT COUNT(*) c FROM trades").c,
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
