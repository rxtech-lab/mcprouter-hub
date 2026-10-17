import { z } from "zod";
import { services } from "@/generated/registry";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { SearchBar } from "@/components/m3/search-bar";
import { requirePageUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { listHref, parseListParams } from "@/app/sources/params";
import { ServicesView, type ServiceCard } from "./services-view";

export const metadata = { title: "Services" };

const PAGE_SIZE = 12;

/** Matches every word of the query against the service and its tools, so "bus eta" finds KMB. */
function matches(service: (typeof services)[number], query: string) {
  const haystack = [service.id, service.title, service.description ?? "", ...service.datasets, ...service.tools.flatMap((tool) => [tool.name, tool.title ?? "", tool.description])]
    .join(" ")
    .toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  await requirePageUser();
  const params = parseListParams(await searchParams);
  const origin = await siteUrl();
  const filtered = params.q ? services.filter((service) => matches(service, params.q!)) : services;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const cards: ServiceCard[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description ?? "",
    datasets: service.datasets,
    endpoint: `${origin}/api/mcp/s/${service.id}/mcp`,
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
        title="Services"
        description={`${services.length} services, ${toolCount} tools. Use the combined endpoint for everything, or a service endpoint for a smaller tool list.`}
      />
      <ServicesView services={cards} allEndpoint={`${origin}/api/mcp/mcp`}>
        <SearchBar action="/services" query={params.q} label="Search services" placeholder="Search services, tools and datasets" />
      </ServicesView>
      {cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={`No services match “${params.q}”`}>Try a shorter word, a tool name such as get_weather, or a dataset ID.</EmptyState>
        </div>
      ) : (
        <Pagination page={page} pageCount={pageCount} total={filtered.length} noun={filtered.length === 1 ? "service" : "services"} href={(next) => listHref("/services", { q: params.q, page: next })} />
      )}
    </>
  );
}
