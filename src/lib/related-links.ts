/**
 * Curated internal-link graph for the indexable pages.
 *
 * Every public page links onward to at least three others, so a crawler that
 * lands on any single page can reach the whole site without following the
 * token-gated routes (/waitlist/confirm, /privacy/verify) or the internal
 * pages (/security, /auth, /account, /insights), which are excluded from the
 * sitemap and marked noindex.
 */
import type { PublicRoutePath } from "./sitemap-routes";

export type RelatedLink = {
  to: PublicRoutePath;
  label: string;
  blurb: string;
};

const pages: Record<RelatedLink["to"], Omit<RelatedLink, "to">> = {
  "/": {
    label: "What VouchList is",
    blurb: "The short version: why good recommendations get lost, and what we do about it.",
  },
  "/features": {
    label: "See the features",
    blurb: "What gets saved, how you search it, and what changes for residents day to day.",
  },
  "/how-it-works": {
    label: "How it works",
    blurb: "Walk through a real group chat and the six steps behind a saved recommendation.",
  },
  "/communities": {
    label: "Who it is for",
    blurb: "Housing societies, parent groups and committees already running on WhatsApp.",
  },
  "/trust": {
    label: "Trust and privacy",
    blurb: "What we store, what we never store, and who can change an entry.",
  },
  "/faq": {
    label: "Read the FAQ",
    blurb: "The questions committees ask before they say yes, answered plainly.",
  },
  "/privacy/request": {
    label: "Ask for your data",
    blurb: "Get a copy of your details or have them deleted. No account needed.",
  },
};

/** Which pages each page points at. Ordered by how useful the next step is. */
const graph: Record<string, RelatedLink["to"][]> = {
  "/": ["/how-it-works", "/features", "/communities", "/faq"],
  "/features": ["/how-it-works", "/communities", "/trust", "/faq"],
  "/how-it-works": ["/features", "/trust", "/communities", "/faq"],
  "/communities": ["/how-it-works", "/features", "/faq", "/trust"],
  "/trust": ["/privacy/request", "/faq", "/how-it-works", "/features"],
  "/faq": ["/how-it-works", "/features", "/trust", "/communities"],
  "/privacy/request": ["/trust", "/faq", "/how-it-works", "/"],
};

/** Returns the onward links for a page, ignoring any trailing slash. */
export function relatedFor(pathname: string): RelatedLink[] {
  const key = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return (graph[key] ?? []).map((to) => ({ to, ...pages[to] }));
}

/** Onward links shown after a successful waitlist signup. */
export const postSignupLinks: RelatedLink[] = (["/how-it-works", "/trust", "/faq"] as const).map(
  (to) => ({ to, ...pages[to] }),
);
