/**
 * Sends the double opt-in confirmation email.
 *
 * Delivery runs on the project's own sender domain. Until that domain is
 * configured the signup is still stored as a pending lead and this returns
 * `not_configured`, so no one is ever silently recorded as confirmed.
 */
export type ConfirmationSend = { sent: boolean; reason?: "not_configured" | "failed" };

export async function sendConfirmationEmail(input: {
  to: string;
  name: string;
  confirmUrl: string;
}): Promise<ConfirmationSend> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.SENDER_DOMAIN;

  if (!apiKey || !senderDomain) {
    console.warn("waitlist confirmation email skipped: no sender domain configured");
    return { sent: false, reason: "not_configured" };
  }

  try {
    // Branded template rendering is added with the sender domain; until then
    // this is the plain confirmation the flow needs to work end to end.
    const response = await fetch("https://api.lovable.dev/email/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `VouchList <hello@${senderDomain}>`,
        to: input.to,
        subject: "Confirm your VouchList waitlist signup",
        html: `<p>Hi ${escapeHtml(input.name)},</p><p>Please confirm you want to join the VouchList waitlist.</p><p><a href="${input.confirmUrl}">Confirm my email</a></p><p>If this was not you, ignore this email and nothing is stored as confirmed.</p>`,
      }),
    });
    if (!response.ok) {
      console.error("waitlist confirmation email rejected", response.status, await response.text());
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (error) {
    console.error("waitlist confirmation email failed", error);
    return { sent: false, reason: "failed" };
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}
