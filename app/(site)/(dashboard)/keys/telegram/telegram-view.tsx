"use client";

import { CircleCheck, Wrench, Send, SlidersHorizontal, Unlink } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/m3/button";
import { ActionsMenu, ActionsMenuItem, ActionsMenuSeparator } from "@/components/actions-menu";
import { Card } from "@/components/m3/card";
import { ConfirmDialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { ServiceBadges } from "@/components/service-badges";
import { ServicesDialog } from "@/components/services-dialog";
import { ToolModeBadge, ToolModeDialog } from "@/components/tool-mode-dialog";
import { useActionRunner } from "@/components/use-action-runner";
import type { ToolMode } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { ServiceSelection } from "@/lib/service-selection";
import { KeysTabs } from "../keys-tabs";
import { unlinkTelegram, updateTelegramServices, updateTelegramToolMode } from "./actions";

export type LinkRow = { id: string; account: string; createdAt: string; scopes: ServiceSelection; toolMode: ToolMode | null };

export function TelegramView({ links, botUsername, enabled, justLinked, editing, editingTools }: { links: LinkRow[]; botUsername: string | null; enabled: boolean; justLinked: boolean; editing: LinkRow | null; editingTools: LinkRow | null }) {
  const [unlinking, setUnlinking] = useState<LinkRow | null>(null);
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const chat = botUsername ? `https://t.me/${botUsername}` : null;
  return (
    <>
      <PageHeader
        title={t("API keys")}
        description={t("Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan.")}
      />
      <KeysTabs />

      {justLinked && links.length > 0 ? (
        <div className="mb-4 flex animate-page-in items-center gap-3 rounded-md bg-primary-container p-4 text-on-primary-container" role="status">
          <CircleCheck size={20} className="shrink-0" />
          <p className="flex-1 type-body-medium">{t("Account linked. Go back to Telegram and ask your question again.")}</p>
          {chat ? <ButtonLink href={chat} variant="text" target="_blank" rel="noreferrer">{t("Open Telegram")}</ButtonLink> : null}
        </div>
      ) : null}

      {links.length === 0 ? (
        <EmptyState icon={<Send size={32} />} title={t("No linked Telegram accounts")}>
          {enabled ? (
            <>
              {botUsername
                ? t("Message the mcprouter bot on Telegram (@{username}). It replies with a sign-in link that links your account, and then answers with the same tools and plan as the agent here.", { username: botUsername })
                : t("Message the mcprouter bot on Telegram. It replies with a sign-in link that links your account, and then answers with the same tools and plan as the agent here.")}
              {chat ? (
                <span className="mt-4 flex justify-center">
                  <ButtonLink href={chat} target="_blank" rel="noreferrer" icon={<Send size={18} />}>{t("Chat on Telegram")}</ButtonLink>
                </span>
              ) : null}
            </>
          ) : (
            t("The Telegram bot isn't set up on this deployment.")
          )}
        </EmptyState>
      ) : (
        <ul className="stagger flex flex-col gap-3" aria-label={t("Linked Telegram accounts")}>
          {links.map((link) => (
            <li key={link.id}>
              <Card className="flex flex-wrap items-center gap-4" data-testid="telegram-link-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Send size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="type-title-medium">{t("Telegram {account}", { account: link.account })}</h2>
                  <p className="type-body-small text-on-surface-variant">{t("Linked {date}. Tool calls count against your plan.", { date: formatDate(link.createdAt, t.locale) })}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <ServiceBadges value={link.scopes} />
                    <ToolModeBadge value={link.toolMode} />
                  </div>
                </div>
                <ActionsMenu label={t("Actions for {name}", { name: link.account })}>
                  <ActionsMenuItem icon={<SlidersHorizontal size={18} />} href={`${pathname}?services=${link.id}`}>{t("Change services")}</ActionsMenuItem>
                  <ActionsMenuItem icon={<Wrench size={18} />} href={`${pathname}?toolMode=${link.id}`}>{t("Change tool mode")}</ActionsMenuItem>
                  <ActionsMenuSeparator />
                  <ActionsMenuItem icon={<Unlink size={18} />} onSelect={() => setUnlinking(link)} danger>{t("Unlink")}</ActionsMenuItem>
                </ActionsMenu>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ServicesDialog
          key={editing.id}
          title={t("Change services")}
          description={t("Choose which services the bot may call when {name} messages it.", { name: editing.account })}
          legend={t("Services the bot may call")}
          value={editing.scopes}
          onSave={(services) => updateTelegramServices({ id: editing.id, services })}
          // Dropping the query closes the dialog, so a reload doesn't reopen it.
          onClose={() => router.replace(pathname, { scroll: false })}
        />
      ) : null}
      {editingTools ? (
        <ToolModeDialog
          key={editingTools.id}
          description={t("Choose how the bot sees tools when {name} messages it.", { name: editingTools.account })}
          value={editingTools.toolMode}
          onSave={(toolMode) => updateTelegramToolMode({ id: editingTools.id, toolMode })}
          onClose={() => router.replace(pathname, { scroll: false })}
        />
      ) : null}
      {unlinking ? <UnlinkDialog link={unlinking} onClose={() => setUnlinking(null)} /> : null}
    </>
  );
}

function UnlinkDialog({ link, onClose }: { link: LinkRow; onClose: () => void }) {
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Unlink this Telegram account?")}
      description={t("The bot will stop answering {name} as you. Messaging it again sends a new sign-in link.", { name: link.account })}
      confirmLabel={t("Unlink")}
      destructive
      pending={pending}
      onConfirm={() => run(() => unlinkTelegram({ id: link.id }), { progress: t("Unlinking…"), success: t("Account unlinked") }, onClose)}
    />
  );
}
