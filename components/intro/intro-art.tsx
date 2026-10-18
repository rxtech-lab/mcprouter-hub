import { BarChart3, Blocks, CloudSun, CreditCard, KeyRound, LayoutDashboard, MessageCircle, MessageSquareText, Radar, Send, Sparkle, Sparkles, Asterisk, Hexagon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/m3/cn";
import { useT } from "@/lib/i18n/client";
import type { IntroArt } from "@/lib/intro-cards";

/** A looping illustration for an intro card. Decorative: the card's text says the same thing. */
export function IntroArtwork({ art }: { art: IntroArt }) {
  return (
    <div aria-hidden className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container-highest">
      {art === "tabs" ? <TabsArt /> : null}
      {art === "connect" ? <ConnectArt /> : null}
      {art === "chat" ? <ChatArt /> : null}
      {art === "chat-clients" ? <ChatClientsArt /> : null}
      {art === "chat-agents" ? <ChatAgentsArt /> : null}
    </div>
  );
}

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

const RAIL = [LayoutDashboard, KeyRound, BarChart3, Blocks, Radar, MessageSquareText, CreditCard];

/** The navigation rail, with the active indicator stepping through each tab while the page changes beside it. */
function TabsArt() {
  return (
    <div className="flex h-[300px] origin-center scale-[0.62] gap-4 sm:scale-75">
      <div className="relative flex w-16 flex-col items-center gap-0 rounded-xl bg-surface-container p-2 pt-3">
        <span className="absolute top-4 left-2 h-8 w-12 rounded-full bg-secondary-container animate-intro-rail" />
        {RAIL.map((Icon, index) => (
          <span key={index} className="relative flex h-10 w-12 items-center justify-center text-on-surface-variant">
            <Icon size={20} />
          </span>
        ))}
      </div>
      <div className="flex w-72 flex-col gap-3 rounded-xl bg-surface-container-lowest p-4">
        <span className="h-6 w-32 rounded-sm bg-primary-container animate-intro-pop" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <span key={index} className="h-14 rounded-md bg-surface-container animate-intro-pop" style={delay(200 + index * 120)} />
          ))}
        </div>
        <span className="flex-1 rounded-md bg-surface-container-low animate-intro-pop" style={delay(600)} />
      </div>
    </div>
  );
}

function ClientBadge({ icon, label, className, style }: { icon: ReactNode; label: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn("flex flex-col items-center gap-1", className)} style={style}>
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-elevation-1">{icon}</span>
      <span className="type-label-small text-on-surface-variant">{label}</span>
    </span>
  );
}

const CLIENTS = [
  { label: "Claude", icon: <Asterisk size={20} /> },
  { label: "ChatGPT", icon: <Hexagon size={20} /> },
  { label: "Gemini", icon: <Sparkle size={20} /> },
];

/** Chat clients on the left, each linked to mcprouter by a line a request travels along. */
function ConnectArt() {
  return (
    <div className="flex w-[85%] items-center justify-between gap-4">
      <div className="flex flex-col gap-3">
        {CLIENTS.map((client, index) => (
          <ClientBadge key={client.label} {...client} className="animate-intro-pop" style={delay(index * 250)} />
        ))}
      </div>
      <div className="relative flex h-40 flex-1 flex-col justify-around">
        {CLIENTS.map((client, index) => (
          <span key={client.label} className="relative block h-0.5 rounded-full bg-outline-variant">
            <span className="absolute -top-1 size-2.5 -translate-x-1/2 rounded-full bg-primary animate-intro-travel" style={delay(index * 500)} />
          </span>
        ))}
      </div>
      <span className="relative flex items-center justify-center">
        <span className="absolute inset-0 rounded-[24%] bg-primary animate-intro-ping" />
        <Logo size={64} className="relative animate-intro-float" />
      </span>
    </div>
  );
}

function Bubble({ from, children, at }: { from: "user" | "agent"; children: ReactNode; at: number }) {
  return (
    <div className={cn("flex animate-intro-pop", from === "user" ? "justify-end" : "justify-start")} style={delay(at)}>
      <div
        className={cn(
          "max-w-[80%] px-3 py-2 type-body-small",
          from === "user" ? "rounded-[16px] rounded-br-xs bg-primary-container text-on-primary-container" : "rounded-[16px] rounded-bl-xs bg-surface-container-lowest text-on-surface",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A question, the agent typing, then a weather card coming back. */
function ChatArt() {
  const t = useT();
  return (
    <div className="flex w-[78%] max-w-sm flex-col gap-2">
      <Bubble from="user" at={0}>{t("What's the weather now?")}</Bubble>
      <div className="flex gap-1 px-1 animate-intro-pop" style={delay(500)}>
        {[0, 150, 300].map((offset) => (
          <span key={offset} className="size-1.5 rounded-full bg-on-surface-variant animate-typing-dot" style={delay(offset)} />
        ))}
      </div>
      <Bubble from="agent" at={1100}>
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-tertiary-container text-on-tertiary-container">
            <CloudSun size={20} />
          </span>
          <span className="flex flex-col">
            <span className="type-title-medium">26°C</span>
            <span className="text-on-surface-variant">{t("Mostly cloudy, no warnings")}</span>
          </span>
        </span>
      </Bubble>
    </div>
  );
}

/** mcprouter in the middle, with ChatGPT, Gemini and Claude around it, each sending a message. */
function ChatClientsArt() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <span className="absolute size-40 rounded-full border border-dashed border-outline-variant" />
      <span className="relative flex items-center justify-center">
        <span className="absolute inset-0 rounded-[24%] bg-primary animate-intro-ping" />
        <Logo size={56} className="relative" />
      </span>
      <ClientBadge {...CLIENTS[1]} className="absolute top-[10%] left-1/2 -translate-x-1/2 animate-intro-float" />
      <ClientBadge {...CLIENTS[2]} className="absolute bottom-[8%] left-[24%] animate-intro-float" style={delay(500)} />
      <ClientBadge {...CLIENTS[0]} className="absolute right-[24%] bottom-[8%] animate-intro-float" style={delay(1000)} />
      <span className="absolute top-[18%] right-[10%] flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 type-label-medium text-on-primary-container animate-intro-pop" style={delay(300)}>
        <Sparkles size={14} /> Next bus?
      </span>
      <span className="absolute top-[42%] left-[6%] rounded-full bg-secondary-container px-3 py-1 type-label-medium text-on-secondary-container animate-intro-pop" style={delay(1200)}>
        Any rain today?
      </span>
    </div>
  );
}

/** A phone with a Telegram and a WhatsApp conversation sliding in. */
function ChatAgentsArt() {
  const t = useT();
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col gap-4">
        <ClientBadge icon={<Send size={20} />} label="Telegram" className="animate-intro-float" />
        <ClientBadge icon={<MessageCircle size={20} />} label="WhatsApp" className="animate-intro-float" style={delay(700)} />
      </div>
      <div className="flex h-44 w-44 flex-col gap-2 rounded-xl border-4 border-surface-container-lowest bg-surface-container p-2.5 shadow-elevation-2 sm:h-48 sm:w-52">
        <span className="flex items-center gap-2 border-b border-outline-variant pb-1.5">
          <Logo size={20} />
          <span className="type-label-medium">mcprouter</span>
        </span>
        <Bubble from="user" at={0}>{t("Is MTR running OK?")}</Bubble>
        <Bubble from="agent" at={900}>{t("All lines normal 🚇")}</Bubble>
        <Bubble from="user" at={1800}>{t("Thanks!")}</Bubble>
      </div>
    </div>
  );
}
