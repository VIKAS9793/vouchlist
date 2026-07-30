import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFound } from "@/components/site/NotFound";

export const Route = createFileRoute("/$")({
  loader: () => {
    throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Page not found | VouchList" },
      {
        name: "description",
        content:
          "The page you requested does not exist. Explore VouchList features, how it works, communities, trust and FAQ instead.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Page not found | VouchList" },
      {
        property: "og:description",
        content: "The page you requested does not exist. Explore the rest of VouchList.",
      },
    ],
  }),
  component: NotFound,
  notFoundComponent: NotFound,
  errorComponent: NotFound,
});
