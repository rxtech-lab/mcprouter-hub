import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, externalMcpClients } from "@/db";
import { requirePageUser } from "@/lib/auth";
import { ClientDialog, OAuthStatus, ReconnectClient } from "./client-dialog";

export const metadata = { title: "MCP clients" };
export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const query = await searchParams;
  const clients = await db.select({ id: externalMcpClients.id, name: externalMcpClients.name, url: externalMcpClients.url, connected: externalMcpClients.connected }).from(externalMcpClients).where(eq(externalMcpClients.userId, user.id)).orderBy(desc(externalMcpClients.createdAt));
  const remove = clients.find((client) => client.id === query.remove);
  return <div className="space-y-6 animate-pane-in">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="type-headline-large">MCP clients</h1><Link className="rounded-full bg-primary px-6 py-3 text-on-primary" href="/mcp-clients?connect=1">Connect MCP client</Link></header>
    <p className="text-on-surface-variant">External OAuth connections shared by your agents and scheduled tasks.</p>
    <OAuthStatus status={query.status} />
    <ul className="divide-y divide-outline-variant">{clients.map((client) => <li key={client.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><h2 className="type-title-medium">{client.name}</h2><p className="break-all type-body-small text-on-surface-variant">{client.url}</p><p>{client.connected ? "Connected" : "Authorization required"}</p></div><div className="flex items-center gap-4"><ReconnectClient client={client} /><Link href={`/mcp-clients?remove=${client.id}`}>Disconnect</Link></div></li>)}</ul>
    {!clients.length && <p>No external MCP clients connected yet.</p>}
    {query.connect === "1" ? <ClientDialog /> : remove ? <ClientDialog remove={remove} /> : null}
  </div>;
}
