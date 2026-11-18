"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireActionUser } from "@/lib/auth";
import { sendText, telegramConfig } from "@/lib/telegram/api";
import { linkedMessage } from "@/lib/telegram/bot";
import { linkAccount, readLinkToken } from "@/lib/telegram/link";

/** Link from the confirmation page. The token is checked again, since the form can be replayed. */
export async function confirmTelegramLink(formData: FormData) {
  const user = await requireActionUser();
  const token = formData.get("token")?.toString();
  if (formData.get("decision") !== "link") redirect("/dashboard");
  const claims = readLinkToken(token);
  if (!claims) redirect(`/telegram/link?${new URLSearchParams({ token: token ?? "" })}`);
  await linkAccount(user, claims);
  const config = telegramConfig();
  const chatId = claims.chatId;
  if (config.enabled && chatId !== null) {
    // Tell the chat it's ready, without holding up the redirect.
    after(() => sendText(config, chatId, linkedMessage(user.email)).catch((error) => console.error("[telegram] could not confirm the link", error)));
  }
  redirect("/keys/telegram?linked=1");
}
