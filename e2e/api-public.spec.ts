import { expect, test } from "@playwright/test";

/**
 * Wire level check that the guard's refusals survive the real server: the
 * detailed matrix lives in src/lib/api-public.integration.test.ts, this only
 * proves the deployed routes answer the same way over HTTP.
 */
const GATED = [
  { name: "csp-dashboard", method: "GET" },
  { name: "csp-alert-check", method: "POST" },
  { name: "insights-digest", method: "POST" },
];

for (const { name, method } of GATED) {
  test(`/api/public/${name} hides itself from anonymous and invalid callers`, async ({
    request,
  }) => {
    // A stranger has to see exactly what a mistyped URL returns, otherwise the
    // status alone confirms the endpoint is there.
    const missing = await request.fetch(`/api/public/${name}-not-a-route`, { method });
    expect(missing.status()).toBe(404);

    for (const headers of [
      undefined,
      { authorization: "Bearer definitely-not-the-token" },
      { authorization: "Basic definitely-not-the-token" },
    ]) {
      const res = await request.fetch(`/api/public/${name}`, { method, headers });
      expect(res.status()).toBe(404);
      expect(res.headers()["cache-control"]).toBe("no-store");
      expect(res.headers()["www-authenticate"]).toBeUndefined();
      expect(await res.text()).not.toMatch(/invalid_token|invalid_request/);
    }
  });

  test(`/api/public/${name} hides itself from method probing`, async ({ request }) => {
    for (const probe of ["PUT", "PATCH", "DELETE"]) {
      const res = await request.fetch(`/api/public/${name}`, { method: probe });
      expect(res.status(), `${probe} should look like a missing route`).toBe(404);
    }
  });
}

test("/api/public/csp-report stays open to browsers", async ({ request }) => {
  const res = await request.post("/api/public/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: JSON.stringify({
      "csp-report": {
        "effective-directive": "script-src",
        "blocked-uri": "https://example.test/x",
      },
    }),
  });
  expect([204, 400]).toContain(res.status());
  expect(res.headers()["access-control-allow-origin"]).toBe("*");
});

test("/api/public/csp-report refuses an unsupported method plainly", async ({ request }) => {
  // This one's existence is not a secret, so it gets the honest code.
  const res = await request.fetch("/api/public/csp-report", { method: "DELETE" });
  expect(res.status()).toBe(405);
  expect(res.headers()["allow"]).toBe("POST, OPTIONS");
});
