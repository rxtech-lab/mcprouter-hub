"use client";

import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ActionsMenu, ActionsMenuItem, ActionsMenuSeparator } from "@/components/actions-menu";
import { Button } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { CodeBlock } from "@/components/m3/code-block";
import { cn } from "@/components/m3/cn";
import { ConfirmDialog, Dialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { SelectField, TextField } from "@/components/m3/text-field";
import { ServiceCombobox, type ServiceChoice } from "@/components/service-combobox";
import { ServiceBadges } from "@/components/service-badges";
import { ToolModeBadge, ToolModeDialog, ToolModeField } from "@/components/tool-mode-dialog";
import { useActionRunner } from "@/components/use-action-runner";
import type { ToolMode } from "@/db/schema";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { KEY_CLIENTS } from "@/lib/mcp-clients";
import { selectionToScopes, type ServiceSelection } from "@/lib/service-selection";
import { createApiKey, renameApiKey, revokeApiKey, updateApiKeyScopes, updateApiKeyToolMode } from "./actions";
import { KeysTabs } from "./keys-tabs";

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  /** Null means the endpoint's default. */
  toolMode: ToolMode | null;
  callCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired" | "unknown";
};

type ServiceOption = ServiceChoice;

type Mode =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "reveal"; name: string; key: string }
  | { kind: "rename"; key: KeyRow }
  | { kind: "scopes"; key: KeyRow }
  | { kind: "toolMode"; key: KeyRow }
  | { kind: "revoke"; key: KeyRow };

/** A dialog opened from the URL, e.g. by the agent. */
export type OpenDialog = { kind: "create"; name?: string } | { kind: "rename" | "scopes" | "toolMode" | "revoke"; key: KeyRow };

type KeysViewProps = { keys: KeyRow[]; services: ServiceOption[]; endpoint: string; initial?: OpenDialog };

export function KeysView({ keys, services, endpoint, initial }: KeysViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>(initial ? (initial.kind === "create" ? { kind: "create" } : initial) : { kind: "none" });
  const close = () => {
    setMode({ kind: "none" });
    // The dialog came from the URL; drop it so a reload doesn't reopen it.
    if (initial) router.replace(pathname, { scroll: false });
  };
  const byId = new Map(services.map((service) => [service.id, service]));
  const t = useT();

  return (
    <>
      <PageHeader
        title={t("API keys")}
        description={t("Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan.")}
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setMode({ kind: "create" })}>
            {t("Create key")}
          </Button>
        }
      />
      <KeysTabs />

      {keys.length === 0 ? (
        <EmptyState icon={<KeyRound size={32} />} title={t("No API keys yet")}>
          {t.rich(
            "Create a key, then paste the ready-made config into Claude Code, Codex, Gemini CLI, Cursor or any MCP client. Claude, ChatGPT and Gemini sign in with OAuth instead, see <link>Set up a client</link>.",
            { link: (chunks) => <Link href="/keys/apps?client=claude" className="text-primary underline">{chunks}</Link> },
          )}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("API keys")}>
          {keys.map((key) => (
            <li key={key.id}>
              <KeyCard apiKey={key} services={byId} onSelect={(kind) => setMode({ kind, key } as Mode)} />
            </li>
          ))}
        </ul>
      )}

      <CreateKeyDialog
        open={mode.kind === "create"}
        services={services}
        initialName={initial?.kind === "create" ? initial.name : undefined}
        onClose={close}
        onCreated={(name, key) => setMode({ kind: "reveal", name, key })}
      />
      {mode.kind === "reveal" ? <RevealKeyDialog name={mode.name} apiKey={mode.key} endpoint={endpoint} onClose={close} /> : null}
      {mode.kind === "rename" ? <RenameKeyDialog apiKey={mode.key} onClose={close} /> : null}
      {mode.kind === "scopes" ? <ScopesDialog apiKey={mode.key} services={services} onClose={close} /> : null}
      {mode.kind === "toolMode" ? (
        <ToolModeDialog
          description={t("Choose how clients using “{name}” see tools. They pick this up the next time they list tools.", { name: mode.key.name })}
          value={mode.key.toolMode}
          allowDefault
          onSave={(toolMode) => updateApiKeyToolMode({ id: mode.key.id, toolMode })}
          onClose={close}
        />
      ) : null}
      {mode.kind === "revoke" ? <RevokeDialog apiKey={mode.key} onClose={close} /> : null}
    </>
  );
}

