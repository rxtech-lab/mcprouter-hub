import { notFound, permanentRedirect } from "next/navigation";
import { ButtonLink } from "@/components/m3/button";
import Link from "@/components/localized-link";
import { SeoBreadcrumbs } from "@/components/seo-breadcrumbs";
import { findApi, API_STATUS_LABELS } from "@/lib/apis";
import { getT } from "@/lib/i18n/server";
import { localizedHref } from "@/lib/i18n/routing";
import { seoMetadata } from "@/lib/seo";
import manifest from "@/generated/manifest.json";

export async function generateMetadata({ params }: PageProps<"/sources/api/[id]">) {
  const api = findApi((await params).id);
  if (!api) return {};
  const metadata = await seoMetadata(`${api.title} API${api.status === "implemented" ? " & MCP Tools" : ""}`, api.description, `/sources/api/${api.id}`);
  return { ...metadata, ...(api.status === "coming-soon" ? { robots: { index: false, follow: true } } : {}) };
}

export default async function ApiPage({ params }: PageProps<"/sources/api/[id]">) {
  const { id } = await params;
  const api = findApi(id);
  if (!api) notFound();
  const t = await getT();
  if (api.id !== id) permanentRedirect(localizedHref(`/sources/api/${api.id}`, t.locale));
  const services = manifest.services.filter((service) => api.services.includes(service.id));
  return <>
    <SeoBreadcrumbs items={[{ name: "MCPRouter", href: "/" }, { name: t("APIs"), href: "/sources/apis" }, { name: api.title, href: `/sources/api/${api.id}` }]} />
    <h1 className="type-headline-large">{api.title}</h1>
    <p className="mt-3 max-w-3xl type-body-large text-on-surface-variant">{api.description}</p>
    <p className="mt-4 type-body-medium">{api.provider} · {api.id} · {t(API_STATUS_LABELS[api.status])}</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <ButtonLink href={api.docs} target="_blank" rel="noreferrer">{t("API docs")}</ButtonLink>
      {services.length ? <ButtonLink href="/guides" variant="outlined">{t("Setup guides")}</ButtonLink> : null}
    </div>
    <section className="mt-10">
      <h2 className="type-title-large">{t("Available tools")}</h2>
      {services.length ? <ul className="stagger mt-4 space-y-4">{services.map((service) => <li key={service.id} className="rounded-lg bg-surface-container-low p-5">
        <Link href={`/sources/${service.id}`} className="type-title-medium text-primary hover:underline">{service.title}</Link>
        <p className="mt-2 type-body-medium text-on-surface-variant">{service.description}</p>
      </li>)}</ul> : <p className="mt-3 type-body-large">{t("Coming soon")}</p>}
    </section>
    <section className="mt-10">
      <h2 className="type-title-large">{t("Source datasets")}</h2>
      <ul className="mt-4 space-y-3">{api.datasets.map((id) => <li key={id}><a className="break-all text-primary hover:underline" href={`https://data.gov.hk/en-data/dataset/${id}`} target="_blank" rel="noreferrer">{id}</a></li>)}</ul>
    </section>
  </>;
}
