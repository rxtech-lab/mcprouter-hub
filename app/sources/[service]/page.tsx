import { ArrowRight, ChevronRight, KeyRound, MessageSquareText } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ButtonLink } from "@/components/m3/button";
import { ServiceIcon } from "@/components/service-icon";
import manifest from "@/generated/manifest.json";
import { serviceApis } from "@/lib/apis";
import { freeChatConfig } from "@/lib/free-chat";
import { findService, serviceDatasets } from "@/lib/sources";
import { BackLink } from "../back-link";
import { DatasetItem } from "../dataset-item";

export async function generateMetadata({ params }: PageProps<"/sources/[service]">): Promise<Metadata> {
  const service = findService((await params).service);
  return service ? { title: service.title, description: service.description } : {};
}

export default async function ServicePage({ params }: PageProps<"/sources/[service]">) {
  const id = (await params).service;
  const service = findService(id);
  if (!service) notFound();
  if (service.id !== id) permanentRedirect(`/sources/${service.id}`);
  const index = manifest.services.indexOf(service);
  const rows = await serviceDatasets(service.datasets);
  const apis = serviceApis(service.id);

  return (
    <>
      <BackLink href="/sources">Data sources</BackLink>
      <section className="flex flex-col gap-6 rounded-xl bg-surface-container-low p-6 md:flex-row md:items-center md:p-8">
        <ServiceIcon id={service.id} index={index} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="type-headline-large">{service.title}</h1>
          <p className="mt-2 max-w-2xl type-body-large text-on-surface-variant">{service.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {freeChatConfig().enabled ? <ButtonLink href="/#try" icon={<MessageSquareText size={18} />}>Try it free</ButtonLink> : null}
          <ButtonLink href="/keys" variant="outlined" icon={<KeyRound size={18} />}>Get an API key</ButtonLink>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 type-title-large">Tools</h2>
        <p className="mb-4 type-body-medium text-on-surface-variant">What your assistant can call through this service.</p>
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
        <h2 className="mb-1 type-title-large">APIs</h2>
        <p className="mb-4 type-body-medium text-on-surface-variant">Upstream APIs this service implements, by their tracker id.</p>
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
        <h2 className="mb-1 type-title-large">Source datasets</h2>
        <p className="mb-4 type-body-medium text-on-surface-variant">Published on DATA.GOV.HK and fetched live when a tool is called.</p>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => <DatasetItem key={row.id} dataset={row} showProvider />)}
        </ul>
      </section>

      <div className="mt-10">
        <ButtonLink href="/sources/providers" variant="text">
          Browse every DATA.GOV.HK provider <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </>
  );
}
