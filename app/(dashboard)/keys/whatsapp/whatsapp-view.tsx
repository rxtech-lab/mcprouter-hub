"use client";

import { CircleCheck, MessageCircle, Unlink } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { ConfirmDialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { useActionRunner } from "@/components/use-action-runner";
import { formatDate } from "@/lib/format";
import { KeysTabs } from "../keys-tabs";
import { unlinkWhatsApp } from "./actions";

export type LinkRow = { id: string; number: string; createdAt: string };

export function WhatsAppView({ links, botNumber, enabled, justLinked }: { links: LinkRow[]; botNumber: string | null; enabled: boolean; justLinked: boolean }) {
  const [unlinking, setUnlinking] = useState<LinkRow | null>(null);
  const chat = botNumber ? `https://wa.me/${botNumber}` : null;
  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan."
      />
      <KeysTabs />

      {justLinked && links.length > 0 ? (
        <div className="mb-4 flex animate-page-in items-center gap-3 rounded-md bg-primary-container p-4 text-on-primary-container" role="status">
          <CircleCheck size={20} className="shrink-0" />
          <p className="flex-1 type-body-medium">Number linked. Go back to WhatsApp and ask your question again.</p>
          {chat ? <ButtonLink href={chat} variant="text" target="_blank" rel="noreferrer">Open WhatsApp</ButtonLink> : null}
        </div>
      ) : null}

      {links.length === 0 ? (
        <EmptyState icon={<MessageCircle size={32} />} title="No linked numbers">
          {enabled ? (
            <>
              Message the mcprouter bot on WhatsApp{botNumber ? ` (+${botNumber})` : ""}. It replies with a sign-in link that links your number, and then answers with the same tools and plan as the agent here.
              {chat ? (
                <span className="mt-4 flex justify-center">
                  <ButtonLink href={chat} target="_blank" rel="noreferrer" icon={<MessageCircle size={18} />}>Chat on WhatsApp</ButtonLink>
                </span>
              ) : null}
            </>
          ) : (
            "The WhatsApp bot isn't set up on this deployment."
          )}
        </EmptyState>
      ) : (
        <ul className="stagger flex flex-col gap-3" aria-label="Linked WhatsApp numbers">
          {links.map((link) => (
            <li key={link.id}>
              <Card className="flex flex-wrap items-center gap-4" data-testid="whatsapp-link-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <MessageCircle size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="type-title-medium">WhatsApp {link.number}</h2>
                  <p className="type-body-small text-on-surface-variant">Linked {formatDate(link.createdAt)}. Tool calls count against your plan.</p>
                </div>
                <Button variant="text" icon={<Unlink size={18} />} onClick={() => setUnlinking(link)} aria-label={`Unlink ${link.number}`}>
                  Unlink
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {unlinking ? <UnlinkDialog link={unlinking} onClose={() => setUnlinking(null)} /> : null}
    </>
  );
}

function UnlinkDialog({ link, onClose }: { link: LinkRow; onClose: () => void }) {
  const { pending, run } = useActionRunner();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Unlink this number?"
      description={`The bot will stop answering ${link.number} as you. Messaging it again sends a new sign-in link.`}
      confirmLabel="Unlink"
      destructive
      pending={pending}
      onConfirm={() => run(() => unlinkWhatsApp({ id: link.id }), { progress: "Unlinking…", success: "Number unlinked" }, onClose)}
    />
  );
}
