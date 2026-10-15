import { useEffect, useState } from "react";

/** Pro yearly price in cents — the single source of truth is the server's /api/branding. */
let cached: number | null = null;
let inflight: Promise<number> | null = null;

function load(): Promise<number> {
  if (cached != null) return Promise.resolve(cached);
  if (!inflight)
    inflight = fetch("/api/branding")
      .then((r) => r.json())
      .then((b) => (cached = Number(b?.proPriceCents) || 49700))
      .catch(() => 49700);
  return inflight;
}

/** Pro price as a dollar label, e.g. "$497". Falls back to $497 until the branding call resolves. */
export function useProPrice(): string {
  const [cents, setCents] = useState<number>(cached ?? 49700);
  useEffect(() => {
    load().then(setCents);
  }, []);
  return `$${Math.round(cents / 100)}`;
}
