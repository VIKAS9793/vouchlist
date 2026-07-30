/**
 * Client safe waitlist contract: schema, anti-bot fields, limits and the
 * result shape. Imported by both the browser form and the server handler.
 */
import { z } from "zod";

/** Shared shape between the browser form and the server function. */
export const waitlistPayloadSchema = z.object({
  name: z.string().trim().min(2, "Please share your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  community: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.string().trim().max(60).optional().or(z.literal("")),
  /** Honeypot. Real people never see this field, so it must stay empty. */
  website: z.string().max(200).optional().or(z.literal("")),
  /** Milliseconds between the form rendering and the submit. */
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
});

export type WaitlistPayload = z.infer<typeof waitlistPayloadSchema>;

/** A human needs at least this long to fill the form in. */
export const MIN_FILL_MS = 2500;

/** Rolling limits, checked against a durable throttle log in the database. */
export const RATE_LIMITS = [
  { scope: "ip", windowMs: 60 * 60_000, max: 5 },
  { scope: "ip", windowMs: 24 * 60 * 60_000, max: 15 },
  { scope: "email", windowMs: 24 * 60 * 60_000, max: 3 },
] as const;

export type WaitlistResult =
  | { ok: true; duplicate: boolean; pending: boolean; eventId: string }
  | { ok: false; reason: "invalid" | "bot" | "rate_limited" | "error"; message: string };
