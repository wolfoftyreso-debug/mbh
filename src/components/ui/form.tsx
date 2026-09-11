import { cn } from "@/lib/utils";

const base = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-28 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237c7c82%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_10px_center] pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("h-4 w-4 rounded border-line-strong text-accent focus:ring-accent", className)} {...props} />;
}

export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="block text-xs text-ink-3">{hint}</span> : null}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Fieldset({ legend, description, children }: { legend: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-base font-semibold">{legend}</legend>
        {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}
