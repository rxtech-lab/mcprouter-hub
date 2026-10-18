import { ArrowLeftRight, Ban, Eye, ShieldCheck, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/m3/button";
import { serviceById } from "@/generated/registry";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { checkAuthorizationRequest, clientRedirect } from "@/lib/mcp/oauth";
import { siteUrl } from "@/lib/site";
import { decideAuthorization } from "./actions";
import { DecisionButtons } from "./decision-buttons";
import { AUTHORIZE_PARAMS } from "./params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Connect an app"), robots: { index: false, follow: false } };
}

function displayTarget(uri: string) {
  const url = new URL(uri);
  return url.protocol === "http:" || url.protocol === "https:" ? url.host : `${url.protocol}//${url.host}`;
}

/** OAuth authorization endpoint: checks the request, makes sure the user is signed in, then asks for consent. */
export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  const params = await searchParams;
  const origin = new URL(await siteUrl()).origin;
  const check = await checkAuthorizationRequest(params, origin);
  const t = await getT();

  if (!check.ok) {
    if (check.redirectUri) {
      redirect(clientRedirect(check.redirectUri, { error: check.error, error_description: check.message }, check.state, origin));
    }
    return (
      <Shell>
        <span className="flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <Ban size={24} />
        </span>
        <h1 className="mt-6 type-headline-small">{t("Can't connect this app")}</h1>
        <p className="mt-2 type-body-large text-on-surface-variant">{check.message}</p>
        <ButtonLink href="/dashboard" variant="tonal" className="mt-8 self-start">{t("Go to dashboard")}</ButtonLink>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams();
    for (const name of AUTHORIZE_PARAMS) {
      const value = params[name];
      if (typeof value === "string") query.set(name, value);
    }
    redirect(`/login?${new URLSearchParams({ next: `/oauth/authorize?${query}` })}`);
  }

  const { request } = check;
  const service = request.resource.service ? serviceById.get(request.resource.service) : null;

  return (
    <Shell>
      <div className="flex items-center gap-3 text-on-surface-variant" aria-hidden>
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Wrench size={22} />
        </span>
        <ArrowLeftRight size={18} />
        <Logo size={48} />
      </div>
      <h1 className="mt-6 type-headline-small">
        {t.rich("Allow {client} to use mcprouter?", { client: <span className="text-primary">{request.client.name}</span> })}
      </h1>
      <p className="mt-2 type-body-large text-on-surface-variant">
        {t.rich("Signed in as {user}.", { user: <span className="text-on-surface">{user.email || user.name}</span> })}
      </p>

      <ul className="stagger mt-6 flex flex-col gap-4 rounded-md bg-surface-container-low p-4">
        <li className="flex items-start gap-3 type-body-medium">
          <Eye size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            {service
              ? t("Call the {service} tools as you. Each tool call counts against your plan, like calls made with an API key.", { service: service.title })
              : t("Call every mcprouter service as you. Each tool call counts against your plan, like calls made with an API key.")}
          </span>
        </li>
        <li className="flex items-start gap-3 type-body-medium">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>{t("It can't see or change your keys, chats or billing. Disconnect it any time under API keys → Connected apps.")}</span>
        </li>
      </ul>

      <p className="mt-4 type-body-small text-on-surface-variant">
        {t.rich("You'll be sent back to {target}. Only allow apps you trust.", {
          target: <span className="font-mono text-on-surface">{displayTarget(request.redirectUri)}</span>,
        })}
      </p>

      <form action={decideAuthorization} className="mt-8">
        {AUTHORIZE_PARAMS.map((name) => {
          const value = params[name];
          return typeof value === "string" ? <input key={name} type="hidden" name={name} value={value} /> : null;
        })}
        <DecisionButtons />
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <section className="flex w-full max-w-lg animate-page-in flex-col rounded-xl bg-surface-container-lowest p-6 shadow-elevation-1 sm:p-10">
        {children}
      </section>
    </main>
  );
}
