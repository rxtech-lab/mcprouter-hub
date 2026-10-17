import { requirePageUser } from "@/lib/auth";
import { summarise } from "@/lib/tracker";
import { loadTrackerRows } from "@/lib/tracker-data";
import { datasetsHref, parseGroupParams } from "../params";
import { GroupGrid, NotSynced } from "../tracker-ui";

export const metadata = { title: "Tracker · Categories" };

export default async function TrackerCategoriesPage({ searchParams }: PageProps<"/tracker/categories">) {
  await requirePageUser();
  const params = parseGroupParams(await searchParams);
  const rows = await loadTrackerRows();
  if (rows.length === 0) return <NotSynced />;
  return (
    <GroupGrid
      groups={summarise(rows).byCategory}
      path="/tracker/categories"
      query={params.q}
      page={params.page}
      noun={["category", "categories"]}
      placeholder="Search categories"
      hrefFor={(group) => datasetsHref({ category: group.key })}
    />
  );
}
