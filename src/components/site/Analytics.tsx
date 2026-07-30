import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { initAnalytics, trackPageView } from "@/lib/analytics";

/**
 * Boots Google Analytics after hydration and reports client-side route
 * changes, which gtag.js cannot see on its own.
 */
export function Analytics() {
  const path = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!path) return;
    // Covers the first render and every client-side route change after it.
    const timer = window.setTimeout(() => trackPageView(path), 0);
    return () => window.clearTimeout(timer);
  }, [path]);

  return null;
}
