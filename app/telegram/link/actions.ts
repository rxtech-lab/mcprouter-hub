"use server";

import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth";
import { linkAccount, readLinkToken } from "@/lib/telegram/link";

/** Link from the confirmation page. The token is checked again, since the form can be replayed. */
export async function confirmTelegramLink(formData: FormData) {
  const user = await requireActionUser();
  const token = formData.get("token")?.toString();
  if (formData.get("decision") !== "link") redirect("/dashboard");
  const claims = readLinkToken(token);
  if (!claims) redirect(`/telegram/link?${new URLSearchParams({ token: token ?? "" })}`);
  await linkAccount(user, claims);
  redirect("/keys/telegram?linked=1");
}
