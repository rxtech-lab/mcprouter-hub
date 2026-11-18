"use client";

import { useState } from "react";
import { ServiceCombobox } from "@/components/service-combobox";
import { useT } from "@/lib/i18n/client";
import { selectionToScopes, type ServiceSelection } from "@/lib/service-selection";

/** Lets the user limit the app to some services before allowing it. Sent with the form as `services`. */
export function ServicesField() {
  const [services, setServices] = useState<ServiceSelection>("all");
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <ServiceCombobox legend={t("Services this app may call")} allLabel={t("All services")} value={services} onChange={setServices} />
      <p className="type-body-small text-on-surface-variant">{t("You can change this later under API keys → Connected apps.")}</p>
      {selectionToScopes(services).map((id) => (
        <input key={id} type="hidden" name="services" value={id} />
      ))}
    </div>
  );
}
