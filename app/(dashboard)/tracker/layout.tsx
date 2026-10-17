import { PageHeader } from "@/components/m3/page-header";
import { LinkTabs } from "@/components/m3/tabs";

export default function TrackerLayout({ children }: LayoutProps<"/tracker">) {
  return (
    <>
      <PageHeader title="Conversion tracker" description="How much of the DATA.GOV.HK catalogue mcprouter serves as MCP tools. Converted datasets come from the service YAML files." />
      <LinkTabs
        label="Tracker views"
        tabs={[
          { href: "/tracker", label: "Overview" },
          { href: "/tracker/categories", label: "Categories" },
          { href: "/tracker/providers", label: "Providers" },
          { href: "/tracker/datasets", label: "Datasets" },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
