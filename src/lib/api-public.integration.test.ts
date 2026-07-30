/**
 * Integration tests for every `/api/public/*` endpoint.
 *
 * These exercise the real route handlers, not a re-implementation of the
 * guard, so the assertions stay true only while each endpoint keeps declaring
 * the protection it is supposed to have. The backend modules the handlers pull
 * in are stubbed: the subject here is the credential and flood behaviour in
 * front of them, not the reporting or digest logic behind them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV_TOKEN = "env-secret-token-value";
const CRON_TOKEN = "cron-row-token-value";

vi.mock("@/lib/csp-reports.server", () => ({
  normalizeReport: (payload: unknown) =>
    payload && typeof payload === "object" ? { effectiveDirective: "script-src" } : null,
  recordReport: () => {},
  persistReport: async () => {},
  reportSummary: async () => ({ total: 0, since: "now", groups: [] }),
}));

vi.mock("@/lib/csp-alerts.server", () => ({
  recentAlerts: async () => [],
  evaluateSpikes: async () => ({ raised: [], checked: 0 }),
}));

vi.mock("@/lib/insights-digest.server", () => ({
  buildWeeklyDigest: async () => ({ generatedAt: "now" }),
  renderDigestHtml: () => "<p>digest</p>",
  sendWeeklyDigest: async () => ({
    sent: false,
    reason: "not_configured",
    to: "owner@example.com",
  }),
}));

/** Stands in for the `internal_tokens` lookup the scheduler credential uses. */
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { token: CRON_TOKEN } }) }),
      }),
    }),
  },
}));

type Handler = (ctx: { request: Request }) => Promise<Response> | Response;

async function handlersFor(path: string): Promise<Record<string, Handler>> {
  const mod = await import(/* @vite-ignore */ `../routes/api/public/${path}`);
  const server = (mod.Route as { options: { server: { handlers: unknown } } }).options.server;
  return server.handlers as Record<string, Handler>;
}

/**
 * Every endpoint under the prefix, with the credential it accepts and the
 * flood cap it declares. A new endpoint that is not listed here fails the
 * coverage test below.
 */
const ENDPOINTS = [
  {
    name: "csp-report",
    file: "csp-report.ts",
    method: "POST",
    gated: false,
    max: 60,
    body: JSON.stringify({ "csp-report": { "effective-directive": "script-src" } }),
    headers: { "content-type": "application/json" },
  },
  {
    name: "csp-dashboard",
    file: "csp-dashboard.ts",
    method: "GET",
    gated: true,
    max: 30,
    accepts: "env" as const,
  },
  {
    name: "csp-alert-check",
    file: "csp-alert-check.ts",
    method: "POST",
    gated: true,
    max: 20,
    accepts: "both" as const,
  },
  {
    name: "insights-digest",
    file: "insights-digest.ts",
    method: "POST",
    gated: true,
    max: 20,
    accepts: "internal" as const,
  },
  {
    name: "guard-metrics",
    file: "guard-metrics.ts",
    method: "GET",
    gated: true,
    max: 30,
    accepts: "env" as const,
  },
];

let ip = 0;
/** A fresh source address per call keeps one test's flood out of the next. */
function freshIp() {
  ip += 1;
  return `203.0.113.${ip % 250}:${ip}`;
}

async function call(
  endpoint: (typeof ENDPOINTS)[number],
  {
    token,
    authorization,
    ip: from = freshIp(),
    extraHeaders,
  }: {
    token?: string;
    authorization?: string;
    ip?: string;
    extraHeaders?: Record<string, string>;
  } = {},
) {
  const handlers = await handlersFor(endpoint.file);
  const handler = handlers[endpoint.method];
  const url = new URL(`http://localhost/api/public/${endpoint.name}`);
  if (token !== undefined) url.searchParams.set("token", token);
  const headers = new Headers({
    "cf-connecting-ip": from,
    ...endpoint.headers,
    ...extraHeaders,
  });
  if (authorization !== undefined) headers.set("authorization", authorization);
  return handler({
    request: new Request(url, { method: endpoint.method, headers, body: endpoint.body }),
  });
}

const gated = ENDPOINTS.filter((e) => e.gated);

