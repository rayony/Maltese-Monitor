export function DogMark() {
  return (
    <div className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-paper shadow-stamp">
      <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
        <ellipse cx="32" cy="38" rx="16" ry="12" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.4" />
        <circle cx="22" cy="22" r="7" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.4" />
        <circle cx="42" cy="22" r="7" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.4" />
        <circle cx="32" cy="34" r="11" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.4" />
        <circle cx="28" cy="33" r="1.4" fill="var(--color-ink)" />
        <circle cx="36" cy="33" r="1.4" fill="var(--color-ink)" />
        <path d="M29 37 Q32 40 35 37" fill="none" stroke="var(--color-ink)" strokeWidth="1.6" />
        <rect x="44" y="40" width="12" height="14" rx="2" fill="var(--color-soup)" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M46 44 H54" stroke="var(--color-cream)" strokeWidth="1.4" />
      </svg>
    </div>
  );
}
