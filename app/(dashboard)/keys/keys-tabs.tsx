"use client";

import { LinkTabs } from "@/components/m3/tabs";
import { useT } from "@/lib/i18n/client";

/** API keys and OAuth-connected apps are two ways to give a client access, so they share a page; per-client setup guides open from Connected apps. */
export function KeysTabs() {
  const t = useT();
  return (
    <div className="mb-6">
      <LinkTabs
        label={t("Access")}
        tabs={[
          { href: "/keys", label: t("API keys") },
          { href: "/keys/apps", label: t("Connected apps") },
          { href: "/keys/whatsapp", label: "WhatsApp" },
          { href: "/keys/telegram", label: "Telegram" },
        ]}
      />
    </div>
  );
}
