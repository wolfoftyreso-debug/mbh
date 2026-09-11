"use client";
import { useEffect, useRef, useState } from "react";
import { sendMessageAction } from "@/server/actions/workspace";
import type { ConversationMessage } from "@/server/domain/messages/service";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/avatar";
import { FileUpload, formatBytes, type UploadedFile } from "@/components/upload/file-upload";
import { formatDateTime, cn } from "@/lib/utils";
import { useT } from "@/components/i18n/provider";

export function Conversation({ publicId, messages, viewerId, canSend }: { publicId: string; messages: ConversationMessage[]; viewerId: string; canSend: boolean }) {
  const { t, locale } = useT();
  const dl = locale === "sv" ? "sv-SE" : "en-GB";
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const { run, pending, error } = useAction(sendMessageAction, { onSuccess: () => { setBody(""); setFiles([]); } });
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  return (
    <div className="flex min-h-[50vh] flex-col rounded-lg border border-line bg-surface">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? <p className="text-center text-sm text-ink-3">{t("chat.none")}</p> : null}
        {messages.map((m) =>
          m.kind === "SYSTEM" ? (
            <div key={m.id} className="sys-event flex justify-center">
              <p className="rounded-full border border-line bg-surface-2 px-3 py-1 text-center text-xs text-ink-2">{m.body} <span className="text-ink-3">· {formatDateTime(m.createdAt, dl)}</span>{typeof m.metadata.versionId === "string" ? <a href={`/assignments/${publicId}/versions/${m.metadata.versionId}`} className="ml-1 text-accent underline">{t("chat.open")}</a> : null}</p>
            </div>
          ) : (
            <div key={m.id} className={cn("flex gap-3", m.sender?.id === viewerId ? "flex-row-reverse" : "")}>
              <Avatar name={m.sender?.name ?? "?"} image={m.sender?.image} size={30} />
              <div className={cn("max-w-[80%] rounded-lg px-3 py-2", m.sender?.id === viewerId ? "bg-accent-soft" : "bg-surface-2")}>
                <p className="text-xs text-ink-3">{m.sender?.name} · {formatDateTime(m.createdAt, dl)}</p>
                <p className="prose-plain mt-0.5 text-sm">{m.body}</p>
                {m.attachments.length ? (
                  <ul className="mt-2 space-y-1">
                    {m.attachments.map((f) => (
                      <li key={f.id}><a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="text-xs text-accent underline">{f.filename} ({formatBytes(f.sizeBytes)})</a></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      {canSend ? (
        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim() && !files.length) return;
            run(publicId, body, files.map((f) => f.id));
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="min-h-20" placeholder={t("chat.placeholder")} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(publicId, body, files.map((f) => f.id)); } }} />
          {files.length ? <ul className="mt-2 flex flex-wrap gap-2 text-xs">{files.map((f) => <li key={f.id} className="rounded-full border border-line px-2 py-0.5">{f.filename} <button type="button" className="text-ink-3" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}>×</button></li>)}</ul> : null}
          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
          <div className="mt-2 flex items-center justify-between">
            <FileUpload purpose="MESSAGE" assignmentPublicId={publicId} onUploaded={(f) => setFiles((p) => [...p, ...f])} label={t("chat.attach")} compact />
            <Button type="submit" size="sm" disabled={pending || (!body.trim() && !files.length)}>{pending ? t("chat.sending") : t("chat.send")}</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
