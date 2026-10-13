/** Hillradar AI mark: solid gold Capitol with a white outline, radar sweeps rising from the dome and a live blip. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
  <defs>
    <linearGradient id="hr-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1a2545"/><stop offset="1" stopColor="#0b1020"/></linearGradient>
    <linearGradient id="hr-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6cf6b"/><stop offset="1" stopColor="#d79a1e"/></linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#hr-bg)" stroke="#2b3a66" strokeWidth="1.5"/>
  
  <path d="M32 24a10 10 0 0 1 10-10" fill="none" stroke="#e7b23c" strokeWidth="2.6" strokeLinecap="round"/>
  <path d="M32 24a17 17 0 0 1 17-17" fill="none" stroke="#e7b23c" strokeWidth="2.6" strokeLinecap="round" opacity=".55"/>
  <circle cx="50" cy="12" r="3" fill="#22c58b"/>
  <circle cx="50" cy="12" r="5.6" fill="none" stroke="#22c58b" strokeWidth="1.2" opacity=".5"/>
  
  <g stroke="#f4f6fb" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
    <path d="M32 21v4" fill="none"/>
    <path d="M14 44a18 18 0 0 1 36 0z" fill="url(#hr-gold)"/>
    <rect x="9" y="44" width="46" height="4.5" rx="1.5" fill="url(#hr-gold)"/>
    <rect x="11" y="48.5" width="42" height="7.5" fill="#0b1020"/>
    <rect x="6" y="56" width="52" height="4" rx="1.5" fill="url(#hr-gold)"/>
  </g>
  <g fill="url(#hr-gold)"><rect x="13.5" y="48.5" width="4" height="7.5"/><rect x="20.5" y="48.5" width="4" height="7.5"/><rect x="27.5" y="48.5" width="4" height="7.5"/><rect x="34.5" y="48.5" width="4" height="7.5"/><rect x="41.5" y="48.5" width="4" height="7.5"/><rect x="48.5" y="48.5" width="2.5" height="7.5"/></g>
</svg>
  );
}
