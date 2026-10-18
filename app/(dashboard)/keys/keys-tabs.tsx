import { LinkTabs } from "@/components/m3/tabs";

/** API keys and OAuth-connected apps are two ways to give a client access, so they share a page with the per-client setup guides. */
export function KeysTabs() {
  return (
    <div className="mb-6">
      <LinkTabs
        label="Access"
        tabs={[
          { href: "/keys", label: "API keys" },
          { href: "/keys/apps", label: "Connected apps" },
          { href: "/keys/setup", label: "Set up a client" },
          { href: "/keys/whatsapp", label: "WhatsApp" },
          { href: "/keys/telegram", label: "Telegram" },
        ]}
      />
    </div>
  );
}
