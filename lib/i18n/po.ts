/**
 * A small gettext PO reader and writer, enough for `locales/<locale>/messages.po`:
 * comments, flags, msgctxt, msgid_plural and multi-line strings.
 */

export type PoEntry = {
  msgctxt?: string;
  msgid: string;
  msgidPlural?: string;
  /** One string, or one per plural form when `msgidPlural` is set. */
  msgstr: string[];
  /** `#.` comments for translators. */
  extracted: string[];
  /** `#:` source references. */
  references: string[];
  /** `#,` flags such as `fuzzy`. */
  flags: string[];
  /** `# ` translator comments. */
  comments: string[];
  obsolete?: boolean;
};

export type PoFile = { headers: Record<string, string>; entries: PoEntry[] };

/** Separates msgctxt from msgid in compiled keys, as gettext does. */
export const CONTEXT_SEPARATOR = "\u0004";

export function entryKey(entry: Pick<PoEntry, "msgctxt" | "msgid">) {
  return entry.msgctxt ? `${entry.msgctxt}${CONTEXT_SEPARATOR}${entry.msgid}` : entry.msgid;
}

function unescape(value: string) {
  return value.replace(/\\(.)/g, (_, char: string) => ({ n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" })[char] ?? char);
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\t/g, "\\t").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

function emptyEntry(): PoEntry {
  return { msgid: "", msgstr: [], extracted: [], references: [], flags: [], comments: [] };
}

export function parsePo(source: string): PoFile {
  const entries: PoEntry[] = [];
  let entry = emptyEntry();
  let started = false;
  // The keyword whose string continuation lines append to.
  let field: { name: "msgctxt" | "msgid" | "msgidPlural" } | { name: "msgstr"; index: number } | null = null;

  const flush = () => {
    if (started) entries.push(entry);
    entry = emptyEntry();
    started = false;
    field = null;
  };

  const append = (text: string) => {
    if (!field) return;
    if (field.name === "msgstr") entry.msgstr[field.index] = (entry.msgstr[field.index] ?? "") + text;
    else entry[field.name] = (entry[field.name] ?? "") + text;
  };

  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("#~")) {
      entry.obsolete = true;
      line = line.slice(2).trim();
      if (!line) continue;
    } else if (line.startsWith("#")) {
      // A comment after a msgstr starts the next entry even without a blank line.
      if (field?.name === "msgstr") flush();
      if (line.startsWith("#.")) entry.extracted.push(line.slice(2).trim());
      else if (line.startsWith("#:")) entry.references.push(...line.slice(2).trim().split(/\s+/).filter(Boolean));
      else if (line.startsWith("#,")) entry.flags.push(...line.slice(2).split(",").map((flag) => flag.trim()).filter(Boolean));
      else if (!line.startsWith("#|")) entry.comments.push(line.slice(1).trim());
      continue;
    }

    const string = line.match(/^"(.*)"$/);
    if (string) {
      append(unescape(string[1]));
      continue;
    }

    const keyword = line.match(/^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+"(.*)"$/);
    if (!keyword) throw new Error(`Could not parse PO line: ${rawLine}`);
    const [, name, index, text] = keyword;
    if ((name === "msgid" || name === "msgctxt") && field?.name === "msgstr") {
      const obsolete = entry.obsolete;
      flush();
      entry.obsolete = obsolete;
    }
    started = true;
    if (name === "msgctxt") field = { name: "msgctxt" };
    else if (name === "msgid") field = { name: "msgid" };
    else if (name === "msgid_plural") field = { name: "msgidPlural" };
    else field = { name: "msgstr", index: index ? Number(index) : 0 };
    if (field.name === "msgctxt" || field.name === "msgidPlural") entry[field.name] = "";
    append(unescape(text));
  }
  flush();

  const headerIndex = entries.findIndex((item) => item.msgid === "" && !item.msgctxt);
  const headers: Record<string, string> = {};
  if (headerIndex >= 0) {
    for (const line of (entries[headerIndex].msgstr[0] ?? "").split("\n")) {
      const colon = line.indexOf(":");
      if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    entries.splice(headerIndex, 1);
  }
  return { headers, entries };
}

function serializeString(keyword: string, value: string, prefix: string) {
  if (!value.includes("\n") || value.indexOf("\n") === value.length - 1) return `${prefix}${keyword} "${escape(value)}"`;
  const lines = value.split(/(?<=\n)/).map((part) => `${prefix}"${escape(part)}"`);
  return [`${prefix}${keyword} ""`, ...lines].join("\n");
}

export function serializePo(file: PoFile) {
  const header = Object.entries(file.headers)
    .map(([key, value]) => `${key}: ${value}\n`)
    .join("");
  const blocks = [[`msgid ""`, serializeString("msgstr", header, "")].join("\n")];
  for (const entry of file.entries) {
    const prefix = entry.obsolete ? "#~ " : "";
    const lines: string[] = [];
    for (const comment of entry.comments) lines.push(comment ? `# ${comment}` : "#");
    for (const comment of entry.extracted) lines.push(`#. ${comment}`);
    if (entry.references.length) lines.push(`#: ${entry.references.join(" ")}`);
    if (entry.flags.length) lines.push(`#, ${entry.flags.join(", ")}`);
    if (entry.msgctxt !== undefined) lines.push(serializeString("msgctxt", entry.msgctxt, prefix));
    lines.push(serializeString("msgid", entry.msgid, prefix));
    if (entry.msgidPlural !== undefined) {
      lines.push(serializeString("msgid_plural", entry.msgidPlural, prefix));
      const forms = entry.msgstr.length ? entry.msgstr : [""];
      forms.forEach((form, index) => lines.push(serializeString(`msgstr[${index}]`, form ?? "", prefix)));
    } else {
      lines.push(serializeString("msgstr", entry.msgstr[0] ?? "", prefix));
    }
    blocks.push(lines.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
}

/** Message catalogue for the runtime: translated, non-fuzzy entries keyed by (context +) msgid. Plural entries keep every form. */
export type Messages = Record<string, string | string[]>;

export function compilePo(file: PoFile): Messages {
  const messages: Messages = {};
  for (const entry of file.entries) {
    if (entry.obsolete || entry.flags.includes("fuzzy")) continue;
    if (entry.msgidPlural !== undefined) {
      if (entry.msgstr.some(Boolean)) messages[entryKey(entry)] = entry.msgstr;
    } else if (entry.msgstr[0]) {
      messages[entryKey(entry)] = entry.msgstr[0];
    }
  }
  return messages;
}
