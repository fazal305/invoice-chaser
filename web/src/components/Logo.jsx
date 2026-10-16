export function LogoMark({ className = 'size-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1f5f4a" />
      <path d="M9 9.5h11.5a2.5 2.5 0 0 1 2.5 2.5v11" fill="none" stroke="#f7f5f0" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9 15h8M9 20h5" stroke="#f7f5f0" strokeWidth="2.4" strokeLinecap="round" />
      <path d="m19.5 20 3.5 3.5 3.5-3.5" fill="none" stroke="#e9b44c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">Invoice Chaser</span>
    </span>
  )
}
