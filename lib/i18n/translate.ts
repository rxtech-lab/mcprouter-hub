import { Fragment, createElement, type ReactNode } from "react";
import { INTL_LOCALES, type Locale } from "./config";
import type { Messages } from "./po";

type Values = Record<string, string | number>;
type RichValues = Record<string, string | number | ReactNode | ((chunks: ReactNode) => ReactNode)>;

export type Translator = {
  /** Translates an English source string; `{name}` placeholders are filled from `values`. */
  (msgid: string, values?: Values): string;
  /** Picks the singular or plural source by `count`, which also fills `{count}`. */
  plural(singular: string, plural: string, count: number, values?: Values): string;
  /** Like `t`, but `<tag>text</tag>` renders through `values.tag(chunks)` and placeholders may be elements. */
  rich(msgid: string, values: RichValues): ReactNode;
  locale: Locale;
};

/**
 * Marks a string for extraction without translating it, for labels declared outside a component.
 * Translate it where it renders: `t(item.label)`.
 */
export function msg(msgid: string) {
  return msgid;
}

function interpolate(template: string, values?: Values) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

export function createTranslator(locale: Locale, messages: Messages): Translator {
  const rules = new Intl.PluralRules(INTL_LOCALES[locale]);

  const lookup = (msgid: string) => {
    const message = messages[msgid];
    return typeof message === "string" && message ? message : msgid;
  };

  const t = ((msgid: string, values?: Values) => interpolate(lookup(msgid), values)) as Translator;

  t.plural = (singular, plural, count, values) => {
    const forms = messages[singular];
    const all = { count, ...values };
    if (Array.isArray(forms) && forms.some(Boolean)) {
      // Chinese has one plural form; languages with more pick by CLDR category.
      const form = forms.length === 1 ? forms[0] : forms[rules.select(count) === "one" ? 0 : 1];
      if (form) return interpolate(form, all);
    }
    return interpolate(count === 1 ? singular : plural, all);
  };

  t.rich = (msgid, values) => {
    const nodes: ReactNode[] = [];
    const pattern = /<(\w+)>([\s\S]*?)<\/\1>|\{(\w+)\}/g;
    const template = lookup(msgid);
    let last = 0;
    for (const match of template.matchAll(pattern)) {
      if (match.index > last) nodes.push(template.slice(last, match.index));
      const [whole, tag, inner, placeholder] = match;
      const value = values[tag ?? placeholder];
      if (tag) {
        nodes.push(typeof value === "function" ? value(inner) : inner);
      } else {
        nodes.push(value === undefined ? whole : typeof value === "function" ? value(null) : value);
      }
      last = match.index + whole.length;
    }
    if (last < template.length) nodes.push(template.slice(last));
    return createElement(Fragment, null, ...nodes.map((node, index) => createElement(Fragment, { key: index }, node)));
  };

  t.locale = locale;
  return t;
}
