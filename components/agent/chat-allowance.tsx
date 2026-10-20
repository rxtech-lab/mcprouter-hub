"use client";

import Link from "next/link";
import { Coins, Gauge, LoaderCircle } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import type { ChatAllowance as Allowance } from "@/lib/chat-allowance";
import { getChatAllowance } from "@/lib/free-chat-actions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

/** Personal usage loads separately from the public catalogue and refreshes after a reply or on window focus. */
export function ChatAllowance({ status, onChange }: { status: string; onChange?: (data: Allowance) => void }) {
  const t = useT();
  const [data, setData] = useState<Allowance | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    let active = true;
    const refresh = () => startTransition(async () => {
      try {
        const result = await getChatAllowance();
        if (!active) return;
        setFailed(!result.ok);
        if (result.ok) {
          setData(result.data);
          onChange?.(result.data);
        }
      } catch {
        if (active) setFailed(true);
      }
    });
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [status, onChange]);

  const number = (value: number) => formatNumber(value, t.locale);
  return (
    <div role="status" aria-live="polite" data-testid="chat-allowance" className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-outline-variant pt-2 type-body-small text-on-surface-variant">
      {failed ? <span>{t("Usage is unavailable right now.")}</span> : !data ? <span className="inline-flex items-center gap-1.5"><LoaderCircle size={14} className="animate-spin" />{t("Loading usage…")}</span> : data.kind === "guest" ? (
        <>
          <span className="inline-flex items-center gap-1.5" title={t("Resets {date}", { date: formatDateTime(data.quota.resetsAt, t.locale) })}><Gauge size={14} />{t("{remaining} of {limit} free messages left today.", { remaining: number(data.quota.remaining), limit: number(data.quota.limit) })}</span>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-primary hover:underline"><Coins size={14} />{t("Sign in to view credits")}</Link>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5" title={data.allowance?.resetsAt ? t("Resets {date}", { date: formatDateTime(data.allowance.resetsAt, t.locale) }) : undefined}>
            <Gauge size={14} />{t("Plan allowance")}: {data.allowance ? data.allowance.limit === null ? t("Unlimited") : t("{remaining} of {limit} calls left", { remaining: number(data.allowance.remaining ?? 0), limit: number(data.allowance.limit) }) : t("Unavailable")}
          </span>
          <Link href="/billing" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <Coins size={14} />{t("Credits")}: {data.billing !== "ready" ? t("Unavailable") : data.credits.length ? data.credits.map((balance) => `${number(balance.available)} ${balance.name}`).join(" · ") : number(0)}
          </Link>
          {!data.metering ? <span>{t("Tool calls are free on this deployment.")}</span> : null}
        </>
      )}
    </div>
  );
}
