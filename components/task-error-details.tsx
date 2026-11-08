"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NativeDialog } from "@/components/native-dialog";
import { Button } from "@/components/m3/button";
import { useT } from "@/lib/i18n/client";

const LEGACY_ERROR = "Task failed. Check billing, MCP connections and script tool names before retrying.";

export function TaskErrorDetails({ error, open, openHref, closeHref }: { error: string; open: boolean; openHref: string; closeHref: string }) {
  const t = useT();
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });
  return <>
    <Link href={openHref} scroll={false} className="inline-flex type-label-large text-error">{t("Error details")}</Link>
    {open && <NativeDialog title={t("Error details")} onClose={close}>
      <p className="whitespace-pre-wrap break-words type-body-medium">{error}</p>
      {error === LEGACY_ERROR && <p className="mt-4 type-body-medium text-on-surface-variant">{t("This earlier run did not record its original error. New runs include the failure stage and reason.")}</p>}
      <div className="mt-6 flex justify-end"><Button onClick={close}>{t("Close")}</Button></div>
    </NativeDialog>}
  </>;
}
