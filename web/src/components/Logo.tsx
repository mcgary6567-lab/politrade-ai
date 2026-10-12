/** Original PoliTrade AI mark: a capitol-style arch over up/down trade arrows, in gold on navy. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#121a2e" stroke="#223052" />
      <path d="M12 20a12 12 0 0 1 24 0" fill="none" stroke="#e7b23c" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="8.5" r="1.8" fill="#e7b23c" />
      <path d="M18 38V24M18 24l-3.2 3.4M18 24l3.2 3.4" fill="none" stroke="#22c58b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 22v14M30 36l-3.2-3.4M30 36l3.2-3.4" fill="none" stroke="#f26a6a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
