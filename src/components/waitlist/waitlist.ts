import { submitWaitlist } from "@/lib/waitlist.functions";
import { waitlistPayloadSchema } from "@/lib/waitlist-schema";
import { z } from "zod";

/**
 * Browser-side schema. It mirrors the server schema minus the anti-bot fields,
 * which the form adds itself. The server revalidates everything.
 */
export const waitlistSchema = z.object({
  name: z.string().trim().min(2, "Please share your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  community: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.string().trim().max(60).optional().or(z.literal("")),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type WaitlistGuards = { website: string; elapsedMs: number };

export async function joinWaitlist(input: WaitlistInput, guards: WaitlistGuards) {
  const payload = waitlistPayloadSchema.safeParse({ ...input, ...guards });
  if (!payload.success) {
    return { ok: false as const, message: payload.error.issues[0].message };
  }

  try {
    const result = await submitWaitlist({ data: payload.data });
    if (result.ok) {
      return {
        ok: true as const,
        duplicate: result.duplicate,
        pending: result.pending,
        eventId: result.eventId,
      };
    }
    return { ok: false as const, message: result.message };
  } catch {
    return { ok: false as const, message: "Something went wrong. Please try again." };
  }
}
