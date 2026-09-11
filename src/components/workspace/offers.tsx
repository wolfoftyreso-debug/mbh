"use client";
import { useState } from "react";
import { acceptOfferAction, createOfferAction, declineOfferAction, withdrawOfferAction } from "@/server/actions/assignments";
import { useAction } from "@/components/common/use-action";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/card";
import { formatMoney, toMajor } from "@/lib/money";
import { formatDateTime, humanize } from "@/lib/utils";
import { useT } from "@/components/i18n/provider";

interface OfferView { id: string; name: string; professionalUserId: string; priceMinor: number; currency: string; pricingModel: string; turnaroundDays: number; message: string; status: string; contributionRole: string; createdAt: Date }

export function OffersList({ publicId, offers, viewerRole, viewerId }: { publicId: string; offers: OfferView[]; viewerRole: "CUSTOMER" | "PROFESSIONAL"; viewerId: string }) {
  const { t, locale } = useT();
  const accept = useAction(acceptOfferAction);
  const decline = useAction(declineOfferAction);
  const withdraw = useAction(withdrawOfferAction);
  const busy = accept.pending || decline.pending || withdraw.pending;
  const error = accept.error ?? decline.error ?? withdraw.error;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">{t("offer.title")}</h2>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      <ul className="mt-2 divide-y divide-line">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{o.name} <Badge tone={o.status === "PENDING" ? "info" : o.status === "ACCEPTED" ? "accent" : "neutral"}>{o.status.toLowerCase()}</Badge></p>
              <p className="text-sm text-ink-2">{formatMoney(o.priceMinor, o.currency)}{o.pricingModel === "PER_WORD" ? " (per-word total)" : o.pricingModel === "HOURLY" ? " (hourly estimate)" : ""} · {o.turnaroundDays} {t("offer.days")} · {t("offer.as")} {humanize(o.contributionRole)}</p>
              {o.message ? <p className="prose-plain mt-1 text-sm text-ink-2">{o.message}</p> : null}
              <p className="text-xs text-ink-3">{formatDateTime(o.createdAt, locale === "sv" ? "sv-SE" : "en-GB")}</p>
            </div>
            {o.status === "PENDING" ? (
              <div className="flex gap-2">
                {viewerRole === "CUSTOMER" ? (<><Button size="sm" disabled={busy} onClick={() => accept.run(publicId, o.id)}>{t("offer.accept")}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => decline.run(publicId, o.id)}>{t("offer.decline")}</Button></>) : o.professionalUserId === viewerId ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => withdraw.run(publicId, o.id)}>{t("offer.withdraw")}</Button> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OfferForm({ publicId, currency, listings, agreementAccepted, defaultRole }: { publicId: string; currency: string; listings: { id: string; title: string; pricingModel: string; basePriceMinor: number; currency: string; turnaroundDays: number }[]; agreementAccepted: boolean; defaultRole: string }) {
  const { t } = useT();
  const [price, setPrice] = useState("");
  const [pricingModel, setPricingModel] = useState<"FIXED_PRICE" | "PER_WORD" | "HOURLY" | "CUSTOM_QUOTE">("FIXED_PRICE");
  const [turnaround, setTurnaround] = useState("5");
  const [message, setMessage] = useState("");
  const [listingId, setListingId] = useState("");
  const [role, setRole] = useState(defaultRole);
  const { run, pending, error, success } = useAction(createOfferAction);
  if (!agreementAccepted) return <Alert tone="warn" title={t("offer.agreementRequired")}>{t("offer.agreementBody")} <LinkButton href="/professional/agreement" size="sm" variant="outline" className="ml-2">{t("offer.reviewAccept")}</LinkButton></Alert>;
  if (success) return <Alert tone="success">{t("offer.sent")}</Alert>;
  return (
    <form className="space-y-4 rounded-lg border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); run(publicId, { price, pricingModel, turnaroundDays: Number(turnaround), message, listingId: listingId || null, contributionRole: role as "AUTHOR" }); }}>
      <h2 className="text-sm font-semibold">{t("offer.make")}</h2>
      {listings.length ? (
        <Field label={t("offer.basedOn")} hint={t("offer.basedOn.hint")}>
          <Select value={listingId} onChange={(e) => { const l = listings.find((x) => x.id === e.target.value); setListingId(e.target.value); if (l) { setPricingModel(l.pricingModel as "FIXED_PRICE"); setTurnaround(String(l.turnaroundDays)); if (l.currency === currency) setPrice(String(toMajor(l.basePriceMinor, currency))); } }}>
            <option value="">{t("offer.none")}</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </Select>
        </Field>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("offer.totalPrice", { currency })} required hint={t("offer.totalPrice.hint")}><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
        <Field label={t("offer.pricingBasis")}><Select value={pricingModel} onChange={(e) => setPricingModel(e.target.value as typeof pricingModel)}><option value="FIXED_PRICE">Fixed price</option><option value="PER_WORD">Per word (total)</option><option value="HOURLY">Hourly (estimate)</option><option value="CUSTOM_QUOTE">Custom quote</option></Select></Field>
        <Field label={t("offer.turnaround")}><Input type="number" min={1} max={365} value={turnaround} onChange={(e) => setTurnaround(e.target.value)} /></Field>
      </div>
      <Field label={t("offer.role")} hint={t("offer.role.hint")}>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {["AUTHOR", "EDITOR", "LANGUAGE_REVIEWER", "DOMAIN_REVIEWER", "FACT_CHECKER", "TRANSLATOR", "TRANSLATION_REVIEWER", "FINAL_APPROVER"].map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
        </Select>
      </Field>
      <Field label={t("offer.message")}><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={t("offer.message.ph")} /></Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? t("chat.sending") : t("offer.send")}</Button>
    </form>
  );
}
