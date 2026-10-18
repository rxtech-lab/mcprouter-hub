import { AppWindow, Bot, History, KeyRound, MessageCircle, Send } from "lucide-react";
import { msg } from "@/lib/i18n/translate";
import type { ClientKind } from "@/lib/usage";

/** Marked for translation; render with `t(CLIENT_KIND_LABELS[kind])`. */
export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  key: msg("API key"),
  oauth: msg("Connected app"),
  web: msg("Agent"),
  telegram: msg("Agent"),
  whatsapp: msg("Agent"),
  agent: msg("Agent"),
};

const icons = { key: KeyRound, oauth: AppWindow, web: Bot, telegram: Send, whatsapp: MessageCircle, agent: History };

export function ClientIcon({ kind, size = 18 }: { kind: ClientKind; size?: number }) {
  const Icon = icons[kind];
  return <Icon size={size} aria-hidden />;
}
