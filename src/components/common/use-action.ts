"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/security/errors";

/** Small helper for calling server actions with pending/error state and a refresh. */
export function useAction<TArgs extends unknown[], TData>(action: (...args: TArgs) => Promise<ActionResult<TData>>, opts: { onSuccess?: (data: TData | undefined) => void; refresh?: boolean } = {}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  function run(...args: TArgs) {
    setError(null);
    setSuccess(false);
    start(async () => {
      const res = await action(...args);
      if (res.ok) {
        setSuccess(true);
        opts.onSuccess?.(res.data);
        if (opts.refresh !== false) router.refresh();
      } else {
        setError(res.error);
      }
    });
  }
  return { run, pending, error, success, setError };
}
