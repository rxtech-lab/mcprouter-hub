import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db, externalMcpClients } from "@/db";
import { requirePageUser } from "@/lib/auth";
import { ClientDetailsDialog, ClientDialog, OAuthStatus, ReconnectClient } from "./client-dialog";
import { ClientDetails } from "./client-details";

export const metadata = { title: "MCP clients" };
export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const query = await searchParams;
  const clients = await db.select({ id: externalMcpClients.id, name: externalMcpClients.name, url: externalMcpClients.url, connected: externalMcpClients.connected }).from(externalMcpClients).where(eq(externalMcpClients.userId, user.id)).orderBy(desc(externalMcpClients.createdAt));
  const remove = clients.find((client) => client.id === query.remove);
  const selected = clients.find((client) => client.id === query.client);
  const tab = query.tab === "account" ? "account" : "tools";
  return <div className="space-y-6 animate-pane-in">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="type-headline-large">MCP clients</h1><Link className="rounded-full bg-primary px-6 py-3 text-on-primary" href="/mcp-clients?connect=1">Connect MCP client</Link></header>
    <p className="text-on-surface-variant">External OAuth connections shared by your agents and scheduled tasks.</p>
    <OAuthStatus status={query.status} />
    <ul className="divide-y divide-outline-variant">{clients.map((client) => <li key={client.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><Link prefetch={false} href={`/mcp-clients?client=${client.id}&tab=tools`} aria-label={`View ${client.name} tools and account`} className="group flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg p-3 -ml-3 transition-colors duration-200 hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><div className="min-w-0"><h2 className="type-title-medium group-hover:text-primary">{client.name}</h2><p className="break-all type-body-small text-on-surface-variant">{client.url}</p><p>{client.connected ? "Connected" : "Authorization required"}</p><p className="mt-1 type-label-medium text-primary">View tools and account</p></div><ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" /></Link><div className="flex items-center gap-4"><ReconnectClient client={client} /><Link href={`/mcp-clients?remove=${client.id}`}>Disconnect</Link></div></li>)}</ul>
    {!clients.length && <p>No external MCP clients connected yet.</p>}
    {query.connect === "1" ? <ClientDialog /> : remove ? <ClientDialog remove={remove} /> : selected ? <ClientDetailsDialog name={selected.name}>
      <p className="line-clamp-2 shrink-0 break-all type-body-small text-on-surface-variant" title={selected.url}>{selected.url}</p>
      <p className="mt-2 shrink-0 type-label-medium">{selected.connected ? "Connected" : "Authorization required"}</p>
      <nav aria-label="MCP client details" className="my-6 flex shrink-0 border-b border-outline-variant">{(["tools", "account"] as const).map((item) => <Link key={item} prefetch={false} scroll={false} aria-current={tab === item ? "page" : undefined} href={`/mcp-clients?client=${selected.id}&tab=${item}`} className={`flex-1 border-b-2 px-4 py-3 text-center type-label-large transition-colors duration-200 ${tab === item ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-surface-container"}`}>{item === "tools" ? "Tools" : "Account"}</Link>)}</nav>
      <Suspense key={`${selected.id}-${tab}`} fallback={<p role="status" className="py-6 text-on-surface-variant">{tab === "tools" ? "Loading tools…" : "Loading account…"}</p>}><ClientDetails userId={user.id} id={selected.id} tab={tab} /></Suspense>
    </ClientDetailsDialog> : null}
  </div>;
}
