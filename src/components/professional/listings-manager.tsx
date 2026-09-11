"use client";
import { useState } from "react";
import { deleteListingAction, upsertListingAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { formatMoney, toMajor } from "@/lib/money";
import { humanize } from "@/lib/utils";

interface Listing { id: string; categoryId: string; categoryName: string; title: string; description: string; languageCode: string | null; domainId: string | null; pricingModel: string; basePriceMinor: number; currency: string; turnaroundDays: number; revisionsIncluded: number; requirements: string; active: boolean }

const empty = (currency: string) => ({ id: null as string | null, categoryId: "", title: "", description: "", languageCode: "", domainId: "", pricingModel: "FIXED_PRICE" as const, basePrice: "", currency, turnaroundDays: "3", revisionsIncluded: "1", requirements: "", active: true });

export function ListingsManager({ listings, categories, languages, domains, defaultCurrency }: { listings: Listing[]; categories: { id: string; name: string; kind: string }[]; languages: { code: string; name: string }[]; domains: { id: string; name: string; depth: number }[]; defaultCurrency: string }) {
  const [form, setForm] = useState<ReturnType<typeof empty> | null>(null);
  const save = useAction(upsertListingAction, { onSuccess: () => setForm(null) });
  const del = useAction(deleteListingAction);
  const set = <K extends keyof ReturnType<typeof empty>>(k: K, v: ReturnType<typeof empty>[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  return (
    <div className="space-y-4">
      {listings.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{l.title} {!l.active ? <Badge>Inactive</Badge> : null}</p>
                <p className="text-xs text-ink-3">{l.categoryName}{l.languageCode ? ` · ${l.languageCode.toUpperCase()}` : ""} · {l.pricingModel === "CUSTOM_QUOTE" ? "custom quote" : `${formatMoney(l.basePriceMinor, l.currency)} ${humanize(l.pricingModel).toLowerCase()}`} · {l.turnaroundDays} days · {l.revisionsIncluded} revisions</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setForm({ id: l.id, categoryId: l.categoryId, title: l.title, description: l.description, languageCode: l.languageCode ?? "", domainId: l.domainId ?? "", pricingModel: l.pricingModel as "FIXED_PRICE", basePrice: String(toMajor(l.basePriceMinor, l.currency)), currency: l.currency, turnaroundDays: String(l.turnaroundDays), revisionsIncluded: String(l.revisionsIncluded), requirements: l.requirements, active: l.active })}>Edit</Button>
                <Button size="sm" variant="ghost" disabled={del.pending} onClick={() => del.run(l.id)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-3">No listings yet.</p>}
      {form ? (
        <form className="space-y-4 rounded-lg border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); save.run({ ...form, languageCode: form.languageCode || null, domainId: form.domainId || null, turnaroundDays: Number(form.turnaroundDays), revisionsIncluded: Number(form.revisionsIncluded) }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required><Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} required><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Title" required><Input value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={120} placeholder="Swedish editorial rewrite" /></Field>
            <Field label="Language"><Select value={form.languageCode} onChange={(e) => set("languageCode", e.target.value)}><option value="">Any</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></Field>
            <Field label="Domain"><Select value={form.domainId} onChange={(e) => set("domainId", e.target.value)}><option value="">None</option>{domains.map((d) => <option key={d.id} value={d.id}>{" ".repeat(d.depth * 3)}{d.name}</option>)}</Select></Field>
            <Field label="Pricing model"><Select value={form.pricingModel} onChange={(e) => set("pricingModel", e.target.value as "FIXED_PRICE")}><option value="FIXED_PRICE">Fixed price</option><option value="PER_WORD">Per word</option><option value="HOURLY">Hourly</option><option value="CUSTOM_QUOTE">Custom quote</option></Select></Field>
            <Field label={`Base price (${form.currency})`}><Input inputMode="decimal" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} /></Field>
            <Field label="Turnaround (days)"><Input type="number" min={1} max={90} value={form.turnaroundDays} onChange={(e) => set("turnaroundDays", e.target.value)} /></Field>
            <Field label="Revisions included"><Input type="number" min={0} max={10} value={form.revisionsIncluded} onChange={(e) => set("revisionsIncluded", e.target.value)} /></Field>
          </div>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field>
          <Field label="Requirements from the customer"><Textarea value={form.requirements} onChange={(e) => set("requirements", e.target.value)} rows={2} className="min-h-16" /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active (visible on your profile)</label>
          {save.error ? <p className="text-xs text-danger">{save.error}</p> : null}
          <div className="flex gap-2"><Button type="submit" disabled={save.pending}>Save listing</Button><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button></div>
        </form>
      ) : <Button variant="outline" onClick={() => setForm(empty(defaultCurrency))}>New listing</Button>}
    </div>
  );
}
