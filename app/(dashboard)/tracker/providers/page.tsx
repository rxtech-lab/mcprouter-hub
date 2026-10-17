import { requirePageUser } from "@/lib/auth";
import { summarise } from "@/lib/tracker";
import { loadTrackerRows } from "@/lib/tracker-data";
import { datasetsHref, parseGroupParams } from "../params";
import { GroupGrid, NotSynced } from "../tracker-ui";

export const metadata = { title: "Tracker · Providers" };

export default async function TrackerProvidersPage({ searchParams }: PageProps<"/tracker/providers">) {
  await requirePageUser();
  const params = parseGroupParams(await searchParams);
  const rows = await loadTrackerRows();
  if (rows.length === 0) return <NotSynced />;
  return (
    <GroupGrid
      groups={summarise(rows).byProvider}
      path="/tracker/providers"
      query={params.q}
      page={params.page}
      noun={["provider", "providers"]}
      placeholder="Search departments and organisations"
      hrefFor={(group) => datasetsHref({ provider: group.key })}
    />
  );
}
