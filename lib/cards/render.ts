import "server-only";
import satori from "satori";
import sharp from "sharp";
import type { Card, CardBlock, CardRow, Chip, Tone } from "@/mcp/apps/card";

/**
 * Draws a `Card` as an SVG with satori (text becomes glyph outlines, so no
 * system fonts are needed), then rasterises it with sharp: Telegram and
 * WhatsApp only take PNG or JPEG pictures.
 */

/** Layout width in CSS pixels; the PNG is drawn at twice this. */
const WIDTH = 540;
const SCALE = 2;
const PADDING = 20;
/** A picture can't scroll, so long lists stop here with a "+N more" line. */
const MAX_ROWS = 10;
const FONT_FAMILY = "Noto Sans HK";
// The HK font omits some Simplified Chinese glyphs, including 节 and 诞.
const FALLBACK_FONT_FAMILY = "Noto Sans SC";

const COLOURS = {
  background: "#ffffff",
  surface: "#f3f5f7",
  text: "#1b1f23",
  muted: "#5f6b76",
  neutral: { background: "#e4e8ec", text: "#2b3238" },
  info: { background: "#e3f0fd", text: "#0d47a1" },
  success: { background: "#e6f4e7", text: "#1b5e20" },
  warning: { background: "#fff4d6", text: "#7a4f01" },
  danger: { background: "#fdeaea", text: "#b71c1c" },
};

type Style = Record<string, string | number>;
type Child = Element | string | null | undefined | false;
type Element = { type: "div"; props: { style: Style; children?: Element[] | string } };

/** A flex `div`. Satori needs `display: flex` on anything with more than one child. */
function div(style: Style, ...children: Array<Child | Child[]>): Element {
  const kids = children.flat().filter((child): child is Element | string => child !== null && child !== undefined && child !== false && child !== "");
  return { type: "div", props: { style: { display: "flex", ...style }, children: kids.length === 1 && typeof kids[0] === "string" ? kids[0] : kids.map((kid) => (typeof kid === "string" ? text({}, kid) : kid)) } };
}

/** One line of text, cut with an ellipsis, or `lines` lines when given. */
function text(style: Style, value: string, lines?: number): Element {
  const clamp: Style = lines ? { display: "block", lineClamp: lines } : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return { type: "div", props: { style: { minWidth: 0, ...clamp, ...style }, children: value } };
}

function toneColours(tone: Tone | undefined, card: Card) {
  if (tone === "accent") return { background: card.accent, text: card.onAccent ?? "#ffffff" };
  return COLOURS[tone && tone !== "neutral" ? tone : "neutral"];
}

function chip(value: Chip, card: Card, style: Style = {}): Element {
  const colours = toneColours(value.tone, card);
  return div(
    { flexShrink: 0, justifyContent: "center", padding: "3px 9px", borderRadius: 999, background: colours.background, color: colours.text, fontSize: 12, fontWeight: 700, ...style },
    text({}, value.text),
  );
}

