"use client";
import { useMemo, useRef, useState } from "react";
import { addReviewCommentAction, qualityHintsAction, resolveReviewCommentAction } from "@/server/actions/workspace";
import type { ReviewCommentView } from "@/server/domain/artifacts/service";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Field } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { humanize, formatDateTime, cn } from "@/lib/utils";

const TYPES = ["LANGUAGE", "FACTUAL", "TERMINOLOGY", "DOMAIN", "LEGAL_RISK", "CLARITY", "STYLE", "SOURCE_REQUIRED", "OTHER"] as const;
const VERDICTS = ["CORRECT", "INCORRECT", "MISLEADING", "IMPRECISE", "TERMINOLOGY_ERROR", "NEEDS_CONTEXT", "RECOMMENDED_CHANGE"] as const;

/**
 * Renders the version text and lets reviewers select a passage to attach a
 * structured comment (anchored by character offsets and quoted text).
 */
export function VersionReader({ publicId, versionId, content, comments, canComment, viewerId, showQualityHints, isDomainReviewer }: { publicId: string; versionId: string; content: string | null; comments: ReviewCommentView[]; canComment: boolean; viewerId: string; showQualityHints: boolean; isDomainReviewer: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ start: number; end: number; text: string } | null>(null);
  const [type, setType] = useState<(typeof TYPES)[number]>(isDomainReviewer ? "DOMAIN" : "LANGUAGE");
  const [verdict, setVerdict] = useState<(typeof VERDICTS)[number] | "">("");
  const [body, setBody] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [hints, setHints] = useState<string[] | null>(null);
  const add = useAction(addReviewCommentAction, { onSuccess: () => { setBody(""); setSuggestion(""); setSel(null); } });
  const resolve = useAction(resolveReviewCommentAction);
  const hintsAction = useAction(qualityHintsAction, { refresh: false, onSuccess: (d) => setHints(d ?? []) });

  function captureSelection() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !ref.current || !content) return;
    const range = s.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    const pre = range.cloneRange();
    pre.selectNodeContents(ref.current);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const text = range.toString();
    if (!text.trim()) return;
    setSel({ start, end: start + text.length, text: text.slice(0, 1000) });
  }

  const open = comments.filter((c) => c.status === "OPEN");
  const highlighted = useMemo(() => {
    if (!content) return null;
    const anchors = open.filter((c) => c.anchorStart !== null && c.anchorEnd !== null && c.anchorEnd! > c.anchorStart!).sort((a, b) => a.anchorStart! - b.anchorStart!);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const c of anchors) {
      if (c.anchorStart! < cursor) continue;
      parts.push(content.slice(cursor, c.anchorStart!));
      parts.push(<mark key={c.id} className={cn("rounded-sm px-0.5", c.type === "DOMAIN" || c.type === "FACTUAL" || c.type === "TERMINOLOGY" ? "bg-warn-soft" : "bg-info-soft")} title={`${humanize(c.type)}: ${c.body}`}>{content.slice(c.anchorStart!, c.anchorEnd!)}</mark>);
      cursor = c.anchorEnd!;
    }
    parts.push(content.slice(cursor));
    return parts;
  }, [content, open]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        {content ? (
          <div ref={ref} onMouseUp={captureSelection} onKeyUp={captureSelection} className="prose-plain select-text rounded-lg border border-line bg-surface p-6 text-[15px]">{highlighted}</div>
        ) : (
          <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-3">This version has no inline text (file-only). Download the files above to review.</p>
        )}
        {showQualityHints && content ? (
          <div className="mt-3">
            <Button size="sm" variant="outline" disabled={hintsAction.pending} onClick={() => hintsAction.run(publicId, content)}>{hintsAction.pending ? "Checking…" : "AI quality hints (for me only)"}</Button>
            {hintsAction.error ? <p className="mt-1 text-xs text-danger">{hintsAction.error}</p> : null}
            {hints ? (hints.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{hints.map((h, i) => <li key={i}>{h}</li>)}</ul> : <p className="mt-2 text-xs text-ink-3">No hints available (AI unavailable or nothing found).</p>) : null}
            <p className="mt-1 text-xs text-ink-3">Hints never change the text and are not attribution. You remain responsible for the work you sign.</p>
          </div>
        ) : null}
      </div>
      <aside className="space-y-4">
        {canComment ? (
          <form className="space-y-2 rounded-lg border border-line bg-surface p-4" onSubmit={(e) => { e.preventDefault(); add.run(publicId, { versionId, type, domainVerdict: verdict || null, anchorStart: sel?.start ?? null, anchorEnd: sel?.end ?? null, quotedText: sel?.text ?? "", body, suggestion }); }}>
            <h2 className="text-sm font-semibold">Add a review comment</h2>
            {sel ? <p className="rounded-md bg-surface-2 px-2 py-1 text-xs"><span className="text-ink-3">Selected:</span> “{sel.text.slice(0, 160)}{sel.text.length > 160 ? "…" : ""}” <button type="button" className="ml-1 text-ink-3 underline" onClick={() => setSel(null)}>clear</button></p> : <p className="text-xs text-ink-3">Select text in the version to anchor the comment (optional).</p>}
            <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
            {["DOMAIN", "FACTUAL", "TERMINOLOGY"].includes(type) ? <Field label="Verdict"><Select value={verdict} onChange={(e) => setVerdict(e.target.value as typeof verdict)}><option value="">—</option>{VERDICTS.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}</Select></Field> : null}
            <Field label="Explanation"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="min-h-20" required /></Field>
            <Field label="Suggested correction"><Textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} rows={2} className="min-h-14" /></Field>
            {add.error ? <p className="text-xs text-danger">{add.error}</p> : null}
            <Button size="sm" type="submit" disabled={add.pending || !body.trim()}>Add comment</Button>
          </form>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold">Comments ({comments.length})</h2>
          {resolve.error ? <p className="text-xs text-danger">{resolve.error}</p> : null}
          <ul className="mt-2 space-y-2">
            {comments.map((c) => (
              <li key={c.id} className={cn("rounded-md border border-line bg-surface p-3 text-sm", c.status !== "OPEN" && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-1.5"><Badge tone={c.type === "DOMAIN" || c.type === "FACTUAL" || c.type === "TERMINOLOGY" ? "warn" : "info"}>{humanize(c.type)}</Badge>{c.domainVerdict ? <Badge tone={c.domainVerdict === "CORRECT" ? "accent" : "danger"}>{humanize(c.domainVerdict)}</Badge> : null}<Badge>{c.status.toLowerCase()}</Badge></div>
                {c.quotedText ? <p className="mt-1 border-l-2 border-line pl-2 text-xs text-ink-3">“{c.quotedText.slice(0, 200)}”</p> : null}
                <p className="prose-plain mt-1">{c.body}</p>
                {c.suggestion ? <p className="mt-1 text-xs"><span className="text-ink-3">Suggested:</span> {c.suggestion}</p> : null}
                <p className="mt-1 text-xs text-ink-3">{c.author.name} · {formatDateTime(c.createdAt)}</p>
                {c.status === "OPEN" && canComment ? <div className="mt-1 flex gap-2 text-xs"><button type="button" className="text-accent underline" disabled={resolve.pending} onClick={() => resolve.run(publicId, c.id, "RESOLVED")}>Resolve</button>{c.author.id !== viewerId ? <button type="button" className="text-ink-3 underline" disabled={resolve.pending} onClick={() => resolve.run(publicId, c.id, "REJECTED")}>Reject</button> : null}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
