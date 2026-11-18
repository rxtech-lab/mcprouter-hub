import { PageHeader } from "@/components/m3/page-header";
import { LinkTabs } from "@/components/m3/tabs";
import { getT } from "@/lib/i18n/server";

export default async function UsageLayout({ children }: LayoutProps<"/usage">) {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Usage")} description={t("MCP calls made with your keys, connected apps, or the agent in the web chat, Telegram and WhatsApp.")} />
      <LinkTabs
        label={t("Usage views")}
        tabs={[
          { href: "/usage", label: t("Calls") },
          { href: "/usage/clients", label: t("Clients"), nested: true },
          { href: "/usage/credits", label: t("Credits") },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
