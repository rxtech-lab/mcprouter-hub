import type { Metadata } from "next";
import { z } from "zod";
import { services } from "@/generated/registry";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { SearchBar } from "@/components/m3/search-bar";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { matchesService } from "@/lib/mcp/search";
import { siteUrl } from "@/lib/site";
import { listHref, parseListParams } from "@/app/sources/params";
import { ServicesView, type ServiceCard } from "./services-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Services") };
}

const PAGE_SIZE = 12;

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  await requirePageUser();
  const t = await getT();
  const params = parseListParams(await searchParams);
  const origin = await siteUrl();
  const filtered = params.q ? services.filter((service) => matchesService(service, params.q!)) : services;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const cards: ServiceCard[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description ?? "",
    datasets: service.datasets,
    endpoint: `${origin}/api/mcp/s/${service.id}/streamable`,
    tools: service.tools.map((tool) => ({
      name: tool.name,
      title: tool.title ?? tool.name,
      description: tool.description,
      schema: JSON.stringify(z.toJSONSchema(tool.inputSchema, { io: "input" }), null, 2),
    })),
  }));
  const toolCount = services.reduce((sum, service) => sum + service.tools.length, 0);

  return (
    <>
      <PageHeader
        title={t("Services")}
        description={t("{services} services, {tools} tools. Use the combined endpoint for everything, or a service endpoint for a smaller tool list.", { services: services.length, tools: toolCount })}
      />
      <ServicesView services={cards} allEndpoint={`${origin}/api/mcp/streamable`}>
        <SearchBar action="/services" query={params.q} label={t("Search services")} placeholder={t("Search services, tools and datasets")} />
      </ServicesView>
      {cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("No services match “{query}”", { query: params.q ?? "" })}>{t("Try a shorter word, a tool name such as get_weather, or a dataset ID.")}</EmptyState>
        </div>
      ) : (
        <Pagination page={page} pageCount={pageCount} total={filtered.length} noun={t.plural("service", "services", filtered.length)} href={(next) => listHref("/services", { q: params.q, page: next })} />
      )}
    </>
  );
}
