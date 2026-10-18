import type { UiComponent, UiSpec } from "@/lib/agent/ui-catalog";
import { blocks, card as block, type Card, type CardBlock, type Chip, type Tone } from "@/mcp/apps/card";

/**
 * The chat card for a UI the agent composed with `show_ui`, for channels that can't render it live
 * (Telegram, WhatsApp). The spec's components map onto card blocks; the root Card's title heads it.
 */

/** The site's primary colour (`--md-sys-color-primary`). */
const ACCENT = "#216487";

type Props = Record<string, unknown>;
type Element = { type: UiComponent; props: Props; children?: string[] };

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

function noticeTone(tone: unknown): Exclude<Tone, "accent" | "neutral"> {
  return tone === "error" ? "danger" : tone === "success" ? "success" : "info";
}

function chipTone(tone: unknown): Tone {
  return tone === "error" ? "danger" : tone === "success" ? "success" : tone === "primary" || tone === "tertiary" ? "accent" : "neutral";
}

/** Short values sit side by side as stats, three to a line; long ones get a row each. */
function pairs(items: Array<{ label: string; value: string }>): CardBlock[] {
  if (items.every((item) => item.value.length <= 14)) {
    const lines: CardBlock[] = [];
    for (let index = 0; index < items.length; index += 3) lines.push(block.stats(items.slice(index, index + 3)));
    return lines;
  }
  return items.map((item) => block.row({ title: item.value, subtitle: item.label }));
}

const metricValue = (props: Props) => `${str(props.value)}${props.unit ? str(props.unit) : ""}`;

export function uiSpecCard(spec: UiSpec): Card {
  const elements = spec.elements as Record<string, Element>;
  const root = elements[spec.root];
  const seen = new Set<string>();
  const childrenOf = (element: Element) =>
    (element.children ?? []).flatMap((key) => {
      // A spec is checked before it's shown, but a picture must never loop.
      if (seen.has(key) || !elements[key]) return [];
      seen.add(key);
      return [elements[key]];
    });

  const draw = (element: Element): CardBlock[] => {
    const { props } = element;
    switch (element.type) {
      case "Card":
        return blocks(props.title ? block.section(str(props.title)) : null, props.subtitle ? block.text(str(props.subtitle), true) : null, childrenOf(element).flatMap(draw));
      case "Stack":
      case "Grid": {
        const children = childrenOf(element);
        if (children.length > 1 && children.every((child) => child.type === "Metric")) {
          return pairs(children.map((child) => ({ label: str(child.props.label), value: metricValue(child.props) })));
        }
        if (children.length > 1 && children.every((child) => child.type === "Badge")) {
          return [block.chips(children.map((child): Chip => ({ text: str(child.props.label), tone: chipTone(child.props.tone) })))];
        }
        return children.flatMap(draw);
      }
      case "Heading":
        return [block.section(str(props.text))];
      case "Text":
        return [block.text(str(props.text), Boolean(props.muted))];
      case "Metric":
        return [block.hero(metricValue(props), str(props.label), props.caption ? str(props.caption) : null)];
      case "Badge":
        return [block.chips([{ text: str(props.label), tone: chipTone(props.tone) }])];
      case "Alert":
        return [block.notice([str(props.title), props.message ? str(props.message) : ""].filter(Boolean).join(": "), noticeTone(props.tone))];
      case "Progress":
        return [block.row({ title: str(props.label), subtitle: props.caption ? str(props.caption) : null, trailing: [{ text: `${Math.round(Number(props.value) * 100)}%`, tone: "accent" }] })];
      case "KeyValue":
        return pairs(((props.items as Array<{ label: unknown; value: unknown }>) ?? []).map((item) => ({ label: str(item.label), value: str(item.value) })));
      case "List":
        return ((props.items as Array<Props>) ?? []).map((item) =>
          block.row({ title: str(item.title), subtitle: item.subtitle ? str(item.subtitle) : null, trailing: item.trailing ? [{ text: str(item.trailing), tone: "accent" }] : undefined }),
        );
      case "Table": {
        const columns = ((props.columns as unknown[]) ?? []).map(str);
        return ((props.rows as unknown[][]) ?? []).map((cells) => {
          const values = columns.map((_, index) => str(cells[index]));
          if (values.length <= 1) return block.row({ title: values[0] ?? "" });
          // First column names the row, the last is its value, and any between become the subtitle.
          const middle = values.slice(1, -1).map((value, index) => `${columns[index + 1]}: ${value}`);
          return block.row({ title: values[0], subtitle: middle.join(" · ") || null, trailing: [{ text: values.at(-1)!, tone: "accent" }] });
        });
      }
      case "Link":
        return [block.text(`${str(props.label)}: ${str(props.href)}`, true)];
      case "Divider":
        return [];
    }
  };

  seen.add(spec.root);
  // The root Card's title and subtitle head the picture; anything else is drawn as blocks.
  const headed = root?.type === "Card" && Boolean(root.props.title);
  const body = !root ? [] : headed ? childrenOf(root).flatMap(draw) : draw(root);
  const heading = body[0]?.kind === "section" ? body[0].title : null;
  const title = headed ? str(root.props.title) : (heading ?? "mcprouter");
  return {
    accent: ACCENT,
    badge: Array.from(title)[0]?.toUpperCase() ?? "M",
    title,
    subtitle: headed && root.props.subtitle ? str(root.props.subtitle) : null,
    blocks: !headed && heading ? body.slice(1) : body,
  };
}
