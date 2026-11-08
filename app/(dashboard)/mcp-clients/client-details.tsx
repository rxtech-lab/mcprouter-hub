import { clientAccount, clientTools } from "@/lib/external-mcp/details";
import { ReloadClientTools, RetryClientDetails } from "./client-dialog";

export async function ClientDetails({ userId, id, tab }: { userId: string; id: string; tab: "tools" | "account" }) {
  if (tab === "account") {
    const result = await clientAccount(userId, id);
    return <section aria-label="Connected account" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
      <h3 className="type-title-medium">Connected account</h3>
      {result.account ? <dl className="space-y-3">
        {result.account.name && <div><dt className="type-label-medium text-on-surface-variant">Name</dt><dd className="break-words">{result.account.name}</dd></div>}
        {result.account.email && <div><dt className="type-label-medium text-on-surface-variant">Email</dt><dd className="break-all">{result.account.email}</dd></div>}
        <div><dt className="type-label-medium text-on-surface-variant">Account ID</dt><dd className="break-all">{result.account.subject}</dd></div>
      </dl> : <div className="space-y-3"><p className="text-on-surface-variant">{result.message}</p><RetryClientDetails /></div>}
    </section>;
  }
  const result = await clientTools(userId, id);
  return <section aria-label="Available tools" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2"><h3 className="type-title-medium">Available tools{!result.error && ` (${result.tools.length})`}</h3><ReloadClientTools id={id} /></div>
    <p className="shrink-0 type-body-small text-on-surface-variant">Tools are cached for 2 hours. Reload to check for changes.</p>
    {result.error ? <div className="min-h-0 overflow-y-auto"><p role="alert" className="text-error">{result.error}</p></div> : result.tools.length ? <ul aria-label="MCP tools" tabIndex={0} className="min-h-0 flex-1 divide-y divide-outline-variant overflow-y-auto overscroll-contain pr-2">{result.tools.map((tool) => <li key={tool.name} className="space-y-1 py-4 first:pt-0">
      <h4 className="type-title-small break-words">{tool.title || tool.name}</h4>
      {tool.title && <p className="type-body-small break-all text-on-surface-variant">{tool.name}</p>}
      {tool.description && <p className="type-body-medium whitespace-pre-wrap break-words text-on-surface-variant">{tool.description}</p>}
    </li>)}</ul> : <p className="text-on-surface-variant">This MCP client has no available tools.</p>}
  </section>;
}
