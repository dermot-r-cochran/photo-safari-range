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
    if (typeof L.ev !== "number") fail("light " + l + " has no exposure value");
  }
  const lens = R.lensFor(k);
  if (!lens || !lens.name || !(lens.min < lens.max) || !lens.floor) fail("range " + k + " has no usable lens");
  else {
    if (R.lensApertures(lens).length < 3) fail("range " + k + " lens offers fewer than three stops");
    if (!R.SCALES[scale].includes(lens.floor)) fail("range " + k + " lens floor " + lens.floor + " is not on the " + scale + " scale");
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
  const scale = onSky ? "sky" : "day", light = onSky ? "newmoon" : "heat", lens = onSky ? R.lensFor("sky") : R.lensFor("amber");
  const e1 = R.exposeFor("S", R.BEHAVIOURS[b].asked, 8, light, b, scale, lens, null);
  const v = R.score(e1, b, { inside: true, cut: false, fill: 0.3 }, light, a, scale);
  if (!v.prize || !v.lines.includes(R.WORDS.prize)) fail("a keeper of " + a + " is not marked a hard plate: " + v.lines.join(" | "));
  const e2 = R.exposeFor("S", R.SHUTTERS[0], 8, "heat", "flight", "day", R.lensFor("amber"), null);
  const w = R.score(e2, "flight", { inside: true, cut: false, fill: 0.3 }, "heat", a);
  if (w.prize) fail("a folder plate of " + a + " is marked a hard plate");
  ok();
}
// dark plates score nothing
if (R.score(R.exposeFor("S", "1/250", 8, "night", "walking", "day", R.lensFor("amber"), null), "walking", { inside: true, cut: false, fill: 0.3, dark: true }, "night").stars !== 0) fail("a plate outside the lamp scored");
// the sky: the words say lines, not smear, and a unique subject spawns once
const sky = R.score(R.exposeFor("S", "30s", 4, "newmoon", "points", "sky", R.lensFor("sky"), "tripod"), "points", { inside: true, cut: false, fill: 0.3 }, "newmoon", null, "sky", "tripod");
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
// days: legs in order and touching, lights real and on the range's scale,
// pause and end legs with words, the last leg an end
for (const d in R.DAYS) {
  const day = R.DAYS[d];
  if (day.length < 2) fail("day " + d + " has fewer than two legs");
  for (let i = 0; i < day.length; i++) {
    const l = day[i];
    if (!l.name || !l.from || !l.to) fail("day " + d + " leg " + i + " is missing name, from or to");
    if (R.hm(l.to) < R.hm(l.from)) fail("day " + d + " leg " + l.name + " ends before it starts");
    if (i > 0 && R.hm(l.from) !== R.hm(day[i - 1].to)) fail("day " + d + " leg " + l.name + " does not start when " + day[i - 1].name + " ends");
    if (l.light && !R.LIGHTS[l.light]) fail("day " + d + " leg " + l.name + " has light " + l.light + ", which does not exist");
    if (l.pause && typeof l.pause !== "string") fail("day " + d + " leg " + l.name + " pause is not words");
    if (l.end && typeof l.end !== "string") fail("day " + d + " leg " + l.name + " end is not words");
  }
  if (!day[day.length - 1].end) fail("day " + d + " does not end");
  if (R.legAt(day, R.hm(day[0].from)) !== 0) fail("day " + d + ": the clock at its start is not in its first leg");
  // a stop is a pause or the end and nothing else; a stop held for a shot
  // never turns the clock back when it resumes
  for (const l of day) {
    if (R.stopsFor(l) !== !!(l.pause || l.end)) fail("day " + d + " leg " + l.name + ": stopsFor disagrees with its words");
    if (R.stopsFor(l) && R.clockAfter(R.hm(l.to) + 20, l) !== R.hm(l.to) + 20) fail("day " + d + " leg " + l.name + ": a held stop rewound the clock");
    if (R.stopsFor(l) && R.clockAfter(R.hm(l.from), l) !== R.hm(l.to)) fail("day " + d + " leg " + l.name + ": a stop taken on time does not end when it ends");
  }
  ok();
}
for (const k in R.RANGES) {
  const day = R.dayFor(k); if (!day) continue;
  for (const l of day) if (l.light && !R.lightsFor(k).includes(l.light)) fail("range " + k + " day sets light " + l.light + ", which the range does not offer");
  // the level by the clock: a window's own value at the middle of its
  // leg, EDGE_DROP darker at the day's first and last lit minute, never
  // outside that band, a lamp the lamp's at any hour, and no NaN
  const lit = day.filter(l => l.light && !R.LIGHTS[l.light].lamp && R.hm(l.to) > R.hm(l.from));
  for (const l of lit) {
    const mid = (R.hm(l.from) + R.hm(l.to)) / 2;
    if (Math.abs(R.evAt(k, mid, l.light) - R.LIGHTS[l.light].ev) > 1e-9) fail("range " + k + " at the middle of " + l.name + " is not the window's own level");
  }
  if (lit.length) {
    if (Math.abs(R.evAt(k, R.hm(lit[0].from), lit[0].light) - (R.LIGHTS[lit[0].light].ev - R.EDGE_DROP)) > 1e-9) fail("range " + k + " first lit minute is not EDGE_DROP darker");
    if (Math.abs(R.evAt(k, R.hm(lit[lit.length - 1].to), lit[lit.length - 1].light) - (R.LIGHTS[lit[lit.length - 1].light].ev - R.EDGE_DROP)) > 1e-9) fail("range " + k + " last lit minute is not EDGE_DROP darker");
  }
  for (const light of R.lightsFor(k)) {
    const evs = R.lightsFor(k).filter(x => !R.LIGHTS[x].lamp).map(x => R.LIGHTS[x].ev);
    const lo = Math.min(...evs) - R.EDGE_DROP, hi = Math.max(...evs);
    for (let t = R.hm(day[0].from); t <= R.hm(day[day.length - 1].from); t += 7) {
      const ev = R.evAt(k, t, light);
      if (!Number.isFinite(ev)) fail("range " + k + " light " + light + " at " + R.clockLabel(t) + ": level is " + ev);
      if (R.LIGHTS[light].lamp) { if (ev !== R.LIGHTS[light].ev) fail("range " + k + ": the lamp's level moved with the clock"); }
      else if (ev < lo - 1e-9 || ev > hi + 1e-9) fail("range " + k + " light " + light + " at " + R.clockLabel(t) + ": level " + ev + " outside " + lo + ".." + hi);
    }
  }
  ok();
}
for (const k in R.RANGES) if (!R.dayFor(k)) for (const light of R.lightsFor(k)) if (R.evAt(k, 600, light) !== R.LIGHTS[light].ev) fail("range " + k + " has no day, but its level moved");
if (R.clockLabel(R.hm("06:15")) !== "06:15" || R.clockLabel(R.hm("18:45")) !== "18:45") fail("clockLabel does not round-trip");
// lights
for (const k in R.LIGHTS) {
  const l = R.LIGHTS[k];
  if (typeof l.ev !== "number" || !l.name) fail("light " + k + " has no exposure value or name");
  ok();
}
// the camera: the exposure model behaves like the tutorial says the body does
{
  const lens = R.lensFor("amber");
  // S at heat, 1/250: ISO 100, and the camera stops down for depth
  const s1 = R.exposeFor("S", "1/250", 8, "heat", "walking", "day", lens, null);
  if (s1.iso !== 100 || s1.aperture < 5.6 || s1.over >= 0.5 || s1.under > 0) fail("S at heat 1/250 is not a clean ISO 100 exposure: " + JSON.stringify(s1));
  // S at last light, 1/2000: wide open and the ISO up, likely dark
  const s2 = R.exposeFor("S", "1/2000", 8, "last", "flight", "day", lens, null);
  if (s2.aperture !== 5.6 || s2.iso < 1600) fail("S at last light 1/2000 did not open up and raise ISO: " + JSON.stringify(s2));
  // A at heat, f/8: shutter fast, ISO 100
  const a1 = R.exposeFor("A", "1/250", 8, "heat", "walking", "day", lens, null);
  if (a1.iso !== 100 || R.tSeconds(a1.shutter) > R.tSeconds(lens.floor)) fail("A at heat f/8 did not hold ISO 100 above the floor: " + JSON.stringify(a1));
  // A at night, f/8: the ISO hits the cap and the shutter drops under the floor
  const a2 = R.exposeFor("A", "1/250", 8, "night", "walking", "day", lens, null);
  if (!a2.dropped || a2.iso !== R.ISO_CAP || R.tSeconds(a2.shutter) <= R.tSeconds(lens.floor)) fail("A at night f/8 did not drop the shutter at the cap: " + JSON.stringify(a2));
  // A never sets a shutter off the scale
  for (const light of ["first", "heat", "last", "night"]) for (const N of R.lensApertures(lens)) {
    const e = R.exposeFor("A", "1/250", N, light, "walking", "day", lens, null);
    if (!R.SCALES.day.includes(e.shutter)) fail("A set a shutter off the scale: " + e.shutter);
    checks++;
  }
  // M at last light, 1/2000 f/22: dark by stops; M at heat 1/8 f/5.6: blown
  const m1 = R.exposeFor("M", "1/2000", 22, "last", "flight", "day", lens, null);
  if (!(m1.under >= 2)) fail("M at last light 1/2000 f/22 is not dark by two stops: " + JSON.stringify(m1));
  const m2 = R.exposeFor("M", "1/8", 5.6, "heat", "resting", "day", lens, null);
  if (!(m2.over >= 1)) fail("M at heat 1/8 f/5.6 is not blown: " + JSON.stringify(m2));
  // the moon meters as a sunlit rock whatever the sky
  const moon = R.exposeFor("M", "1/250", 8, "newmoon", "sunlit", "sky", R.lensFor("sky"), "tripod");
  if (moon.iso > 200 || moon.under > 0) fail("the moon did not meter as sunlit: " + JSON.stringify(moon));
  // a support lowers the A-mode floor: ISO 100 holds longer
  const a3 = R.exposeFor("A", "1/250", 8, "last", "resting", "day", lens, "beanbag");
  const a4 = R.exposeFor("A", "1/250", 8, "last", "resting", "day", lens, null);
  if (a3.iso > a4.iso) fail("a support raised the ISO in A");
  // the dark and blown plates lose stars; diffraction at f/16 loses one
  const dark = R.score(m1, "flight", { inside: true, cut: false, fill: 0.3 }, "last", null, "day");
  if (dark.stars > 1 || !dark.lines.includes(R.WORDS.under2)) fail("a frame two stops dark did not lose two stars");
  const blown = R.score(m2, "resting", { inside: true, cut: false, fill: 0.3 }, "heat", null, "day");
  if (!blown.lines.includes(R.WORDS.over)) fail("a blown frame is not named");
  const diff = R.score(R.exposeFor("M", "1/60", 16, "heat", "resting", "day", lens, null), "resting", { inside: true, cut: false, fill: 0.3 }, "heat", null, "day");
  if (!diff.lines.includes(R.WORDS.diffPlain) || diff.stars === 3) fail("f/16 did not cost a star for diffraction");
  // every pull's depth words are strings in known bands, and the macro 1:1 says millimetre at f/8
  for (const k in R.RANGES) for (const p of R.pullsFor(k)) if (p.depth) for (const band in p.depth) {
    if (!["wide", "mid", "stopped", "narrow"].includes(band)) fail("pull " + p.name + " on " + k + " has depth band " + band);
    if (typeof p.depth[band] !== "string") fail("pull " + p.name + " depth " + band + " is not words");
  }
  const macro = R.score(R.exposeFor("M", "1/125", 8, "overcast", "still", "day", R.lensFor("home"), null), "still", { inside: true, cut: false, fill: 0.3 }, "overcast", null, "day", null, R.pullsFor("home")[2]);
  if (!macro.lines.some(l => /millimetre/.test(l))) fail("1:1 at f/8 does not say millimetre");
  // the bodies: real steps and caps, a known autofocus kind, and the newer mirrorless
  // holds ISO where the older DSLR has to drop the shutter
  for (const k in R.BODIES) {
    const B = R.BODIES[k];
    if (!B.name || !["centre", "eye"].includes(B.af) || !B.note) fail("body " + k + " is missing name, af or note");
    if (!Array.isArray(B.isoSteps) || B.isoSteps[0] !== 100 || B.isoSteps[B.isoSteps.length - 1] !== B.cap) fail("body " + k + " ISO steps do not run from 100 to its cap");
    if (!B.isoSteps.includes(B.noiseFrom)) fail("body " + k + " noise threshold is not an ISO step");
    if (!(B.diffraction.soft < B.diffraction.plain)) fail("body " + k + " diffraction thresholds are out of order");
    ok();
  }
  for (const k in R.RANGES) { const b = R.bodyFor(k); if (!R.BODIES[b]) fail("range " + k + " defaults to body " + b); if (!R.lensFor(k, b)) fail("range " + k + " has no lens for " + b); }
  const dz = R.exposeFor("A", "1/250", 8, "night", "walking", "day", lens, null, R.BODIES.newer);
  if (dz.dropped || dz.iso > R.BODIES.newer.cap) fail("the newer mirrorless dropped the shutter where its cap should have held: " + JSON.stringify(dz));
  const dd = R.exposeFor("A", "1/250", 8, "night", "walking", "day", lens, null, R.BODIES.older);
  if (!dd.dropped) fail("the older DSLR did not drop the shutter at night in A");
  const z16 = R.score(R.exposeFor("M", "1/60", 8, "heat", "resting", "day", lens, null, R.BODIES.newer), "resting", { inside: true, cut: false, fill: 0.3 }, "heat", null, "day", null, null, R.BODIES.newer);
  if (!z16.lines.some(l => /f\/8: diffraction/.test(l))) fail("the newer mirrorless does not name diffraction from f/8");
  // the guide's advice is always words or nothing
  if (R.ADVICE) for (const mode of ["S", "A", "M"]) for (const light of ["heat", "last", "night"]) for (const b of ["resting", "running", "flight"]) for (const N of R.lensApertures(lens)) {
    const e = R.exposeFor(mode, "1/250", N, light, b, "day", lens, null);
    const t = R.advise(e, b, "day", null, R.PULLS[2], "drive");
    if (t !== null && typeof t !== "string") fail("advice is not words for " + mode + " " + light + " " + b);
    checks++;
  }
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
// misses: every frame has a file, a fault the coaching knows, an animal if it names one, and words
for (const m of R.MISSES) {
  if (!m.file || !m.title || !m.alt || !m.caption) fail("miss " + (m.title || m.file) + " is missing file, title, alt or caption");
  if (!R.COACH.tips[m.fault] || m.fault === "other") fail("miss " + m.title + " names fault " + m.fault + ", which the coaching does not");
  if (m.animal && !R.ANIMALS[m.animal]) fail("miss " + m.title + " is of " + m.animal + ", not an animal");
  if (!onDisk.has(m.file)) fail("miss " + m.title + " has no file images/" + m.file);
  if (referenced.has(m.file)) fail("miss file " + m.file + " is listed twice");
  referenced.add(m.file);
  if (/[0-9]+\/[0-9]+|f\/[0-9]/.test(m.alt)) fail("miss " + m.title + " alt states settings");
  ok();
}
// missFor: the plate's own animal first, any frame of the fault after, null for a fault with none
if (!R.missFor("dark", "zebra", R.mulberry(3)) || R.missFor("dark", "zebra", R.mulberry(3)).animal !== "zebra") fail("missFor skipped the zebra's own dark frame");
if (!R.missFor("cut", "lion", R.mulberry(3))) fail("missFor gave nothing for a cut lion, though a cut frame exists");
if (R.missFor("other", null, R.mulberry(3)) !== null) fail("missFor gave a frame for a fault with none");
ok();
for (const f of onDisk) if (!referenced.has(f)) fail("images/" + f + " is not shown on any plate or miss");
// the wanted list: exactly the cast animals with no frame, and never one with a frame
for (const k in R.RANGES) {
  const w = R.wantedFor(k);
  for (const a of w) { if (!R.RANGES[k].cast[a]) fail("wanted list for " + k + " names " + a + ", not in its cast"); if (R.PLATES.some(p => p.animal === a)) fail("wanted list for " + k + " names " + a + ", which has a frame"); }
  if (w.length) console.log("  author's shooting list, " + R.RANGES[k].name + ": " + w.map(x => R.ANIMALS[x].name).join(", "));
  for (const a in R.RANGES[k].cast) if (!R.PLATES.some(p => p.animal === a) && !w.includes(a)) fail("wanted list for " + k + " misses " + a);
  ok();
}
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
    const lens = scale === "sky" ? R.lensFor("sky") : R.lensFor("amber");
    for (const s of R.SCALES[scale]) for (const f of framings) {
      const e = R.exposeFor("S", s, 8, light, b, scale, lens, scale === "sky" ? "tripod" : null);
      if (!R.SCALES[scale].includes(e.shutter) || !R.lensApertures(lens).includes(e.aperture) || !R.ISO_STEPS.includes(e.iso)) fail("exposure off the dials: " + JSON.stringify(e));
      const v = R.score(e, b, f, light, null, scale, scale === "sky" ? "tripod" : null);
      if (!(v.stars >= 0 && v.stars <= 3)) fail("score out of range: " + s + " " + b);
      if (!Array.isArray(v.lines) || !v.lines.length) fail("score with no words: " + s + " " + b);
      if (v.lines.some(x => x === undefined)) fail("score with a missing word: " + s + " " + b + " on " + scale);
      if (!f.inside && v.stars !== 0) fail("a plate with nothing in it scored " + v.stars);
      const asked = R.askedFor(b, scale === "sky" ? "tripod" : null, scale);
      if (f.inside && !f.cut && f.fill === 0.3 && s === asked && e.over < 0.5 && !e.under && e.aperture < R.DIFFRACTION.plain && !(v.stars === 3 && v.keeper)) fail("matched shutter, clean frame, clean exposure, not three stars: " + b + " at " + light + ": " + v.lines.join(" | "));
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
    const light = scale === "day" ? "first" : "newmoon", lens = scale === "day" ? R.lensFor("amber") : R.lensFor("sky");
    const e = R.exposeFor("S", bag, 8, light, b, scale, lens, "beanbag");
    const v = R.score(e, b, { inside: true, cut: false, fill: 0.3 }, light, null, scale, "beanbag");
    // in bright light a slow shutter drives S to f/16 and diffraction, which is true to life; the test is about the support
    if (e.over >= 0.5 || e.aperture >= R.DIFFRACTION.plain) { checks++; continue; }
    if (v.stars !== 3 || !v.lines.includes(R.WORDS.beanbag)) fail("a still subject on the beanbag at its supported shutter is not a clean three stars: " + b + " " + v.lines.join(" | "));
    const w = R.score(e, b, { inside: true, cut: false, fill: 0.3 }, light, null, scale, null);
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
