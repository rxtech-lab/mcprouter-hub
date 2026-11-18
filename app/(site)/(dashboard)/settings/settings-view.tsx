"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/m3/button";
import { FilterChip } from "@/components/m3/chip";
import { ConfirmDialog, Dialog } from "@/components/m3/dialog";
import { ServiceCombobox } from "@/components/service-combobox";
import { useActionRunner } from "@/components/use-action-runner";
import { useT } from "@/lib/i18n/client";
import type { Exposure } from "@/lib/mcp/exposure";
import { selectionToScopes, type ServiceSelection } from "@/lib/service-selection";
import { resetExposure, updateExposedRegions, updateExposedServices, updateExposedTools } from "./actions";

export type ServiceOption = { id: string; title: string; region: string; tools: Array<{ name: string; title: string; hidden: boolean }> };
type RegionOption = { id: string; name: string };

/** The dialog the URL opens. */
export type OpenDialog = { kind: "regions" | "services" | "reset" } | { kind: "tools"; service: ServiceOption };

type SettingsDialogsProps = { open?: OpenDialog; exposedServices: ServiceSelection; regions: RegionOption[]; exposure: Exposure };

export function SettingsDialogs({ open, exposedServices, regions, exposure }: SettingsDialogsProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Dropping the query closes the dialog, so a reload doesn't reopen it.
  const close = () => router.replace(pathname, { scroll: false });

  if (!open) return null;
  switch (open.kind) {
    case "regions":
      return <RegionsDialog regions={regions} value={exposure.regions} onClose={close} />;
    case "services":
      return <ServicesDialog value={exposedServices} regions={exposure.regions} onClose={close} />;
    case "tools":
      return <ToolsDialog service={open.service} onClose={close} />;
    case "reset":
      return <ResetDialog onClose={close} />;
  }
}

/** Filter chips with an "All" chip that clears the selection, the way key scopes are picked. */
function ChipPicker({ legend, allLabel, options, value, onChange }: { legend: string; allLabel: string; options: Array<{ id: string; label: string }>; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 type-body-small text-on-surface-variant">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        <FilterChip selected={value.length === 0} onClick={() => onChange([])}>{allLabel}</FilterChip>
        {options.map((option) => {
          const selected = value.includes(option.id);
          return (
            <FilterChip key={option.id} selected={selected} onClick={() => onChange(selected ? value.filter((id) => id !== option.id) : [...value, option.id])}>
              {option.label}
            </FilterChip>
          );
        })}
      </div>
    </fieldset>
  );
}

function SaveActions({ pending, disabled, onClose, onSave }: { pending: boolean; disabled?: boolean; onClose: () => void; onSave: () => void }) {
  const t = useT();
  return (
    <>
      <Button variant="text" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
      <Button disabled={pending || disabled} onClick={onSave}>{pending ? t("Saving…") : t("Save")}</Button>
    </>
  );
}

function RegionsDialog({ regions, value, onClose }: { regions: RegionOption[]; value: string[]; onClose: () => void }) {
  const [selected, setSelected] = useState(value);
  const { pending, run } = useActionRunner();
  const t = useT();
  const save = () => run(() => updateExposedRegions({ regions: selected }), { progress: t("Saving regions…"), success: t("Regions updated") }, onClose);
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Change regions")}
      description={t("Expose only services whose data comes from these regions. Choose All to include regions added later.")}
      actions={<SaveActions pending={pending} onClose={onClose} onSave={save} />}
    >
      <ChipPicker
        legend={t("Regions to expose")}
        allLabel={t("All regions")}
        options={regions.map((region) => ({ id: region.id, label: region.name }))}
        value={selected}
        onChange={setSelected}
      />
    </Dialog>
  );
}

function ServicesDialog({ value, regions, onClose }: { value: ServiceSelection; regions: string[]; onClose: () => void }) {
  const [selected, setSelected] = useState(value);
  const { pending, run } = useActionRunner();
  const t = useT();
  const save = () => run(() => updateExposedServices({ services: selectionToScopes(selected) }), { progress: t("Saving services…"), success: t("Services updated") }, onClose);
  const outsideRegion = (selected === "all" ? [] : selected).filter((service) => regions.length && !regions.includes(service.region));
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Choose services")}
      description={t("MCP clients and the agent see only these services. Choose All to expose every service, including new ones.")}
      actions={<SaveActions pending={pending} onClose={onClose} onSave={save} />}
    >
      <div className="flex flex-col gap-3">
        <ServiceCombobox legend={t("Services to expose")} allLabel={t("All services")} value={selected} onChange={setSelected} disabled={pending} />
        {outsideRegion.length ? (
          <p className="type-body-small text-on-surface-variant" role="status">
            {t.plural("{count} of these is outside the regions you expose, so it stays hidden.", "{count} of these are outside the regions you expose, so they stay hidden.", outsideRegion.length)}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function ToolsDialog({ service, onClose }: { service: ServiceOption; onClose: () => void }) {
  const [visible, setVisible] = useState(() => service.tools.filter((tool) => !tool.hidden).map((tool) => tool.name));
  const { pending, run } = useActionRunner();
  const t = useT();
  const save = () => run(() => updateExposedTools({ service: service.id, tools: visible }), { progress: t("Saving tools…"), success: t("Tools updated") }, onClose);
  const allSelected = visible.length === service.tools.length;
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Choose tools")}
      description={t("Tools of {service} that MCP clients and the agent can call.", { service: service.title })}
      actions={
        <>
          {/* Unselecting all makes it quick to keep just one or two; saving still needs at least one. */}
          <Button variant="text" className="mr-auto" disabled={pending} onClick={() => setVisible(allSelected ? [] : service.tools.map((tool) => tool.name))}>
            {allSelected ? t("Unselect all") : t("Select all")}
          </Button>
          <SaveActions pending={pending} disabled={visible.length === 0} onClose={onClose} onSave={save} />
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t("Tools to expose")}</legend>
        <ul className="stagger flex flex-col gap-2">
          {service.tools.map((tool) => {
            const selected = visible.includes(tool.name);
            return (
              <li key={tool.name}>
                <FilterChip
                  selected={selected}
                  className="h-auto min-h-10 w-full justify-start py-2 text-left"
                  onClick={() => setVisible(selected ? visible.filter((name) => name !== tool.name) : [...visible, tool.name])}
                >
                  <span className="flex min-w-0 flex-col">
                    <span>{tool.title}</span>
                    <span className="truncate font-mono text-xs opacity-80">{tool.name}</span>
                  </span>
                </FilterChip>
              </li>
            );
          })}
        </ul>
        {visible.length === 0 ? (
          <p className="type-body-small text-error" role="alert">{t("Keep at least one tool, or hide the whole service instead")}</p>
        ) : null}
      </fieldset>
    </Dialog>
  );
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Expose everything?")}
      description={t("Every region, service and tool will be exposed again, including ones added later.")}
      confirmLabel={t("Expose everything")}
      pending={pending}
      onConfirm={() => run(() => resetExposure(), { progress: t("Resetting…"), success: t("Everything is exposed") }, onClose)}
    />
  );
}
