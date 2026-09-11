import { brand } from "@/lib/config/brand";
import { env } from "@/lib/config/env";

/**
 * All transactional e-mail templates live here. Business logic passes a
 * template key and variables; it never builds HTML itself.
 */
export type EmailTemplateKey =
  | "WELCOME"
  | "ASSIGNMENT_RECEIVED"
  | "PROFESSIONAL_INVITED"
  | "OFFER_RECEIVED"
  | "ASSIGNMENT_ACCEPTED"
  | "NEW_MESSAGE"
  | "DELIVERY_RECEIVED"
  | "REVISION_REQUESTED"
  | "FINAL_VERSION_READY"
  | "SIGNATURE_COMPLETED"
  | "PAYMENT_RECEIPT"
  | "PAYOUT_NOTIFICATION"
  | "DISPUTE_UPDATE"
  | "VERIFICATION_UPDATE"
  | "SECURITY_ALERT"
  | "ORGANIZATION_INVITE";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): RenderedEmail {
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e6e6e2;border-radius:12px"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b66">${esc(brand.name)}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${esc(p)}</p>`).join("")}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#14532d;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600">${esc(cta.label)}</a></p>` : ""}
<p style="margin:28px 0 0;font-size:12px;color:#8a8a85">This message was sent by ${esc(brand.name)}. If you did not expect it, you can ignore it.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, cta ? `${cta.label}: ${cta.url}` : ""].filter((l) => l !== undefined).join("\n");
  return { subject: title, html, text };
}

const url = (path: string) => `${env.APP_URL}${path}`;

export function renderEmail(key: EmailTemplateKey, vars: Record<string, string | undefined>): RenderedEmail {
  const v = (k: string, d = "") => vars[k] ?? d;
  switch (key) {
    case "WELCOME":
      return layout(`Welcome to ${brand.name}`, [
        `Your account is ready. ${brand.name} connects verified human professionals with people who need work they can stand behind.`,
        "You can commission work as a customer, or set up a professional profile to offer your expertise.",
      ], { label: "Open your dashboard", url: url("/dashboard") });
    case "ASSIGNMENT_RECEIVED":
      return layout("Your assignment has been created", [`“${v("title")}” is now ${v("statusLabel", "open")}.`, "You will be notified when professionals respond."], { label: "View assignment", url: url(`/assignments/${v("publicId")}`) });
    case "PROFESSIONAL_INVITED":
      return layout("You have been invited to an assignment", [`${v("customerName", "A customer")} invited you to “${v("title")}”.`, "Review the brief and respond with an offer if it fits your expertise."], { label: "View invitation", url: url(`/assignments/${v("publicId")}`) });
    case "OFFER_RECEIVED":
      return layout("You received an offer", [`${v("professionalName", "A professional")} sent an offer for “${v("title")}”: ${v("price")}.`], { label: "Review offer", url: url(`/assignments/${v("publicId")}`) });
    case "ASSIGNMENT_ACCEPTED":
      return layout("Assignment accepted", [`The offer for “${v("title")}” was accepted. The workspace is now open.`], { label: "Open workspace", url: url(`/assignments/${v("publicId")}`) });
    case "NEW_MESSAGE":
      return layout("New message", [`${v("senderName", "Someone")} wrote in “${v("title")}”.`], { label: "Open conversation", url: url(`/assignments/${v("publicId")}`) });
    case "DELIVERY_RECEIVED":
      return layout("A new version was delivered", [`Version ${v("version")} of “${v("title")}” is ready for your review.`], { label: "Review version", url: url(`/assignments/${v("publicId")}`) });
    case "REVISION_REQUESTED":
      return layout("Revision requested", [`The customer requested changes to version ${v("version")} of “${v("title")}”.`], { label: "View request", url: url(`/assignments/${v("publicId")}`) });
    case "FINAL_VERSION_READY":
      return layout("Final version ready for sign-off", [`Version ${v("version")} of “${v("title")}” is ready for final human sign-off.`], { label: "Open assignment", url: url(`/assignments/${v("publicId")}`) });
    case "SIGNATURE_COMPLETED":
      return layout("Final human sign-off completed", [`${v("professionalName")} signed version ${v("version")} of “${v("title")}”.`, `Record identifier: ${v("recordId")}.`], { label: "View assignment", url: url(`/assignments/${v("publicId")}`) });
    case "PAYMENT_RECEIPT":
      return layout("Payment receipt", [`We received ${v("amount")} for “${v("title")}”.`, `Reference: ${v("reference")}.`], { label: "View assignment", url: url(`/assignments/${v("publicId")}`) });
    case "PAYOUT_NOTIFICATION":
      return layout("Payout update", [`A payout of ${v("amount")} is ${v("status", "being processed")}.`], { label: "View earnings", url: url("/professional/earnings") });
    case "DISPUTE_UPDATE":
      return layout("Dispute update", [`The dispute on “${v("title")}” is now ${v("status")}.`, v("notes")].filter(Boolean), { label: "View assignment", url: url(`/assignments/${v("publicId")}`) });
    case "VERIFICATION_UPDATE":
      return layout("Verification update", [`Your verification status is now: ${v("status")}.`, v("notes")].filter(Boolean), { label: "View profile", url: url("/professional/profile") });
    case "SECURITY_ALERT":
      return layout("Security notice", [v("message", "A security-relevant change was made to your account.")], { label: "Review account settings", url: url("/settings/security") });
    case "ORGANIZATION_INVITE":
      return layout("You were added to an organization", [`${v("inviterName", "Someone")} added you to ${v("organizationName")}.`], { label: "Open organization", url: url("/organizations") });
  }
}
