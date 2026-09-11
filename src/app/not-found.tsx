import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-3 text-sm text-ink-2">The page or record you are looking for does not exist or is not available to you.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-accent underline-offset-4 hover:underline">Go to the start page</Link>
    </div>
  );
}
