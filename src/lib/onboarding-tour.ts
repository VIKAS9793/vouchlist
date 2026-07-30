/**
 * Definition of the homepage onboarding tour. Kept apart from the UI so the
 * analytics events, the copy and the tests all read the same step list.
 */
export type TourStep = {
  /** Stable slug reported to analytics, never renamed for copy changes. */
  id: string;
  title: string;
  body: string;
  /** Homepage section the step scrolls into view. */
  anchor: string;
};

export const tourSteps: TourStep[] = [
  {
    id: "problem",
    title: "The problem we start from",
    body: "Trusted recommendations get buried in group chat within minutes, so neighbours ask the same question every week.",
    anchor: "problem",
  },
  {
    id: "how-it-works",
    title: "How VouchList works",
    body: "Ask, save, sort, find again. Four steps that run beside the WhatsApp group you already use.",
    anchor: "how-it-works",
  },
  {
    id: "trust-architecture",
    title: "Why the answers stay trustworthy",
    body: "Every entry traces back to a real neighbour who vouched for it. No ads, no paid placement.",
    anchor: "trust-architecture",
  },
  {
    id: "waitlist",
    title: "Bring it to your community",
    body: "Register your interest and we will reach out if this concept moves to a built product.",
    anchor: "waitlist",
  },
];

/** Remembers that this visitor has seen the tour, so it never auto opens twice. */
export const TOUR_STORAGE_KEY = "vouchlist:tour-seen";

export function hasSeenTour() {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
  } catch {
    // Storage can be blocked. The tour simply offers itself again next visit.
  }
}
