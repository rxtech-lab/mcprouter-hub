/**
 * Translations live in locales/<locale>/messages.po, keyed by the English source string. Usage:
 *   bun scripts/i18n.ts extract   add new t()/msg() strings to every messages.po and drop unused ones
 *   bun scripts/i18n.ts check     fail if a messages.po is out of date or has untranslated strings
 *   bun scripts/i18n.ts compile   write generated/i18n/<locale>.json for the runtime (part of `bun run codegen`)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, LOCALES } from "../lib/i18n/config";
import { compilePo, entryKey, parsePo, serializePo, type PoEntry, type PoFile } from "../lib/i18n/po";

const root = path.resolve(import.meta.dirname, "..");
const sourceDirs = ["app", "components", "lib"];
const translated = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
const poPath = (locale: string) => path.join(root, "locales", locale, "messages.po");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const literal = String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\x60(?:[^\x60\\$]|\\.)*\x60)`;
const single = new RegExp(String.raw`(?<![\w.$])(?:t|t\.rich|msg)\(\s*${literal}`, "g");
const plural = new RegExp(String.raw`(?<![\w.$])t\.plural\(\s*${literal}\s*,\s*${literal}`, "g");

function unquote(value: string) {
  const body = value.slice(1, -1);
  if (value[0] === '"') return JSON.parse(value) as string;
  return JSON.parse(`"${body.replace(/\\(['`])/g, "$1").replace(/"/g, '\\"')}"`) as string;
}

/**
 * Every translatable string in the source, ordered by where it first appears.
 * References name files without line numbers, so unrelated edits don't churn the PO files.
 */
function extract() {
  const found = new Map<string, PoEntry & { order: number }>();
  const add = (msgid: string, file: string, order: number, msgidPlural?: string) => {
    const reference = path.relative(root, file);
    const existing = found.get(msgid);
    if (existing) {
      if (!existing.references.includes(reference)) existing.references.push(reference);
      if (msgidPlural && existing.msgidPlural === undefined) existing.msgidPlural = msgidPlural;
      existing.order = Math.min(existing.order, order);
      return;
    }
    found.set(msgid, { msgid, msgidPlural, msgstr: [], extracted: [], references: [reference], flags: [], comments: [], order });
  };
  const files = sourceDirs
    .flatMap((dir) => sourceFiles(path.join(root, dir)))
    .filter((file) => !file.includes(`${path.sep}lib${path.sep}i18n${path.sep}`))
    .sort();
  files.forEach((file, fileIndex) => {
    const source = readFileSync(file, "utf8");
    const order = (index: number) => fileIndex * 1e7 + index;
    for (const match of source.matchAll(plural)) add(unquote(match[1]), file, order(match.index), unquote(match[2]));
    for (const match of source.matchAll(single)) add(unquote(match[1]), file, order(match.index));
  });
  return [...found.values()].sort((a, b) => a.order - b.order).map(({ order, ...entry }) => (void order, entry));
}

function readPo(locale: string): PoFile {
  const file = poPath(locale);
  if (existsSync(file)) return parsePo(readFileSync(file, "utf8"));
  return { headers: {}, entries: [] };
}

function merge(locale: string, extracted: PoEntry[]): PoFile {
  const current = readPo(locale);
  const previous = new Map(current.entries.filter((entry) => !entry.obsolete).map((entry) => [entryKey(entry), entry]));
  return {
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Content-Transfer-Encoding": "8bit",
      Language: locale,
      "Plural-Forms": "nplurals=1; plural=0;",
      "X-Source-Language": DEFAULT_LOCALE,
    },
    entries: extracted.map((entry) => {
      const old = previous.get(entryKey(entry));
      return {
        ...entry,
        msgstr: [old?.msgstr[0] ?? ""],
        comments: old?.comments ?? [],
        flags: old?.flags ?? [],
      };
    }),
  };
}

const command = process.argv[2];

if (command === "extract" || command === "check") {
  const extracted = extract();
  const problems: string[] = [];
  for (const locale of translated) {
    const next = serializePo(merge(locale, extracted));
    const file = poPath(locale);
    if (command === "extract") {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, next);
      const missing = parsePo(next).entries.filter((entry) => !entry.msgstr[0]).length;
      console.log(`${path.relative(root, file)}: ${extracted.length} strings, ${missing} untranslated`);
      continue;
    }
    if (!existsSync(file) || readFileSync(file, "utf8") !== next) problems.push(`${path.relative(root, file)} is out of date. Run \`bun run i18n:extract\`.`);
    for (const entry of parsePo(next).entries) {
      if (!entry.msgstr[0]) problems.push(`${locale}: untranslated "${entry.msgid}" (${entry.references[0]})`);
      else if (entry.flags.includes("fuzzy")) problems.push(`${locale}: fuzzy "${entry.msgid}" (${entry.references[0]})`);
    }
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  if (command === "check") console.log(`Translations are up to date (${extracted.length} strings).`);
} else if (command === "compile") {
  const outDir = path.join(root, "generated/i18n");
  mkdirSync(outDir, { recursive: true });
  for (const locale of translated) {
    writeFileSync(path.join(outDir, `${locale}.json`), `${JSON.stringify(compilePo(readPo(locale)), null, 2)}\n`);
  }
  console.log(`Compiled ${translated.length} message catalogues.`);
} else {
  console.error("Usage: bun scripts/i18n.ts <extract|check|compile>");
  process.exit(1);
}
