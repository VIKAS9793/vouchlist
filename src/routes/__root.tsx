import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NotFound } from "@/components/site/NotFound";
import { RoutePrewarm } from "@/components/site/RoutePrewarm";
import { Analytics } from "@/components/site/Analytics";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VouchList" },
      {
        name: "description",
        content:
          "The trusted shared list for WhatsApp communities. Recommendations from your neighbours, saved and easy to find.",
      },
      { name: "author", content: "VouchList" },
      { property: "og:title", content: "VouchList" },
      {
        property: "og:description",
        content: "The trusted shared list for WhatsApp communities.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "VouchList" },
      { property: "og:locale", content: "en_IN" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "google-site-verification",
        content: "SwVg4cqb1hrBiO-ISPOzhMU-4LwhoQTzM4xufLMWZzA",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Inter:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runtime style injectors (react-remove-scroll and friends) read this
            global to nonce the <style> tags they create, so they satisfy CSP.
            The nonce attribute is stamped onto this tag by the server. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "window.__webpack_nonce__=document.currentScript&&document.currentScript.nonce||'';",
          }}
        />
        {/* Applies the saved colour theme before first paint so a dark
            preference never flashes a light screen. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // One listener for the whole app. Identity changes only: unfiltered, this
  // also fires on hourly token refreshes and on every mount, which would
  // thrash the router and the query cache for no reason.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      // Refetching after sign-out would fire protected requests at a cleared
      // session and get a wall of 401s back.
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <RoutePrewarm />
        <Analytics />
        <main className="flex-1">
          <Breadcrumbs />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </QueryClientProvider>
  );
}
