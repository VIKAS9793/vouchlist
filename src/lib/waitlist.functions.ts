import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import {
  waitlistPayloadSchema,
  type WaitlistPayload,
  type WaitlistResult,
} from "./waitlist-schema";
import { detectBot, enforceRateLimit } from "./waitlist.server";
import {
  CONFIRM_TTL_MS,
  confirmWithToken,
  confirmationUrl,
  mintConfirmationToken,
  type ConfirmOutcome,
} from "./waitlist-confirm.server";
import { sendConfirmationEmail } from "./waitlist-email.server";

export const submitWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: WaitlistPayload) => input)
  .handler(async ({ data }): Promise<WaitlistResult> => {
    const parsed = waitlistPayloadSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, reason: "invalid", message: parsed.error.issues[0].message };
    }
    const input = parsed.data;

    const bot = detectBot(input);
    if (bot) return bot;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      "unknown";

    const limited = await enforceRateLimit(supabaseAdmin as never, { ip, email: input.email });
    if (limited) return limited;

    const email = input.email.trim().toLowerCase();

    // Correlation id for the conversion event, minted on the server so the
    // analytics event can be matched back to this exact submission.
    const eventId = crypto.randomUUID();

    // Explicit duplicate check so a repeat signup is answered as "already on
    // the list" rather than relying only on the unique index rejecting it.
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("waitlist")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      console.error("waitlist duplicate check failed", lookupError.code, lookupError.message);
      return { ok: false, reason: "error", message: "Something went wrong. Please try again." };
    }
    if (existing) {
      return { ok: true, duplicate: true, pending: existing.status !== "confirmed", eventId };
    }

    // Double opt in: the row is stored as a pending lead and only the emailed
    // link can promote it to confirmed.
    const token = mintConfirmationToken();
    const now = Date.now();

    const { error } = await supabaseAdmin.from("waitlist").insert({
      name: input.name.trim(),
      email,
      community: input.community?.trim() || null,
      city: input.city?.trim() || null,
      role: input.role?.trim() || null,
      status: "pending",
      confirmation_token: token,
      confirmation_sent_at: new Date(now).toISOString(),
      confirmation_expires_at: new Date(now + CONFIRM_TTL_MS).toISOString(),
    });

    if (error) {
      // The unique index is the authoritative guard against a race between
      // two simultaneous submissions of the same address.
      if (error.code === "23505") return { ok: true, duplicate: true, pending: true, eventId };
      console.error("waitlist insert failed", error.code, error.message);
      return { ok: false, reason: "error", message: "Something went wrong. Please try again." };
    }

    const origin = new URL(
      getRequestHeader("origin") ?? getRequestHeader("referer") ?? "https://vouchlist.app",
    ).origin;
    await sendConfirmationEmail({
      to: email,
      name: input.name.trim(),
      confirmUrl: confirmationUrl(origin, token),
    });

    return { ok: true, duplicate: false, pending: true, eventId };
  });

/** Exchanges a confirmation token for a confirmed lead. */
export const confirmWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<ConfirmOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return confirmWithToken(supabaseAdmin as never, data.token);
  });
