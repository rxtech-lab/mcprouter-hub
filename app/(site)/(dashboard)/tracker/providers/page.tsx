import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { summarise } from "@/lib/tracker";
import { loadTrackerRows } from "@/lib/tracker-data";
import { datasetsHref, parseGroupParams } from "../params";
import { GroupGrid, NotSynced } from "../tracker-ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tracker · Providers") };
}

export default async function TrackerProvidersPage({ searchParams }: PageProps<"/tracker/providers">) {
  await requirePageUser();
  const t = await getT();
  const params = parseGroupParams(await searchParams);
  const rows = await loadTrackerRows();
  if (rows.length === 0) return <NotSynced />;
  return (
    <GroupGrid
      groups={summarise(rows).byProvider}
      path="/tracker/providers"
      query={params.q}
      page={params.page}
      noun={(count) => t.plural("provider", "providers", count)}
      searchLabel={t("Search providers")}
      empty={t("No providers match “{query}”", { query: params.q ?? "" })}
      placeholder={t("Search departments and organisations")}
      hrefFor={(group) => datasetsHref({ provider: group.key })}
    />
  );
}
