import { brand } from "@/lib/config/brand";

export default function SuspendedPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Account suspended</h1>
      <p className="mt-3 text-sm text-ink-2">Your account has been suspended by the platform. If you believe this is a mistake, contact {brand.supportEmail}.</p>
    </div>
  );
}
