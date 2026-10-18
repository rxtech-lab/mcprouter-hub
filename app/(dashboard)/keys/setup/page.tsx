import Link from "next/link";
import { KeyRound, LogIn } from "lucide-react";
import { z } from "zod";
import { ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { CodeBlock } from "@/components/m3/code-block";
import { cn } from "@/components/m3/cn";
import { PageHeader } from "@/components/m3/page-header";
import { listHref } from "@/app/sources/params";
import { requirePageUser } from "@/lib/auth";
import { KEY_PLACEHOLDER, MCP_CLIENTS, mcpClientById, type SetupStep } from "@/lib/mcp-clients";
import { siteUrl } from "@/lib/site";
import { KeysTabs } from "../keys-tabs";

export const metadata = { title: "Set up a client" };

const paramsSchema = z.object({
  client: z.string().optional().catch(undefined),
  auth: z.enum(["oauth", "key"]).catch("oauth"),
});

export default async function SetupPage({ searchParams }: PageProps<"/keys/setup">) {
  await requirePageUser();
  const raw = await searchParams;
  const params = paramsSchema.parse(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  const client = mcpClientById(params.client) ?? MCP_CLIENTS[0];
  const auth = client.apiKey ? params.auth : "oauth";
  const endpoint = `${await siteUrl()}/api/mcp/mcp`;
  const steps = auth === "key" && client.apiKey ? client.apiKey(endpoint, KEY_PLACEHOLDER) : client.oauth(endpoint);
  const href = (values: { client?: string; auth?: string }) =>
    listHref("/keys/setup", { client: values.client ?? client.id, auth: values.auth === "key" ? "key" : undefined });

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys let MCP clients call mcprouter on your behalf. Clients that support OAuth can sign in instead. Each tool call counts against your plan."
      />
      <KeysTabs />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav aria-label="Clients" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {MCP_CLIENTS.map((option) => {
            const active = option.id === client.id;
            return (
              <Link
                key={option.id}
                href={href({ client: option.id, auth })}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "state-layer flex shrink-0 flex-col rounded-full px-4 py-2 transition-colors duration-200 ease-emphasized md:rounded-md",
                  active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                )}
              >
                <span className="type-label-large">{option.name}</span>
                <span className="hidden type-body-small opacity-80 md:block">{option.kind}</span>
              </Link>
            );
          })}
        </nav>

        <Card key={`${client.id}-${auth}`} className="animate-fade-through flex min-w-0 flex-col gap-5" data-testid="client-guide">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="type-title-large">{client.name}</h2>
              <p className="type-body-medium text-on-surface-variant">{client.kind}</p>
            </div>
            {client.apiKey ? (
              <nav aria-label="Sign-in method" className="flex rounded-full border border-outline">
                {(
                  [
                    { value: "oauth", label: "Sign in", icon: <LogIn size={16} /> },
                    { value: "key", label: "API key", icon: <KeyRound size={16} /> },
                  ] as const
                ).map((option, index) => (
                  <Link
                    key={option.value}
                    href={href({ auth: option.value })}
                    aria-current={auth === option.value ? "page" : undefined}
                    scroll={false}
                    className={cn(
                      "state-layer flex h-10 items-center gap-2 px-4 type-label-large transition-colors duration-200",
                      index === 0 ? "rounded-l-full" : "rounded-r-full border-l border-outline",
                      auth === option.value ? "bg-secondary-container text-on-secondary-container" : "text-on-surface",
                    )}
                  >
                    {option.icon}
                    {option.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          <p className="type-body-medium text-on-surface-variant">
            {auth === "key" ? (
              <>
                Replace <code className="font-mono text-on-surface">{KEY_PLACEHOLDER}</code> with a key from the API keys tab. New keys show these steps with the key filled in.
              </>
            ) : (
              "You sign in to mcprouter and approve access, with no key to copy. Manage or disconnect the client under Connected apps."
            )}
          </p>

          <Steps steps={steps} />

          {client.note ? <p className="rounded-sm bg-surface-container p-3 type-body-medium text-on-surface-variant">{client.note}</p> : null}

          {auth === "key" ? (
            <div>
              <ButtonLink href="/keys" variant="tonal" icon={<KeyRound size={18} />}>
                Create a key
              </ButtonLink>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

function Steps({ steps }: { steps: SetupStep[] }) {
  return (
    <ol className="stagger flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container type-label-large text-on-primary-container tabular-nums">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <p className="type-body-large">{step.text}</p>
            {step.code ? <CodeBlock code={step.code} what="Copied" /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
