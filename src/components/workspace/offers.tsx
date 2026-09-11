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

interface OfferView { id: string; name: string; professionalUserId: string; priceMinor: number; currency: string; pricingModel: string; turnaroundDays: number; message: string; status: string; contributionRole: string; createdAt: Date }

export function OffersList({ publicId, offers, viewerRole, viewerId }: { publicId: string; offers: OfferView[]; viewerRole: "CUSTOMER" | "PROFESSIONAL"; viewerId: string }) {
  const accept = useAction(acceptOfferAction);
  const decline = useAction(declineOfferAction);
  const withdraw = useAction(withdrawOfferAction);
  const busy = accept.pending || decline.pending || withdraw.pending;
  const error = accept.error ?? decline.error ?? withdraw.error;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Offers</h2>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      <ul className="mt-2 divide-y divide-line">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{o.name} <Badge tone={o.status === "PENDING" ? "info" : o.status === "ACCEPTED" ? "accent" : "neutral"}>{o.status.toLowerCase()}</Badge></p>
              <p className="text-sm text-ink-2">{formatMoney(o.priceMinor, o.currency)}{o.pricingModel === "PER_WORD" ? " (per-word total)" : o.pricingModel === "HOURLY" ? " (hourly estimate)" : ""} · {o.turnaroundDays} days · as {humanize(o.contributionRole)}</p>
              {o.message ? <p className="prose-plain mt-1 text-sm text-ink-2">{o.message}</p> : null}
              <p className="text-xs text-ink-3">{formatDateTime(o.createdAt)}</p>
            </div>
            {o.status === "PENDING" ? (
              <div className="flex gap-2">
                {viewerRole === "CUSTOMER" ? (<><Button size="sm" disabled={busy} onClick={() => accept.run(publicId, o.id)}>Accept</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => decline.run(publicId, o.id)}>Decline</Button></>) : o.professionalUserId === viewerId ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => withdraw.run(publicId, o.id)}>Withdraw</Button> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OfferForm({ publicId, currency, listings, agreementAccepted, defaultRole }: { publicId: string; currency: string; listings: { id: string; title: string; pricingModel: string; basePriceMinor: number; currency: string; turnaroundDays: number }[]; agreementAccepted: boolean; defaultRole: string }) {
  const [price, setPrice] = useState("");
  const [pricingModel, setPricingModel] = useState<"FIXED_PRICE" | "PER_WORD" | "HOURLY" | "CUSTOM_QUOTE">("FIXED_PRICE");
  const [turnaround, setTurnaround] = useState("5");
  const [message, setMessage] = useState("");
  const [listingId, setListingId] = useState("");
  const [role, setRole] = useState(defaultRole);
  const { run, pending, error, success } = useAction(createOfferAction);
  if (!agreementAccepted) return <Alert tone="warn" title="Confidentiality agreement required">Before you can make offers you must accept the professional confidentiality agreement. <LinkButton href="/professional/agreement" size="sm" variant="outline" className="ml-2">Review and accept</LinkButton></Alert>;
  if (success) return <Alert tone="success">Your offer was sent.</Alert>;
  return (
    <form className="space-y-4 rounded-lg border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); run(publicId, { price, pricingModel, turnaroundDays: Number(turnaround), message, listingId: listingId || null, contributionRole: role as "AUTHOR" }); }}>
      <h2 className="text-sm font-semibold">Make an offer</h2>
      {listings.length ? (
        <Field label="Based on your service listing" hint="Optional. Pre-fills the price model and turnaround.">
          <Select value={listingId} onChange={(e) => { const l = listings.find((x) => x.id === e.target.value); setListingId(e.target.value); if (l) { setPricingModel(l.pricingModel as "FIXED_PRICE"); setTurnaround(String(l.turnaroundDays)); if (l.currency === currency) setPrice(String(toMajor(l.basePriceMinor, currency))); } }}>
            <option value="">None</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </Select>
        </Field>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={`Total price (${currency})`} required hint="Fixed total for the assignment, in the customer's currency."><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
        <Field label="Pricing basis"><Select value={pricingModel} onChange={(e) => setPricingModel(e.target.value as typeof pricingModel)}><option value="FIXED_PRICE">Fixed price</option><option value="PER_WORD">Per word (total)</option><option value="HOURLY">Hourly (estimate)</option><option value="CUSTOM_QUOTE">Custom quote</option></Select></Field>
        <Field label="Turnaround (days)"><Input type="number" min={1} max={365} value={turnaround} onChange={(e) => setTurnaround(e.target.value)} /></Field>
      </div>
      <Field label="Your role on this assignment" hint="What you will be responsible for and sign.">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {["AUTHOR", "EDITOR", "LANGUAGE_REVIEWER", "DOMAIN_REVIEWER", "FACT_CHECKER", "TRANSLATOR", "TRANSLATION_REVIEWER", "FINAL_APPROVER"].map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
        </Select>
      </Field>
      <Field label="Message"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="How you would approach the work, questions, what you need from the customer." /></Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send offer"}</Button>
    </form>
  );
}
