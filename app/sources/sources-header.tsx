import { LinkTabs } from "@/components/m3/tabs";
import manifest from "@/generated/manifest.json";
import { apiTracker } from "@/lib/apis";
import { catalogueTotals } from "@/lib/sources";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

/** Title and tabs shared by the Services, APIs and Providers lists. */
export async function SourcesHeader() {
  const [totals, t] = await Promise.all([catalogueTotals(), getT()]);
  return (
    <div className="mb-6">
      <h1 className="type-headline-large md:type-display-small">{t("Data sources")}</h1>
      <p className="mt-2 max-w-2xl type-body-large text-on-surface-variant">
        {t("mcprouter turns DATA.GOV.HK datasets into MCP tools.")}
        {totals.datasets
          ? ` ${t("The catalogue has {datasets} datasets from {providers} government departments and organisations.", { datasets: formatNumber(totals.datasets, t.locale), providers: formatNumber(totals.providers, t.locale) })}`
          : ""}
      </p>
      <div className="mt-6">
        <LinkTabs
          label={t("Data source views")}
          tabs={[
            { href: "/sources", label: t("Services"), count: manifest.services.length },
            { href: "/sources/apis", label: t("APIs"), count: apiTracker.apis.length },
            { href: "/sources/providers", label: t("Providers"), count: totals.providers || undefined },
          ]}
        />
      </div>
    </div>
  );
}
