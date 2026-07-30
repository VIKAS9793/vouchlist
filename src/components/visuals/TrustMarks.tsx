type MarkProps = { className?: string };

function Mark({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-10 text-accent-strong"
    >
      {children}
    </svg>
  );
}

const marks = [
  {
    title: "Consent first",
    copy: "A community opts in before anything is saved.",
    art: (
      <Mark>
        <path d="M24 6l15 6.5V25c0 9.5-6.4 17.5-15 20-8.6-2.5-15-10.5-15-20V12.5L24 6z" />
        <path d="M17 24.5l5 5 9.5-10" />
      </Mark>
    ),
  },
  {
    title: "Community owned",
    copy: "The group keeps its list and can delete it any time.",
    art: (
      <Mark>
        <circle cx="24" cy="16" r="6" />
        <path d="M12 38c0-6.6 5.4-12 12-12s12 5.4 12 12" />
        <path d="M7 22a5 5 0 016-4.9M41 22a5 5 0 00-6-4.9" />
      </Mark>
    ),
  },
  {
    title: "No ads, ever",
    copy: "Vendors cannot buy a place on a neighbour's list.",
    art: (
      <Mark>
        <circle cx="24" cy="24" r="16" />
        <path d="M13 13l22 22" />
      </Mark>
    ),
  },
  {
    title: "Stays in WhatsApp",
    copy: "No new app to install and no new habit to learn.",
    art: (
      <Mark>
        <path d="M40 24a16 16 0 01-23.8 13.9L8 40l2.3-7.9A16 16 0 1140 24z" />
        <path d="M19 20c1 4.5 4.5 8 9 9" />
      </Mark>
    ),
  },
];

export function TrustMarks({ className }: MarkProps) {
  return (
    <section className={className} aria-label="Why communities trust VouchList">
      <div className="mx-auto w-full max-w-6xl px-6">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {marks.map((mark) => (
            <li key={mark.title} className="flex gap-4">
              <span className="shrink-0">{mark.art}</span>
              <span className="block">
                <span className="block font-display text-base font-semibold">{mark.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {mark.copy}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
