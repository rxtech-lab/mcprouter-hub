"use server";

import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth";
import { linkNumber, readLinkToken } from "@/lib/whatsapp/link";

/** Link from the confirmation page. The token is checked again, since the form can be replayed. */
export async function confirmWhatsAppLink(formData: FormData) {
  const user = await requireActionUser();
  const token = formData.get("token")?.toString();
  if (formData.get("decision") !== "link") redirect("/dashboard");
  const claims = readLinkToken(token);
  if (!claims) redirect(`/whatsapp/link?${new URLSearchParams({ token: token ?? "" })}`);
  await linkNumber(user, claims);
  redirect("/keys/whatsapp?linked=1");
}
