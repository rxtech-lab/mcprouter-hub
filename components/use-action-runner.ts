"use client";

import { useTransition } from "react";
import { useSnackbar } from "@/components/m3/snackbar";
import type { ActionResult } from "@/lib/action-result";

/**
 * Runs a server action with status shown in the snackbar overlay: progress
 * while it runs, then the result.
 */
export function useActionRunner() {
  const snackbar = useSnackbar();
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    messages: { progress: string; success: string | ((data: T) => string) },
    onSuccess?: (data: T) => void,
  ) {
    startTransition(async () => {
      snackbar.show(messages.progress, { tone: "progress" });
      const result = await action();
      if (result.ok) {
        snackbar.show(typeof messages.success === "function" ? messages.success(result.data) : messages.success, { tone: "success" });
        onSuccess?.(result.data);
      } else {
        snackbar.show(result.error, { tone: "error" });
      }
    });
  }

  return { pending, run };
}
