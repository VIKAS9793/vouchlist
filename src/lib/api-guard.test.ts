import { expect, test } from "vitest";
import { readCredential, replayCheck, authFailure } from "@/lib/api-guard";

const req = (init?: RequestInit, url = "https://x/api/public/t") => new Request(url, init);

test("credential parsing", () => {
  expect(readCredential(req())).toEqual({ ok: false, reason: "missing" });
  expect(readCredential(req({ headers: { authorization: "Basic x" } }))).toEqual({
    ok: false,
    reason: "malformed",
  });
  expect(readCredential(req({ headers: { authorization: "Bearer" } }))).toEqual({
    ok: false,
    reason: "malformed",
  });
  expect(readCredential(req({ headers: { authorization: "Bearer a b" } }))).toEqual({
    ok: false,
    reason: "malformed",
  });
  expect(readCredential(req({ headers: { authorization: "Bearer " + "a".repeat(600) } }))).toEqual({
    ok: false,
    reason: "malformed",
  });
  expect(readCredential(req({ headers: { authorization: "bearer tok" } }))).toEqual({
    ok: true,
    token: "tok",
  });
  expect(readCredential(req(undefined, "https://x/t?token=abc"))).toEqual({
    ok: true,
    token: "abc",
  });
  expect(readCredential(req(undefined, "https://x/t?token="))).toEqual({
    ok: false,
    reason: "malformed",
  });
});

test("replay detection", () => {
  const now = 1_000_000;
  const fresh = (nonce: string, ts = now) =>
    req({ headers: { "x-request-nonce": nonce, "x-request-timestamp": String(ts) } });
  expect(replayCheck(req(), {}, now)).toBeNull();
  expect(replayCheck(req(), { required: true }, now)).toBe("missing");
  expect(replayCheck(req({ headers: { "x-request-nonce": "n" } }), {}, now)).toBe("malformed");
  expect(replayCheck(fresh("n1"), {}, now)).toBeNull();
  expect(replayCheck(fresh("n1"), {}, now)).toBe("replayed");
  expect(replayCheck(fresh("n2", now - 10 * 60_000), {}, now)).toBe("replayed");
  expect(replayCheck(fresh("n3", now + 10 * 60_000), {}, now)).toBe("replayed");
  expect(
    replayCheck(
      req({ headers: { "x-request-nonce": "n4", "x-request-timestamp": "abc" } }),
      {},
      now,
    ),
  ).toBe("malformed");
});

test("status mapping", () => {
  expect(authFailure("missing").status).toBe(401);
  expect(authFailure("malformed").status).toBe(401);
  expect(authFailure("invalid").status).toBe(403);
  expect(authFailure("replayed").status).toBe(403);
});
