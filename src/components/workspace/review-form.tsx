"use client";
import { useState } from "react";
import { submitReviewAction } from "@/server/actions/workspace";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Select, Field, Textarea, Checkbox } from "@/components/ui/form";
import { RATING_DIMENSIONS } from "@/lib/constants";

export function ReviewForm({ publicId, professionals }: { publicId: string; professionals: { userId: string; name: string }[] }) {
  const [pro, setPro] = useState(professionals[0]?.userId ?? "");
  const [rating, setRating] = useState(5);
  const [onTime, setOnTime] = useState(true);
  const [comment, setComment] = useState("");
  const [anonymized, setAnonymized] = useState(true);
  const [dims, setDims] = useState<Record<string, number>>({});
  const { run, pending, error, success } = useAction(submitReviewAction);
  if (success) return <p className="text-xs text-accent">Thank you — your verified review was recorded.</p>;
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-ink-3">Rate the work</h2>
      <div className="mt-2 space-y-2">
        {professionals.length > 1 ? <Field label="Professional"><Select value={pro} onChange={(e) => setPro(e.target.value)}>{professionals.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}</Select></Field> : null}
        <Field label="Overall"><Select value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2">
          {RATING_DIMENSIONS.map((d) => (
            <Field key={d} label={d.toLowerCase()}><Select value={dims[d] ?? ""} onChange={(e) => setDims({ ...dims, [d]: Number(e.target.value) })}><option value="">—</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={onTime} onChange={(e) => setOnTime(e.target.checked)} /> Delivered on time</label>
        <Field label="Comment"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="min-h-20" /></Field>
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={anonymized} onChange={(e) => setAnonymized(e.target.checked)} /> Show as “Verified customer” instead of my name</label>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button size="sm" disabled={pending || !pro} onClick={() => run(publicId, { professionalUserId: pro, rating, onTime, comment, dimensions: Object.fromEntries(Object.entries(dims).filter(([, v]) => v)), anonymized })}>Submit review</Button>
      </div>
    </div>
  );
}
