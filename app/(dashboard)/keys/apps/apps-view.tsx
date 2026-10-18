"use client";

import { AppWindow, ChevronRight, KeyRound, LogIn, Plus, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { ConfirmDialog, Dialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { SetupSteps } from "@/components/setup-steps";
import { useActionRunner } from "@/components/use-action-runner";
import { listHref } from "@/app/sources/params";
import { formatDate, formatRelative } from "@/lib/format";
import { KEY_PLACEHOLDER, type SetupStep } from "@/lib/mcp-clients";
import { disconnectApp } from "../actions";
import { KeysTabs } from "../keys-tabs";

export type AppRow = { id: string; name: string; service: string | null; lastUsedAt: string | null; createdAt: string };
export type ClientOption = { id: string; name: string; kind: string };
/** The setup guide picked in the URL, with its steps already filled in on the server. */
export type ClientGuide = ClientOption & { auth: "oauth" | "key"; supportsApiKey: boolean; steps: SetupStep[]; note: string | null };

const PATH = "/keys/apps";
const guideHref = (client: string, auth?: "oauth" | "key") => listHref(PATH, { client, auth: auth === "key" ? "key" : undefined });

export function AppsView({ apps, clients, guide }: { apps: AppRow[]; clients: ClientOption[]; guide: ClientGuide | null }) {
  const [disconnecting, setDisconnecting] = useState<AppRow | null>(null);
  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan."
        actions={
          apps.length > 0 ? (
            <ButtonLink href={guideHref(clients[0].id)} scroll={false} icon={<Plus size={18} />}>
              Add client
            </ButtonLink>
          ) : null
        }
      />
      <KeysTabs />

      {apps.length === 0 ? (
        <EmptyState icon={<AppWindow size={32} />} title="No connected apps">
          <p>Pick your client to see how to add mcprouter. Clients that support OAuth ask you to sign in and approve access, with no key to copy.</p>
          <ul className="stagger mt-6 grid gap-2 text-left sm:grid-cols-2" aria-label="Clients">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={guideHref(client.id)}
                  scroll={false}
                  className="state-layer flex items-center gap-3 rounded-md bg-surface-container px-4 py-3 text-on-surface transition-colors duration-200 ease-emphasized"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block type-label-large">{client.name}</span>
                    <span className="block truncate type-body-small text-on-surface-variant">{client.kind}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
                </Link>
              </li>
            ))}
          </ul>
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

      <ClientGuideDialog guide={guide} clients={clients} />
      {disconnecting ? <DisconnectDialog app={disconnecting} onClose={() => setDisconnecting(null)} /> : null}
    </>
  );
}

/** Setup steps for one client. Open while `?client=` is in the URL; closing drops it. */
function ClientGuideDialog({ guide, clients }: { guide: ClientGuide | null; clients: ClientOption[] }) {
  const router = useRouter();
  // Keep showing the last guide while the dialog animates out after the URL loses `?client=`.
  const [shown, setShown] = useState(guide);
  if (guide && (guide.id !== shown?.id || guide.auth !== shown.auth)) setShown(guide);
  if (!shown) return null;

  return (
    <Dialog
      open={guide !== null}
      onOpenChange={(open) => !open && router.push(PATH, { scroll: false })}
      title={`Add ${shown.name}`}
      description={
        shown.auth === "key" ? (
          <>
            Replace <code className="font-mono text-on-surface">{KEY_PLACEHOLDER}</code> with a key from the API keys tab. New keys show these steps with the key filled in.
          </>
        ) : (
          "You sign in to mcprouter and approve access, with no key to copy. The client then appears in this list."
        )
      }
      className="w-[min(720px,calc(100vw-32px))]"
      actions={
        <>
          {shown.auth === "key" ? (
            <ButtonLink href="/keys" variant="tonal" icon={<KeyRound size={18} />}>
              Create a key
            </ButtonLink>
          ) : null}
          <Button variant="text" onClick={() => router.push(PATH, { scroll: false })}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-testid="client-guide">
        <nav aria-label="Clients" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {clients.map((option) => {
            const active = option.id === shown.id;
            return (
              <Link
                key={option.id}
                href={guideHref(option.id, shown.auth)}
                replace
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "state-layer flex h-8 shrink-0 items-center rounded-sm border px-3 type-label-large transition-colors duration-200 ease-emphasized",
                  active ? "border-transparent bg-secondary-container text-on-secondary-container" : "border-outline-variant text-on-surface-variant",
                )}
              >
                {option.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-body-medium text-on-surface-variant">{shown.kind}</p>
          {shown.supportsApiKey ? (
            <nav aria-label="Sign-in method" className="flex rounded-full border border-outline">
              {(
                [
                  { value: "oauth", label: "Sign in", icon: <LogIn size={16} /> },
                  { value: "key", label: "API key", icon: <KeyRound size={16} /> },
                ] as const
              ).map((option, index) => (
                <Link
                  key={option.value}
                  href={guideHref(shown.id, option.value)}
                  replace
                  scroll={false}
                  aria-current={shown.auth === option.value ? "page" : undefined}
                  className={cn(
                    "state-layer flex h-10 items-center gap-2 px-4 type-label-large transition-colors duration-200",
                    index === 0 ? "rounded-l-full" : "rounded-r-full border-l border-outline",
                    shown.auth === option.value ? "bg-secondary-container text-on-secondary-container" : "text-on-surface",
                  )}
                >
                  {option.icon}
                  {option.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div key={`${shown.id}-${shown.auth}`} className="animate-fade-through flex flex-col gap-5">
          <SetupSteps steps={shown.steps} />
          {shown.note ? <p className="rounded-sm bg-surface-container p-3 type-body-medium text-on-surface-variant">{shown.note}</p> : null}
        </div>
      </div>
    </Dialog>
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
