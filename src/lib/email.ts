import "server-only";
import { Resend } from "resend";
import { env } from "./env";

type Mail = { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string };

let resend: Resend | null = null;

/**
 * Sends email through Resend when RESEND_API_KEY is set.
 * Without a key, emails are printed to the server console so every flow still works locally.
 */
export async function sendEmail(mail: Mail) {
  const to = Array.isArray(mail.to) ? mail.to.filter(Boolean) : [mail.to].filter(Boolean);
  if (to.length === 0) return;
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `\n📧 [email:dev] to=${to.join(", ")}\n   subject: ${mail.subject}\n   ${
        mail.text ?? mail.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)
      }\n`,
    );
    return;
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  try {
    const { error } = await resend.emails.send({
      from: env.emailFrom,
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: mail.replyTo,
    });
    if (error) console.error("[email] send failed", error);
  } catch (err) {
    console.error("[email] send failed", err);
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal branded HTML email with one call-to-action button. */
export function emailLayout(opts: {
  brand?: string;
  color?: string;
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
  footer?: string;
}) {
  const color = opts.color ?? "#4f46e5";
  const brand = esc(opts.brand ?? "Approval OS");
  const body = opts.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.55">${esc(l)}</p>`).join("");
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${opts.cta.url}" style="background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(opts.cta.label)}</a></p><p style="font-size:12px;color:#71717a;word-break:break-all">${esc(opts.cta.url)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="font-weight:700;font-size:15px;margin-bottom:16px;color:${color}">${brand}</div>
<div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e4e4e7">
<h1 style="font-size:20px;margin:0 0 16px">${esc(opts.heading)}</h1>${body}${cta}</div>
<p style="font-size:12px;color:#a1a1aa;margin-top:16px">${esc(opts.footer ?? "Sent via Approval OS")}</p>
</div></body></html>`;
  const text = [opts.heading, "", ...opts.lines, opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : ""].join("\n");
  return { html, text };
}
