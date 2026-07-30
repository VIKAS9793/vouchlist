import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  createPrivacyRequest,
  privacyVerifyUrl,
  resolvePrivacyRequest,
  type PrivacyOutcome,
} from "./privacy-request.server";
import { sendPrivacyRequestEmail } from "./privacy-email.server";

const privacyRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  kind: z.enum(["export", "delete"]),
  website: z.string().max(200).optional(),
});

export type PrivacyRequestResult =
  { ok: true } | { ok: false; reason: "invalid" | "rate_limited" | "error"; message: string };

/**
 * Starts an account free privacy request. The answer is deliberately identical
 * whether or not the address is on the list, so nobody can use this form to
 * discover who signed up.
 */
export const requestPrivacyAction = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; kind: "export" | "delete"; website?: string }) => input)
  .handler(async ({ data }): Promise<PrivacyRequestResult> => {
    const parsed = privacyRequestSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid", message: parsed.error.issues[0].message };
    }
    // Honeypot: a real person never fills a hidden field.
    if (parsed.data.website && parsed.data.website.trim() !== "") return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      "unknown";

    const created = await createPrivacyRequest(supabaseAdmin as never, {
      email: parsed.data.email,
      kind: parsed.data.kind,
      ip,
    });

    if (!created.ok) {
      return created.reason === "rate_limited"
        ? {
            ok: false,
            reason: "rate_limited",
            message: "You have asked for this a few times already. Please try again in an hour.",
          }
        : { ok: false, reason: "error", message: "Something went wrong. Please try again." };
    }

    const origin = new URL(
      getRequestHeader("origin") ?? getRequestHeader("referer") ?? "https://vouchlist.app",
    ).origin;

    await sendPrivacyRequestEmail({
      to: parsed.data.email.trim().toLowerCase(),
      kind: parsed.data.kind,
      verifyUrl: privacyVerifyUrl(origin, created.token),
    });

    return { ok: true };
  });

/** Completes a privacy request once the emailed link is opened. */
export const completePrivacyRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<PrivacyOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return resolvePrivacyRequest(supabaseAdmin as never, data.token);
  });
