"use client";

import { AppWindow, Unplug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { CodeBlock } from "@/components/m3/code-block";
import { ConfirmDialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { useActionRunner } from "@/components/use-action-runner";
import { formatDate, formatRelative } from "@/lib/format";
import { disconnectApp } from "../actions";
import { KeysTabs } from "../keys-tabs";

export type AppRow = { id: string; name: string; service: string | null; lastUsedAt: string | null; createdAt: string };

export function AppsView({ apps, endpoint }: { apps: AppRow[]; endpoint: string }) {
  const [disconnecting, setDisconnecting] = useState<AppRow | null>(null);
  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan."
      />
      <KeysTabs />

      {apps.length === 0 ? (
        <EmptyState icon={<AppWindow size={32} />} title="No connected apps">
          Add mcprouter to a client that supports OAuth, such as Claude, ChatGPT, Claude Code, Codex or Gemini CLI. It will ask you to sign in and approve access, with no key to copy. <Link href="/keys/setup" className="text-primary underline">Set up a client</Link> has the steps for each.
        </EmptyState>
      ) : (
        <ul className="stagger flex flex-col gap-3" aria-label="Connected apps">
          {apps.map((app) => (
            <li key={app.id}>
              <Card className="flex flex-wrap items-start gap-4" data-testid="app-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <AppWindow size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="type-title-medium">{app.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.service ? <Badge>{app.service}</Badge> : <Badge tone="primary">All services</Badge>}
                    <Badge>OAuth</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 type-body-small text-on-surface-variant sm:grid-cols-4">
                    <div><dt className="inline">Last used </dt><dd className="inline text-on-surface">{formatRelative(app.lastUsedAt)}</dd></div>
                    <div><dt className="inline">Connected </dt><dd className="inline text-on-surface">{formatDate(app.createdAt)}</dd></div>
                  </dl>
                </div>
                <Button variant="text" icon={<Unplug size={18} />} onClick={() => setDisconnecting(app)} aria-label={`Disconnect ${app.name}`}>
                  Disconnect
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 max-w-2xl">
        <p className="mb-2 type-label-large text-on-surface-variant">MCP endpoint for OAuth clients</p>
        <CodeBlock code={`claude mcp add --transport http mcprouter ${endpoint}`} what="Command copied" />
      </div>

      {disconnecting ? <DisconnectDialog app={disconnecting} onClose={() => setDisconnecting(null)} /> : null}
    </>
  );
}

function DisconnectDialog({ app, onClose }: { app: AppRow; onClose: () => void }) {
  const { pending, run } = useActionRunner();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Disconnect this app?"
      description={`“${app.name}” will lose access immediately. It can connect again only after you sign in and approve it.`}
      confirmLabel="Disconnect"
      destructive
      pending={pending}
      onConfirm={() => run(() => disconnectApp({ id: app.id }), { progress: "Disconnecting…", success: "App disconnected" }, onClose)}
    />
  );
}
