import { PageHeader } from "@/components/m3/page-header";
import { LinkTabs } from "@/components/m3/tabs";

export default function UsageLayout({ children }: LayoutProps<"/usage">) {
  return (
    <>
      <PageHeader title="Usage" description="MCP calls made with your keys, connected apps, or the agent in the web chat, Telegram and WhatsApp." />
      <LinkTabs
        label="Usage views"
        tabs={[
          { href: "/usage", label: "Calls" },
          { href: "/usage/clients", label: "Clients", nested: true },
          { href: "/usage/credits", label: "Credits" },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
