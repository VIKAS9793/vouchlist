import { describe, expect, it } from "vitest";
import { detectBot, isLocalAddress } from "./waitlist.server";
import { MIN_FILL_MS, type WaitlistPayload } from "./waitlist-schema";

describe("waitlist.server pure functions", () => {
  describe("detectBot", () => {
    const validPayload: WaitlistPayload = {
      name: "Alice Liddell",
      email: "alice@example.com",
      community: "Wonderland",
      city: "Oxford",
      elapsedMs: MIN_FILL_MS + 100,
    };

    it("returns null for a clean payload", () => {
      expect(detectBot(validPayload)).toBeNull();
    });

    it("allows payload without elapsedMs", () => {
      const payload = { ...validPayload, elapsedMs: undefined };
      expect(detectBot(payload)).toBeNull();
    });

    it("rejects honeypot (website field)", () => {
      const payload = { ...validPayload, website: "http://bot.com" };
      expect(detectBot(payload)).toEqual({
        ok: false,
        reason: "bot",
        message: "We could not verify this submission. Please try again.",
      });
    });

    it("rejects submission that is too fast", () => {
      const payload = { ...validPayload, elapsedMs: MIN_FILL_MS - 1 };
      expect(detectBot(payload)).toEqual({
        ok: false,
        reason: "bot",
        message: "That was a little too quick. Please try again.",
      });
    });

    it("rejects link patterns in name, community, or city", () => {
      const payloads = [
        { ...validPayload, name: "Alice http://spam.com" },
        { ...validPayload, community: "www.spam.com" },
        { ...validPayload, city: "[url=spam.com]spam[/url]" },
        { ...validPayload, name: "<a href=''>link</a>" },
      ];

      for (const payload of payloads) {
        expect(detectBot(payload)).toEqual({
          ok: false,
          reason: "bot",
          message: "Links are not allowed in these fields.",
        });
      }
    });

    it("rejects disposable email domains", () => {
      const payload = { ...validPayload, email: "alice@mailinator.com" };
      expect(detectBot(payload)).toEqual({
        ok: false,
        reason: "bot",
        message: "Please use a permanent email address.",
      });
    });

    it("rejects repeated character runs of 8 or more", () => {
      const payloads = [
        { ...validPayload, name: "aaaaaaaa" },
        { ...validPayload, name: "Alice !!!!!!!!" },
      ];

      for (const payload of payloads) {
        expect(detectBot(payload)).toEqual({
          ok: false,
          reason: "bot",
          message: "Please enter your real name.",
        });
      }
    });

    it("allows character runs of 7", () => {
      const payload = { ...validPayload, name: "aaaaaaa" };
      expect(detectBot(payload)).toBeNull();
    });
  });

  describe("isLocalAddress", () => {
    it("identifies local and loopback addresses", () => {
      const localAddresses = [
        "unknown",
        "::1",
        "localhost",
        "127.0.0.1",
        "127.255.255.255",
        "10.0.0.0",
        "10.255.255.255",
        "192.168.0.0",
        "192.168.255.255",
        "172.16.0.0",
        "172.31.255.255",
      ];

      for (const ip of localAddresses) {
        expect(isLocalAddress(ip)).toBe(true);
      }
    });

    it("identifies public addresses", () => {
      const publicAddresses = [
        "8.8.8.8",
        "1.1.1.1",
        "172.15.255.255",
        "172.32.0.0",
        "192.169.0.1",
        "2001:db8::1",
      ];

      for (const ip of publicAddresses) {
        expect(isLocalAddress(ip)).toBe(false);
      }
    });
  });
});
