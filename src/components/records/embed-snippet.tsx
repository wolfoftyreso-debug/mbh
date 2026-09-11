"use client";
import { useState } from "react";
import { useT } from "@/components/i18n/provider";

export function EmbedSnippet({ publicId, appUrl, professionalName, roleLabel }: { publicId: string; appUrl: string; professionalName: string; roleLabel: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const link = `<a href="${appUrl}/record/${publicId}" rel="noopener">${roleLabel} ${professionalName} · ${t("rec.embed.text")}</a>`;
  const iframe = `<iframe src="${appUrl}/embed/${publicId}" title="Authorship record" width="420" height="72" style="border:0" loading="lazy"></iframe>`;
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <section className="mt-10 border-t border-line pt-6 font-sans text-sm">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs uppercase tracking-wider text-ink-3 hover:text-ink">
        {open ? t("rec.embed.hide") : t("rec.embed.show")}
      </button>
      {open ? (
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-xs text-ink-3">{t("rec.embed.link")}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs">{link}</pre>
            <button type="button" onClick={() => copy(link, "link")} className="mt-1 text-xs text-accent underline">{copied === "link" ? t("rec.embed.copied") : t("rec.embed.copy")}</button>
          </div>
          <div>
            <p className="text-xs text-ink-3">{t("rec.embed.badge")}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs">{iframe}</pre>
            <button type="button" onClick={() => copy(iframe, "iframe")} className="mt-1 text-xs text-accent underline">{copied === "iframe" ? t("rec.embed.copied") : t("rec.embed.copy")}</button>
          </div>
          <iframe src={`${appUrl}/embed/${publicId}`} title="Attribution preview" width="420" height="72" style={{ border: 0, maxWidth: "100%" }} />
        </div>
      ) : null}
    </section>
  );
}
