import { ArrowRight, Code, Globe, KeyRound, type LucideIcon, MessageCircle, MessageSquareText, MousePointer2, Plug, Send, Sparkles, Terminal, Wrench } from "lucide-react";
import Link from "next/link";
import manifest from "@/generated/manifest.json";
import { HeroChat } from "@/components/agent/hero-chat";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/m3/button";
import { ServiceIcon } from "@/components/service-icon";
import { SiteFooter } from "@/components/site-footer";
import { ClientSetupDialog } from "@/components/client-setup-dialog";
import { ScrollTimeline } from "@/components/scroll-timeline";
import { SetupSteps } from "@/components/setup-steps";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { freeChatConfig } from "@/lib/free-chat";
import { getT } from "@/lib/i18n/server";
import { msg } from "@/lib/i18n/translate";
import { MCP_CLIENTS, mcpClientById } from "@/lib/mcp-clients";
import { siteUrl } from "@/lib/site";
import { telegramConfig } from "@/lib/telegram/api";
import { whatsAppConfig } from "@/lib/whatsapp/wasender";

const clientIcons: Record<string, LucideIcon> = {
  "claude-code": Terminal,
  claude: MessageSquareText,
  chatgpt: Globe,
  codex: Code,
  gemini: Sparkles,
  cursor: MousePointer2,
};

/** Cycled per card so the grid reads as a palette, not a wall of one colour. */
const clientTones = [
  "bg-primary-container text-on-primary-container",
  "bg-secondary-container text-on-secondary-container",
  "bg-tertiary-container text-on-tertiary-container",
];

const timeline = [
  { id: "top", label: msg("Overview") },
  { id: "services", label: msg("Services") },
  { id: "clients", label: msg("Clients") },
  { id: "chat-apps", label: msg("Telegram & WhatsApp") },
  { id: "how", label: msg("How it works") },
  { id: "get-started", label: msg("Get started") },
];

