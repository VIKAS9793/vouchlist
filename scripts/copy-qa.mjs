#!/usr/bin/env node
/**
 * Copy QA: reviews every user-facing string on the site for formatting and
 * grammar problems before publishing.
 *
 *   node scripts/copy-qa.mjs        deterministic rule checks (fast, offline)
 *   node scripts/copy-qa.mjs --ai   rule checks + AI grammar review
 *
 * Exits with code 1 when any error-level issue is found, so it can gate a
 * publish/build step.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/routes", "src/components"];
const SKIP_FILES = [/routeTree\.gen\.ts$/, /\/ui\//, /README\.md$/, /sitemap\[\.\]xml\.ts$/];
const USE_AI = process.argv.includes("--ai");

/* ------------------------------------------------------------------ files */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(full)) out.push(full);
  }
  return out;
}

function collectFiles() {
  return SCAN_DIRS.filter((d) => {
    try {
      return statSync(join(ROOT, d)).isDirectory();
    } catch {
      return false;
    }
  })
    .flatMap((d) => walk(join(ROOT, d)))
    .map((f) => relative(ROOT, f))
    .filter((f) => !SKIP_FILES.some((re) => re.test(f)));
}

/* ---------------------------------------------------------------- extract */

const COPY_KEYS =
  /\b(title|description|copy|line|q|a|label|heading|subtitle|blurb|body|answer|question)\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const CONST_COPY =
  /\bconst\s+(title|description|heading|subtitle)\s*=\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
const JSX_TEXT = />([^<>{}]*[A-Za-z]{3}[^<>{}]*)</g;

