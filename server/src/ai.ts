import Anthropic from "@anthropic-ai/sdk";
import { integ, aiOn } from "./settings.js";

/** A short, plain-language note about a trade. Uses Claude or Gemini if a key is set; else a rule-based line. */
export async function tradeInsight(t: {
  politician: string; party?: string; chamber?: string; ticker?: string; issuer: string;
  tx_type: string; amount_min?: number | null; amount_max?: number | null; tx_date?: string | null;
}): Promise<string> {
  const amount = t.amount_min != null ? `$${fmt(t.amount_min)}–$${fmt(t.amount_max ?? t.amount_min)}` : "undisclosed amount";
  const base = `${t.politician} (${[t.party, t.chamber].filter(Boolean).join(", ")}) ${verb(t.tx_type)} ${t.issuer}${t.ticker ? ` (${t.ticker})` : ""} for ${amount}.`;
  if (!aiOn()) return base;
  const prompt = `In ONE concise, neutral sentence (max 30 words), summarize this US congressional stock disclosure for an alerts feed. No advice, no speculation about motive.\n${base} Trade date: ${t.tx_date ?? "n/a"}.`;
  try {
    const ak = integ.anthropicKey();
    if (ak) {
      const a = new Anthropic({ apiKey: ak });
      const r = await a.messages.create({ model: integ.aiModel(), max_tokens: 120, messages: [{ role: "user", content: prompt }] });
      const txt = r.content.map((c: any) => (c.type === "text" ? c.text : "")).join("").trim();
      return txt || base;
    }
    const gk = integ.geminiKey();
    if (gk) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${integ.geminiModel()}:generateContent?key=${gk}`;
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const j: any = await r.json();
      const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return txt || base;
    }
  } catch { /* fall back */ }
  return base;
}

/** 2–3 sentence plain-English thesis for a signal (AI when a key is set; otherwise a clear templated one). */
export async function signalThesis(sg: { ticker: string; issuer: string; direction: "buy" | "sell"; buyers: number; sellers: number; smart: number; volume: number; bipartisan: boolean; days: number; topBuyers: { name: string; hit_rate?: number | null }[] }): Promise<string> {
  const who = sg.topBuyers.slice(0, 3).map((b) => b.name + (b.hit_rate != null ? ` (${Math.round(b.hit_rate * 100)}% hit rate)` : "")).join(", ");
  const base = sg.direction === "buy"
    ? `${sg.buyers} lawmaker${sg.buyers > 1 ? "s" : ""} disclosed buying ${sg.issuer} (${sg.ticker}) in the last ${sg.days} days${sg.sellers ? ` against ${sg.sellers} seller${sg.sellers > 1 ? "s" : ""}` : ""}${sg.bipartisan ? ", from both parties" : ""}. ${who ? `Notable buyers: ${who}. ` : ""}Congressional buying clusters like this have historically preceded above-market 6-month moves more often than not — treat it as a research lead, not a recommendation.`
    : `${sg.sellers} lawmaker${sg.sellers > 1 ? "s" : ""} disclosed selling ${sg.issuer} (${sg.ticker}) in the last ${sg.days} days${sg.buyers ? ` against ${sg.buyers} buyer${sg.buyers > 1 ? "s" : ""}` : ""}. Selling clusters are a weaker signal than buying (sales are often for liquidity), so read this as caution rather than a short call.`;
  if (!aiOn()) return base;
  const prompt = `You write short, neutral research notes for a congressional-trading tracker. In 2–3 sentences (max 70 words) explain why this ${sg.direction.toUpperCase()} signal on ${sg.issuer} (${sg.ticker}) is worth a member's attention and what the main caveat is. Facts: ${base} Do not give investment advice or price targets; do not invent news.`;
  try {
    const ak = integ.anthropicKey();
    if (ak) {
      const a = new Anthropic({ apiKey: ak });
      const r = await a.messages.create({ model: integ.aiModel(), max_tokens: 160, messages: [{ role: "user", content: prompt }] });
      const txt = r.content.map((c: any) => (c.type === "text" ? c.text : "")).join("").trim();
      return txt || base;
    }
    const gk = integ.geminiKey();
    if (gk) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${integ.geminiModel()}:generateContent?key=${gk}`;
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const j: any = await r.json();
      return j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || base;
    }
  } catch { /* fall back */ }
  return base;
}

const verb = (t: string) => (t === "buy" ? "bought" : t === "sell" ? "sold" : "exchanged");
const fmt = (n: number) => n.toLocaleString("en-US");
