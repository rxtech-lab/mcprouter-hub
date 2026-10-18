"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireActionUser } from "@/lib/auth";
import { linkedMessage } from "@/lib/whatsapp/bot";
import { linkNumber, readLinkToken } from "@/lib/whatsapp/link";
import { sendText, whatsAppConfig } from "@/lib/whatsapp/wasender";

/** Link from the confirmation page. The token is checked again, since the form can be replayed. */
export async function confirmWhatsAppLink(formData: FormData) {
  const user = await requireActionUser();
  const token = formData.get("token")?.toString();
  if (formData.get("decision") !== "link") redirect("/dashboard");
  const claims = readLinkToken(token);
  if (!claims) redirect(`/whatsapp/link?${new URLSearchParams({ token: token ?? "" })}`);
  await linkNumber(user, claims);
  const config = whatsAppConfig();
  const phone = claims.phone;
  if (config.enabled && phone) {
    // Tell the number it's ready, without holding up the redirect.
    after(() => sendText(config, phone, linkedMessage(user.email)).catch((error) => console.error("[whatsapp] could not confirm the link", error)));
  }
  redirect("/keys/whatsapp?linked=1");
}
