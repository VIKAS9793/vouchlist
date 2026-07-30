import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  callerDigest,
  guardMetrics,
  guardMetricsPrometheus,
  recordGuardEvent,
  resetGuardMetrics,
} from "./api-guard-metrics";

function event(overrides: Partial<Parameters<typeof recordGuardEvent>[0]> = {}) {
  return {
    endpoint: "csp-dashboard",
    outcome: "allowed" as const,
    method: "GET",
    caller: callerDigest("203.0.113.1"),
    gated: true,
    ...overrides,
  };
}

describe("guard metrics", () => {
  beforeEach(() => {
    resetGuardMetrics();
    vi.restoreAllMocks();
  });

  it("counts outcomes per endpoint", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});

    recordGuardEvent(event());
    recordGuardEvent(event({ outcome: "invalid" }));
    recordGuardEvent(event({ outcome: "rate_limited" }));
    recordGuardEvent(event({ endpoint: "csp-report", gated: false }));

    const snapshot = guardMetrics();
    const dashboard = snapshot.endpoints.find((e) => e.endpoint === "csp-dashboard")!;
    expect(dashboard.total).toBe(3);
    expect(dashboard.counts.invalid).toBe(1);
    expect(dashboard.counts.rate_limited).toBe(1);
    expect(dashboard.callers).toBe(1);
    expect(dashboard.lastRefusalAt).not.toBeNull();
    expect(snapshot.totals.total).toBe(4);
  });

  it("logs refusals loudly and allowed requests quietly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    recordGuardEvent(event({ outcome: "invalid" }));
    recordGuardEvent(event());

    expect(warn).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledTimes(1);
    const line = JSON.parse(warn.mock.calls[0][0] as string);
    expect(line).toMatchObject({ log: "api-guard", endpoint: "csp-dashboard", outcome: "invalid" });
  });

  it("never writes a raw caller address into the log", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    recordGuardEvent(event({ outcome: "missing", caller: callerDigest("198.51.100.7") }));
    expect(warn.mock.calls[0][0] as string).not.toContain("198.51.100.7");
  });

  it("exposes the counters in Prometheus form", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    recordGuardEvent(event({ outcome: "rate_limited" }));
    const text = guardMetricsPrometheus();
    expect(text).toContain(
      'api_guard_requests_total{endpoint="csp-dashboard",outcome="rate_limited"} 1',
    );
    expect(text).toContain('api_guard_callers{endpoint="csp-dashboard"} 1');
  });
});
