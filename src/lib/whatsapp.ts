/**
 * WhatsApp click-to-chat links. With a phone number the chat opens directly with that contact;
 * without one, WhatsApp lets the user pick a chat or group, which is how most agencies share.
 */
export function waLink(phone: string | null | undefined, text: string) {
  const digits = phone?.replace(/[^\d]/g, "") ?? "";
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return digits ? `https://wa.me/${digits}${q}` : `https://wa.me/${q}`;
}

export function approvalShareText(opts: { agency: string; title: string; url: string; dueAt?: string | null; name?: string }) {
  const hi = opts.name ? `Hi ${opts.name.split(" ")[0]}, ` : "Hi! ";
  const due = opts.dueAt
    ? ` by ${new Date(opts.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    : "";
  return `${hi}${opts.agency} has shared “${opts.title}” for your approval${due}.\n\nTap to review, comment and approve (no login needed):\n${opts.url}`;
}
