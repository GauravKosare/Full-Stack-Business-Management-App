import { logger } from "./logger";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? "gpkfree@gmail.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "Business Management App";

export const isBrevoConfigured = Boolean(BREVO_API_KEY);

// Invite emails are a nice-to-have on top of the in-app notification, not the
// primary delivery path — a Brevo outage or missing key must never fail the invite
// itself, so callers should fire-and-log rather than await-and-throw.
export async function sendInviteEmail(params: {
  toEmail: string;
  toName: string;
  businessName: string;
  role: string;
  joinUrl: string;
}): Promise<void> {
  if (!BREVO_API_KEY) {
    logger.warn("BREVO_API_KEY not set — skipping invite email");
    return;
  }

  const { toEmail, toName, businessName, role, joinUrl } = params;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email: toEmail, name: toName }],
      subject: `You've been invited to join ${businessName}`,
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited to ${businessName}</h2>
          <p>You've been invited to join <strong>${businessName}</strong> as a <strong>${role}</strong>.</p>
          <p>
            <a href="${joinUrl}" style="display: inline-block; background: #2563EB; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
              Accept invite
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">Sign in with this email address (${toEmail}) to join automatically.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo send failed: ${res.status} ${body}`);
  }
}
