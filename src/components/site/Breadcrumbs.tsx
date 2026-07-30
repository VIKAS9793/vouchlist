import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { trailFor } from "@/lib/breadcrumbs";

/**
 * Visible breadcrumb navigation. Reads the same trail map as the
 * BreadcrumbList JSON-LD, so the two always describe the identical path.
 * Renders nothing on the homepage and on routes with no registered trail.
 */
export function Breadcrumbs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const trail = trailFor(pathname);

  if (trail.length === 0) return null;

  const current = trail[trail.length - 1];

  return (
    <nav aria-label="Breadcrumb" className="border-b border-border/60 bg-mist/30">
      <ol className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-6 py-3 text-sm text-muted-foreground">
        <li>
          <Link
            to="/"
            className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            Home
          </Link>
        </li>
        {trail.map((crumb) => {
          const isCurrent = crumb.path === current.path;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
              {isCurrent ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