function KeyCard({ apiKey, services, onSelect }: { apiKey: KeyRow; services: Map<string, ServiceOption>; onSelect: (kind: "rename" | "scopes" | "toolMode" | "revoke") => void }) {
  const active = apiKey.status === "active";
  const t = useT();
  return (
    <Card className={cn("flex flex-wrap items-start gap-4", !active && "opacity-60")} data-testid="key-card">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <KeyRound size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-title-medium">{apiKey.name}</h2>
          {apiKey.status === "revoked" ? <Badge tone="error">{t("Revoked")}</Badge> : null}
          {apiKey.status === "expired" ? <Badge tone="error">{t("Expired")}</Badge> : null}
        </div>
        <p className="mt-1 font-mono text-sm text-on-surface-variant">{apiKey.prefix}…</p>
        <div className="mt-3 flex flex-wrap gap-1">
          <ServiceBadges value={toSelection(apiKey.scopes, services)} />
          <ToolModeBadge value={apiKey.toolMode} allowDefault />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 type-body-small text-on-surface-variant sm:grid-cols-4">
          <div><dt className="inline">{t("Calls")} </dt><dd className="inline text-on-surface tabular-nums">{formatNumber(apiKey.callCount, t.locale)}</dd></div>
          <div><dt className="inline">{t("Last used")} </dt><dd className="inline text-on-surface">{formatRelative(apiKey.lastUsedAt, undefined, t.locale)}</dd></div>
          <div><dt className="inline">{t("Created")} </dt><dd className="inline text-on-surface">{formatDate(apiKey.createdAt, t.locale)}</dd></div>
          <div><dt className="inline">{t("Expires")} </dt><dd className="inline text-on-surface">{apiKey.expiresAt ? formatDate(apiKey.expiresAt, t.locale) : t("Never")}</dd></div>
        </dl>
      </div>
      {active ? (
        <ActionsMenu label={t("Actions for {name}", { name: apiKey.name })}>
          <ActionsMenuItem icon={<Pencil size={18} />} onSelect={() => onSelect("rename")}>{t("Rename")}</ActionsMenuItem>
          <ActionsMenuItem icon={<ShieldCheck size={18} />} onSelect={() => onSelect("scopes")}>{t("Change services")}</ActionsMenuItem>
          <ActionsMenuItem icon={<Wrench size={18} />} onSelect={() => onSelect("toolMode")}>{t("Change tool mode")}</ActionsMenuItem>
          <ActionsMenuSeparator />
          <ActionsMenuItem icon={<Trash2 size={18} />} onSelect={() => onSelect("revoke")} danger>{t("Revoke")}</ActionsMenuItem>
        </ActionsMenu>
      ) : null}
    </Card>
  );
}

/** Saved scopes as a picker selection; ids no longer in the catalogue are dropped. */
function toSelection(scopes: string[], byId: Map<string, ServiceOption>): ServiceSelection {
  return scopes.length ? scopes.flatMap((id) => byId.get(id) ?? []) : "all";
}

function ServicePicker({ services, value, onChange, disabled }: { services: ServiceOption[]; value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  const t = useT();
  const byId = new Map(services.map((service) => [service.id, service]));
  return (
    <ServiceCombobox
      legend={t("Services this key may call")}
      allLabel={t("All services")}
      value={toSelection(value, byId)}
      onChange={(next) => onChange(selectionToScopes(next))}
      disabled={disabled}
    />
  );
}

type CreateKeyDialogProps = {
  open: boolean;
  services: ServiceOption[];
  /** Pre-filled, e.g. the name the agent suggested. */
  initialName?: string;
  onClose: () => void;
  onCreated: (name: string, key: string) => void;
};

function CreateKeyDialog({ open, services, initialName, onClose, onCreated }: CreateKeyDialogProps) {
  const [name, setName] = useState(initialName ?? "");
  const [scopes, setScopes] = useState<string[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode | null>(null);
  const [expires, setExpires] = useState("0");
  const { pending, run } = useActionRunner();
  const t = useT();

  const reset = () => {
    setName("");
    setScopes([]);
    setToolMode(null);
    setExpires("0");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Create API key")}
      description={t("The key is shown once, right after you create it.")}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
          <Button
            type="submit"
            form="create-key-form"
            disabled={pending || !name.trim()}
          >
            {pending ? t("Creating…") : t("Create")}
          </Button>
        </>
      }
    >
      <form
        id="create-key-form"
        className="flex flex-col gap-5 py-1"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () => createApiKey({ name, scopes, toolMode, expiresInDays: Number(expires) as 0 | 30 | 90 | 365 }),
            { progress: t("Creating key…"), success: t("Key created") },
            (data) => {
              reset();
              onCreated(data.name, data.key);
            },
          );
        }}
      >
        <TextField label={t("Name")} placeholder={t("e.g. Claude Code on my laptop")} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoFocus required />
        <SelectField label={t("Expires")} value={expires} onChange={(event) => setExpires(event.target.value)}>
          <option value="0">{t("Never")}</option>
          <option value="30">{t("In 30 days")}</option>
          <option value="90">{t("In 90 days")}</option>
          <option value="365">{t("In 1 year")}</option>
        </SelectField>
        <ServicePicker services={services} value={scopes} onChange={setScopes} disabled={pending} />
        <ToolModeField value={toolMode} onChange={setToolMode} allowDefault disabled={pending} />
      </form>
    </Dialog>
  );
}

