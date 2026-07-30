import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Where to send someone after they sign in.
 *
 * Only a same-origin path is ever honoured: an absolute URL here would let a
 * crafted link bounce people off the site straight after signing in.
 */
export function safeRedirect(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}

export type SessionState = {
  /** True until the browser has answered; render neutral UI while it is. */
  loading: boolean;
  user: User | null;
};

/**
 * Reads the current signed-in user in browser code.
 *
 * The session lives in localStorage, which the server cannot read, so the
 * first render on both sides is the neutral "loading" state and the real
 * answer arrives after mount. That keeps the server and client markup
 * identical instead of hydration-mismatching on a signed-in header.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true, user: null });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ loading: false, user: data.session?.user ?? null });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ loading: false, user: session?.user ?? null });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** Best available display name for a Google account. */
export function displayName(user: User): string {
  const meta = user.user_metadata as { full_name?: string; name?: string } | null;
  return meta?.full_name || meta?.name || user.email || "Signed in";
}
