import { notFound } from "next/navigation";
import Services, { generateMetadata as servicesMetadata } from "@/app/(site)/sources/page";
import Apis, { generateMetadata as apisMetadata } from "@/app/(site)/sources/apis/page";
import SourcesLayout from "@/app/(site)/sources/layout";
import { isLocale } from "@/lib/i18n/config";
import { catalogueRender } from "@/lib/i18n/server";
import { catalogueVariantQuery } from "@/lib/public-cache";

export const dynamic = "error";
export const dynamicParams = true;
export const revalidate = 300;

// Generate on first use, so the production database is never needed at build time.
export function generateStaticParams() {
  return [];
}

type Props = PageProps<"/catalogue-render/[locale]/[view]/[variant]">;

async function catalogueProps(params: Props["params"]) {
  const { locale, view, variant } = await params;
  const query = catalogueVariantQuery(view, variant);
  if (!isLocale(locale) || query === null) notFound();
  Object.assign(catalogueRender(), { locale, path: view === "apis" ? "/sources/apis" : "/sources", query });
  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of new URLSearchParams(query)) values[key] ??= value;
  return { view, props: { params: Promise.resolve({}), searchParams: Promise.resolve(values) } };
}

export async function generateMetadata({ params }: Props) {
  const { view, props } = await catalogueProps(params);
  return view === "apis" ? apisMetadata(props) : servicesMetadata();
}

export default async function CataloguePage({ params }: Props) {
  const { view, props } = await catalogueProps(params);
  return <SourcesLayout params={props.params}>{view === "apis" ? <Apis {...props} /> : <Services />}</SourcesLayout>;
}