function RevealKeyDialog({ name, apiKey, endpoint, onClose }: { name: string; apiKey: string; endpoint: string; onClose: () => void }) {
  const [clientId, setClientId] = useState(KEY_CLIENTS[0].id);
  const client = KEY_CLIENTS.find((option) => option.id === clientId) ?? KEY_CLIENTS[0];
  const t = useT();
  return (
    <Dialog
      open
      dismissible={false}
      onOpenChange={(next) => !next && onClose()}
      title={t("“{name}” is ready", { name })}
      className="w-[min(680px,calc(100vw-32px))]"
      actions={<Button onClick={onClose}>{t("Done")}</Button>}
    >
      <div className="flex flex-col gap-4 py-1">
        <p className="flex items-start gap-2 rounded-sm bg-tertiary-container p-3 type-body-medium text-on-tertiary-container">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          {t("Copy this key now. It is stored only as a hash, so it can't be shown again.")}
        </p>
        <div data-testid="revealed-key">
          <CodeBlock code={apiKey} label={t("API key")} what={t("Key copied")} />
        </div>
        <div role="tablist" aria-label={t("Client")} className="flex overflow-x-auto border-b border-outline-variant">
          {KEY_CLIENTS.map((option) => (
            <button
              key={option.id}
              role="tab"
              type="button"
              aria-selected={client.id === option.id}
              onClick={() => setClientId(option.id)}
              className={cn(
                "state-layer -mb-px h-12 shrink-0 cursor-pointer border-b-2 px-4 type-title-small",
                client.id === option.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant",
              )}
            >
              {t(option.name)}
            </button>
          ))}
        </div>
        <ol key={client.id} role="tabpanel" aria-label={t(client.name)} className="animate-fade-through flex flex-col gap-3">
          {client.apiKey(endpoint, apiKey).map((step, index) => (
            <li key={index} className="flex flex-col gap-2">
              <p className="type-body-medium">
                <span className="tabular-nums text-on-surface-variant">{index + 1}. </span>
                {t(step.text)}
              </p>
              {step.code ? <CodeBlock code={step.code} what={t("Config copied")} /> : null}
            </li>
          ))}
        </ol>
        <p className="type-body-small text-on-surface-variant">
          {t.rich("Claude, ChatGPT and other clients that sign in with OAuth don't need a key. See <link>Set up a client</link>.", {
            link: (chunks) => <Link href="/keys/apps?client=claude" className="text-primary underline">{chunks}</Link>,
          })}
        </p>
      </div>
    </Dialog>
  );
}

function RenameKeyDialog({ apiKey, onClose }: { apiKey: KeyRow; onClose: () => void }) {
  const [name, setName] = useState(apiKey.name);
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Rename key")}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
          <Button type="submit" form="rename-key-form" disabled={pending || !name.trim() || name.trim() === apiKey.name}>
            {pending ? t("Saving…") : t("Save")}
          </Button>
        </>
      }
    >
      <form
        id="rename-key-form"
        className="py-1"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => renameApiKey({ id: apiKey.id, name }), { progress: t("Renaming key…"), success: t("Key renamed") }, onClose);
        }}
      >
        <TextField label={t("Name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoFocus required />
      </form>
    </Dialog>
  );
}

function ScopesDialog({ apiKey, services, onClose }: { apiKey: KeyRow; services: ServiceOption[]; onClose: () => void }) {
  const [scopes, setScopes] = useState(apiKey.scopes);
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Change services")}
      description={t("Choose which services “{name}” can call. Clients see only these tools.", { name: apiKey.name })}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
          <Button
            disabled={pending}
            onClick={() => run(() => updateApiKeyScopes({ id: apiKey.id, scopes }), { progress: t("Saving services…"), success: t("Services updated") }, onClose)}
          >
            {pending ? t("Saving…") : t("Save")}
          </Button>
        </>
      }
    >
      <ServicePicker services={services} value={scopes} onChange={setScopes} disabled={pending} />
    </Dialog>
  );
}

function RevokeDialog({ apiKey, onClose }: { apiKey: KeyRow; onClose: () => void }) {
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Revoke this key?")}
      description={t("Clients using “{name}” ({prefix}…) will stop working immediately. This can't be undone.", { name: apiKey.name, prefix: apiKey.prefix })}
      confirmLabel={t("Revoke")}
      destructive
      pending={pending}
      onConfirm={() => run(() => revokeApiKey({ id: apiKey.id }), { progress: t("Revoking key…"), success: t("Key revoked") }, onClose)}
    />
  );
}
