export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none">
          <path
            d="M4 12.5 9.5 18 20 6.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">VouchList</span>
    </span>
  );
}
