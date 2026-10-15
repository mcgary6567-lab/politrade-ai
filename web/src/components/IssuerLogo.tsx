import { useState } from "react";

/** Company logo by ticker (proxied + disk-cached on our origin); falls back to a letter avatar. */
export default function IssuerLogo({ ticker, name, size = 28, className = "" }: { ticker?: string | null; name?: string; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const letter = String(ticker || name || "?").trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (!ticker || err) return <span style={style} className={`grid shrink-0 place-items-center rounded-lg bg-ink-600 font-mono font-700 text-gold ${className}`}>{letter}</span>;
  return <img src={`/api/logo/${encodeURIComponent(ticker)}`} alt="" loading="lazy" onError={() => setErr(true)} style={style} className={`shrink-0 rounded-lg bg-white object-contain p-0.5 ${className}`} />;
}