function row(value: CardRow, card: Card): Element {
  return div(
    { alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, background: COLOURS.surface, overflow: "hidden", opacity: value.muted ? 0.55 : 1 },
    // A floor on the leading chip's width keeps short labels ("Mon 19", "Tue 20") lined up.
    value.leading && chip(value.leading, card, { minWidth: 60 }),
    div(
      { flexDirection: "column", flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
      value.title && text({ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: COLOURS.text }, value.title, 2),
      value.subtitle && text({ fontSize: 12, color: COLOURS.muted }, value.subtitle),
    ),
    value.trailing?.length ? div({ gap: 6, flexShrink: 0 }, value.trailing.map((item) => chip(item, card))) : null,
  );
}

function block(value: CardBlock, card: Card): Element {
  switch (value.kind) {
    case "hero": {
      const colour = value.tone && value.tone !== "neutral" && value.tone !== "accent" ? COLOURS[value.tone].text : card.accent;
      return div(
        { flexDirection: "column", padding: "14px 16px", borderRadius: 16, background: COLOURS.surface },
        text({ fontSize: 40, fontWeight: 700, color: colour, lineHeight: 1.15 }, value.value),
        value.label && text({ fontSize: 15, fontWeight: 700, color: COLOURS.text }, value.label),
        value.detail && text({ fontSize: 12, color: COLOURS.muted }, value.detail, 2),
      );
    }
    case "notice": {
      const colours = COLOURS[value.tone];
      return div({ padding: "10px 12px", borderRadius: 12, background: colours.background, color: colours.text }, text({ fontSize: 13, lineHeight: 1.4 }, value.text, 4));
    }
    case "stats":
      return div(
        { gap: 8 },
        value.items.map((item) =>
          div(
            { flexDirection: "column", flexGrow: 1, flexBasis: 0, minWidth: 0, padding: "10px 12px", borderRadius: 12, background: COLOURS.surface },
            text({ fontSize: 11, color: COLOURS.muted }, item.label),
            text({ fontSize: 16, fontWeight: 700, color: COLOURS.text }, item.value),
          ),
        ),
      );
    case "text":
      return text({ fontSize: 13.5, lineHeight: 1.45, color: value.muted ? COLOURS.muted : COLOURS.text }, value.text, 8);
    case "chips":
      return div({ flexWrap: "wrap", gap: 6 }, value.items.map((item) => chip(item, card)));
    case "section":
      return text({ marginTop: 4, fontSize: 12, fontWeight: 700, color: COLOURS.muted }, value.title);
    case "row":
      return row(value, card);
  }
}

/** The blocks to draw: rows past `MAX_ROWS` are dropped (with any section left empty) and counted instead. */
function visibleBlocks(card: Card) {
  const shown: CardBlock[] = [];
  let rows = 0;
  let hidden = 0;
  for (const value of card.blocks) {
    if (value.kind === "row" && rows >= MAX_ROWS) hidden++;
    else if (value.kind === "section" && rows >= MAX_ROWS) continue;
    else {
      if (value.kind === "row") rows++;
      shown.push(value);
    }
  }
  while (shown.at(-1)?.kind === "section") shown.pop();
  return { shown, hidden };
}

export function cardTree(card: Card): Element {
  const { shown, hidden } = visibleBlocks(card);
  const accentText = card.onAccent ?? "#ffffff";
  return div(
    // Satori adds padding to the width, so the content box is what's left of the canvas.
    { width: WIDTH - 2 * PADDING, maxWidth: WIDTH - 2 * PADDING, overflow: "hidden", flexDirection: "column", gap: 8, padding: PADDING, background: COLOURS.background, color: COLOURS.text, fontFamily: `${FONT_FAMILY}, ${FALLBACK_FONT_FAMILY}`, borderTop: `6px solid ${card.accent}` },
    div(
      { alignItems: "center", gap: 12, marginBottom: 4 },
      div(
        { flexShrink: 0, minWidth: 44, height: 44, padding: "0 8px", borderRadius: 12, alignItems: "center", justifyContent: "center", background: card.accent, color: accentText, fontWeight: 700, fontSize: card.badge.length > 3 ? 13 : 16 },
        text({}, card.badge.slice(0, 8)),
      ),
      div(
        { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0 },
        text({ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }, card.title || " "),
        card.subtitle && text({ fontSize: 13, color: COLOURS.muted }, card.subtitle),
      ),
    ),
    shown.map((value) => block(value, card)),
    hidden > 0 && text({ fontSize: 12, color: COLOURS.muted, paddingLeft: 4 }, `+${hidden} more`),
    div(
      { marginTop: 4, justifyContent: "space-between", gap: 12, fontSize: 11, color: COLOURS.muted },
      text({ flexShrink: 1 }, card.footer ?? ""),
      text({ flexShrink: 0, fontWeight: 700 }, "mcprouter"),
    ),
  );
}

/** Satori draws this where it cuts text short, so the subset needs it too. */
const ELLIPSIS = "…";

/** Every character the card draws, so the font can be fetched as a small subset. */
function characters(element: Element | string): string {
  if (typeof element === "string") return element;
  const children = element.props.children;
  if (children === undefined) return "";
  return typeof children === "string" ? children : children.map(characters).join("");
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

/**
 * Subset each family to the characters drawn, keeping downloads small.
 * HK supplies the preferred local forms; SC covers missing Simplified Chinese.
 */
async function loadFont(family: string, weight: 400 | 700, chars: string, fetcher: typeof fetch): Promise<Font> {
  const unique = [...new Set(chars)].join("");
  const css = await fetcher(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(unique)}`, {
    signal: AbortSignal.timeout(8_000),
  }).then((response) => (response.ok ? response.text() : Promise.reject(new Error(`Google Fonts ${response.status}`))));
  const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
  if (!url) throw new Error("Google Fonts returned no TrueType font");
  const data = await fetcher(url, { signal: AbortSignal.timeout(8_000) }).then((response) =>
    response.ok ? response.arrayBuffer() : Promise.reject(new Error(`Font download ${response.status}`)),
  );
  return { name: family, data, weight, style: "normal" };
}

export async function renderCardSvg(card: Card, fetcher: typeof fetch = fetch) {
  const tree = cardTree(card);
  const chars = characters(tree) + ELLIPSIS;
  const families = /\p{Script=Han}/u.test(chars) ? [FONT_FAMILY, FALLBACK_FONT_FAMILY] : [FONT_FAMILY];
  const fonts = await Promise.all(families.flatMap((family) => ([400, 700] as const).map((weight) => loadFont(family, weight, chars, fetcher))));
  return satori(tree as unknown as Parameters<typeof satori>[0], { width: WIDTH, fonts });
}

/** The card as a PNG, twice the layout size so it stays sharp on phones. */
export async function renderCardPng(card: Card, fetcher: typeof fetch = fetch) {
  const svg = await renderCardSvg(card, fetcher);
  return sharp(Buffer.from(svg), { density: 72 * SCALE }).png().toBuffer();
}
