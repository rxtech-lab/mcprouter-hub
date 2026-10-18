"use server";

import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth";
import { approveAuthorization, checkAuthorizationRequest, clientRedirect } from "@/lib/mcp/oauth";
import { siteUrl } from "@/lib/site";
import { AUTHORIZE_PARAMS } from "./params";

/** Allow or deny from the consent page. The request is validated again, since the form can be replayed. */
export async function decideAuthorization(formData: FormData) {
  const user = await requireActionUser();
  const origin = new URL(await siteUrl()).origin;
  const params = Object.fromEntries(AUTHORIZE_PARAMS.map((name) => [name, formData.get(name)?.toString() || undefined]));
  const check = await checkAuthorizationRequest(params, origin);
  if (!check.ok) {
    if (!check.redirectUri) throw new Error("NOT_FOUND");
    redirect(clientRedirect(check.redirectUri, { error: check.error, error_description: check.message }, check.state, origin));
  }

  const { request } = check;
  if (formData.get("decision") !== "allow") {
    redirect(clientRedirect(request.redirectUri, { error: "access_denied", error_description: "Access was declined." }, request.state, origin));
  }
  const code = await approveAuthorization(user.id, request);
  redirect(clientRedirect(request.redirectUri, { code }, request.state, origin));
}
