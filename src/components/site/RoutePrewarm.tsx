import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Warms the JavaScript for the primary navigation once the hero has painted.
 *
 * The router already preloads a route on hover/focus ("intent"). This adds a
 * second, idle-time pass so the five header destinations are resolved before
 * the visitor ever points at them, without competing with the first paint.
 */
const PRIMARY_ROUTES = ["/features", "/how-it-works", "/communities", "/trust", "/faq"] as const;

export function RoutePrewarm() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const warm = () => {
      if (cancelled) return;
      for (const to of PRIMARY_ROUTES) {
        void router.preloadRoute({ to }).catch(() => {
          /* preloading is best effort; never surface a failure to the visitor */
        });
      }
    };

    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const handle = idle(warm, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(warm, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  return null;
}
