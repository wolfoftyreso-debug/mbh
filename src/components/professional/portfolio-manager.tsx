"use client";
import { useState } from "react";
import { addPortfolioItemAction, removePortfolioItemAction } from "@/server/actions/professionals";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";

export function PortfolioManager({ items, eligibleRecords }: { items: { id: string; title: string; url: string | null }[]; eligibleRecords: { id: string; workTitle: string; publicId: string }[] }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [recordId, setRecordId] = useState("");
  const add = useAction(addPortfolioItemAction, { onSuccess: () => { setTitle(""); setUrl(""); setRecordId(""); } });
  const remove = useAction(removePortfolioItemAction);
  return (
    <div className="space-y-3 text-sm">
      {items.length ? <ul className="space-y-1">{items.map((i) => <li key={i.id} className="flex items-center justify-between gap-2"><span className="truncate">{i.title}</span><button type="button" className="text-xs text-ink-3 hover:text-danger" onClick={() => remove.run(i.id)}>Remove</button></li>)}</ul> : <p className="text-ink-3">No portfolio items.</p>}
      <form className="space-y-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); add.run({ title, description: "", url: url || null, authorshipRecordId: recordId || null }); }}>
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></Field>
        <Field label="URL (optional)"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        {eligibleRecords.length ? <Field label="Link to a permitted platform record"><Select value={recordId} onChange={(e) => setRecordId(e.target.value)}><option value="">None</option>{eligibleRecords.map((r) => <option key={r.id} value={r.id}>{r.workTitle} ({r.publicId})</option>)}</Select></Field> : null}
        {add.error ? <p className="text-xs text-danger">{add.error}</p> : null}
        <Button size="sm" type="submit" disabled={add.pending}>Add item</Button>
      </form>
    </div>
  );
}