beforeEach(() => {
  process.env.CSP_REPORTS_TOKEN = VALID_ENV_TOKEN;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("coverage", () => {
  it("lists every route file under api/public", async () => {
    const modules = import.meta.glob("../routes/api/public/*.ts");
    const files = Object.keys(modules)
      .map((p) => p.split("/").pop() as string)
      .filter((f) => !f.includes(".test."))
      .sort();
    expect(files).toEqual(ENDPOINTS.map((e) => e.file).sort());
  });
});

/** Every refusal a stranger can trigger has to look like a missing route. */
async function expectLooksMissing(res: Response) {
  expect(res.status).toBe(404);
  expect(res.headers.get("www-authenticate")).toBeNull();
  const body = await res.text();
  expect(body).not.toMatch(/invalid_token|invalid_request|malformed|replayed/);
  expect(body).not.toContain(VALID_ENV_TOKEN);
  expect(body).not.toContain(CRON_TOKEN);
  return body;
}

describe.each(gated)("$name token checks", (endpoint) => {
  it("hides itself from a request with no credential", async () => {
    const res = await call(endpoint);
    await expectLooksMissing(res);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["empty header", ""],
    ["scheme only", "Bearer"],
    ["wrong scheme", `Basic ${VALID_ENV_TOKEN}`],
    ["extra parameters", `Bearer ${VALID_ENV_TOKEN}, Bearer other`],
    ["non printable characters", "Bearer tok\u0001en"],
    ["oversized token", `Bearer ${"a".repeat(513)}`],
  ])("hides itself from a %s", async (_label, authorization) => {
    await expectLooksMissing(await call(endpoint, { authorization }));
  });

  it("hides itself from an empty ?token=", async () => {
    await expectLooksMissing(await call(endpoint, { token: "" }));
  });

  it("hides itself from a wrong token without echoing the secret", async () => {
    await expectLooksMissing(await call(endpoint, { authorization: "Bearer not-the-token" }));
  });

  it("hides itself from a token that only shares a prefix with the secret", async () => {
    await expectLooksMissing(
      await call(endpoint, { authorization: `Bearer ${VALID_ENV_TOKEN.slice(0, -1)}X` }),
    );
  });

  it("answers every kind of failure identically", async () => {
    const bodies = await Promise.all(
      [
        await call(endpoint),
        await call(endpoint, { authorization: "Basic x" }),
        await call(endpoint, { authorization: "Bearer not-the-token" }),
      ].map(async (res) => `${res.status} ${await res.text()}`),
    );
    expect(new Set(bodies).size).toBe(1);
  });

  it("hides itself from an unsupported method", async () => {
    const handlers = await handlersFor(endpoint.file);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const handler = handlers[method];
      expect(handler, `${endpoint.name} should answer ${method}`).toBeTypeOf("function");
      const res = await handler({
        request: new Request(`http://localhost/api/public/${endpoint.name}`, { method }),
      });
      await expectLooksMissing(res);
    }
  });

  it("accepts the credential it is configured for", async () => {
    const accepted: string[] = [];
    if (endpoint.accepts === "env" || endpoint.accepts === "both") accepted.push(VALID_ENV_TOKEN);
    if (endpoint.accepts === "internal" || endpoint.accepts === "both") accepted.push(CRON_TOKEN);
    for (const token of accepted) {
      const viaHeader = await call(endpoint, { authorization: `Bearer ${token}` });
      const viaQuery = await call(endpoint, { token });
      for (const res of [viaHeader, viaQuery]) {
        expect([401, 403, 404]).not.toContain(res.status);
        expect(res.status).toBeLessThan(500);
      }
    }
  });

  it("rejects a credential the endpoint is not configured for", async () => {
    const rejected =
      endpoint.accepts === "env"
        ? CRON_TOKEN
        : endpoint.accepts === "internal"
          ? VALID_ENV_TOKEN
          : null;
    if (!rejected) return;
    await expectLooksMissing(await call(endpoint, { authorization: `Bearer ${rejected}` }));
  });

  it("refuses every token once the environment secret is unset", async () => {
    delete process.env.CSP_REPORTS_TOKEN;
    // An unset secret must never fall open, and it must not change the answer
    // for an endpoint that never accepted that credential in the first place.
    await expectLooksMissing(await call(endpoint, { authorization: `Bearer ${VALID_ENV_TOKEN}` }));
    if (endpoint.accepts !== "env") {
      const res = await call(endpoint, { authorization: `Bearer ${CRON_TOKEN}` });
      expect(res.status).toBe(200);
    }
  });
});

describe("timing safe comparison", () => {
  it("does not reveal how much of the token is correct", async () => {
    const { secretEquals, timingSafeEqual } = await import("@/lib/api-guard");

    // Behavioural guarantee: length alone never short circuits a match, and a
    // near miss is refused exactly like a wild guess.
    expect(await secretEquals(VALID_ENV_TOKEN, VALID_ENV_TOKEN)).toBe(true);
    expect(await secretEquals(VALID_ENV_TOKEN, `${VALID_ENV_TOKEN.slice(0, -1)}X`)).toBe(false);
    expect(await secretEquals(VALID_ENV_TOKEN, "x")).toBe(false);
    expect(timingSafeEqual("abcdef", "abcdeg")).toBe(false);
    expect(timingSafeEqual("abcdef", "abc")).toBe(false);
    expect(timingSafeEqual("abcdef", "abcdef")).toBe(true);

    // Timing guarantee: comparing digests means a token sharing a long prefix
    // costs the same as one differing at the first byte.
    const nearMiss = `${VALID_ENV_TOKEN.slice(0, -1)}X`;
    const wildGuess = `Z${VALID_ENV_TOKEN.slice(1)}`;
    const measure = async (candidate: string) => {
      const samples: number[] = [];
      for (let i = 0; i < 200; i += 1) {
        const start = performance.now();
        await secretEquals(VALID_ENV_TOKEN, candidate);
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)];
    };
    const near = await measure(nearMiss);
    const wild = await measure(wildGuess);
    const ratio = Math.max(near, wild) / Math.max(Math.min(near, wild), 1e-6);
    // Generous bound: this catches an early return, not microarchitectural noise.
    expect(ratio).toBeLessThan(5);
  });
});

