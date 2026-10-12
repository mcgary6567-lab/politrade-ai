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

const verb = (t: string) => (t === "buy" ? "bought" : t === "sell" ? "sold" : "exchanged");
const fmt = (n: number) => n.toLocaleString("en-US");
