import { requirePageUser } from "@/lib/auth";
import { telegramConfig } from "@/lib/telegram/api";
import { listLinks } from "@/lib/telegram/link";
import { TelegramView, type LinkRow } from "./telegram-view";

export const metadata = { title: "Telegram" };

export default async function TelegramPage({ searchParams }: PageProps<"/keys/telegram">) {
  const user = await requirePageUser();
  const { linked } = await searchParams;
  const rows = await listLinks(user.id);
  const links: LinkRow[] = rows.map((row) => ({ id: row.telegramHash, account: row.displayName, createdAt: row.createdAt.toISOString() }));
  const config = telegramConfig();
  return <TelegramView links={links} botUsername={config.botUsername} enabled={config.enabled} justLinked={linked === "1"} />;
}
