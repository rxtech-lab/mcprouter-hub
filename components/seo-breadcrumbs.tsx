import Link from "@/components/localized-link";
import { StructuredData } from "@/components/structured-data";
import { getLocale } from "@/lib/i18n/server";
import { localizedHref } from "@/lib/i18n/routing";
import { seoOrigin } from "@/lib/seo";

export async function SeoBreadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const locale = await getLocale();
  return <>
    <nav aria-label="Breadcrumb" className="mb-5 type-body-small text-on-surface-variant">
      <ol className="flex flex-wrap gap-2">{items.map((item, index) => <li key={item.href}>
        {index ? <span aria-hidden="true" className="mr-2">/</span> : null}
        {index === items.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.href} className="text-primary hover:underline">{item.name}</Link>}
      </li>)}</ol>
    </nav>
    <StructuredData data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name, item: `${seoOrigin()}${localizedHref(item.href, locale)}`,
    })) }} />
  </>;
}
