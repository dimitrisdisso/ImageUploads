// Transactional email through your own provider account (Resend or Brevo), sent from your own address.
import { appEnv } from "./core.server";

type Mail = { to: string; subject: string; html: string; text: string };

function parseFrom(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (match?.[2]) return { ...(match[1] ? { name: match[1].replace(/^"|"$/g, "") } : {}), email: match[2] };
  return { email: from.trim() };
}

export async function sendMail(mail: Mail): Promise<void> {
  const env = appEnv();
  const provider = (env.EMAIL_PROVIDER ?? "").toLowerCase();
  const key = env.EMAIL_API_KEY;
  const from = env.EMAIL_FROM;
  if (!provider || !key || !from) {
    throw new Error("Email is not configured: set EMAIL_PROVIDER, EMAIL_API_KEY and EMAIL_FROM");
  }

  let response: Response;
  if (provider === "resend") {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
  } else if (provider === "brevo") {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: parseFrom(from),
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
      }),
    });
  } else {
    throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (use "resend" or "brevo")`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider rejected the message (${response.status}): ${detail.slice(0, 300)}`);
  }
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A plain, branded email with one call-to-action button. */
export function actionEmail(opts: { site: string; heading: string; intro: string; action: string; url: string; footer: string }) {
  const html = `<!doctype html><html lang="el"><body style="margin:0;background:#f6f1ec;font-family:Arial,Helvetica,sans-serif;color:#1f1a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-top:6px solid #7b1d26">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7b1d26;font-weight:bold">${escape(opts.site)}</td></tr>
<tr><td style="padding:0 28px;font-size:22px;font-weight:bold">${escape(opts.heading)}</td></tr>
<tr><td style="padding:16px 28px;font-size:15px;line-height:1.6">${escape(opts.intro)}</td></tr>
<tr><td style="padding:8px 28px 24px"><a href="${escape(opts.url)}" style="display:inline-block;background:#7b1d26;color:#f1e8e1;text-decoration:none;font-weight:bold;padding:12px 22px">${escape(opts.action)}</a></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;line-height:1.5;color:#6b625c">${escape(opts.footer)}<br><br><span style="word-break:break-all">${escape(opts.url)}</span></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${opts.heading}\n\n${opts.intro}\n\n${opts.action}: ${opts.url}\n\n${opts.footer}`;
  return { html, text };
}
