"use client";

import { useState } from "react";
import { Button } from "@/components/m3/button";
import { Dialog } from "@/components/m3/dialog";
import { ServiceCombobox } from "@/components/service-combobox";
import { useActionRunner } from "@/components/use-action-runner";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";
import { selectionToScopes, type ServiceSelection } from "@/lib/service-selection";

type ServicesDialogProps = {
  title: string;
  description: string;
  legend: string;
  value: ServiceSelection;
  /** Gets the selection as saved scopes. */
  onSave: (services: string[]) => Promise<ActionResult<unknown>>;
  onClose: () => void;
};

/** Limits a connection (an app or a bot link) to all, some or no services. */
export function ServicesDialog({ title, description, legend, value, onSave, onClose }: ServicesDialogProps) {
  const [selected, setSelected] = useState(value);
  const { pending, run } = useActionRunner();
  const t = useT();
  const save = () => run(() => onSave(selectionToScopes(selected)), { progress: t("Saving services…"), success: t("Services updated") }, onClose);
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={title}
      description={description}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
          <Button disabled={pending} onClick={save}>{pending ? t("Saving…") : t("Save")}</Button>
        </>
      }
    >
      <ServiceCombobox legend={legend} allLabel={t("All services")} value={selected} onChange={setSelected} disabled={pending} />
    </Dialog>
  );
}
