/**
 * Cards shown in the dashboard's intro dialog. Tutorial cards walk a new user through the dashboard;
 * feature cards announce something new. Each card is shown until the user has read it. Text is marked with `msg()` and translated where it renders.
 * Add a feature card here when a feature ships; give it a new id so everyone sees it once.
 */

import { msg } from "@/lib/i18n/translate";

/** Which animated illustration sits on top of the card. */
export type IntroArt = "tabs" | "connect" | "chat" | "chat-clients" | "chat-agents";

export type IntroCard = {
  id: string;
  kind: "tutorial" | "feature";
  title: string;
  description: string;
  art: IntroArt;
  /** Short items listed under the description, e.g. what each tab is for. */
  points?: { title: string; body: string }[];
  /** A page that lets the user try it straight away. */
  action?: { label: string; href: string };
};

export const INTRO_CARDS: IntroCard[] = [
  {
    id: "tutorial-tabs",
    kind: "tutorial",
    title: msg("Welcome to your dashboard"),
    description: msg("Everything lives in the navigation on the left (at the bottom on a phone). Here is what each tab is for."),
    art: "tabs",
    points: [
      { title: msg("Overview"), body: msg("Today's calls, your plan and shortcuts.") },
      { title: msg("API keys"), body: msg("Keys, connected apps, and the Telegram and WhatsApp bots.") },
      { title: msg("Usage"), body: msg("Calls per day, by client and your credit history.") },
      { title: msg("Services"), body: msg("Every tool and the data behind it.") },
      { title: msg("Tracker"), body: msg("Which DATA.GOV.HK datasets are converted next.") },
      { title: msg("Agent"), body: msg("Ask about live data, or ask it to do things in the dashboard for you.") },
      { title: msg("Billing"), body: msg("Your plan and allowance.") },
    ],
  },
  {
    id: "tutorial-connect",
    kind: "tutorial",
    title: msg("Connect your chat client"),
    description:
      msg("Add mcprouter to the chat app you already use, such as Claude, ChatGPT, Gemini, Gemini CLI, Codex or Cursor. Pick your client under Connected apps and follow its steps; most sign in with OAuth, so there is no key to copy."),
    art: "connect",
    action: { label: msg("Set up a client"), href: "/keys/apps?client=claude" },
  },
  {
    id: "tutorial-chat",
    kind: "tutorial",
    title: msg("Quick start: ask the agent"),
    description:
      msg("No setup needed: the Agent tab answers with live data, starting with Hong Kong: the weather, the next bus or A&E waiting times. It can also find pages and prepare actions here, such as creating a key."),
    art: "chat",
    action: { label: msg("Try “What's the weather now?”"), href: `/chat?ask=${encodeURIComponent("What's the weather in Hong Kong right now? Any warnings?")}` },
  },
  {
    id: "feature-chat-clients",
    kind: "feature",
    title: msg("New: chat with ChatGPT, Gemini and Claude"),
    description:
      msg("mcprouter now works in ChatGPT, Gemini and Claude. Connect it once and ask about live data, starting with Hong Kong's weather and transport, right in the chat app you already use."),
    art: "chat-clients",
    action: { label: msg("Connect a client"), href: "/keys/apps?client=chatgpt" },
  },
  {
    id: "feature-chat-agents",
    kind: "feature",
    title: msg("New: the agent on Telegram and WhatsApp"),
    description:
      msg("Chat with the mcprouter agent from Telegram or WhatsApp. Link your account once, then send a message like you would to a friend. Calls count towards your plan."),
    art: "chat-agents",
    action: { label: msg("Link Telegram"), href: "/keys/telegram" },
  },
];

export const INTRO_CARD_IDS = INTRO_CARDS.map((card) => card.id);

export function introCardById(id: string | undefined) {
  return INTRO_CARDS.find((card) => card.id === id);
}
