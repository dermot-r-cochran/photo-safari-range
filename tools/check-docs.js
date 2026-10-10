#!/usr/bin/env node
"use strict";
/* check-docs — hold the Markdown to what is on disk.
 *
 * Three checks, Node only, nothing to install:
 *
 * 1. Every relative link in README.md (and in any Markdown under docs/, if
 *    that folder ever exists) names a file or folder that exists. External
 *    links (http, https, mailto) and in-page anchors are not checked.
 * 2. No Markdown file in the repository carries a second front-matter
 *    block: a `---` line, then only `key: value` lines, then `---`,
 *    anywhere but at the very top. That is what a stray fragment left by a
 *    merge looks like.
 * 3. Every count the README states about the repository's own files
 *    matches the files on disk (the COUNTS table below; add a row when the
 *    README states a new one).
 *
 * The shape follows architecture-definition-model's check_docs.py. The
 * README-proof convention it backs was Dermot's decision of 10 October
 * 2026: every capability bullet names the check that proves it, or says
 * "no test yet" or "not yet implemented".
 *
 *     node tools/check-docs.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const errors = [];

// The page's world data, loaded the way tools/check.js loads it, so a count
// of plate frames can be taken from the files on disk that PLATES names
// (the rest of images/ is the MISSES frames, which the README does not count).
function world() {
  const vm = require("vm");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const ctx = { console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx, { filename: "index.html" });
  return ctx.RANGE;
}
const onDisk = () => new Set(fs.readdirSync(path.join(root, "images")));
const plateFiles = (keep) => { const R = world(), disk = onDisk(); return R.PLATES.filter(p => disk.has(p.file) && keep(R, p)).length; };

// The README's counts of files on disk: a pattern whose first group is the
// number (in words or digits), and how to count the files it is about.
const COUNTS = [
  {
    what: "plate frames under images/",
    pattern: /\b([A-Za-z-]+|\d+) frames\s+so far,\s+under\s+`images\/`/,
    count: () => plateFiles(() => true)
  },
  {
    what: "Beech Wood plate frames under images/",
    pattern: /\b([A-Za-z-]+|\d+)\s+frames from the portfolio's Macro and Nature pages/,
    count: () => plateFiles((R, p) => !!R.RANGES.home.cast[p.animal])
  }
];

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numberOf(word) {
  if (/^\d+$/.test(word)) return Number(word);
  const parts = word.toLowerCase().split("-");
  let n = 0;
  for (const p of parts) {
    if (UNITS.includes(p)) n += UNITS.indexOf(p);
    else if (TENS.includes(p) && p) n += 10 * TENS.indexOf(p);
    else return null;
  }
  return n;
}

function markdownFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...markdownFiles(p));
    else if (e.name.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out;
}

// Body lines outside fenced code blocks, with inline code removed.
function proseLines(text) {
  const kept = [];
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return; }
    if (!fenced) kept.push([i + 1, line.replace(/`[^`\n]*`/g, "")]);
  });
  return kept;
}

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const all = markdownFiles(root);

// 2. front matter: a block anywhere but the top is a second one
const KEY = /^[A-Za-z_][\w-]*\s*:(\s|$)/;
for (const file of all) {
  const lines = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced || lines[i].trim() !== "---") continue;
    let j = i + 1, keys = 0;
    while (j < lines.length && KEY.test(lines[j])) { keys++; j++; }
    if (!keys || j >= lines.length || lines[j].trim() !== "---") continue;
    if (i === 0) { i = j; continue; }
    errors.push(rel(file) + ":" + (i + 1) + ": a front-matter block below the top of the file");
    i = j;
  }
}

// 1. relative links in the README and docs/
const LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const REF = /^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/;
const linked = all.filter(f => rel(f) === "README.md" || rel(f).startsWith("docs/"));
for (const file of linked) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const [n, line] of proseLines(text)) {
    const targets = [...line.matchAll(LINK)].map(m => m[1]);
    const ref = line.match(REF);
    if (ref) targets.push(ref[1]);
    for (const target of targets) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      const p = decodeURI(target.split("#")[0].split("?")[0]);
      if (!p) continue;
      const resolved = p.startsWith("/") ? path.join(root, p) : path.join(path.dirname(file), p);
      if (!fs.existsSync(resolved)) errors.push(rel(file) + ":" + n + ": link " + JSON.stringify(target) + " resolves to nothing");
    }
  }
}

// 3. the README's counts
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8").replace(/\r\n/g, "\n");
for (const c of COUNTS) {
  const m = readme.match(c.pattern);
  if (!m) { errors.push("README.md: no longer states the count of " + c.what + "; update COUNTS in tools/check-docs.js"); continue; }
  const said = numberOf(m[1]), found = c.count();
  if (said !== found) errors.push("README.md: says " + m[1] + " " + c.what + ", and there are " + found);
}

for (const e of errors) console.error("  FAIL: " + e);
console.log(all.length + " Markdown files, " + linked.length + " link-checked, " + COUNTS.length + " count(s), " + errors.length + " problem(s)");
process.exit(errors.length ? 1 : 0);
