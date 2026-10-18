import { requirePageUser } from "@/lib/auth";
import { listLinks, maskedNumber } from "@/lib/whatsapp/link";
import { whatsAppConfig } from "@/lib/whatsapp/wasender";
import { WhatsAppView, type LinkRow } from "./whatsapp-view";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({ searchParams }: PageProps<"/keys/whatsapp">) {
  const user = await requirePageUser();
  const { linked } = await searchParams;
  const rows = await listLinks(user.id);
  const links: LinkRow[] = rows.map((row) => ({ id: row.phoneHash, number: maskedNumber(row.phoneHint), createdAt: row.createdAt.toISOString() }));
  const botNumber = process.env.WHATSAPP_BOT_NUMBER?.replace(/\D/g, "") || null;
  return <WhatsAppView links={links} botNumber={botNumber} enabled={whatsAppConfig().enabled} justLinked={linked === "1"} />;
}