/** Source that only looks like text because it sits between "=>" and "<". */
const CODE_ISH = /[=;`]|\?\.|\?\?|=>|\(\s*$|\)\s*[:?]|["']\s*[;:?]|\)\?\./;

/** Pull the human-readable strings out of one source file. */
function extractStrings(file) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const lines = src.split("\n");
  const found = [];

  const push = (text, index) => {
    const value = text.replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    if (!value || value.length < 8) return;
    // Skip identifier-like or single-label strings: they are not prose.
    if (value.split(/\s+/).length < 3 && !/[.!?]$/.test(value)) return;
    if (/^[\w.$@[\]-]+$/.test(value)) return;
    if (!/[A-Za-z]{3}/.test(value)) return;
    if (/^[a-z-]+(\s[a-z-]+)*$/.test(value) && value.includes("-") && !value.includes(" ")) return;
    const line = src.slice(0, index).split("\n").length;
    found.push({ file, line, text: value, source: "literal" });
  };

  for (const re of [COPY_KEYS, CONST_COPY]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) push(m[2], m.index);
  }

  JSX_TEXT.lastIndex = 0;
  let m;
  while ((m = JSX_TEXT.exec(src))) {
    const raw = m[1];
    if (!/[a-z]/.test(raw)) continue;
    // "=>" and comparison operators end in ">", so a match can start inside an
    // expression rather than at the end of a JSX tag. Those are code, not copy.
    if (src[m.index - 1] === "=" || src[m.index - 1] === "!" || src[m.index - 1] === "<") continue;
    if (CODE_ISH.test(raw)) continue;
    push(raw, m.index);
  }

  // Multi-line JSX paragraphs: stitch plain-text lines that sit between tags.
  let buffer = [];
  let bufferLine = 0;
  lines.forEach((raw, i) => {
    const trimmed = raw.trim();
    const isProse =
      trimmed.length > 0 &&
      !/[{}<>()[\]=;"`]/.test(trimmed) &&
      !/:\s*$|\w\?:/.test(trimmed) &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("*") &&
      /^[A-Z\u201c']/.test(trimmed) &&
      !/^([A-Za-z_$][\w$]*,\s*)+$/.test(trimmed);
    if (isProse) {
      if (!buffer.length) bufferLine = i + 1;
      buffer.push(trimmed);
    } else if (buffer.length) {
      found.push({ file, line: bufferLine, text: buffer.join(" "), source: "jsx" });
      buffer = [];
    }
  });
  if (buffer.length) found.push({ file, line: bufferLine, text: buffer.join(" "), source: "jsx" });

  // de-duplicate
  const seen = new Set();
  return found.filter((f) => {
    const key = `${f.file}:${f.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------------ rules */

const COMMON_TYPOS = [
  [/\brecieve\b/i, "receive"],
  [/\bseperate\b/i, "separate"],
  [/\boccured\b/i, "occurred"],
  [/\bteh\b/i, "the"],
  [/\bthier\b/i, "their"],
  [/\bdefinately\b/i, "definitely"],
  [/\baccomodate\b/i, "accommodate"],
  [/\bneighbour hood\b/i, "neighbourhood"],
  [/\bcommunitys\b/i, "communities"],
  [/\bits'\b/, "its / it's"],
  [/\bshould of\b/i, "should have"],
  [/\bwould of\b/i, "would have"],
  [/\balot\b/i, "a lot"],
];

const FRAGMENT_STARTERS =
  /^(and|but|or|so|because|which|while|although|though|whereas|plus|also)\b/i;

const VERBISH =
  /\b(is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|keeps?|gets?|makes?|turns?|builds?|answers?|saves?|stays?|works?|helps?|needs?|adds?|owns?|shows?|comes?|goes?|lives?|starts?|happens?|becomes?|[a-z]+(?:s|ed|ing))\b/i;

function ruleCheck({ file, line, text, source }) {
  const issues = [];
  const at = (level, rule, detail) => issues.push({ file, line, text, level, rule, detail });

  if (/—|–/.test(text))
    at("error", "em-dash", "Contains an em/en dash; use a comma, colon or new sentence.");
  if (/…/.test(text)) at("error", "ellipsis", "Contains a typographic ellipsis character.");
  if (/\.\.\./.test(text)) at("warn", "ellipsis", "Contains '...'; prefer a complete sentence.");
  if (/ {2,}\S/.test(text)) at("error", "double-space", "Contains repeated spaces.");
  if (/\s+[,.;:!?]/.test(text)) at("error", "space-before-punct", "Space before punctuation.");
  if (/[,;:][^\s"'”)\]]/.test(text))
    at("error", "missing-space", "Missing space after punctuation.");
  if (/[!?]{2,}|\.{4,}/.test(text)) at("error", "repeated-punct", "Repeated punctuation marks.");
  if (/[A-Z]{5,}/.test(text.replace(/\b(VouchList|FAQ|AI|WhatsApp|RLS|SEO)\b/g, "")))
    at("warn", "shouting", "Long run of capital letters.");
  if (/\s$|^\s/.test(text)) at("warn", "whitespace", "Leading or trailing whitespace.");

  const straight = /(^|\s)"/.test(text);
  const curly = /[“”]/.test(text);
  if (straight && curly) at("error", "mixed-quotes", "Mixes straight and curly quotation marks.");

  for (const [re, fix] of COMMON_TYPOS) {
    if (re.test(text)) at("error", "typo", `Possible typo; did you mean "${fix}"?`);
  }

  // Sentence-level checks.
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const isHeadline = sentences.length === 1 && !/[.!?]$/.test(text) && text.length < 90;

  for (const sentence of sentences) {
    const words = sentence
      .replace(/[“”"']/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (FRAGMENT_STARTERS.test(sentence) && /[.!?]$/.test(sentence))
      at("warn", "fragment", `Sentence starts with a conjunction: "${sentence}"`);
    if (!isHeadline && words.length >= 5 && !VERBISH.test(sentence) && /\.$/.test(sentence))
      at("warn", "fragment", `Possible sentence fragment (no verb): "${sentence}"`);
    if (/^[a-z]/.test(sentence) && words.length >= 3 && /[.!?]$/.test(sentence))
      at("error", "capitalisation", `Sentence does not start with a capital: "${sentence}"`);
  }

  if (
    source === "literal" &&
    !isHeadline &&
    sentences.length &&
    !/[.!?:”"’)]$/.test(text) &&
    text.split(/\s+/).length > 12
  )
    at("warn", "terminal-punct", "Long copy block does not end with punctuation.");

  return issues;
}

/* --------------------------------------------------------------------- AI */

async function aiReview(entries) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    console.warn("! LOVABLE_API_KEY is not set; skipping the AI grammar pass.\n");
    return [];
  }

  const payload = entries.map((e, i) => ({ id: i, file: e.file, line: e.line, text: e.text }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a copy editor for a professional product website written in British English. " +
            "Review each string for grammar errors, typos, sentence fragments, and inconsistent punctuation. " +
            "Short marketing headlines without a full stop are acceptable and must not be reported. " +
            "Deliberate stylistic short sentences are acceptable if grammatical. " +
            'Reply with JSON: {"issues":[{"id":number,"problem":string,"suggestion":string}]}. ' +
            "Return an empty array when the copy is clean.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI review rate limited (429). Try again shortly.");
  if (res.status === 402)
    throw new Error("AI review unavailable (402): workspace AI credits are exhausted.");
  if (!res.ok) throw new Error(`AI review failed (${res.status}): ${await res.text()}`);

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.warn("! Could not parse the AI response; skipping AI findings.\n");
    return [];
  }

  return (parsed.issues ?? [])
    .filter((i) => payload[i.id])
    .map((i) => ({
      ...entries[i.id],
      level: "warn",
      rule: "ai-grammar",
      detail: `${i.problem}${i.suggestion ? ` Suggested: "${i.suggestion}"` : ""}`,
    }));
}

/* -------------------------------------------------------------------- run */

async function main() {
  const files = collectFiles();
  const entries = files.flatMap(extractStrings);
  const issues = entries.flatMap(ruleCheck);

  if (USE_AI) {
    try {
      issues.push(...(await aiReview(entries)));
    } catch (error) {
      console.error(`! ${error.message}\n`);
    }
  }

  console.log(`Copy QA: ${entries.length} strings across ${files.length} files\n`);

  if (!issues.length) {
    console.log("No grammar or formatting issues found. Ready to publish.");
    return;
  }

  const byFile = new Map();
  for (const issue of issues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, []);
    byFile.get(issue.file).push(issue);
  }

  for (const [file, list] of [...byFile].sort()) {
    console.log(file);
    for (const i of list.sort((a, b) => a.line - b.line)) {
      const tag = i.level === "error" ? "ERROR" : "warn ";
      console.log(`  ${tag} ${String(i.line).padStart(4)}  [${i.rule}] ${i.detail}`);
      console.log(`         "${i.text.slice(0, 110)}${i.text.length > 110 ? "…" : ""}"`);
    }
    console.log("");
  }

  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;
  console.log(`${errors} error(s), ${warnings} warning(s).`);
  if (errors) process.exitCode = 1;
}

main();
