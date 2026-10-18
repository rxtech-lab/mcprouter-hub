"use client";

import { SlidersHorizontal } from "lucide-react";
import Form from "next/form";
import { useState } from "react";
import { Button } from "@/components/m3/button";
import { Dialog } from "@/components/m3/dialog";
import { SelectField } from "@/components/m3/text-field";
import { useT } from "@/lib/i18n/client";

type Props = { formats: string[]; format?: string; api?: string; keep: Record<string, string | undefined> };

/** Opens a dialog with the less common dataset filters; applying it navigates with the filters in the URL. */
export function FiltersButton({ formats, format, api, keep }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const count = Number(Boolean(format)) + Number(Boolean(api));
  return (
    <>
      <Button variant={count ? "tonal" : "outlined"} icon={<SlidersHorizontal size={18} />} onClick={() => setOpen(true)} className="h-14">
        {t("Filters")}{count ? ` · ${count}` : ""}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Filter datasets")}
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
            <Button type="submit" form="tracker-filters">{t("Apply")}</Button>
          </>
        }
      >
        <Form id="tracker-filters" action="/tracker/datasets" onSubmit={() => setOpen(false)} className="flex flex-col gap-4 pt-1">
          {Object.entries(keep).map(([key, value]) => (value ? <input key={key} type="hidden" name={key} value={value} /> : null))}
          <SelectField label={t("Format")} name="format" defaultValue={format ?? ""}>
            <option value="">{t("Any format")}</option>
            {formats.map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectField>
          <SelectField label={t("Endpoints")} name="api" defaultValue={api ?? ""}>
            <option value="">{t("All datasets")}</option>
            <option value="1">{t("Real API endpoints only")}</option>
          </SelectField>
        </Form>
      </Dialog>
    </>
  );
}
