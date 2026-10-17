import { ArrowLeft, ArrowRight, BarChart3, KeyRound, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button, ButtonLink } from "@/components/m3/button";
import { ServiceIcon } from "@/components/service-icon";
import manifest from "@/generated/manifest.json";
import { authStatus, getCurrentUser, signIn } from "@/lib/auth";
import { freeChatConfig } from "@/lib/free-chat";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

const benefits = [
  { icon: <KeyRound size={20} />, text: "API keys for Claude, Cursor, VS Code and any MCP client" },
  { icon: <MessageSquareText size={20} />, text: "The Hong Kong agent, with your chats saved" },
  { icon: <BarChart3 size={20} />, text: "Usage by key and tool, and your plan in one place" },
];

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const freeChat = freeChatConfig();

  async function authenticate() {
    "use server";
    await signIn("rxlab", { redirectTo: "/dashboard" });
  }

  return (
    <main className="grid min-h-dvh bg-surface lg:grid-cols-[1.1fr_1fr]">
      {/* Brand pane: what you get by signing in. Hidden on small screens, where the form comes first. */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary-container p-12 text-on-primary-container lg:m-3 lg:flex lg:rounded-xl">
        <Link href="/" className="flex items-center gap-3 self-start rounded-md">
          <Logo size={40} />
          <span className="type-title-large">mcprouter</span>
        </Link>
        <div className="flex max-w-lg flex-col gap-8">
          <h1 className="type-display-small">Hong Kong open data, ready for your AI.</h1>
          <ul className="flex flex-col gap-4">
            {benefits.map((benefit) => (
              <li key={benefit.text} className="flex items-center gap-4 type-body-large">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest/60">{benefit.icon}</span>
                {benefit.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2" aria-label={`${manifest.services.length} services`}>
          {manifest.services.map((service) => (
            <ServiceIcon key={service.id} id={service.id} onContainer />
          ))}
        </div>
      </section>

      <section className="flex flex-col px-6 py-6 md:px-12">
        <div className="flex items-center justify-between">
          <ButtonLink href="/" variant="text" icon={<ArrowLeft size={18} />} className="-ml-3">Home</ButtonLink>
          <Link href="/" aria-label="mcprouter home" className="rounded-md lg:hidden">
            <Logo size={36} />
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h2 className="type-headline-large">Sign in</h2>
          <p className="mt-2 type-body-large text-on-surface-variant">Use your RxLab account to manage API keys, usage and saved chats.</p>

          {!authStatus.configured ? (
            <p role="alert" className="mt-6 rounded-md bg-error-container p-4 type-body-medium text-on-error-container">
              Sign-in is not configured. Set the AUTH_* environment variables, or set DEV_BYPASS_AUTH=true locally.
            </p>
          ) : null}

          <form action={authenticate} className="mt-8">
            <Button type="submit" disabled={!authStatus.configured} className="h-14 w-full rounded-lg">
              Continue with RxLab <ArrowRight size={18} />
            </Button>
          </form>

          {freeChat.enabled ? (
            <>
              <div className="my-6 flex items-center gap-4 type-label-medium text-on-surface-variant" aria-hidden>
                <span className="h-px flex-1 bg-outline-variant" /> or <span className="h-px flex-1 bg-outline-variant" />
              </div>
              <ButtonLink href="/#try" variant="tonal" icon={<MessageSquareText size={18} />} className="h-14 w-full rounded-lg">
                Try the agent without an account
              </ButtonLink>
              <p className="mt-2 text-center type-body-small text-on-surface-variant">{freeChat.dailyLimit} free messages a day</p>
            </>
          ) : null}

          <p className="mt-10 flex items-start gap-2 type-body-small text-on-surface-variant">
            <ShieldCheck size={16} className="mt-px shrink-0" />
            mcprouter only reads your RxLab profile and email. API keys are stored hashed and shown once.
          </p>
        </div>
      </section>
    </main>
  );
}
