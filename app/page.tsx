import { ArrowRight, KeyRound, MessageSquareText, Plug, Wrench } from "lucide-react";
import Link from "next/link";
import manifest from "@/generated/manifest.json";
import { HeroChat } from "@/components/agent/hero-chat";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/m3/button";
import { ServiceIcon } from "@/components/service-icon";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { freeChatConfig } from "@/lib/free-chat";

const steps = [
  { icon: <KeyRound size={24} />, title: "Create a key", body: "Sign in, then create an API key scoped to the services you need." },
  { icon: <Plug size={24} />, title: "Connect your client", body: "Paste one config into Claude, Cursor, VS Code or any MCP client." },
  { icon: <MessageSquareText size={24} />, title: "Just ask", body: "“When's the next 1A bus?” Your assistant calls the right tool, live." },
];

export default function Home() {
  const toolCount = manifest.services.reduce((sum, service) => sum + service.tools.length, 0);
  const freeChat = freeChatConfig();
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <SiteHeader />

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pt-4 pb-20 md:gap-24 md:px-6">
        <section className="grid animate-page-in items-center gap-10 overflow-hidden rounded-xl bg-primary-container px-6 py-12 text-on-primary-container md:px-12 md:py-16 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="inline-flex h-8 items-center gap-2 self-start rounded-sm bg-surface-container-lowest/60 px-3 type-label-large">
              <Wrench size={16} /> {manifest.services.length} services · {toolCount} MCP tools
            </span>
            <h1 className="type-display-small md:type-display-large">Hong Kong open data, as tools your AI can call.</h1>
            <p className="max-w-xl type-body-large opacity-90">
              Weather, buses, MTR, A&amp;E waiting times, car parks, public holidays and the whole DATA.GOV.HK catalogue — live, through one
              MCP endpoint and one API key.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/dashboard" className="h-14 rounded-lg px-6">
                Open dashboard <ArrowRight size={18} />
              </ButtonLink>
            </div>
            {freeChat.enabled ? (
              <p className="type-body-medium opacity-80">Try it right here: {freeChat.dailyLimit} free messages a day, no account needed.</p>
            ) : null}
          </div>
          {freeChat.enabled ? <HeroChat dailyLimit={freeChat.dailyLimit} /> : <ToolCallPreview />}
        </section>

        <section id="services">
          <SectionHeading eyebrow="Services" title="Everything Hongkongers check on their phone" />
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
                    {service.tools.length} {service.tools.length === 1 ? "tool" : "tools"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/sources" variant="tonal">
              Read more about the data sources <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/sources/providers" variant="text">
              Search all providers
            </ButtonLink>
          </div>
        </section>

        <section id="how">
          <SectionHeading eyebrow="How it works" title="From sign-in to answers in a minute" />
          <ol className="stagger grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-4 rounded-lg border border-outline-variant p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">{step.icon}</span>
                  <span className="type-display-small text-outline-variant tabular-nums">{index + 1}</span>
                </div>
                <h3 className="type-title-large">{step.title}</h3>
                <p className="type-body-medium text-on-surface-variant">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col items-start gap-6 rounded-xl bg-surface-container-high p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="flex items-center gap-5">
            <Logo size={56} />
            <div>
              <h2 className="type-headline-medium">Ready when your assistant is.</h2>
              <p className="mt-1 type-body-large text-on-surface-variant">Free to start. Every tool call is metered on your dashboard.</p>
            </div>
          </div>
          <ButtonLink href="/login" className="h-14 rounded-lg px-6">
            Get an API key <ArrowRight size={18} />
          </ButtonLink>
        </section>
      </main>

      <SiteFooter />
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

/** A static illustration of an agent turn: the question, the tool call and the answer. */
function ToolCallPreview() {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-4 text-on-surface shadow-elevation-2 md:p-5">
      <p className="self-end rounded-lg rounded-br-xs bg-primary px-4 py-2 type-body-medium text-on-primary">Is it going to rain? Any warnings?</p>
      {["hko_current_weather", "hko_warning_summary"].map((tool) => (
        <div key={tool} className="flex items-center gap-3 rounded-md border border-outline-variant px-3 py-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Wrench size={14} />
          </span>
          <span className="flex-1 truncate font-mono text-[13px]">{tool}</span>
          <span className="type-label-medium text-on-surface-variant">Done</span>
        </div>
      ))}
      <p className="type-body-medium">
        It&apos;s <strong>27°C</strong> at the Observatory with <strong>79% humidity</strong>. No rain in the past hour and{" "}
        <strong>no warnings are in force</strong>.
      </p>
    </div>
  );
}
