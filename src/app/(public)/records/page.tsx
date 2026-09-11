import { brand } from "@/lib/config/brand";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Authorship records" };

export default function RecordsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Authorship records</h1>
      <p className="mt-4 text-ink-2">Every signed version on {brand.name} gets a permanent record with an opaque identifier such as {brand.recordPrefix}-01JZ…. If someone gave you a record identifier, look it up here.</p>
      <form action="/record" method="get" className="mt-8 flex gap-2" onSubmit={undefined}>
        <Input name="id" placeholder={`${brand.recordPrefix}-…`} className="mono" required pattern="[A-Z]{1,6}-[0-9A-Z]{26}" />
        <Button type="submit">Open record</Button>
      </form>
      <p className="mt-6 text-sm text-ink-3">Records that the customer has kept private cannot be looked up. Anonymized records show the service and the professional without revealing the work or the customer.</p>
    </div>
  );
}
