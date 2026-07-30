import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-trust.jpg.asset.json";
import { Reveal } from "@/components/motion/Reveal";
import { OWNER_EMAIL } from "@/components/site/PrivacyNotice";
import { RelatedLinks } from "@/components/site/RelatedLinks";
import {
  responseTargets,
  incidentStages,
  inScope,
  outOfScope,
  reportChecklist,
} from "@/lib/security-policy";

const title = "Security: report a vulnerability to VouchList";
const description =
  "How to report a security issue in VouchList, what to include, the response times we aim for, and the steps we follow when handling an incident.";

export const Route = createFileRoute("/security")({
  head: () => {
    const origin = SITE_ORIGIN;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        // Internal page for security researchers, not part of the product
        // story. Reachable only through /.well-known/security.txt.
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${origin}/security` },
        { property: "og:image", content: `${origin}${ogImage.url}` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: `${origin}${ogImage.url}` },
      ],
      links: [{ rel: "canonical", href: `${origin}/security` }],
      scripts: [
        breadcrumbScript(origin, trailFor("/security")),
        pageGraphScript({
          path: "/security",
          title,
          description,
          image: `${origin}${ogImage.url}`,
        }),
      ],
    };
  },
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
            Security
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Report a security issue.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            This page is maintained by the VouchList team to explain how to report a vulnerability
            and what happens after you do. VouchList is a small, owner-run project, so every report
            reaches a person who can act on it. It is a description of our own practice, not an
            independent audit or a certification.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              className="inline-flex items-center rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-accent-foreground"
              href={`mailto:${OWNER_EMAIL}?subject=Security%20report`}
            >
              Email a security report
            </a>
            <a
              className="text-sm text-accent-strong underline underline-offset-4"
              href="/.well-known/security.txt"
            >
              security.txt
            </a>
          </div>
        </Reveal>
      </section>

      <section id="how-to-report" className="scroll-mt-24 border-t border-border/60 bg-mist/30">
        <div className="mx-auto w-full max-w-4xl px-6 py-20">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight">How to report</h2>
            <p className="mt-4 text-muted-foreground">
              Send the report by email to{" "}
              <a
                className="text-accent-strong underline underline-offset-4"
                href={`mailto:${OWNER_EMAIL}`}
              >
                {OWNER_EMAIL}
              </a>{" "}
              with "Security report" in the subject line. Please do not open a public post about the
              issue before we have had a chance to fix it. If you would prefer an encrypted channel,
              say so in the first email and we will arrange one.
            </p>
            <h3 className="mt-10 font-display text-xl font-semibold">What to include</h3>
            <ul className="mt-4 space-y-3 text-muted-foreground">
              {reportChecklist.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-strong"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section id="response-times" className="scroll-mt-24 mx-auto w-full max-w-5xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Response times we aim for
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            These are the targets we hold ourselves to. They are goals set by the product owner
            rather than a contractual guarantee, and we will tell you if a fix is going to take
            longer.
          </p>
          <div
            className="mt-8 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Security response time targets"
          >
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Target acknowledgement, assessment and fix times for each severity level
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    Severity
                  </th>
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    Example
                  </th>
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    First reply
                  </th>
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    Assessment
                  </th>
                  <th scope="col" className="py-3 font-semibold">
                    Fix or mitigation
                  </th>
                </tr>
              </thead>
              <tbody>
                {responseTargets.map((row) => (
                  <tr key={row.severity} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-4 pr-4 font-semibold text-foreground">
                      {row.severity}
                    </th>
                    <td className="py-4 pr-4 text-muted-foreground">{row.example}</td>
                    <td className="py-4 pr-4 text-muted-foreground">{row.acknowledge}</td>
                    <td className="py-4 pr-4 text-muted-foreground">{row.assess}</td>
                    <td className="py-4 text-muted-foreground">{row.remediate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Times are counted in business days from the moment the report arrives, in India Standard
            Time.
          </p>
        </Reveal>
      </section>

      <section id="incident-workflow" className="scroll-mt-24 border-t border-border/60 bg-mist/30">
        <div className="mx-auto w-full max-w-4xl px-6 py-20">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              What happens after a report
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every report, and every issue our own monitoring raises, runs through the same six
              stages.
            </p>
            <ol className="mt-10 space-y-8">
              {incidentStages.map((stage, index) => (
                <li key={stage.name} className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background font-display text-sm font-semibold"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">{stage.name}</h3>
                    <p className="mt-1 text-sm font-medium text-accent-strong">{stage.timing}</p>
                    <p className="mt-2 text-muted-foreground">{stage.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section id="scope" className="scroll-mt-24 mx-auto w-full max-w-5xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Scope and safe testing
          </h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-xl font-semibold">In scope</h3>
              <ul className="mt-4 space-y-3 text-muted-foreground">
                {inScope.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-strong"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">Out of scope</h3>
              <ul className="mt-4 space-y-3 text-muted-foreground">
                {outOfScope.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-border"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-10 max-w-3xl text-muted-foreground">
            Please test only against your own data. Do not run automated scanners that degrade the
            service, do not access or modify another person's information, and stop as soon as you
            have enough evidence to write the report. If you follow this page in good faith, we will
            treat your research as authorised and we will not pursue action against you.
          </p>
        </Reveal>
      </section>

      <section id="disclosure" className="scroll-mt-24 border-t border-border/60">
        <div className="mx-auto w-full max-w-4xl px-6 py-20">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Disclosure and credit
            </h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>
                We work to coordinated disclosure. Once a fix is live, you are welcome to publish
                your findings, and we ask for up to 90 days from the first reply before public
                disclosure so a patch can reach everyone using the site.
              </p>
              <p>
                If an incident affects community data, we notify the admins of every affected group
                directly with what happened, what data was involved and what we changed, and we
                follow the timings in the notification stage above.
              </p>
              <p>
                We do not run a paid bug bounty at this stage. With your permission we credit
                reporters by name in the fix note we send to affected communities.
              </p>
              <p>
                For privacy questions, data corrections and deletion requests, see{" "}
                <Link
                  className="text-accent-strong underline underline-offset-4"
                  to="/trust"
                  hash="privacy"
                >
                  trust and privacy
                </Link>
                .
              </p>
            </div>
          </Reveal>
        </div>
      </section>
      <RelatedLinks path="/security" />
    </>
  );
}
