"use client";

import { Badge } from "@/components/m3/chip";
import { useT } from "@/lib/i18n/client";
import type { ServiceSelection } from "@/lib/service-selection";

/** The services a connection may call, as badges. */
export function ServiceBadges({ value }: { value: ServiceSelection }) {
  const t = useT();
  if (value === "all") return <Badge tone="primary">{t("All services")}</Badge>;
  if (value.length === 0) return <Badge tone="error">{t("No services")}</Badge>;
  return value.map((service) => <Badge key={service.id}>{service.title}</Badge>);
}
