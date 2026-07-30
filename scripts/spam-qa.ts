/**
 * Spam protection gate for the waitlist.
 *
 * Part 1 exercises the real server-side guards (honeypot, submit timing, link
 * and disposable-address filters, rolling rate limits) against a stubbed
 * database client.
 * Part 2 statically asserts the wiring cannot be bypassed: the browser never
 * writes to the waitlist table directly, and the form still renders the
 * honeypot and timing fields.
 *
 * Run with: bun run scripts/spam-qa.ts
 */
import { readFileSync } from "node:fs";
import { detectBot, enforceRateLimit, isLocalAddress } from "../src/lib/waitlist.server";
import { MIN_FILL_MS, RATE_LIMITS, type WaitlistPayload } from "../src/lib/waitlist-schema";

const failures: string[] = [];
let checks = 0;

function check(name: string, condition: boolean) {
  checks += 1;
  if (!condition) failures.push(name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getReason(res: any) {
  return res && res.ok === false ? res.reason : null;
}

const human: WaitlistPayload = {
  name: "Asha Kulkarni",
  email: "asha@example.com",
  community: "Sai Darshan CHS",
  city: "Mumbai",
  role: "Resident",
  website: "",
  elapsedMs: 15_000,
};

// --- 1. bot detection -------------------------------------------------------
check("a genuine submission is not flagged", detectBot(human) === null);
check(
  "honeypot field blocks submission",
  getReason(detectBot({ ...human, website: "http://spam.example" })) === "bot",
);
check(
  "submits faster than a human are blocked",
  getReason(detectBot({ ...human, elapsedMs: MIN_FILL_MS - 1 })) === "bot",
);
check(
  "timing threshold allows a fast but real fill",
  detectBot({ ...human, elapsedMs: MIN_FILL_MS + 1 }) === null,
);
check(
  "links in free text are blocked",
  getReason(detectBot({ ...human, community: "visit https://cheap.example" })) === "bot",
);
check(
  "bbcode links are blocked",
  getReason(detectBot({ ...human, city: "[url=x]buy[/url]" })) === "bot",
);
check(
  "disposable addresses are blocked",
  getReason(detectBot({ ...human, email: "a@mailinator.com" })) === "bot",
);
check(
  "keyboard mashing in the name is blocked",
  getReason(detectBot({ ...human, name: "aaaaaaaaaa" })) === "bot",
);
check(
  "missing timing metadata does not block a real user",
  detectBot({ ...human, elapsedMs: undefined }) === null,
);

// --- 2. rate limiting -------------------------------------------------------
type Row = { bucket: string; created_at: string };

function stubAdmin(rows: Row[], options: { failReads?: boolean } = {}) {
  const inserted: Row[] = [];
  const api = {
    from() {
      let bucket = "";
      let since = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select: () => builder,
        eq: (_c: string, value: string) => {
          bucket = value;
          return builder;
        },
        gte: (_c: string, value: string) => {
          since = value;
          if (options.failReads)
            return Promise.resolve({ count: null, error: { message: "read failed" } });
          const count = rows.filter((r) => r.bucket === bucket && r.created_at >= since).length;
          return Promise.resolve({ count, error: null });
        },
        insert: (values: Row[]) => {
          inserted.push(...values);
          return Promise.resolve({ error: null });
        },
        delete: () => ({ lt: () => Promise.resolve({ error: null }) }),
      };
      return builder;
    },
  };
  return { api, inserted };
}

const now = new Date().toISOString();
const identity = { ip: "203.0.113.9", email: "asha@example.com" };

const clean = stubAdmin([]);
check("a first-time visitor is allowed", (await enforceRateLimit(clean.api, identity)) === null);
check("each accepted signup is recorded for both scopes", clean.inserted.length === 2);
check(
  "recorded buckets never contain the raw ip or email",
  clean.inserted.every(
    (r) => !r.bucket.includes(identity.ip) && !r.bucket.includes(identity.email),
  ),
);

const ipLimit = RATE_LIMITS.find((l) => l.scope === "ip")!;
const ipBucket = clean.inserted.find((r) => r.bucket.startsWith("ip:"))!.bucket;
const emailBucket = clean.inserted.find((r) => r.bucket.startsWith("email:"))!.bucket;

const flooded = stubAdmin(
  Array.from({ length: ipLimit.max }, () => ({ bucket: ipBucket, created_at: now })),
);
check(
  "a flood from one address is rate limited",
  getReason(await enforceRateLimit(flooded.api, identity)) === "rate_limited",
);
check("a rate limited attempt is not recorded as a signup", flooded.inserted.length === 0);

const emailLimit = RATE_LIMITS.find((l) => l.scope === "email")!;
const repeated = stubAdmin(
  Array.from({ length: emailLimit.max }, () => ({ bucket: emailBucket, created_at: now })),
);
check(
  "repeat attempts for one email are rate limited",
  getReason(await enforceRateLimit(repeated.api, identity)) === "rate_limited",
);

const stale = stubAdmin(
  Array.from({ length: ipLimit.max }, () => ({
    bucket: ipBucket,
    created_at: new Date(Date.now() - 72 * 60 * 60_000).toISOString(),
  })),
);
check(
  "attempts outside the window do not count",
  (await enforceRateLimit(stale.api, identity)) === null,
);

const broken = stubAdmin([], { failReads: true });
check(
  "the limiter fails closed when the throttle log is unreadable",
  getReason(await enforceRateLimit(broken.api, identity)) === "error",
);

check("public addresses are rate limited", !isLocalAddress("49.36.12.7"));
check(
  "loopback traffic is exempt from address limits",
  isLocalAddress("127.0.0.1") && isLocalAddress("::1"),
);
const localFlood = stubAdmin(
  Array.from({ length: ipLimit.max }, () => ({ bucket: ipBucket, created_at: now })),
);
check(
  "local test traffic is not blocked by the address limit",
  (await enforceRateLimit(localFlood.api, { ip: "127.0.0.1", email: "asha@example.com" })) === null,
);
check("email limits still apply to local traffic", localFlood.inserted.length === 1);

// --- 3. wiring cannot be bypassed ------------------------------------------
const clientModule = readFileSync("src/components/waitlist/waitlist.ts", "utf8");
check(
  "the browser does not write to the waitlist table directly",
  !/from\(["']waitlist["']\)/.test(clientModule),
);
check(
  "the browser submits through the protected server function",
  clientModule.includes("submitWaitlist"),
);

const formModule = readFileSync("src/components/waitlist/WaitlistForm.tsx", "utf8");
check(
  "the form renders the honeypot field",
  /name="website"/.test(formModule) && /aria-hidden="true"/.test(formModule),
);
check("the honeypot stays out of the tab order", /tabIndex=\{-1\}/.test(formModule));
check("the form sends submit timing", formModule.includes("elapsedMs"));

const serverFn = readFileSync("src/lib/waitlist.functions.ts", "utf8");
check("the server function runs bot detection", serverFn.includes("detectBot"));
check("the server function enforces rate limits", serverFn.includes("enforceRateLimit"));
check("the server function revalidates input", serverFn.includes("waitlistPayloadSchema"));

// --- report -----------------------------------------------------------------
if (failures.length) {
  console.error("\nSpam protection gate failed:");
  for (const f of failures) console.error(`  error  ${f}`);
  console.error(`\n${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`Spam protection gate passed (${checks} checks).`);
