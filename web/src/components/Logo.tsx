/** Hillradar mark: a Capitol dome under a radar sweep, gold on navy. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#121a2e" stroke="#223052" />
      {/* radar rings */}
      <circle cx="24" cy="26" r="16" fill="none" stroke="#223052" strokeWidth="1.2" />
      <circle cx="24" cy="26" r="10" fill="none" stroke="#2c3b63" strokeWidth="1.2" />
      {/* sweep */}
      <path d="M24 26L24 10A16 16 0 0 1 38.9 20.4z" fill="#e7b23c" opacity=".22" />
      <path d="M24 26L38.9 20.4" stroke="#e7b23c" strokeWidth="2" strokeLinecap="round" />
      {/* dome */}
      <path d="M15 30a9 9 0 0 1 18 0" fill="none" stroke="#e7b23c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 21v-4M22 17h4" stroke="#e7b23c" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 31h22M16 31v6M20 31v6M24 31v6M28 31v6M32 31v6M12 37h24" stroke="#e7b23c" strokeWidth="2" strokeLinecap="round" />
      {/* blip */}
      <circle cx="33" cy="17" r="2" fill="#22c58b" />
    </svg>
  );
}
