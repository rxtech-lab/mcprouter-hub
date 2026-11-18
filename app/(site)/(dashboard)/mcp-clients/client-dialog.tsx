"use client";

import { useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NativeDialog } from "@/components/native-dialog";
import { Button } from "@/components/m3/button";
import { useSnackbar } from "@/components/m3/snackbar";
import { useActionRunner } from "@/components/use-action-runner";
import { connectClient, disconnectClient, reloadClientTools } from "./actions";

export function ReloadClientTools({ id }: { id: string }) {
  const router = useRouter();
  const { pending, run } = useActionRunner();
  return <Button variant="text" disabled={pending} onClick={() => run(() => reloadClientTools(id), { progress: "Reloading tools…", success: "Tools reloaded" }, () => router.refresh())}>{pending ? "Reloading…" : "Reload tools"}</Button>;
}

export function RetryClientDetails() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button variant="text" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Loading…" : "Try again"}</Button>;
}

export function ClientDetailsDialog({ name, children }: { name: string; children: ReactNode }) {
  const router = useRouter();
  const close = () => router.push("/mcp-clients", { scroll: false });
  return <NativeDialog title={name} onClose={close} fixedLayout>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    <div className="mt-4 flex shrink-0 justify-end border-t border-outline-variant pt-4"><Button variant="text" onClick={close}>Close</Button></div>
  </NativeDialog>;
}

export function OAuthStatus({ status }: { status?: string }) {
  const { show } = useSnackbar();
  const router = useRouter();
  useEffect(() => {
    if (!status) return;
    show(status === "connected" ? "MCP client connected" : "Connection failed. Try reconnecting the client.", { tone: status === "connected" ? "success" : "error" });
    router.replace("/mcp-clients");
  }, [status, show, router]);
  return null;
}

export function ClientDialog({ remove }: { remove?: { id: string; name: string } }) {
  const router = useRouter();
  const { pending, run } = useActionRunner();
  const close = () => router.push("/mcp-clients");
  return <NativeDialog title={remove ? "Disconnect MCP client" : "Connect MCP client"} onClose={close}>
    {remove ? <><p>Disconnect {remove.name}? Agents and scheduled tasks will lose access. You can also revoke mcprouter access at the provider.</p><div className="mt-6 flex justify-end gap-2"><Button variant="text" onClick={close}>Cancel</Button><Button disabled={pending} variant="danger" onClick={() => run(() => disconnectClient(remove.id), { progress: "Disconnecting…", success: "MCP client disconnected" }, close)}>Disconnect</Button></div></> :
      <form className="flex flex-col gap-4" onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        // Keep the inputs intact when the action returns a connection error.
        const form = new FormData(event.currentTarget);
        run(() => connectClient({ name: String(form.get("name")), url: String(form.get("url")), clientId: String(form.get("clientId") || "") || undefined, clientSecret: String(form.get("clientSecret") || "") || undefined }), { progress: "Starting OAuth…", success: "Opening provider authorization…" }, ({ url }) => window.location.assign(url));
      }}>
        <p className="type-body-medium text-on-surface-variant">Connect a public HTTPS MCP server. All your signed-in agents and scheduled tasks can use its tools. Authorization happens at the provider.</p>
        <label>Name<input className="mt-1 block w-full rounded-md border p-3" name="name" required maxLength={80} /></label>
        <label>MCP server URL<input className="mt-1 block w-full rounded-md border p-3" name="url" type="url" required placeholder="https://example.com/mcp" /></label>
        <details><summary>Pre-registered OAuth client (optional)</summary><p className="my-2 type-body-small">Otherwise dynamic client registration is used. Redirect URI: /api/external-mcp/callback on this site.</p><label>Client ID<input className="mt-1 block w-full rounded-md border p-3" name="clientId" autoComplete="off" /></label><label>Client secret<input className="mt-1 block w-full rounded-md border p-3" name="clientSecret" type="password" autoComplete="new-password" /></label></details>
        <div className="flex justify-end gap-2"><Button variant="text" type="button" onClick={close}>Cancel</Button><Button disabled={pending} type="submit">Continue with OAuth</Button></div>
      </form>}
  </NativeDialog>;
}

export function ReconnectClient({ client }: { client: { id: string; name: string; url: string } }) {
  const { pending, run } = useActionRunner();
  return <Button variant="text" disabled={pending} onClick={() => run(() => connectClient(client), { progress: "Reconnecting…", success: "Opening provider authorization…" }, ({ url }) => window.location.assign(url))}>Reconnect</Button>;
}
