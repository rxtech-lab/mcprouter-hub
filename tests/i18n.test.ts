import { createElement, Fragment, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { matchLocale } from "@/lib/i18n/config";
import { compilePo, parsePo, serializePo } from "@/lib/i18n/po";
import { createTranslator } from "@/lib/i18n/translate";

describe("matchLocale", () => {
  it("falls back to English without a header or a supported language", () => {
    expect(matchLocale(null)).toBe("en");
    expect(matchLocale("fr-FR,de;q=0.8")).toBe("en");
  });

  it("maps Traditional Chinese regions and scripts to zh-HK", () => {
    expect(matchLocale("zh-HK")).toBe("zh-HK");
    expect(matchLocale("zh-TW,zh;q=0.9")).toBe("zh-HK");
    expect(matchLocale("zh-Hant-MO")).toBe("zh-HK");
    expect(matchLocale("yue")).toBe("zh-HK");
  });

  it("maps other Chinese to zh-CN", () => {
    expect(matchLocale("zh-CN")).toBe("zh-CN");
    expect(matchLocale("zh")).toBe("zh-CN");
    expect(matchLocale("zh-Hans-SG")).toBe("zh-CN");
  });

  it("honours q-values and order", () => {
    expect(matchLocale("en;q=0.5,zh-HK;q=0.9")).toBe("zh-HK");
    expect(matchLocale("fr,zh-CN;q=0.8,en;q=0.7")).toBe("zh-CN");
    expect(matchLocale("en-GB,zh-HK")).toBe("en");
  });
});

const po = `msgid ""
msgstr ""
"Language: zh-HK\\n"
"Plural-Forms: nplurals=1; plural=0;\\n"

#. Shown on the landing page
#: app/page.tsx
msgid "Hello {name}"
msgstr "你好，{name}"

#: app/page.tsx
msgid "Line one\\n"
"line two"
msgstr ""
"第一行\\n"
"第二行"

#, fuzzy
msgid "Draft"
msgstr "草稿"

msgid "Untranslated"
msgstr ""

msgid "{count} key"
msgid_plural "{count} keys"
msgstr[0] "{count} 條金鑰"

msgctxt "verb"
msgid "Open"
msgstr "開啟"

msgid "Say \\"hi\\""
msgstr "講「hi」"
`;

describe("PO files", () => {
  it("parses headers, comments, multi-line strings, plurals and context", () => {
    const file = parsePo(po);
    expect(file.headers.Language).toBe("zh-HK");
    expect(file.entries[0]).toMatchObject({ msgid: "Hello {name}", msgstr: ["你好，{name}"], extracted: ["Shown on the landing page"], references: ["app/page.tsx"] });
    expect(file.entries[1]).toMatchObject({ msgid: "Line one\nline two", msgstr: ["第一行\n第二行"] });
    expect(file.entries[2].flags).toEqual(["fuzzy"]);
    expect(file.entries[4]).toMatchObject({ msgidPlural: "{count} keys", msgstr: ["{count} 條金鑰"] });
    expect(file.entries[5]).toMatchObject({ msgctxt: "verb", msgid: "Open" });
    expect(file.entries[6]).toMatchObject({ msgid: 'Say "hi"' });
  });

  it("compiles only translated, non-fuzzy entries", () => {
    const messages = compilePo(parsePo(po));
    expect(messages["Hello {name}"]).toBe("你好，{name}");
    expect(messages).not.toHaveProperty("Draft");
    expect(messages).not.toHaveProperty("Untranslated");
    expect(messages["{count} key"]).toEqual(["{count} 條金鑰"]);
    expect(messages["verb\u0004Open"]).toBe("開啟");
  });

  it("round-trips through serialize", () => {
    const file = parsePo(po);
    expect(parsePo(serializePo(file))).toEqual(file);
  });
});

describe("createTranslator", () => {
  const t = createTranslator("zh-HK", compilePo(parsePo(po)));
  const en = createTranslator("en", {});

  it("translates and interpolates, falling back to the source", () => {
    expect(t("Hello {name}", { name: "Ada" })).toBe("你好，Ada");
    expect(t("Untranslated")).toBe("Untranslated");
    expect(t("Draft")).toBe("Draft");
    expect(en("Hello {name}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("picks plural forms", () => {
    expect(en.plural("{count} key", "{count} keys", 1)).toBe("1 key");
    expect(en.plural("{count} key", "{count} keys", 3)).toBe("3 keys");
    expect(t.plural("{count} key", "{count} keys", 3)).toBe("3 條金鑰");
  });

  it("renders rich text with tags and element placeholders", () => {
    const node = en.rich("Read the <docs>guide</docs> for {name}", {
      docs: (chunks) => createElement("a", { href: "/docs" }, chunks),
      name: createElement("b", null, "MCP"),
    });
    expect(isValidElement(node)).toBe(true);
    expect(renderToStaticMarkup(createElement(Fragment, null, node))).toBe('Read the <a href="/docs">guide</a> for <b>MCP</b>');
  });
});
