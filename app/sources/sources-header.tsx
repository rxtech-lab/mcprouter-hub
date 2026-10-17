import { LinkTabs } from "@/components/m3/tabs";
import manifest from "@/generated/manifest.json";
import { catalogueTotals } from "@/lib/sources";
import { formatNumber } from "@/lib/format";

/** Title and tabs shared by the Services and Providers lists. */
export async function SourcesHeader() {
  const totals = await catalogueTotals();
  return (
    <div className="mb-6">
      <h1 className="type-headline-large md:type-display-small">Data sources</h1>
      <p className="mt-2 max-w-2xl type-body-large text-on-surface-variant">
        mcprouter turns DATA.GOV.HK datasets into MCP tools.
        {totals.datasets ? ` The catalogue has ${formatNumber(totals.datasets)} datasets from ${formatNumber(totals.providers)} government departments and organisations.` : ""}
      </p>
      <div className="mt-6">
        <LinkTabs
          label="Data source views"
          tabs={[
            { href: "/sources", label: "Services", count: manifest.services.length },
            { href: "/sources/providers", label: "Providers", count: totals.providers || undefined },
          ]}
        />
      </div>
    </div>
  );
}
