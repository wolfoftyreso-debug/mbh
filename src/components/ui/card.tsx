import { cn } from "@/lib/utils";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function Section({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: React.ReactNode; action?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-3">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="flex gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-3">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger" | "success"; title?: string; children: React.ReactNode }) {
  const tones = {
    info: "bg-info-soft text-info border-info/20",
    warn: "bg-warn-soft text-warn border-warn/20",
    danger: "bg-danger-soft text-danger border-danger/20",
    success: "bg-accent-soft text-accent border-accent/20",
  } as const;
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm", tones[tone])} role={tone === "danger" ? "alert" : "status"}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function DescriptionList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2", className)}>
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs uppercase tracking-wide text-ink-3">{i.label}</dt>
          <dd className="mt-0.5 text-ink">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
