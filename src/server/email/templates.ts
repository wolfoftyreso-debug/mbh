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

export type EmailLocale = "en" | "sv";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }, locale: EmailLocale = "en"): RenderedEmail {
  const footer = locale === "sv" ? `Det här meddelandet skickades av ${esc(brand.name)}. Om du inte väntade dig det kan du bortse från det.` : `This message was sent by ${esc(brand.name)}. If you did not expect it, you can ignore it.`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e6e6e2;border-radius:12px"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b66">${esc(brand.name)}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${esc(p)}</p>`).join("")}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#14532d;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600">${esc(cta.label)}</a></p>` : ""}
<p style="margin:28px 0 0;font-size:12px;color:#8a8a85">${footer}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, cta ? `${cta.label}: ${cta.url}` : ""].filter((l) => l !== undefined).join("\n");
  return { subject: title, html, text };
}

const url = (path: string) => `${env.APP_URL}${path}`;

export function renderEmail(key: EmailTemplateKey, vars: Record<string, string | undefined>, locale: EmailLocale = "en"): RenderedEmail {
  const v = (k: string, d = "") => vars[k] ?? d;
  const L = (path: string, label: string) => ({ label, url: url(path) });
  const assignmentPath = `/assignments/${v("publicId")}`;
  if (locale === "sv") {
    switch (key) {
      case "WELCOME":
        return layout(`Välkommen till ${brand.name}`, [`Ditt konto är klart. ${brand.name} kopplar verifierade yrkespersoner till dem som behöver arbete de kan stå bakom.`, "Du kan beställa arbete som kund eller skapa en yrkesprofil för att erbjuda din kompetens."], L("/dashboard", "Öppna översikten"), "sv");
      case "ASSIGNMENT_RECEIVED":
        return layout("Ditt uppdrag har skapats", [`”${v("title")}” är nu ${v("statusLabel", "öppet")}.`, "Du får besked när yrkespersoner svarar."], L(assignmentPath, "Visa uppdrag"), "sv");
      case "PROFESSIONAL_INVITED":
        return layout("Du har bjudits in till ett uppdrag", [`${v("customerName", "En kund")} bjöd in dig till ”${v("title")}”.`, "Läs uppdragsbeskrivningen och svara med en offert om det passar din kompetens."], L(assignmentPath, "Visa inbjudan"), "sv");
      case "OFFER_RECEIVED":
        return layout("Du har fått en offert", [`${v("professionalName", "En yrkesperson")} skickade en offert på ”${v("title")}”: ${v("price")}.`], L(assignmentPath, "Granska offert"), "sv");
      case "ASSIGNMENT_ACCEPTED":
        return layout("Uppdraget är accepterat", [`Offerten för ”${v("title")}” har accepterats. Arbetsytan är nu öppen.`], L(assignmentPath, "Öppna arbetsytan"), "sv");
      case "NEW_MESSAGE":
        return layout("Nytt meddelande", [`${v("senderName", "Någon")} skrev i ”${v("title")}”.`], L(assignmentPath, "Öppna konversationen"), "sv");
      case "DELIVERY_RECEIVED":
        return layout("En ny version har levererats", [`Version ${v("version")} av ”${v("title")}” är klar för din granskning.`], L(assignmentPath, "Granska version"), "sv");
      case "REVISION_REQUESTED":
        return layout("Revidering begärd", [`Kunden har begärt ändringar i version ${v("version")} av ”${v("title")}”.`], L(assignmentPath, "Visa begäran"), "sv");
      case "FINAL_VERSION_READY":
        return layout("Slutversionen är klar för signering", [`Version ${v("version")} av ”${v("title")}” är klar för slutlig mänsklig signering.`], L(assignmentPath, "Öppna uppdraget"), "sv");
      case "SIGNATURE_COMPLETED":
        return layout("Slutlig signering genomförd", [`${v("professionalName")} signerade version ${v("version")} av ”${v("title")}”.`, `Post-id: ${v("recordId")}.`], L(assignmentPath, "Visa uppdrag"), "sv");
      case "PAYMENT_RECEIPT":
        return layout("Betalningskvitto", [`Vi har tagit emot ${v("amount")} för ”${v("title")}”.`, `Referens: ${v("reference")}.`], L(assignmentPath, "Visa uppdrag"), "sv");
      case "PAYOUT_NOTIFICATION":
        return layout("Utbetalning", [`En utbetalning på ${v("amount")} ${v("status", "behandlas")}.`], L("/professional/earnings", "Visa intäkter"), "sv");
      case "DISPUTE_UPDATE":
        return layout("Uppdatering om tvist", [`Tvisten om ”${v("title")}” är nu ${v("status")}.`, v("notes")].filter(Boolean), L(assignmentPath, "Visa uppdrag"), "sv");
      case "VERIFICATION_UPDATE":
        return layout("Uppdaterad verifiering", [`Din verifieringsstatus är nu: ${v("status")}.`, v("notes")].filter(Boolean), L("/professional/profile", "Visa profil"), "sv");
      case "SECURITY_ALERT":
        return layout("Säkerhetsmeddelande", [v("message", "En säkerhetsrelaterad ändring gjordes på ditt konto.")], L("/settings/security", "Granska kontoinställningar"), "sv");
      case "ORGANIZATION_INVITE":
        return layout("Du har lagts till i en organisation", [`${v("inviterName", "Någon")} lade till dig i ${v("organizationName")}.`], L("/organizations", "Öppna organisation"), "sv");
    }
  }
  switch (key) {
    case "WELCOME":
      return layout(`Welcome to ${brand.name}`, [
        `Your account is ready. ${brand.name} connects verified human professionals with people who need work they can stand behind.`,
        "You can commission work as a customer, or set up a professional profile to offer your expertise.",
      ], L("/dashboard", "Open your dashboard"));
    case "ASSIGNMENT_RECEIVED":
      return layout("Your assignment has been created", [`“${v("title")}” is now ${v("statusLabel", "open")}.`, "You will be notified when professionals respond."], L(assignmentPath, "View assignment"));
    case "PROFESSIONAL_INVITED":
      return layout("You have been invited to an assignment", [`${v("customerName", "A customer")} invited you to “${v("title")}”.`, "Review the brief and respond with an offer if it fits your expertise."], L(assignmentPath, "View invitation"));
    case "OFFER_RECEIVED":
      return layout("You received an offer", [`${v("professionalName", "A professional")} sent an offer for “${v("title")}”: ${v("price")}.`], L(assignmentPath, "Review offer"));
    case "ASSIGNMENT_ACCEPTED":
      return layout("Assignment accepted", [`The offer for “${v("title")}” was accepted. The workspace is now open.`], L(assignmentPath, "Open workspace"));
    case "NEW_MESSAGE":
      return layout("New message", [`${v("senderName", "Someone")} wrote in “${v("title")}”.`], L(assignmentPath, "Open conversation"));
    case "DELIVERY_RECEIVED":
      return layout("A new version was delivered", [`Version ${v("version")} of “${v("title")}” is ready for your review.`], L(assignmentPath, "Review version"));
    case "REVISION_REQUESTED":
      return layout("Revision requested", [`The customer requested changes to version ${v("version")} of “${v("title")}”.`], L(assignmentPath, "View request"));
    case "FINAL_VERSION_READY":
      return layout("Final version ready for sign-off", [`Version ${v("version")} of “${v("title")}” is ready for final human sign-off.`], L(assignmentPath, "Open assignment"));
    case "SIGNATURE_COMPLETED":
      return layout("Final human sign-off completed", [`${v("professionalName")} signed version ${v("version")} of “${v("title")}”.`, `Record identifier: ${v("recordId")}.`], L(assignmentPath, "View assignment"));
    case "PAYMENT_RECEIPT":
      return layout("Payment receipt", [`We received ${v("amount")} for “${v("title")}”.`, `Reference: ${v("reference")}.`], L(assignmentPath, "View assignment"));
    case "PAYOUT_NOTIFICATION":
      return layout("Payout update", [`A payout of ${v("amount")} is ${v("status", "being processed")}.`], L("/professional/earnings", "View earnings"));
    case "DISPUTE_UPDATE":
      return layout("Dispute update", [`The dispute on “${v("title")}” is now ${v("status")}.`, v("notes")].filter(Boolean), L(assignmentPath, "View assignment"));
    case "VERIFICATION_UPDATE":
      return layout("Verification update", [`Your verification status is now: ${v("status")}.`, v("notes")].filter(Boolean), L("/professional/profile", "View profile"));
    case "SECURITY_ALERT":
      return layout("Security notice", [v("message", "A security-relevant change was made to your account.")], L("/settings/security", "Review account settings"));
    case "ORGANIZATION_INVITE":
      return layout("You were added to an organization", [`${v("inviterName", "Someone")} added you to ${v("organizationName")}.`], L("/organizations", "Open organization"));
  }
}
