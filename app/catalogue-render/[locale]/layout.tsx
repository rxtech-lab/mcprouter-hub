import { notFound } from "next/navigation";
import SiteDocument, { generateMetadata as siteMetadata } from "@/app/(site)/layout";
import { isLocale } from "@/lib/i18n/config";
import { catalogueRender } from "@/lib/i18n/server";

type Props = LayoutProps<"/catalogue-render/[locale]">;

async function selectLocale(params: Props["params"]) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  catalogueRender().locale = locale;
}

export async function generateMetadata({ params }: Props) {
  await selectLocale(params);
  return siteMetadata();
}

export default async function CatalogueDocument({ params, children }: Props) {
  await selectLocale(params);
  return <SiteDocument params={params}>{children}</SiteDocument>;
}
