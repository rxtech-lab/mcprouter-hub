"use client";

import { DropdownMenu } from "radix-ui";
import { KeyRound, MoreVertical, Pencil, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, IconButton } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { Badge, FilterChip } from "@/components/m3/chip";
import { CodeBlock } from "@/components/m3/code-block";
import { cn } from "@/components/m3/cn";
import { ConfirmDialog, Dialog } from "@/components/m3/dialog";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { SelectField, TextField } from "@/components/m3/text-field";
import { useActionRunner } from "@/components/use-action-runner";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { KEY_CLIENTS } from "@/lib/mcp-clients";
import { createApiKey, renameApiKey, revokeApiKey, updateApiKeyScopes } from "./actions";
import { KeysTabs } from "./keys-tabs";

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  callCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired" | "unknown";
};

type ServiceOption = { id: string; title: string };

type Mode =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "reveal"; name: string; key: string }
  | { kind: "rename"; key: KeyRow }
  | { kind: "scopes"; key: KeyRow }
  | { kind: "revoke"; key: KeyRow };

export function KeysView({ keys, services, endpoint }: { keys: KeyRow[]; services: ServiceOption[]; endpoint: string }) {
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const close = () => setMode({ kind: "none" });
  const titles = new Map(services.map((service) => [service.id, service.title]));

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan."
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setMode({ kind: "create" })}>
            Create key
          </Button>
        }
      />
      <KeysTabs />

      {keys.length === 0 ? (
        <EmptyState icon={<KeyRound size={32} />} title="No API keys yet">
          Create a key, then paste the ready-made config into Claude Code, Codex, Gemini CLI, Cursor or any MCP client. Claude and ChatGPT sign in with OAuth instead, see{" "}
          <Link href="/keys/setup" className="text-primary underline">Set up a client</Link>.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="API keys">
          {keys.map((key) => (
            <li key={key.id}>
              <KeyCard apiKey={key} titles={titles} onSelect={(kind) => setMode({ kind, key } as Mode)} />
            </li>
          ))}
        </ul>
      )}

      <CreateKeyDialog
        open={mode.kind === "create"}
        services={services}
        onClose={close}
        onCreated={(name, key) => setMode({ kind: "reveal", name, key })}
      />
      {mode.kind === "reveal" ? <RevealKeyDialog name={mode.name} apiKey={mode.key} endpoint={endpoint} onClose={close} /> : null}
      {mode.kind === "rename" ? <RenameKeyDialog apiKey={mode.key} onClose={close} /> : null}
      {mode.kind === "scopes" ? <ScopesDialog apiKey={mode.key} services={services} onClose={close} /> : null}
      {mode.kind === "revoke" ? <RevokeDialog apiKey={mode.key} onClose={close} /> : null}
    </>
  );
}

