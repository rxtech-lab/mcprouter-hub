import { redirect } from "next/navigation";
import { listHref } from "@/app/sources/params";

/** The setup guides now open as a dialog on Connected apps; keep old links working. */
export default async function SetupPage({ searchParams }: PageProps<"/keys/setup">) {
  const { client, auth } = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  redirect(listHref("/keys/apps", { client: first(client) ?? "claude-code", auth: first(auth) === "key" ? "key" : undefined }));
}
