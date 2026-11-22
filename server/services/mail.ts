/**
 * Outgoing email (password reset links). Optional: without SMTP settings the server simply
 * doesn't offer email reset.
 *
 * SMTP_HOST, SMTP_PORT (465 = TLS, 587 = STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM.
 * For Gmail: smtp.gmail.com, 465, your address, and a Google "app password".
 */
import nodemailer from 'nodemailer';

export interface Mailer {
  send(msg: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

export function smtpMailerFromEnv(env: NodeJS.ProcessEnv): Mailer | undefined {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return undefined;
  const port = Number(env.SMTP_PORT || 465);
  const from = env.MAIL_FROM?.trim() || `Waypoint <${user}>`;
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port !== 465, auth: { user, pass } });
  return {
    async send(msg) {
      await transport.sendMail({ from, ...msg });
    },
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function resetEmail(link: string, minutes: number) {
  const text = `Someone (hopefully you) asked to reset your Waypoint password.\n\nSet a new password here (the link works once, for ${minutes} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1f3038;max-width:520px">
<p>Someone (hopefully you) asked to reset your Waypoint password.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0d7480;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none">Set a new password</a></p>
<p style="color:#5d6b72;font-size:14px">The link works once, for ${minutes} minutes. If you didn't ask for this, ignore this email; your password stays the same.</p>
</div>`;
  return { subject: 'Reset your Waypoint password', text, html };
}
