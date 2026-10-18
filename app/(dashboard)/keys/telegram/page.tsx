import { requirePageUser } from "@/lib/auth";
import { serviceSelection } from "@/lib/service-scopes";
import { telegramConfig } from "@/lib/telegram/api";
import { listLinks } from "@/lib/telegram/link";
import { TelegramView, type LinkRow } from "./telegram-view";

export const metadata = { title: "Telegram" };

export default async function TelegramPage({ searchParams }: PageProps<"/keys/telegram">) {
  const user = await requirePageUser();
  const { linked, services, toolMode } = await searchParams;
  const rows = await listLinks(user.id);
  const links: LinkRow[] = rows.map((row) => ({ id: row.telegramHash, account: row.displayName, createdAt: row.createdAt.toISOString(), scopes: serviceSelection(row.scopes), toolMode: row.toolMode }));
  const config = telegramConfig();
  return (
    <TelegramView
      links={links}
      botUsername={config.botUsername}
      enabled={config.enabled}
      justLinked={linked === "1"}
      // `?services=<id>` opens the services dialog for that link.
      editing={links.find((link) => link.id === services) ?? null}
      // `?toolMode=<id>` opens the tool mode dialog for that link.
      editingTools={links.find((link) => link.id === toolMode) ?? null}
    />
  );
}
