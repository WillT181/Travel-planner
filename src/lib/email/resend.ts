/**
 * Minimal Resend (resend.com) email sender via their REST API.
 *
 * No SDK dependency — we POST to https://api.resend.com/emails with the
 * RESEND_API_KEY. When the key is missing (e.g. local dev), we degrade
 * gracefully: nothing is sent and the caller surfaces the invite link so the
 * owner can share it manually.
 *
 * Environment:
 *   RESEND_API_KEY   server-only secret (never NEXT_PUBLIC_)
 *   RESEND_FROM      optional "Name <email@domain>"; defaults to Resend's
 *                    shared onboarding@resend.dev test sender.
 */

interface SendInviteArgs {
  to: string;
  inviteUrl: string;
  tripName: string;
  inviterEmail: string | null;
  role: "editor" | "viewer";
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function inviteHtml({
  inviteUrl,
  tripName,
  inviterEmail,
  role,
}: SendInviteArgs): string {
  const inviter = inviterEmail ? `<strong>${inviterEmail}</strong>` : "Someone";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
        <span style="width:10px;height:10px;border-radius:999px;background:#f59e0b;display:inline-block;"></span>
        <span style="font-weight:800;font-size:18px;color:#0f766e;">Wanderly</span>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 8px;font-size:20px;">You're invited to plan a trip</h1>
        <p style="margin:0 0 20px;color:#475569;line-height:1.6;">
          ${inviter} invited you to collaborate on
          <strong>${tripName}</strong> as ${role === "editor" ? "an <strong>Editor</strong>" : "a <strong>Viewer</strong>"}.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;
                  font-weight:600;padding:12px 22px;border-radius:10px;">
          View invitation
        </a>
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
          Or paste this link into your browser:<br />
          <a href="${inviteUrl}" style="color:#0f766e;">${inviteUrl}</a>
        </p>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
        If you weren't expecting this, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

export async function sendInviteEmail(
  args: SendInviteArgs
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.RESEND_FROM ?? "Wanderly <onboarding@resend.dev>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `You're invited to plan "${args.tripName}" on Wanderly`,
        html: inviteHtml(args),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, error: `Resend ${res.status}: ${detail}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
