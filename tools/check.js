#!/usr/bin/env node
"use strict";
/* check — run the game's model without a browser.
 *
 * Loads the <script> out of index.html into a bare VM context (no
 * `document`, so the page never boots) and holds the world data and the
 * scorer to the shape the page relies on: every behaviour asks for a
 * shutter the camera has, every animal's states are behaviours, every
 * range's cast is animals, every light window prices every shutter, the
 * scorer returns 0..3 for every shutter against every behaviour and every
 * framing, a matched shutter with a clean frame is always a keeper, and a
 * spawn plan is deterministic and spaced. Node only — nothing to install.
 *
 *     node tools/check.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no <script> block in index.html"); process.exit(1); }

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(m[1], ctx, { filename: "index.html" });
const R = ctx.RANGE;
if (!R) { console.error("the script did not export RANGE"); process.exit(1); }

let fails = 0, checks = 0;
const fail = (msg) => { fails++; console.error("  FAIL: " + msg); };
const ok = () => { checks++; };

// scales
const allShutters = new Set();
for (const s in R.SCALES) {
  if (R.SCALES[s].length < 4) fail("scale " + s + " has fewer than four shutters");
  for (const sh of R.SCALES[s]) allShutters.add(sh);
}
// behaviours
for (const k in R.BEHAVIOURS) {
  const b = R.BEHAVIOURS[k];
  if (!allShutters.has(b.asked)) fail("behaviour " + k + " asks for " + b.asked + ", not a shutter on any scale");
  if (!b.verb || !b.note) fail("behaviour " + k + " has no verb or note");
  ok();
}
// every animal a range casts asks only for shutters on that range's scale,
// and every light a range offers is priced on that scale
for (const k in R.RANGES) {
  const r = R.RANGES[k], scale = R.scaleFor(k);
  if (!R.SCALES[scale]) fail("range " + k + " shoots on scale " + scale + ", which does not exist");
  for (const a in r.cast) for (const b in (R.ANIMALS[a] || { states: {} }).states) {
    if (!R.SCALES[scale].includes(R.BEHAVIOURS[b].asked)) fail("range " + k + " casts " + a + ", whose " + b + " asks " + R.BEHAVIOURS[b].asked + ", not on the " + scale + " scale");
  }
  for (const l of R.lightsFor(k)) {
    const L = R.LIGHTS[l]; if (!L) continue;
    if ((L.scale || "day") !== scale) fail("range " + k + " offers light " + l + ", which is on the " + (L.scale || "day") + " scale");
    for (const sh of R.SCALES[scale]) if (!(L.iso[sh] > 0)) fail("light " + l + " has no ISO for " + sh);
  }
  ok();
}
// animals
for (const k in R.ANIMALS) {
  const a = R.ANIMALS[k];
  if (!a.name || !a.latin || !a.shape || !a.colour) fail("animal " + k + " is missing name, latin, shape or colour");
  if (!(a.size > 0)) fail("animal " + k + " has no size");
  let n = 0;
  for (const s in a.states) { if (!R.BEHAVIOURS[s]) fail("animal " + k + " has state " + s + ", not a behaviour"); n++; }
  if (!n) fail("animal " + k + " has no states");
  if (a.fly && !("flight" in a.states)) fail("animal " + k + " flies but never has flight");
  ok();
}
// ranges
for (const k in R.RANGES) {
  const r = R.RANGES[k];
  if (!["drive", "hide", "walk", "tripod"].includes(r.seat)) fail("range " + k + " seat is " + r.seat);
  if (!r.name || !r.place || !r.note) fail("range " + k + " is missing name, place or note");
  let n = 0, day = 0;
  for (const s in r.cast) { if (!R.ANIMALS[s]) fail("range " + k + " casts " + s + ", not an animal"); else if (!R.ANIMALS[s].night) day++; n++; }
  if (n < 2) fail("range " + k + " casts fewer than two animals");
  if (day < 2) fail("range " + k + " has fewer than two animals by day");
  const lights = R.lightsFor(k);
  if (!lights.length) fail("range " + k + " offers no light");
  for (const l of lights) if (!R.LIGHTS[l]) fail("range " + k + " offers light " + l + ", which does not exist");
  const hasNightOnly = Object.keys(r.cast).some(s => R.ANIMALS[s] && R.ANIMALS[s].night);
  if (hasNightOnly && !lights.some(l => R.LIGHTS[l] && R.LIGHTS[l].lamp)) fail("range " + k + " casts a night animal but offers no night drive");
  // a day plan never spawns a night-only animal; a night plan can
  const dayPlan = R.spawnPlan(k, 40, R.mulberry(11), lights[0]);
  if (!R.LIGHTS[lights[0]].lamp && dayPlan.some(p => R.ANIMALS[p.key].night)) fail("range " + k + " spawns a night animal by day");
  ok();
}
// a keeper on a prize animal says so
for (const a in R.ANIMALS) if (R.ANIMALS[a].prize) {
  const b = Object.keys(R.ANIMALS[a].states)[0];
  const onSky = !R.SCALES.day.includes(R.BEHAVIOURS[b].asked);
  const v = R.score(R.BEHAVIOURS[b].asked, b, { inside: true, cut: false, fill: 0.3 }, onSky ? "newmoon" : "heat", a, onSky ? "sky" : "day");
  if (!v.prize || !v.lines.includes(R.WORDS.prize)) fail("a keeper of " + a + " is not marked a hard plate");
  const w = R.score(R.SHUTTERS[0], "flight", { inside: true, cut: false, fill: 0.3 }, "heat", a);
  if (w.prize) fail("a folder plate of " + a + " is marked a hard plate");
  ok();
}
// dark plates score nothing
if (R.score("1/250", "walking", { inside: true, cut: false, fill: 0.3, dark: true }, "night").stars !== 0) fail("a plate outside the lamp scored");
// the sky: the words say lines, not smear, and a unique subject spawns once
const sky = R.score("30s", "points", { inside: true, cut: false, fill: 0.3 }, "newmoon", null, "sky");
if (sky.stars !== 2 || !/lines/.test(sky.lines.join(" "))) fail("a stop over on the sky scale does not say the stars drew lines");
for (const k in R.RANGES) for (const l of R.lightsFor(k)) {
  const plan = R.spawnPlan(k, 30, R.mulberry(5), l);
  const seen = {};
  for (const p of plan) {
    const A = R.ANIMALS[p.key];
    if (A.unique && seen[p.key]) fail("range " + k + " spawns " + p.key + " twice");
    seen[p.key] = 1;
    if (A.only && !A.only.includes(l)) fail("range " + k + " spawns " + p.key + " under " + l + ", which it does not appear in");
  }
}
// lights
for (const k in R.LIGHTS) {
  const l = R.LIGHTS[k];
  for (const s of R.SCALES[l.scale || "day"]) if (!(l.iso[s] > 0)) fail("light " + k + " has no ISO for " + s);
  ok();
}
// pulls, the default set and any range's own
if (R.PULLS.length < 2) fail("fewer than two pulls on the glass");
for (const p of R.PULLS) if (!(p.frac > 0 && p.frac <= 1)) fail("pull " + p.name + " has a bad fraction");
for (const k in R.RANGES) {
  const pulls = R.pullsFor(k);
  if (pulls.length < 2) fail("range " + k + " has fewer than two pulls");
  for (const p of pulls) {
    if (!p.name || !p.note || !(p.frac > 0 && p.frac <= 1)) fail("range " + k + " pull " + (p.name || "?") + " is missing name, note or a good fraction");
    if (p.verdict !== undefined && typeof p.verdict !== "string") fail("range " + k + " pull " + p.name + " has a verdict that is not words");
  }
  ok();
}

// plates: every frame has a file, an animal, behaviours the animal has, words
const imagesDir = path.join(root, "images");
const onDisk = fs.existsSync(imagesDir) ? new Set(fs.readdirSync(imagesDir)) : new Set();
const referenced = new Set();
for (const p of R.PLATES) {
  if (!p.file || !p.title || !p.alt || !p.caption) fail("plate " + (p.title || p.file) + " is missing file, title, alt or caption");
  if (!R.ANIMALS[p.animal]) fail("plate " + p.title + " is of " + p.animal + ", not an animal");
  if (!Array.isArray(p.behaviours) || !p.behaviours.length) fail("plate " + p.title + " names no behaviour");
  for (const b of p.behaviours || []) {
    if (!R.BEHAVIOURS[b]) fail("plate " + p.title + " names behaviour " + b);
    else if (R.ANIMALS[p.animal] && !R.ANIMALS[p.animal].states[b]) fail("plate " + p.title + ": " + p.animal + " never does " + b);
  }
  if (!onDisk.has(p.file)) fail("plate " + p.title + " has no file images/" + p.file);
  if (referenced.has(p.file)) fail("plate file " + p.file + " is listed twice");
  referenced.add(p.file);
  if (/[0-9]+\/[0-9]+|f\/[0-9]/.test(p.alt)) fail("plate " + p.title + " alt states settings");
  ok();
}
for (const f of onDisk) if (!referenced.has(f)) fail("images/" + f + " is not shown on any plate");
// plateFor: exact before any, deterministic, null for an animal with no frame
for (const a in R.ANIMALS) for (const b in R.ANIMALS[a].states) {
  const p = R.plateFor(a, b, R.mulberry(3));
  const has = R.PLATES.some(x => x.animal === a);
  if (has && !p) fail("plateFor gave nothing for " + a + " " + b);
  if (!has && p) fail("plateFor gave a frame for " + a + ", which has none");
  if (p && R.PLATES.some(x => x.animal === a && x.behaviours.includes(b)) && !p.behaviours.includes(b)) fail("plateFor skipped an exact frame for " + a + " " + b);
  checks++;
}

// scorer
const framings = [
  { inside: false, cut: false, fill: 0 },
  { inside: true, cut: true, fill: 0.3 },
  { inside: true, cut: false, fill: 0.05 },
  { inside: true, cut: false, fill: 0.3 },
  { inside: true, cut: false, fill: 0.6 }
];
for (const light in R.LIGHTS) {
  const scale = R.LIGHTS[light].scale || "day";
  for (const b in R.BEHAVIOURS) {
    if (!R.SCALES[scale].includes(R.BEHAVIOURS[b].asked)) continue;
    for (const s of R.SCALES[scale]) for (const f of framings) {
      const v = R.score(s, b, f, light, null, scale);
      if (!(v.stars >= 0 && v.stars <= 3)) fail("score out of range: " + s + " " + b);
      if (!Array.isArray(v.lines) || !v.lines.length) fail("score with no words: " + s + " " + b);
      if (v.lines.some(x => x === undefined)) fail("score with a missing word: " + s + " " + b + " on " + scale);
      if (!f.inside && v.stars !== 0) fail("a plate with nothing in it scored " + v.stars);
      if (f.inside && !f.cut && f.fill === 0.3 && s === R.BEHAVIOURS[b].asked && !(v.stars === 3 && v.keeper)) fail("matched shutter, clean frame, not three stars: " + b + " at " + light);
      if (v.keeper !== (v.stars >= 2)) fail("keeper does not follow the stars: " + s + " " + b);
      checks++;
    }
  }
}
if (R.shutterLabel(250) !== "1/250" || R.shutterLabel("15s") !== "15s") fail("shutterLabel does not read old and new plates alike");
// a support lowers the floor for a still subject by two stops and leaves a
// moving one alone; the scorer honours it and says so
for (const b in R.BEHAVIOURS) {
  const scale = R.SCALES.day.includes(R.BEHAVIOURS[b].asked) ? "day" : "sky";
  const hand = R.askedFor(b, null, scale), bag = R.askedFor(b, "beanbag", scale);
  const s = R.SCALES[scale], di = s.indexOf(hand) - s.indexOf(bag);
  if (R.STILL[b] && !(di === 2 || (di > 0 && s.indexOf(bag) === 0))) fail("a support does not lower " + b + " by two stops");
  if (!R.STILL[b] && hand !== bag) fail("a support changed " + b + ", which moves");
  if (R.STILL[b] && hand !== bag) {
    const v = R.score(bag, b, { inside: true, cut: false, fill: 0.3 }, scale === "day" ? "heat" : "newmoon", null, scale, "beanbag");
    if (v.stars !== 3 || !v.lines.includes(R.WORDS.beanbag)) fail("a still subject on the beanbag at its supported shutter is not a clean three stars");
    const w = R.score(bag, b, { inside: true, cut: false, fill: 0.3 }, scale === "day" ? "heat" : "newmoon", null, scale, null);
    if (w.stars === 3) fail("the supported shutter scored three in the hand for " + b);
  }
  checks++;
}

// measureFrame
const plate = { x: 100, y: 100, w: 400, h: 225 };
const inside = R.measureFrame({ x: 200, y: 150, w: 80, h: 50 }, plate);
if (!inside.inside || inside.cut) fail("a box wholly inside the plate reads as cut or outside");
const cut = R.measureFrame({ x: 460, y: 150, w: 80, h: 50 }, plate);
if (!cut.inside || !cut.cut) fail("a box over the edge does not read as cut");
const out = R.measureFrame({ x: 600, y: 150, w: 80, h: 50 }, plate);
if (out.inside) fail("a box outside the plate reads as inside");
ok();

// spawn plan: deterministic, spaced, valid
for (const k in R.RANGES) {
  const a = R.spawnPlan(k, 14, R.mulberry(7)), b = R.spawnPlan(k, 14, R.mulberry(7));
  if (JSON.stringify(a) !== JSON.stringify(b)) fail("spawn plan for " + k + " is not deterministic");
  for (let i = 1; i < a.length; i++) if (a[i].x - a[i - 1].x < 200) fail("spawn plan for " + k + " puts two animals within a jeep-length");
  if (a[0].x > 800) fail("spawn plan for " + k + " leaves the range empty on entry");
  for (const p of a) { if (!R.ANIMALS[p.key]) fail("spawn cast " + p.key); if (!R.ANIMALS[p.key].states[p.behaviour]) fail("spawned " + p.key + " " + p.behaviour + ", a state it does not have"); }
  ok();
}

console.log(checks + " checks, " + fails + " failures");
process.exit(fails ? 1 : 0);
