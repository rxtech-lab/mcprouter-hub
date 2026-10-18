"use client";

import { AppWindow, ChevronRight, KeyRound, ListTree, LogIn, Plus, Search, SlidersHorizontal, Unplug, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/m3/button";
import { ActionsMenu, ActionsMenuItem, ActionsMenuSeparator } from "@/components/actions-menu";
import { Card } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { ConfirmDialog, Dialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { ServiceBadges } from "@/components/service-badges";
import { ServicesDialog } from "@/components/services-dialog";
import { SetupSteps } from "@/components/setup-steps";
import { ToolModeBadge, ToolModeDialog } from "@/components/tool-mode-dialog";
import { useActionRunner } from "@/components/use-action-runner";
import { listHref } from "@/app/sources/params";
import { formatDate, formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { ServiceSelection } from "@/lib/service-selection";
import { KEY_PLACEHOLDER, type SetupStep } from "@/lib/mcp-clients";
import type { ToolMode } from "@/lib/mcp/meta-tools";
import { disconnectApp, updateAppServices, updateAppToolMode } from "../actions";
import { KeysTabs } from "../keys-tabs";

/** `service` is set for apps connected to a single-service endpoint; otherwise `scopes` limits them. `toolMode` null means the endpoint's default. */
export type AppRow = { id: string; name: string; service: string | null; scopes: ServiceSelection; toolMode: ToolMode | null; lastUsedAt: string | null; createdAt: string };
export type ClientOption = { id: string; name: string; kind: string };
/** The setup guide picked in the URL, with its steps already filled in on the server. */
export type ClientGuide = ClientOption & { auth: "oauth" | "key"; tools: ToolMode; supportsApiKey: boolean; steps: SetupStep[]; note: string | null };

const PATH = "/keys/apps";
const guideHref = (client: string, auth?: "oauth" | "key", tools?: ToolMode) =>
  listHref(PATH, { client, auth: auth === "key" ? "key" : undefined, tools: tools === "all" ? "all" : undefined });

type AppsViewProps = { apps: AppRow[]; clients: ClientOption[]; guide: ClientGuide | null; editing: AppRow | null; editingTools: AppRow | null };

export function AppsView({ apps, clients, guide, editing, editingTools }: AppsViewProps) {
  const [disconnecting, setDisconnecting] = useState<AppRow | null>(null);
  const router = useRouter();
  const t = useT();
  return (
    <>
      <PageHeader
        title={t("API keys")}
        description={t("Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan.")}
        actions={
          apps.length > 0 ? (
            <ButtonLink href={guideHref(clients[0].id)} scroll={false} icon={<Plus size={18} />}>
              {t("Add client")}
            </ButtonLink>
          ) : null
        }
      />
      <KeysTabs />

      {apps.length === 0 ? (
        <EmptyState icon={<AppWindow size={32} />} title={t("No connected apps")}>
          <p>{t("Pick your client to see how to add mcprouter. Clients that support OAuth ask you to sign in and approve access, with no key to copy.")}</p>
          <ul className="stagger mt-6 grid gap-2 text-left sm:grid-cols-2" aria-label={t("Clients")}>
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={guideHref(client.id)}
                  scroll={false}
                  className="state-layer flex items-center gap-3 rounded-md bg-surface-container px-4 py-3 text-on-surface transition-colors duration-200 ease-emphasized"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block type-label-large">{t(client.name)}</span>
                    <span className="block truncate type-body-small text-on-surface-variant">{t(client.kind)}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
                </Link>
              </li>
            ))}
          </ul>
        </EmptyState>
      ) : (
        <ul className="stagger flex flex-col gap-3" aria-label={t("Connected apps")}>
          {apps.map((app) => (
            <li key={app.id}>
              <Card className="flex flex-wrap items-start gap-4" data-testid="app-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <AppWindow size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="type-title-medium">{app.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.service ? (
                      <Badge>{app.service}</Badge>
                    ) : (
                      <ServiceBadges value={app.scopes} />
                    )}
                    <ToolModeBadge value={app.toolMode} allowDefault />
                    <Badge>OAuth</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 type-body-small text-on-surface-variant sm:grid-cols-4">
                    <div><dt className="inline">{t("Last used")} </dt><dd className="inline text-on-surface">{formatRelative(app.lastUsedAt, undefined, t.locale)}</dd></div>
                    <div><dt className="inline">{t("Connected")} </dt><dd className="inline text-on-surface">{formatDate(app.createdAt, t.locale)}</dd></div>
                  </dl>
                </div>
                <ActionsMenu label={t("Actions for {name}", { name: app.name })}>
                  {app.service ? null : (
                    <ActionsMenuItem icon={<SlidersHorizontal size={18} />} href={`${PATH}?services=${encodeURIComponent(app.id)}`}>{t("Change services")}</ActionsMenuItem>
                  )}
                  <ActionsMenuItem icon={<Wrench size={18} />} href={`${PATH}?toolMode=${encodeURIComponent(app.id)}`}>{t("Change tool mode")}</ActionsMenuItem>
                  <ActionsMenuSeparator />
                  <ActionsMenuItem icon={<Unplug size={18} />} onSelect={() => setDisconnecting(app)} danger>{t("Disconnect")}</ActionsMenuItem>
                </ActionsMenu>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ClientGuideDialog guide={guide} clients={clients} />
      {editing ? (
        <ServicesDialog
          key={editing.id}
          title={t("Change services")}
          description={t("Choose which services “{name}” can call. It sees only their tools.", { name: editing.name })}
          legend={t("Services this app may call")}
          value={editing.scopes}
          onSave={(services) => updateAppServices({ id: editing.id, services })}
          // Dropping the query closes the dialog, so a reload doesn't reopen it.
          onClose={() => router.replace(PATH, { scroll: false })}
        />
      ) : null}
      {editingTools ? (
        <ToolModeDialog
          key={editingTools.id}
          description={t("Choose how “{name}” sees tools. It picks this up the next time it lists tools.", { name: editingTools.name })}
          value={editingTools.toolMode}
          allowDefault
          onSave={(toolMode) => updateAppToolMode({ id: editingTools.id, toolMode })}
          onClose={() => router.replace(PATH, { scroll: false })}
        />
      ) : null}
      {disconnecting ? <DisconnectDialog app={disconnecting} onClose={() => setDisconnecting(null)} /> : null}
    </>
  );
}

/** Setup steps for one client. Open while `?client=` is in the URL; closing drops it. */
function ClientGuideDialog({ guide, clients }: { guide: ClientGuide | null; clients: ClientOption[] }) {
  const router = useRouter();
  const t = useT();
  // Keep showing the last guide while the dialog animates out after the URL loses `?client=`.
  const [shown, setShown] = useState(guide);
  if (guide && (guide.id !== shown?.id || guide.auth !== shown.auth || guide.tools !== shown.tools)) setShown(guide);
  if (!shown) return null;

  return (
    <Dialog
      open={guide !== null}
      onOpenChange={(open) => !open && router.push(PATH, { scroll: false })}
      title={t("Add {name}", { name: t(shown.name) })}
      description={
        shown.auth === "key" ? (
          t.rich("Replace {placeholder} with a key from the API keys tab. New keys show these steps with the key filled in.", {
            placeholder: <code className="font-mono text-on-surface">{KEY_PLACEHOLDER}</code>,
          })
        ) : (
          t("You sign in to mcprouter and approve access, with no key to copy. The client then appears in this list.")
        )
      }
      className="w-[min(720px,calc(100vw-32px))]"
      actions={
        <>
          {shown.auth === "key" ? (
            <ButtonLink href="/keys" variant="tonal" icon={<KeyRound size={18} />}>
              {t("Create a key")}
            </ButtonLink>
          ) : null}
          <Button variant="text" onClick={() => router.push(PATH, { scroll: false })}>
            {t("Done")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-testid="client-guide">
        <nav aria-label={t("Clients")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {clients.map((option) => {
            const active = option.id === shown.id;
            return (
              <Link
                key={option.id}
                href={guideHref(option.id, shown.auth, shown.tools)}
                replace
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "state-layer flex h-8 shrink-0 items-center rounded-sm border px-3 type-label-large transition-colors duration-200 ease-emphasized",
                  active ? "border-transparent bg-secondary-container text-on-secondary-container" : "border-outline-variant text-on-surface-variant",
                )}
              >
                {t(option.name)}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-body-medium text-on-surface-variant">{t(shown.kind)}</p>
          {shown.supportsApiKey ? (
            <nav aria-label={t("Sign-in method")} className="flex rounded-full border border-outline">
              {(
                [
                  { value: "oauth", label: t("Sign in"), icon: <LogIn size={16} /> },
                  { value: "key", label: t("API key"), icon: <KeyRound size={16} /> },
                ] as const
              ).map((option, index) => (
                <Link
                  key={option.value}
                  href={guideHref(shown.id, option.value, shown.tools)}
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

        <div className="flex flex-col gap-2">
          <nav aria-label={t("Tools to expose")} className="flex self-start rounded-full border border-outline">
            {(
              [
                { value: "search", label: t("Search tools"), icon: <Search size={16} /> },
                { value: "all", label: t("All tools"), icon: <ListTree size={16} /> },
              ] as const
            ).map((option, index) => (
              <Link
                key={option.value}
                href={guideHref(shown.id, shown.auth, option.value)}
                replace
                scroll={false}
                aria-current={shown.tools === option.value ? "page" : undefined}
                className={cn(
                  "state-layer flex h-10 items-center gap-2 px-4 type-label-large transition-colors duration-200",
                  index === 0 ? "rounded-l-full" : "rounded-r-full border-l border-outline",
                  shown.tools === option.value ? "bg-secondary-container text-on-secondary-container" : "text-on-surface",
                )}
              >
                {option.icon}
                {option.label}
              </Link>
            ))}
          </nav>
          <p className="type-body-small text-on-surface-variant">
            {shown.tools === "search"
              ? t("The client sees only search_tools, read_tool and use_tool, and finds the tools it needs, so its context stays small.")
              : t("The client sees every tool by name. Some clients cap how many tools they load, so this suits clients without a limit.")}
          </p>
        </div>

        <div key={`${shown.id}-${shown.auth}-${shown.tools}`} className="animate-fade-through flex flex-col gap-5">
          <SetupSteps steps={shown.steps} />
          {shown.note ? <p className="rounded-sm bg-surface-container p-3 type-body-medium text-on-surface-variant">{t(shown.note)}</p> : null}
        </div>
      </div>
    </Dialog>
  );
}

function DisconnectDialog({ app, onClose }: { app: AppRow; onClose: () => void }) {
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Disconnect this app?")}
      description={t("“{name}” will lose access immediately. It can connect again only after you sign in and approve it.", { name: app.name })}
      confirmLabel={t("Disconnect")}
      destructive
      pending={pending}
      onConfirm={() => run(() => disconnectApp({ id: app.id }), { progress: t("Disconnecting…"), success: t("App disconnected") }, onClose)}
    />
  );
}
