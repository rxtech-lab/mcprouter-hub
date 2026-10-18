import { Globe, ListChecks, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import { services } from "@/generated/registry";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle, StatCard } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { PageHeader } from "@/components/m3/page-header";
import { ServiceIcon } from "@/components/service-icon";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { exposedServices, getExposure, isOpenExposure, serviceExposure, type ServiceExposure } from "@/lib/mcp/exposure";
import { REGION_NAMES, REGIONS } from "@/lib/regions";
import { NO_SERVICES } from "@/lib/service-selection";
import { serviceSelection } from "@/lib/service-scopes";
import { SettingsDialogs, type OpenDialog, type ServiceOption } from "./settings-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Settings") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

/** The dialog in the URL: `?edit=regions|services|reset`, or `?tools=<service id>`. */
function openDialog(raw: Record<string, string | string[] | undefined>, options: ServiceOption[]): OpenDialog | undefined {
  const tools = first(raw.tools);
  const service = tools ? options.find((option) => option.id === tools) : undefined;
  if (service) return { kind: "tools", service };
  const edit = first(raw.edit);
  return edit === "regions" || edit === "services" || edit === "reset" ? { kind: edit } : undefined;
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requirePageUser();
  const t = await getT();
  const exposure = await getExposure(user.id);
  const exposed = exposedServices(services, exposure);
  const exposedTools = new Set(exposed.flatMap((service) => service.tools.map((tool) => tool.name)));
  const totalTools = services.reduce((sum, service) => sum + service.tools.length, 0);

  const options: ServiceOption[] = services.map((service) => ({
    id: service.id,
    title: service.title,
    region: service.region,
    tools: service.tools.map((tool) => ({ name: tool.name, title: tool.title ?? tool.name, hidden: exposure.hiddenTools.includes(tool.name) })),
  }));
  const dialog = openDialog(await searchParams, options);

  const status: Record<ServiceExposure, { label: string; tone: "success" | "neutral" }> = {
    exposed: { label: t("Exposed"), tone: "success" },
    region: { label: t("Region hidden"), tone: "neutral" },
    service: { label: t("Hidden"), tone: "neutral" },
    tools: { label: t("All tools hidden"), tone: "neutral" },
  };
  const regionNames = (ids: readonly string[]) => ids.map((id) => t(REGION_NAMES[id as keyof typeof REGION_NAMES] ?? id)).join(", ");

  return (
    <>
      <PageHeader
        title={t("Settings")}
        description={t("Choose which regions, services and tools your MCP endpoints expose. This applies to every API key, OAuth app and the agent; a key limited to some services narrows it further.")}
        actions={
          isOpenExposure(exposure) ? null : (
            <ButtonLink variant="text" href="/settings?edit=reset" scroll={false} icon={<RotateCcw size={18} />}>
              {t("Expose everything")}
            </ButtonLink>
          )
        }
      />

      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Regions")} value={exposure.regions.length ? regionNames(exposure.regions) : t("All")} icon={<Globe size={18} />} />
        <StatCard label={t("Services exposed")} value={`${exposed.length} / ${services.length}`} icon={<SlidersHorizontal size={18} />} />
        <StatCard label={t("Tools exposed")} value={`${exposedTools.size} / ${totalTools}`} icon={<ListChecks size={18} />} />
      </div>

      <div className="stagger mt-6 flex flex-col gap-4">
        <Card className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle>{t("Regions")}</CardTitle>
            <p className="type-body-medium text-on-surface-variant">
              {exposure.regions.length
                ? t("Only services from {regions} are exposed.", { regions: regionNames(exposure.regions) })
                : t("Services from every region are exposed, including regions added later: {regions}.", { regions: regionNames(REGIONS) })}
            </p>
          </div>
          <ButtonLink variant="tonal" href="/settings?edit=regions" scroll={false} icon={<Globe size={18} />}>
            {t("Change regions")}
          </ButtonLink>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle>{t("Services and tools")}</CardTitle>
              <p className="type-body-medium text-on-surface-variant">
                {exposure.services.includes(NO_SERVICES)
                  ? t("No services are exposed, so MCP clients and the agent have no tools. Choose services to expose some.")
                  : exposure.services.length
                  ? t("Only the services you picked are exposed. New services stay hidden until you add them.")
                  : t("Every service is exposed, including new ones. Pick some to expose only those.")}
              </p>
            </div>
            <ButtonLink variant="tonal" href="/settings?edit=services" scroll={false} icon={<SlidersHorizontal size={18} />}>
              {t("Choose services")}
            </ButtonLink>
          </div>
          <ul className="stagger divide-y divide-outline-variant" data-testid="exposure-list">
            {services.map((service, index) => {
              const state = serviceExposure(service, exposure);
              const visible = service.tools.filter((tool) => !exposure.hiddenTools.includes(tool.name)).length;
              return (
                <li key={service.id} className="flex flex-wrap items-center gap-3 py-3">
                  <ServiceIcon id={service.id} index={index} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="type-title-small">{service.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={status[state].tone}>{status[state].label}</Badge>
                      <Badge>{regionNames([service.region])}</Badge>
                      <span className="type-body-small text-on-surface-variant">
                        {t("{visible} of {total} tools", { visible, total: service.tools.length })}
                      </span>
                    </span>
                  </div>
                  <ButtonLink variant="outlined" href={`/settings?tools=${encodeURIComponent(service.id)}`} scroll={false} icon={<ListChecks size={18} />}>
                    {t("Choose tools")}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <SettingsDialogs
        // A new dialog in the URL starts the dialogs afresh, with that one's saved choices.
        key={dialog ? JSON.stringify(dialog) : "none"}
        open={dialog}
        exposedServices={serviceSelection(exposure.services)}
        regions={REGIONS.map((id) => ({ id, name: t(REGION_NAMES[id]) }))}
        exposure={exposure}
      />
    </>
  );
}
