/**
 * Sends the one time link that proves someone owns the address they are asking
 * about. Until a sender domain is configured this reports `not_configured`,
 * and the request stays pending rather than acting on unverified input.
 */
import type { PrivacyKind } from "./privacy-request.server";

export type PrivacySend = { sent: boolean; reason?: "not_configured" | "failed" };

export async function sendPrivacyRequestEmail(input: {
  to: string;
  kind: PrivacyKind;
  verifyUrl: string;
}): Promise<PrivacySend> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.SENDER_DOMAIN;

  if (!apiKey || !senderDomain) {
    console.warn("privacy request email skipped: no sender domain configured");
    return { sent: false, reason: "not_configured" };
  }

  const action =
    input.kind === "delete" ? "delete your waitlist details" : "send you a copy of your details";

  try {
    const response = await fetch("https://api.lovable.dev/email/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `VouchList <hello@${senderDomain}>`,
        to: input.to,
        subject:
          input.kind === "delete"
            ? "Confirm the deletion of your VouchList details"
            : "Confirm your VouchList data request",
        html: `<p>We received a request to ${action}.</p><p><a href="${input.verifyUrl}">Confirm this request</a></p><p>The link works once and expires in 24 hours. If this was not you, ignore this email and nothing changes.</p>`,
      }),
    });
    if (!response.ok) {
      console.error("privacy request email rejected", response.status, await response.text());
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (error) {
    console.error("privacy request email failed", error);
    return { sent: false, reason: "failed" };
  }
}
