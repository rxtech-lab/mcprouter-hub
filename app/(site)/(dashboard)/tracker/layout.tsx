import { PageHeader } from "@/components/m3/page-header";
import { LinkTabs } from "@/components/m3/tabs";
import { getT } from "@/lib/i18n/server";

export default async function TrackerLayout({ children }: LayoutProps<"/tracker">) {
  const t = await getT();
  return (
    <>
      <PageHeader
        title={t("Conversion tracker")}
        description={t("How much of the DATA.GOV.HK catalogue mcprouter serves as MCP tools. Converted datasets come from the service YAML files.")}
      />
      <LinkTabs
        label={t("Tracker views")}
        tabs={[
          { href: "/tracker", label: t("Overview") },
          { href: "/tracker/categories", label: t("Categories") },
          { href: "/tracker/providers", label: t("Providers") },
          { href: "/tracker/datasets", label: t("Datasets") },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