function KeyCard({ apiKey, titles, onSelect }: { apiKey: KeyRow; titles: Map<string, string>; onSelect: (kind: "rename" | "scopes" | "revoke") => void }) {
  const active = apiKey.status === "active";
  return (
    <Card className={cn("flex flex-wrap items-start gap-4", !active && "opacity-60")} data-testid="key-card">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <KeyRound size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-title-medium">{apiKey.name}</h2>
          {apiKey.status === "revoked" ? <Badge tone="error">Revoked</Badge> : null}
          {apiKey.status === "expired" ? <Badge tone="error">Expired</Badge> : null}
        </div>
        <p className="mt-1 font-mono text-sm text-on-surface-variant">{apiKey.prefix}…</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {apiKey.scopes.length === 0 ? (
            <Badge tone="primary">All services</Badge>
          ) : (
            apiKey.scopes.map((scope) => <Badge key={scope}>{titles.get(scope) ?? scope}</Badge>)
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 type-body-small text-on-surface-variant sm:grid-cols-4">
          <div><dt className="inline">Calls </dt><dd className="inline text-on-surface tabular-nums">{formatNumber(apiKey.callCount)}</dd></div>
          <div><dt className="inline">Last used </dt><dd className="inline text-on-surface">{formatRelative(apiKey.lastUsedAt)}</dd></div>
          <div><dt className="inline">Created </dt><dd className="inline text-on-surface">{formatDate(apiKey.createdAt)}</dd></div>
          <div><dt className="inline">Expires </dt><dd className="inline text-on-surface">{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Never"}</dd></div>
        </dl>
      </div>
      {active ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label={`Actions for ${apiKey.name}`}>
              <MoreVertical size={20} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-xs bg-surface-container py-2 shadow-elevation-2">
              <MenuItem icon={<Pencil size={18} />} onSelect={() => onSelect("rename")}>Rename</MenuItem>
              <MenuItem icon={<ShieldCheck size={18} />} onSelect={() => onSelect("scopes")}>Change services</MenuItem>
              <DropdownMenu.Separator className="my-2 h-px bg-outline-variant" />
              <MenuItem icon={<Trash2 size={18} />} onSelect={() => onSelect("revoke")} danger>Revoke</MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </Card>
  );
}

function MenuItem({ icon, children, onSelect, danger }: { icon: React.ReactNode; children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex h-12 cursor-pointer items-center gap-3 px-3 type-label-large outline-none data-[highlighted]:bg-on-surface/8",
        danger ? "text-error" : "text-on-surface",
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function ServicePicker({ services, value, onChange }: { services: ServiceOption[]; value: string[]; onChange: (value: string[]) => void }) {
  const all = value.length === 0;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 type-body-small text-on-surface-variant">Services this key may call</legend>
      <div className="flex flex-wrap gap-2">
        <FilterChip selected={all} onClick={() => onChange([])}>All services</FilterChip>
        {services.map((service) => {
          const selected = value.includes(service.id);
          return (
            <FilterChip
              key={service.id}
              selected={selected}
              onClick={() => onChange(selected ? value.filter((id) => id !== service.id) : [...value, service.id])}
            >
              {service.title}
            </FilterChip>
          );
        })}
      </div>
    </fieldset>
  );
}

function CreateKeyDialog({ open, services, onClose, onCreated }: { open: boolean; services: ServiceOption[]; onClose: () => void; onCreated: (name: string, key: string) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expires, setExpires] = useState("0");
  const { pending, run } = useActionRunner();

  const reset = () => {
    setName("");
    setScopes([]);
    setExpires("0");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Create API key"
      description="The key is shown once, right after you create it."
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            type="submit"
            form="create-key-form"
            disabled={pending || !name.trim()}
          >
            {pending ? "Creating…" : "Create"}
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
            () => createApiKey({ name, scopes, expiresInDays: Number(expires) as 0 | 30 | 90 | 365 }),
            { progress: "Creating key…", success: "Key created" },
            (data) => {
              reset();
              onCreated(data.name, data.key);
            },
          );
        }}
      >
        <TextField label="Name" placeholder="e.g. Claude Code on my laptop" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoFocus required />
        <SelectField label="Expires" value={expires} onChange={(event) => setExpires(event.target.value)}>
          <option value="0">Never</option>
          <option value="30">In 30 days</option>
          <option value="90">In 90 days</option>
          <option value="365">In 1 year</option>
        </SelectField>
        <ServicePicker services={services} value={scopes} onChange={setScopes} />
      </form>
    </Dialog>
  );
}

function RevealKeyDialog({ name, apiKey, endpoint, onClose }: { name: string; apiKey: string; endpoint: string; onClose: () => void }) {
  const [clientId, setClientId] = useState(KEY_CLIENTS[0].id);
  const client = KEY_CLIENTS.find((option) => option.id === clientId) ?? KEY_CLIENTS[0];
  return (
    <Dialog
      open
      dismissible={false}
      onOpenChange={(next) => !next && onClose()}
      title={`“${name}” is ready`}
      className="w-[min(680px,calc(100vw-32px))]"
      actions={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-4 py-1">
        <p className="flex items-start gap-2 rounded-sm bg-tertiary-container p-3 type-body-medium text-on-tertiary-container">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          Copy this key now. It is stored only as a hash, so it can&apos;t be shown again.
        </p>
        <div data-testid="revealed-key">
          <CodeBlock code={apiKey} label="API key" what="Key copied" />
        </div>
        <div role="tablist" aria-label="Client" className="flex overflow-x-auto border-b border-outline-variant">
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
              {option.name}
            </button>
          ))}
        </div>
        <ol key={client.id} role="tabpanel" aria-label={client.name} className="animate-fade-through flex flex-col gap-3">
          {client.apiKey(endpoint, apiKey).map((step, index) => (
            <li key={index} className="flex flex-col gap-2">
              <p className="type-body-medium">
                <span className="tabular-nums text-on-surface-variant">{index + 1}. </span>
                {step.text}
              </p>
              {step.code ? <CodeBlock code={step.code} what="Config copied" /> : null}
            </li>
          ))}
        </ol>
        <p className="type-body-small text-on-surface-variant">
          Claude, ChatGPT and other clients that sign in with OAuth don&apos;t need a key. See{" "}
          <Link href="/keys/setup" className="text-primary underline">Set up a client</Link>.
        </p>
      </div>
    </Dialog>
  );
}

function RenameKeyDialog({ apiKey, onClose }: { apiKey: KeyRow; onClose: () => void }) {
  const [name, setName] = useState(apiKey.name);
  const { pending, run } = useActionRunner();
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Rename key"
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form="rename-key-form" disabled={pending || !name.trim() || name.trim() === apiKey.name}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="rename-key-form"
        className="py-1"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => renameApiKey({ id: apiKey.id, name }), { progress: "Renaming key…", success: "Key renamed" }, onClose);
        }}
      >
        <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoFocus required />
      </form>
    </Dialog>
  );
}

function ScopesDialog({ apiKey, services, onClose }: { apiKey: KeyRow; services: ServiceOption[]; onClose: () => void }) {
  const [scopes, setScopes] = useState(apiKey.scopes);
  const { pending, run } = useActionRunner();
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Change services"
      description={`Choose which services “${apiKey.name}” can call. Clients see only these tools.`}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => run(() => updateApiKeyScopes({ id: apiKey.id, scopes }), { progress: "Saving services…", success: "Services updated" }, onClose)}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <ServicePicker services={services} value={scopes} onChange={setScopes} />
    </Dialog>
  );
}

function RevokeDialog({ apiKey, onClose }: { apiKey: KeyRow; onClose: () => void }) {
  const { pending, run } = useActionRunner();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Revoke this key?"
      description={`Clients using “${apiKey.name}” (${apiKey.prefix}…) will stop working immediately. This can't be undone.`}
      confirmLabel="Revoke"
      destructive
      pending={pending}
      onConfirm={() => run(() => revokeApiKey({ id: apiKey.id }), { progress: "Revoking key…", success: "Key revoked" }, onClose)}
    />
  );
}
