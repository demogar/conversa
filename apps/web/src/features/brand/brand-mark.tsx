/** The Conversa mark: two cut speech squares, in the system's ink and gold. */
export function BrandLogo({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 22 22" className="shrink-0">
      <rect width="22" height="22" fill="var(--ink)" />
      <rect x="3" y="3" width="11" height="9" fill="var(--oro)" />
      <rect x="8" y="10" width="11" height="9" fill="var(--cloth-pale)" />
      <rect x="10" y="12" width="7" height="2" fill="var(--ink)" />
      <rect x="10" y="15" width="4" height="2" fill="var(--ink)" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <BrandLogo />
      <span className="font-display text-base font-bold tracking-display wdth-display">Conversa</span>
    </span>
  );
}
