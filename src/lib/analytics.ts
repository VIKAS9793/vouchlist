/**
 * Google Analytics 4 (gtag.js) wiring.
 *
 * Loaded lazily in the browser so it never blocks the first paint, and kept in
 * one module so both the app and the QA suite agree on event names and the
 * exact metadata each conversion carries.
 */

/** Measurement ID, injected at build time by the analytics connector. */
export const MEASUREMENT_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as
  string | undefined;

/** The single conversion event fired when someone joins the waitlist. */
export const WAITLIST_CONVERSION_EVENT = "waitlist_signup";

/** GA4 recommended lead event, sent alongside for standard reporting. */
export const WAITLIST_LEAD_EVENT = "generate_lead";

/** Onboarding tour funnel: start, one per step, then skip or complete. */
export const TOUR_START_EVENT = "onboarding_tour_start";
export const TOUR_STEP_EVENT = "onboarding_step_complete";
export const TOUR_SKIP_EVENT = "onboarding_tour_skip";
export const TOUR_COMPLETE_EVENT = "onboarding_tour_complete";

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** Test hook: every event sent in this page, in order. */
    __analyticsEvents?: Array<{ name: string; params: AnalyticsParams }>;
  }
}

let initialised = false;

/** Pushes to the GA queue. Safe before gtag.js finishes downloading. */
function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
}

/**
 * Loads gtag.js once and configures the measurement ID. Manual page views:
 * this is a client-routed site, so each route change sends its own event.
 */
export function initAnalytics() {
  if (typeof window === "undefined" || initialised) return;
  if (!MEASUREMENT_ID) return;
  initialised = true;

  window.dataLayer = window.dataLayer ?? [];
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

/** Sends a GA4 event and records it on the page for end-to-end verification. */
export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  const clean: AnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") clean[key] = value;
  }
  window.__analyticsEvents = window.__analyticsEvents ?? [];
  window.__analyticsEvents.push({ name, params: clean });
  gtag("event", name, { send_to: MEASUREMENT_ID, ...clean });
}

export function trackPageView(path: string) {
  trackEvent("page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/**
 * SHA-256 of the lowercased email. Lets a signup be matched back to a person
 * we already know about without ever sending an address to a third party.
 */
export async function hashEmail(email: string): Promise<string | undefined> {
  try {
    const data = new TextEncoder().encode(email.trim().toLowerCase());
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

export type WaitlistConversion = {
  /** Server-generated id, so the frontend event and the backend row line up. */
  eventId: string;
  duplicate: boolean;
  city?: string;
  role?: string;
  community?: string;
  emailHash?: string;
  formLocation: string;
};

/** Fires the waitlist conversion with the metadata that was submitted. */
export function trackWaitlistConversion(conversion: WaitlistConversion) {
  const params: AnalyticsParams = {
    event_id: conversion.eventId,
    transaction_id: conversion.eventId,
    method: "waitlist_form",
    form_location: conversion.formLocation,
    is_duplicate: conversion.duplicate,
    lead_city: conversion.city,
    lead_role: conversion.role,
    has_community: Boolean(conversion.community),
    lead_id: conversion.emailHash,
  };
  trackEvent(WAITLIST_CONVERSION_EVENT, params);
  // Only count a brand new signup as a lead, so duplicates do not inflate it.
  if (!conversion.duplicate) {
    trackEvent(WAITLIST_LEAD_EVENT, { ...params, currency: "INR", value: 0 });
  }
}

/**
 * Shared shape for every onboarding tour event, so start, step, skip and
 * complete can be compared in one funnel report without joining on guesswork.
 */
export type TourEventContext = {
  /** Id minted when the tour starts, identical on every event in that run. */
  tourId: string;
  /** How the tour was opened: "auto" on a first visit, "manual" from the nudge. */
  trigger: string;
  /** Total steps in the tour, so completion rate is readable per event. */
  totalSteps: number;
  /** Zero-based index of the step in view, omitted for the start event. */
  stepIndex?: number;
  /** Stable slug of the step, easier to read in reports than an index. */
  stepId?: string;
  /** Milliseconds since the tour started. */
  elapsedMs?: number;
};

function tourParams(context: TourEventContext): AnalyticsParams {
  return {
    tour_id: context.tourId,
    tour_name: "homepage_onboarding",
    tour_trigger: context.trigger,
    tour_total_steps: context.totalSteps,
    step_index: context.stepIndex,
    step_number: context.stepIndex === undefined ? undefined : context.stepIndex + 1,
    step_id: context.stepId,
    elapsed_ms: context.elapsedMs,
  };
}

export function trackTourStart(context: TourEventContext) {
  trackEvent(TOUR_START_EVENT, tourParams(context));
}

/** Fired once per step the visitor finishes, not once per step they see. */
export function trackTourStepComplete(context: TourEventContext) {
  trackEvent(TOUR_STEP_EVENT, tourParams(context));
}

export function trackTourSkip(context: TourEventContext) {
  trackEvent(TOUR_SKIP_EVENT, {
    ...tourParams(context),
    // Steps finished before dropping out, the key number for effectiveness.
    steps_completed: context.stepIndex ?? 0,
  });
}

export function trackTourComplete(context: TourEventContext) {
  trackEvent(TOUR_COMPLETE_EVENT, { ...tourParams(context), steps_completed: context.totalSteps });
}
