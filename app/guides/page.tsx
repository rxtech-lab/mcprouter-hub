import Link from "@/components/localized-link";
import { MCP_CLIENTS } from "@/lib/mcp-clients";
import { getT } from "@/lib/i18n/server";
import { seoMetadata } from "@/lib/seo";
import { serviceContent } from "@/lib/service-content";

export async function generateMetadata() {
  const t = await getT();
  return seoMetadata(t("MCP Setup Guides & Hong Kong Data Use Cases"), t("Connect your AI client to MCPRouter and explore Hong Kong transport, weather, air quality and economic data."));
}

export default async function GuidesPage() {
  const t = await getT();
  return <>
    <h1 className="type-headline-large">{t("Setup guides")}</h1>
    <p className="mt-3 max-w-2xl type-body-large text-on-surface-variant">{t("Connect your AI client to MCPRouter and explore Hong Kong transport, weather, air quality and economic data.")}</p>
    <ul className="stagger mt-8 grid gap-3 sm:grid-cols-2">{MCP_CLIENTS.map((client) => <li key={client.id}>
      <Link href={`/guides/${client.id}`} className="state-layer flex h-full flex-col gap-2 rounded-lg bg-surface-container-low p-5">
        <h2 className="type-title-large">{t(client.name)}</h2><p className="type-body-medium text-on-surface-variant">{t(client.kind)}</p>
      </Link>
    </li>)}</ul>
    <section className="mt-10">
      <h2 className="type-title-large">{t("Hong Kong data use cases")}</h2>
      <p className="mt-3 type-body-large text-on-surface-variant">{t("Start with a service below for example questions, available tools and source limitations.")}</p>
      <ul className="mt-4 space-y-3">{Object.entries(serviceContent).map(([id, content]) => <li key={id}><Link className="type-body-large text-primary hover:underline" href={`/sources/${id}`}>{t(content.title)}</Link></li>)}</ul>
    </section>
  </>;
}
