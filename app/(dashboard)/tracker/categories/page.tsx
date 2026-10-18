import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { summarise } from "@/lib/tracker";
import { loadTrackerRows } from "@/lib/tracker-data";
import { datasetsHref, parseGroupParams } from "../params";
import { GroupGrid, NotSynced } from "../tracker-ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tracker · Categories") };
}

export default async function TrackerCategoriesPage({ searchParams }: PageProps<"/tracker/categories">) {
  await requirePageUser();
  const t = await getT();
  const params = parseGroupParams(await searchParams);
  const rows = await loadTrackerRows();
  if (rows.length === 0) return <NotSynced />;
  return (
    <GroupGrid
      groups={summarise(rows).byCategory}
      path="/tracker/categories"
      query={params.q}
      page={params.page}
      noun={(count) => t.plural("category", "categories", count)}
      searchLabel={t("Search categories")}
      empty={t("No categories match “{query}”", { query: params.q ?? "" })}
      placeholder={t("Search categories")}
      hrefFor={(group) => datasetsHref({ category: group.key })}
    />
  );
}
