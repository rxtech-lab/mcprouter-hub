// Bus operators and their colours, shared by the app and the chat card.

export type Operator = { badge: string; name: string; accent: string; onAccent: string };

export const OPERATORS = {
  kmb: { badge: "KMB", name: "KMB", accent: "#e1251b", onAccent: "#ffffff" },
  citybus: { badge: "CTB", name: "Citybus", accent: "#ffd200", onAccent: "#1d1b16" },
  gmb: { badge: "GMB", name: "Green minibus", accent: "#00843d", onAccent: "#ffffff" },
} satisfies Record<string, Operator>;

export function operatorOf(tool: string | undefined): Operator {
  return OPERATORS[String(tool ?? "").split("_")[0] as keyof typeof OPERATORS] ?? OPERATORS.kmb;
}