describe.each(ENDPOINTS)("$name rate limiting", (endpoint) => {
  it(`allows ${endpoint.max} requests per minute and refuses the next`, async () => {
    const from = freshIp();
    const credential = endpoint.gated
      ? {
          authorization: `Bearer ${endpoint.accepts === "internal" ? CRON_TOKEN : VALID_ENV_TOKEN}`,
        }
      : {};

    for (let i = 0; i < endpoint.max; i += 1) {
      const res = await call(endpoint, { ...credential, ip: from });
      expect(res.status, `request ${i + 1} should be inside the budget`).not.toBe(429);
    }
    const blocked = await call(endpoint, { ...credential, ip: from });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
  });

  it("counts each caller separately", async () => {
    const credential = endpoint.gated
      ? {
          authorization: `Bearer ${endpoint.accepts === "internal" ? CRON_TOKEN : VALID_ENV_TOKEN}`,
        }
      : {};
    const noisy = freshIp();
    for (let i = 0; i <= endpoint.max; i += 1) await call(endpoint, { ...credential, ip: noisy });
    expect((await call(endpoint, { ...credential, ip: noisy })).status).toBe(429);
    expect((await call(endpoint, { ...credential, ip: freshIp() })).status).not.toBe(429);
  });

  it("never admits the flood cap to a caller it has not authenticated", async () => {
    const from = freshIp();
    for (let i = 0; i <= endpoint.max * 2; i += 1) {
      const res = await call(endpoint, { ip: from });
      // A gated endpoint stays a missing route however hard it is hammered;
      // an open one says plainly that the caller is over its budget.
      if (endpoint.gated) expect(res.status).toBe(404);
      else expect([204, 400, 429]).toContain(res.status);
    }
  });

  it("lets the caller back in once the window rolls over", async () => {
    const credential = endpoint.gated
      ? {
          authorization: `Bearer ${endpoint.accepts === "internal" ? CRON_TOKEN : VALID_ENV_TOKEN}`,
        }
      : {};
    const from = freshIp();
    for (let i = 0; i <= endpoint.max; i += 1) await call(endpoint, { ...credential, ip: from });
    expect((await call(endpoint, { ...credential, ip: from })).status).toBe(429);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    const res = await call(endpoint, { ...credential, ip: from });
    expect(res.status).not.toBe(429);
  });
});

describe("rate limit isolation across endpoints", () => {
  it("gives each endpoint its own budget for the same caller", async () => {
    const from = freshIp();
    const [first, second] = ENDPOINTS;
    for (let i = 0; i <= first.max; i += 1) await call(first, { ip: from });
    expect((await call(first, { ip: from })).status).toBe(429);
    expect((await call(second, { ip: from })).status).not.toBe(429);
  });
});

describe("csp-report is open by design", () => {
  it("answers an unsupported method with 405 and an Allow header", async () => {
    const handlers = await handlersFor("csp-report.ts");
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      const res = await handlers[method]({
        request: new Request("http://localhost/api/public/csp-report", { method }),
      });
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
    }
  });
});
