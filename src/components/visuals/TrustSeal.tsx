type Props = { className?: string };

/**
 * Inline vector trust seal. Ships with the HTML, so it paints on first frame
 * with no network request, no decode cost and no layout shift.
 */
export function TrustSeal({ className }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label="Community verified seal"
      className={className}
      width="96"
      height="96"
    >
      <circle
        cx="48"
        cy="48"
        r="45"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <circle
        cx="48"
        cy="48"
        r="45"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="vector-draw"
        style={{ strokeDasharray: 283, strokeDashoffset: 283 }}
      />
      <path
        d="M48 20l21 9v18c0 13-9 24.5-21 29-12-4.5-21-16-21-29V29l21-9z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M38 48.5l7.5 7.5L59 42"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="vector-draw vector-draw-delayed"
        style={{ strokeDasharray: 40, strokeDashoffset: 40 }}
      />
    </svg>
  );
}