const steps = [
  { icon: <KeyRound size={24} />, title: msg("Create a key"), body: msg("Sign in, then create an API key scoped to the services you need.") },
  { icon: <Plug size={24} />, title: msg("Connect your client"), body: msg("Sign in from Claude, Claude Code, ChatGPT, Codex, Cursor or any MCP client.") },
  { icon: <MessageSquareText size={24} />, title: msg("Just ask"), body: msg("“When's the next 1A bus?” Your assistant calls the right tool, live.") },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const toolCount = manifest.services.reduce((sum, service) => sum + service.tools.length, 0);
  const freeChat = freeChatConfig();
  const telegram = telegramConfig();
  const whatsAppNumber = process.env.WHATSAPP_BOT_NUMBER?.replace(/\D/g, "") || null;
  const user = await getCurrentUser();
  const t = await getT();
  const { client: clientParam } = await searchParams;
  // Signed-in users go straight to the full guide; everyone else gets a preview dialog first.
  const preview = user ? undefined : mcpClientById(typeof clientParam === "string" ? clientParam : undefined);
  const setupHref = (id: string) => `/keys/apps?${new URLSearchParams({ client: id })}`;
  const clientHref = (id: string) => (user ? setupHref(id) : `/?${new URLSearchParams({ client: id })}`);
  const clients = MCP_CLIENTS.filter((client) => client.id !== "other");
  const otherClient = MCP_CLIENTS.find((client) => client.id === "other");
  const bots = [
    {
      name: "Telegram",
      icon: Send,
      tone: "bg-primary-container text-on-primary-container",
      accent: "bg-primary text-on-primary",
      body: t("Message the bot like a friend. Link your account once and every answer uses your plan."),
      question: t("Next 1A bus from Star Ferry?"),
      answer: t("The next **1A** leaves Star Ferry in **4 min**, then 11 and 19 min."),
      href: telegram.botUsername ? `https://t.me/${telegram.botUsername}` : "/keys/telegram",
      enabled: telegram.enabled,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      tone: "bg-tertiary-container text-on-tertiary-container",
      accent: "bg-tertiary text-on-tertiary",
      body: t("Ask about buses, weather or A&E waits right in WhatsApp, no app or setup needed."),
      question: t("Any typhoon signal today?"),
      answer: t("**No tropical cyclone signal** is in force. 28°C with a chance of showers."),
      href: whatsAppNumber ? `https://wa.me/${whatsAppNumber}` : "/keys/whatsapp",
      enabled: whatsAppConfig().enabled,
    },
  ];
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <SiteHeader />

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pt-4 pb-20 md:gap-24 md:px-6">
        <section id="top" className="scroll-mt-24 grid animate-page-in items-center gap-10 overflow-hidden rounded-xl bg-primary-container px-6 py-12 text-on-primary-container md:px-12 md:py-16 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="inline-flex h-8 items-center gap-2 self-start rounded-sm bg-surface-container-lowest/60 px-3 type-label-large">
              <Wrench size={16} /> {t("{services} services · {tools} MCP tools", { services: manifest.services.length, tools: toolCount })}
            </span>
            <h1 className="type-display-small md:type-display-large">{t("Hong Kong open data, as tools your AI can call.")}</h1>
            <p className="max-w-xl type-body-large opacity-90">
              {t("Weather, buses, MTR, A&E waiting times, car parks, public holidays and the whole DATA.GOV.HK catalogue — live, through one MCP endpoint and one API key.")}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/dashboard" className="h-14 rounded-lg px-6">
                {t("Open dashboard")} <ArrowRight size={18} />
              </ButtonLink>
            </div>
            {freeChat.enabled ? (
              <p className="type-body-medium opacity-80">{t("Try it right here: {limit} free messages a day, no account needed.", { limit: freeChat.dailyLimit })}</p>
            ) : null}
          </div>
          {freeChat.enabled ? <HeroChat dailyLimit={freeChat.dailyLimit} /> : <ToolCallPreview />}
        </section>

        <section id="services" className="scroll-mt-24">
          <SectionHeading eyebrow={t("Services")} title={t("Everything Hongkongers check on their phone")} />
          <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {manifest.services.map((service, index) => (
              <li key={service.id}>
                <Link href={`/sources/${service.id}`} className="state-layer flex h-full flex-col gap-4 rounded-lg bg-surface-container-low p-5 text-on-surface">
                  <ServiceIcon id={service.id} index={index} />
                  <div className="flex flex-1 flex-col gap-1">
                    <h3 className="type-title-medium">{service.title}</h3>
                    <p className="line-clamp-3 type-body-medium text-on-surface-variant">{service.description}</p>
                  </div>
                  <span className="type-label-medium text-on-surface-variant">
                    {t.plural("{count} tool", "{count} tools", service.tools.length)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/sources" variant="tonal">
              {t("Read more about the data sources")} <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/sources/providers" variant="text">
              {t("Search all providers")}
            </ButtonLink>
          </div>
        </section>

        <section id="clients" className="scroll-mt-24">
          <SectionHeading eyebrow={t("Clients")} title={t("Works with the assistants you already use")} />
          <p className="-mt-4 mb-8 max-w-2xl type-body-large text-on-surface-variant">
            {t("One MCP endpoint for every client. Most sign in with OAuth, so there's no key to copy; the rest take an API key.")}
          </p>
          <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client, index) => {
              const Icon = clientIcons[client.id] ?? Plug;
              return (
                <li key={client.id}>
                  <Link
                    href={clientHref(client.id)}
                    scroll={false}
                    className="group state-layer relative flex h-full min-h-56 flex-col overflow-hidden rounded-xl bg-surface-container-low p-6 text-on-surface transition-[box-shadow,translate] duration-300 ease-emphasized hover:-translate-y-1 hover:shadow-elevation-2"
                  >
                    <Icon aria-hidden size={160} strokeWidth={1} className="pointer-events-none absolute -right-8 -bottom-8 text-on-surface opacity-[0.05] transition-transform duration-500 ease-emphasized group-hover:scale-110 group-hover:-rotate-6" />
                    <div className="flex items-start justify-between gap-3">
                      <span className={`flex size-14 items-center justify-center rounded-lg ${clientTones[index % clientTones.length]}`}>
                        <Icon size={28} />
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className="rounded-sm border border-outline-variant px-2 py-0.5 type-label-small text-on-surface-variant">OAuth</span>
                        {client.apiKey ? <span className="rounded-sm border border-outline-variant px-2 py-0.5 type-label-small text-on-surface-variant">{t("API key")}</span> : null}
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-1 pt-8">
                      <h3 className="type-headline-small">{t(client.name)}</h3>
                      <p className="type-body-medium text-on-surface-variant">{t(client.kind)}</p>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-2 type-label-large text-primary">
                      {t("Set up {name}", { name: t(client.name) })}
                      <ArrowRight size={16} className="transition-transform duration-300 ease-emphasized group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {otherClient ? (
            <Link
              href={clientHref(otherClient.id)}
              scroll={false}
              className="group state-layer mt-4 flex items-center gap-4 rounded-xl border border-dashed border-outline p-6 text-on-surface"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                <Plug size={24} />
              </span>
              <div className="flex flex-1 flex-col">
                <h3 className="type-title-large">{t("Using something else?")}</h3>
                <p className="type-body-medium text-on-surface-variant">{t("Any client that speaks MCP over streamable HTTP can connect with the endpoint URL and an API key.")}</p>
              </div>
              <ArrowRight size={20} className="shrink-0 text-on-surface-variant transition-transform duration-300 ease-emphasized group-hover:translate-x-1" />
            </Link>
          ) : null}

          <div id="chat-apps" className="mt-16 mb-8 flex scroll-mt-24 flex-col gap-2">
            <span className="type-label-large text-primary">{t("Chat apps")}</span>
            <h3 className="type-headline-medium">{t("No AI app? Just message the bot.")}</h3>
            <p className="max-w-2xl type-body-large text-on-surface-variant">{t("The same live Hong Kong data on Telegram and WhatsApp. Nothing to install or configure.")}</p>
          </div>
          <ul className="stagger grid gap-4 md:grid-cols-2">
            {bots.map((bot) => {
              const Icon = bot.icon;
              const external = bot.href.startsWith("http");
              return (
                <li key={bot.name}>
                  <Link
                    href={bot.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className={`group state-layer relative flex h-full flex-col gap-6 overflow-hidden rounded-xl p-6 transition-[box-shadow,translate] duration-300 ease-emphasized hover:-translate-y-1 hover:shadow-elevation-3 md:p-8 ${bot.tone}`}
                  >
                    <Icon aria-hidden size={220} strokeWidth={1} className="pointer-events-none absolute -top-10 -right-10 opacity-[0.08] transition-transform duration-500 ease-emphasized group-hover:scale-110 group-hover:rotate-6" />
                    <div className="flex items-center gap-4">
                      <span className={`flex size-16 shrink-0 items-center justify-center rounded-full shadow-elevation-1 ${bot.accent}`}>
                        <Icon size={30} />
                      </span>
                      <div className="flex flex-col">
                        <h4 className="type-headline-small">{t("{name} bot", { name: bot.name })}</h4>
                        {bot.enabled ? (
                          <span className="inline-flex items-center gap-1.5 type-label-medium opacity-80">
                            <span className="size-2 rounded-full bg-current" /> {t("Online now")}
                          </span>
                        ) : (
                          <span className="type-label-medium opacity-80">{t("Coming soon")}</span>
                        )}
                      </div>
                    </div>
                    <p className="type-body-large opacity-90">{bot.body}</p>

                    <div aria-hidden className="flex flex-col gap-2 rounded-lg bg-surface-container-lowest/70 p-4 text-on-surface backdrop-blur-sm">
                      <p className="max-w-[85%] self-end rounded-lg rounded-br-xs bg-primary px-3 py-2 type-body-medium text-on-primary">{bot.question}</p>
                      <p className="max-w-[85%] self-start rounded-lg rounded-bl-xs bg-surface-container-high px-3 py-2 type-body-medium">
                        <BoldText text={bot.answer} />
                      </p>
                    </div>

                    <span className={`mt-auto inline-flex h-12 items-center gap-2 self-start rounded-full px-6 type-label-large ${bot.accent}`}>
                      {t("Chat on {name}", { name: bot.name })}
                      <ArrowRight size={18} className="transition-transform duration-300 ease-emphasized group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="how" className="scroll-mt-24">
          <SectionHeading eyebrow={t("How it works")} title={t("From sign-in to answers in a minute")} />
          <ol className="stagger grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-4 rounded-lg border border-outline-variant p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">{step.icon}</span>
                  <span className="type-display-small text-outline-variant tabular-nums">{index + 1}</span>
                </div>
                <h3 className="type-title-large">{t(step.title)}</h3>
                <p className="type-body-medium text-on-surface-variant">{t(step.body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="get-started" className="flex scroll-mt-24 flex-col items-start gap-6 rounded-xl bg-surface-container-high p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="flex items-center gap-5">
            <Logo size={56} />
            <div>
              <h2 className="type-headline-medium">{t("Ready when your assistant is.")}</h2>
              <p className="mt-1 type-body-large text-on-surface-variant">{t("Free to start. Every tool call is metered on your dashboard.")}</p>
            </div>
          </div>
          <ButtonLink href="/login" className="h-14 rounded-lg px-6">
            {t("Get an API key")} <ArrowRight size={18} />
          </ButtonLink>
        </section>
      </main>

      <SiteFooter />
      <ScrollTimeline sections={timeline.map((section) => ({ ...section, label: t(section.label) }))} />

      {preview ? (
        <ClientSetupDialog
          key={preview.id}
          name={t(preview.name)}
          kind={t(preview.kind)}
          signInHref={`/login?${new URLSearchParams({ next: setupHref(preview.id) })}`}
        >
          <SetupSteps steps={preview.oauth(`${await siteUrl()}/api/mcp/streamable`)} />
          {preview.note ? <p className="mt-4 rounded-sm bg-surface-container p-3 type-body-medium text-on-surface-variant">{t(preview.note)}</p> : null}
        </ClientSetupDialog>
      ) : null}
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <span className="type-label-large text-primary">{eyebrow}</span>
      <h2 className="type-headline-large">{title}</h2>
    </div>
  );
}

/** Renders `**bold**` spans in the short canned bot replies. */
function BoldText({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));
}

/** A static illustration of an agent turn: the question, the tool call and the answer. */
async function ToolCallPreview() {
  const t = await getT();
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-4 text-on-surface shadow-elevation-2 md:p-5">
      <p className="self-end rounded-lg rounded-br-xs bg-primary px-4 py-2 type-body-medium text-on-primary">{t("Is it going to rain? Any warnings?")}</p>
      {["hko_current_weather", "hko_warning_summary"].map((tool) => (
        <div key={tool} className="flex items-center gap-3 rounded-md border border-outline-variant px-3 py-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Wrench size={14} />
          </span>
          <span className="flex-1 truncate font-mono text-[13px]">{tool}</span>
          <span className="type-label-medium text-on-surface-variant">{t("Done")}</span>
        </div>
      ))}
      <p className="type-body-medium">
        {t.rich("It's <strong>27°C</strong> at the Observatory with <strong>79% humidity</strong>. No rain in the past hour and <strong>no warnings are in force</strong>.", {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
    </div>
  );
}
