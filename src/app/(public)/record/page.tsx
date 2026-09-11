import { redirect } from "next/navigation";

export default async function RecordLookup({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  redirect(id ? `/record/${encodeURIComponent(id.trim().toUpperCase())}` : "/records");
}
