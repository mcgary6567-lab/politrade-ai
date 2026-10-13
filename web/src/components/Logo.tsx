/** Hillradar AI mark: a solid Capitol dome with radar sweeps rising from its top and a live blip. Gold on deep navy. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hr-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1a2545" /><stop offset="1" stopColor="#0b1020" /></linearGradient>
        <linearGradient id="hr-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6cf6b" /><stop offset="1" stopColor="#d79a1e" /></linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#hr-bg)" stroke="#2b3a66" strokeWidth="1.5" />
      <path d="M32 29a17 17 0 0 1 17-17" fill="none" stroke="#e7b23c" strokeWidth="3" strokeLinecap="round" opacity=".95" />
      <path d="M32 29a25 25 0 0 1 25-25" fill="none" stroke="#e7b23c" strokeWidth="3" strokeLinecap="round" opacity=".45" />
      <path d="M32 29a9 9 0 0 1 9-9" fill="none" stroke="#e7b23c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="49" cy="14" r="3.2" fill="#22c58b" />
      <circle cx="49" cy="14" r="6" fill="none" stroke="#22c58b" strokeWidth="1.2" opacity=".5" />
      <path d="M32 25.5v3.5" stroke="url(#hr-gold)" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 43a14 14 0 0 1 28 0z" fill="url(#hr-gold)" />
      <rect x="14" y="43" width="36" height="4" rx="1.5" fill="url(#hr-gold)" />
      <rect x="16" y="47" width="32" height="8" fill="#0b1020" />
      <g fill="url(#hr-gold)"><rect x="18" y="47" width="3.4" height="8" /><rect x="24.3" y="47" width="3.4" height="8" /><rect x="30.6" y="47" width="3.4" height="8" /><rect x="36.9" y="47" width="3.4" height="8" /><rect x="43.2" y="47" width="3.4" height="8" /></g>
      <rect x="12" y="55" width="40" height="3.5" rx="1.5" fill="url(#hr-gold)" />
    </svg>
  );
}
