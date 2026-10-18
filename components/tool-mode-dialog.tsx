"use client";

import { ListTree, Search, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/m3/button";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { Dialog } from "@/components/m3/dialog";
import { useActionRunner } from "@/components/use-action-runner";
import type { ToolMode } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

/** `default` leaves the choice to the endpoint: search tools on the all-services endpoint, every tool on a single-service one. */
type Choice = ToolMode | "default";

type ToolModeFieldProps = {
  value: ToolMode | null;
  onChange: (value: ToolMode | null) => void;
  /** Offers "Endpoint default" (null). Without it, null reads as `all`. */
  allowDefault?: boolean;
  disabled?: boolean;
};

/** Picks how a connection lists tools: every tool by name, or search_tools, read_tool and use_tool. */
export function ToolModeField({ value, onChange, allowDefault, disabled }: ToolModeFieldProps) {
  const t = useT();
  const selected: Choice = value ?? (allowDefault ? "default" : "all");
  const options: { value: Choice; icon: ReactNode; label: string; description: string }[] = [
    ...(allowDefault
      ? [
          {
            value: "default" as const,
            icon: <Settings2 size={20} />,
            label: t("Endpoint default"),
            description: t("Search tools on the all-services endpoint, every tool on a single-service one. ?tools= in the URL can switch it."),
          },
        ]
      : []),
    {
      value: "all",
      icon: <ListTree size={20} />,
      label: t("Every tool"),
      description: t("Each tool is listed by name. Some clients cap how many tools they load."),
    },
    {
      value: "search",
      icon: <Search size={20} />,
      label: t("Search, read and use"),
      description: t("Only search_tools, read_tool and use_tool are listed, so the tool list stays small. Searching and reading are free."),
    },
  ];
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 type-label-large text-on-surface-variant">{t("How tools are listed")}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "state-layer flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-200 ease-emphasized",
            selected === option.value ? "border-transparent bg-secondary-container text-on-secondary-container" : "border-outline-variant text-on-surface",
          )}
        >
          <input
            type="radio"
            name="tool-mode"
            value={option.value}
            checked={selected === option.value}
            onChange={() => onChange(option.value === "default" ? null : option.value)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="mt-0.5 shrink-0">{option.icon}</span>
          <span className="min-w-0">
            <span className="block type-label-large">{option.label}</span>
            <span className="block type-body-small opacity-80">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** A badge for a connection's chosen tool mode; nothing for the default. */
export function ToolModeBadge({ value, allowDefault }: { value: ToolMode | null; allowDefault?: boolean }) {
  const t = useT();
  const mode = value ?? (allowDefault ? null : "all");
  if (mode === "search") return <Badge icon={<Search size={14} />}>{t("Search tools")}</Badge>;
  if (mode === "all" && value) return <Badge icon={<ListTree size={14} />}>{t("Every tool")}</Badge>;
  return null;
}

type ToolModeDialogProps = {
  description: string;
  value: ToolMode | null;
  allowDefault?: boolean;
  onSave: (toolMode: ToolMode | null) => Promise<ActionResult<unknown>>;
  onClose: () => void;
};

/** Changes how a connection (a key, an app or a bot link) lists tools. */
export function ToolModeDialog({ description, value, allowDefault, onSave, onClose }: ToolModeDialogProps) {
  const [selected, setSelected] = useState(value);
  const { pending, run } = useActionRunner();
  const t = useT();
  const save = () => run(() => onSave(selected), { progress: t("Saving tool mode…"), success: t("Tool mode updated") }, onClose);
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={t("Change tool mode")}
      description={description}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
          <Button disabled={pending || selected === value} onClick={save}>{pending ? t("Saving…") : t("Save")}</Button>
        </>
      }
    >
      <ToolModeField value={selected} onChange={setSelected} allowDefault={allowDefault} disabled={pending} />
    </Dialog>
  );
}
