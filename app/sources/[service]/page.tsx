import { ArrowRight, ChevronRight, KeyRound, MessageSquareText } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ButtonLink } from "@/components/m3/button";
import { ServiceIcon } from "@/components/service-icon";
import manifest from "@/generated/manifest.json";
import { serviceApis } from "@/lib/apis";
import { getT } from "@/lib/i18n/server";
import { findService, serviceDatasets } from "@/lib/sources";
import { BackLink } from "../back-link";
import { DatasetItem } from "../dataset-item";
import { ApiDialog, ApiToolButton } from "../apis/api-dialog";

export async function generateMetadata({ params }: PageProps<"/sources/[service]">): Promise<Metadata> {
  const service = findService((await params).service);
  return service ? { title: service.title, description: service.description } : {};
}

export default async function ServicePage({ params, searchParams }: PageProps<"/sources/[service]">) {
  const id = (await params).service;
  const service = findService(id);
  if (!service) notFound();
  if (service.id !== id) permanentRedirect(`/sources/${service.id}`);
  const index = manifest.services.indexOf(service);
  const rows = await serviceDatasets(service.datasets);
  const apis = serviceApis(service.id);
  const t = await getT();
  const query = await searchParams;
  const chatOpen = query.chat === "1";
  const closeQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (["chat", "fullscreen", "panel", "minimized"].includes(key)) continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) closeQuery.append(key, item);
  }
  const closeHref = `/sources/${service.id}${closeQuery.size ? `?${closeQuery}` : ""}`;
  const chatQuery = new URLSearchParams(closeQuery);
  chatQuery.set("chat", "1");

  return (
    <>
      <BackLink href="/sources">{t("Data sources")}</BackLink>
      <section className="flex flex-col gap-6 rounded-xl bg-surface-container-low p-6 md:flex-row md:items-center md:p-8">
        <ServiceIcon id={service.id} index={index} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="type-headline-large">{service.title}</h1>
          <p className="mt-2 max-w-2xl type-body-large text-on-surface-variant">{service.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {service.tools.length ? <ButtonLink href={`/sources/${service.id}?${chatQuery}`} scroll={false} icon={<MessageSquareText size={18} />}>{t("Chat")}</ButtonLink> : null}
          <ButtonLink href="/keys" variant="outlined" icon={<KeyRound size={18} />}>{t("Get an API key")}</ButtonLink>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 type-title-large">{t("Tools")}</h2>
        <p className="mb-4 type-body-medium text-on-surface-variant">{t("What your assistant can call through this service.")}</p>
        <ul className="stagger grid gap-3 md:grid-cols-2">
          {service.tools.map((tool) => (
            <li key={tool.name} className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4">
              <code className="self-start rounded-xs bg-secondary-container px-2 py-0.5 font-mono text-[13px] text-on-secondary-container">{tool.name}</code>
              <p className="type-body-medium text-on-surface-variant">{tool.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 type-title-large">{t("APIs")}</h2>
        <p className="mb-4 type-body-medium text-on-surface-variant">{t("Upstream APIs this service implements, by their tracker id.")}</p>
        <ul className="stagger grid gap-3 md:grid-cols-2">
          {apis.map((api) => (
            <li key={api.id}>
              <Link href={`/sources/apis?api=${api.id}`} className="state-layer flex h-full items-center gap-3 rounded-lg border border-outline-variant p-4 text-on-surface">
                <code className="shrink-0 rounded-xs bg-surface-container-high px-2 py-0.5 font-mono text-[13px] text-on-surface-variant">{api.id}</code>
                <span className="min-w-0 flex-1 type-title-small">{api.title}</span>
                <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 type-title-large">{t("Source datasets")}</h2>
        <p className="mb-4 type-body-medium text-on-surface-variant">{t("Published on DATA.GOV.HK and fetched live when a tool is called.")}</p>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => <DatasetItem key={row.id} dataset={row} showProvider />)}
        </ul>
      </section>

      <div className="mt-10">
        <ButtonLink href="/sources/providers" variant="text">
          {t("Browse every DATA.GOV.HK provider")} <ArrowRight size={16} />
        </ButtonLink>
      </div>
      {chatOpen && service.tools.length ? (
        <ApiDialog apiId={service.id} serviceId={service.id} title={service.title} description={service.description} closeHref={closeHref} canChat>
          <section>
            <h3 className="mb-2 type-title-medium">{t("Available tools")}</h3>
            <ul className="flex flex-col gap-2">
              {service.tools.map((tool) => (
                <li key={tool.name} className="rounded-md border border-outline-variant p-3">
                  <ApiToolButton name={tool.name} />
                  <p className="mt-1 type-body-small text-on-surface-variant">{tool.description}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-5">
            <h3 className="mb-2 type-title-medium">{t("Display tools")}</h3>
            <div className="flex flex-wrap gap-3"><ApiToolButton name="show_ui" /><ApiToolButton name="show_tool_ui" /><ApiToolButton name="show_map" /></div>
          </section>
        </ApiDialog>
      ) : null}
    </>
  );
}
