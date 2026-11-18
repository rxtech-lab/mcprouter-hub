import { requirePageUser } from "@/lib/auth";
import { serviceSelection } from "@/lib/service-scopes";
import { listLinks, maskedNumber } from "@/lib/whatsapp/link";
import { whatsAppConfig } from "@/lib/whatsapp/wasender";
import { WhatsAppView, type LinkRow } from "./whatsapp-view";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({ searchParams }: PageProps<"/keys/whatsapp">) {
  const user = await requirePageUser();
  const { linked, services, toolMode } = await searchParams;
  const rows = await listLinks(user.id);
  const links: LinkRow[] = rows.map((row) => ({ id: row.phoneHash, number: maskedNumber(row.phoneHint), createdAt: row.createdAt.toISOString(), scopes: serviceSelection(row.scopes), toolMode: row.toolMode }));
  const botNumber = process.env.WHATSAPP_BOT_NUMBER?.replace(/\D/g, "") || null;
  return (
    <WhatsAppView
      links={links}
      botNumber={botNumber}
      enabled={whatsAppConfig().enabled}
      justLinked={linked === "1"}
      // `?services=<id>` opens the services dialog for that link.
      editing={links.find((link) => link.id === services) ?? null}
      // `?toolMode=<id>` opens the tool mode dialog for that link.
      editingTools={links.find((link) => link.id === toolMode) ?? null}
    />
  );
}
