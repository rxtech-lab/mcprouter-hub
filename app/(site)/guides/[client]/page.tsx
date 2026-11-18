import { notFound } from "next/navigation";
import { SetupSteps } from "@/components/setup-steps";
import { SeoBreadcrumbs } from "@/components/seo-breadcrumbs";
import { ButtonLink } from "@/components/m3/button";
import { SnackbarProvider } from "@/components/m3/snackbar";
import { mcpClientById } from "@/lib/mcp-clients";
import { getT } from "@/lib/i18n/server";
import { seoMetadata, seoOrigin } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/guides/[client]">) {
  const client = mcpClientById((await params).client);
  if (!client) return {};
  const t = await getT();
  return seoMetadata(t("Connect {client} to MCPRouter", { client: t(client.name) }), t("Set up MCPRouter with OAuth or an API key to access Hong Kong open data from your AI client."));
}

export default async function ClientGuide({ params, searchParams }: PageProps<"/guides/[client]">) {
  const client = mcpClientById((await params).client);
  if (!client) notFound();
  const t = await getT();
  const title = t("Connect {client} to MCPRouter", { client: t(client.name) });
  const method = (await searchParams).method === "api-key" && client.apiKey ? "api-key" : "oauth";
  const endpoint = `${seoOrigin()}/api/mcp/streamable`;
  const steps = method === "api-key" && client.apiKey ? client.apiKey(endpoint, "mcpr_your_key") : client.oauth(endpoint);
  return <>
    <SeoBreadcrumbs items={[{ name: "MCPRouter", href: "/" }, { name: t("Setup guides"), href: "/guides" }, { name: t(client.name), href: `/guides/${client.id}` }]} />
    <h1 className="type-headline-large">{title}</h1>
    <p className="mt-3 type-body-large text-on-surface-variant">{t("Set up MCPRouter with OAuth or an API key to access Hong Kong open data from your AI client.")}</p>
    {client.apiKey ? <nav className="my-6 flex gap-3" aria-label={t("Authentication")}>
      <ButtonLink href={`/guides/${client.id}`} variant={method === "oauth" ? "filled" : "outlined"}>OAuth</ButtonLink>
      <ButtonLink href={`/guides/${client.id}?method=api-key`} variant={method === "api-key" ? "filled" : "outlined"}>{t("API key")}</ButtonLink>
    </nav> : null}
    <section className="mt-8"><SnackbarProvider><SetupSteps steps={steps} /></SnackbarProvider></section>
    {client.note ? <p className="mt-6 rounded-lg bg-secondary-container p-4 type-body-medium text-on-secondary-container">{t(client.note)}</p> : null}
    <div className="mt-8 flex flex-wrap gap-3">
      <ButtonLink href={method === "api-key" ? "/keys" : "/login"}>{method === "api-key" ? t("Get an API key") : t("Sign in")}</ButtonLink>
      <ButtonLink href="/sources" variant="outlined">{t("Data sources")}</ButtonLink>
    </div>
  </>;
}
