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
  const usage = (allowance: { used: number; limit: number | null } | null) => !allowance
    ? t("Unavailable") : `${number(allowance.used)} / ${allowance.limit === null ? "∞" : number(allowance.limit)}`;
  return (
    <div role="status" aria-live="polite" data-testid="chat-allowance" className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-outline-variant pt-2 type-body-small text-on-surface-variant">
      {failed ? <span>{t("Usage is unavailable right now.")}</span> : !data ? <span className="inline-flex items-center gap-1.5"><LoaderCircle size={14} className="animate-spin" />{t("Loading usage…")}</span> : data.kind === "guest" ? (
        <>
          <span className="inline-flex items-center gap-1.5" title={t("Resets {date}", { date: formatDateTime(data.quota.resetsAt, t.locale) })}><Gauge size={14} />{t("{remaining} of {limit} free messages left today.", { remaining: number(data.quota.remaining), limit: number(data.quota.limit) })}</span>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-primary hover:underline"><Coins size={14} />{t("Sign in to view credits")}</Link>
        </>
      ) : (
        <>
          <Link href="/billing" className="text-primary hover:underline">{t("Chat allowance")}: {usage(data.chatAllowance)}</Link>
          <Link href="/usage" className="text-primary hover:underline">{t("MCP calls")}: {usage(data.allowance)}</Link>
          <Link href="/usage?meter=premium" className="text-primary hover:underline">{t("Premium MCP calls")}: {usage(data.premiumAllowance)}</Link>
          {!data.metering ? <span>{t("Chat and tool calls are free on this deployment.")}</span> : null}
        </>
      )}
    </div>
  );
}
