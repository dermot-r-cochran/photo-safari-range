#!/usr/bin/env node
"use strict";
/* check-play — boot the page and play every range without a browser.
 *
 * tools/check.js loads the script into a bare VM context with no
 * `document`, so the page never boots and everything below the RANGE
 * export (the camp, the clock, the cards, the keys, the sheet) had no
 * test. This check gives the same script a stub document: every element
 * id the HTML carries, elements that keep what is written to them, a
 * canvas whose 2D context accepts any call and draws nothing, a
 * localStorage in memory, a requestAnimationFrame the check pumps by
 * hand, and a Date.now that does not move, so a run is the same every
 * time. Then it does what a player does: reads the camp, picks each range
 * by its button, lets the day run, presses the keys the pad prints, fires
 * a shot, keeps a plate, takes the break card and the end card, and packs
 * up. Only the element ids and the canvas size are read out of
 * index.html, and the page gets no test hook; the stub only stands in
 * for the browser. Node only — nothing to install.
 *
 *     node tools/check-play.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no <script> block in index.html"); process.exit(1); }

let fails = 0, checks = 0;
const fail = (msg) => { fails++; console.error("  FAIL: " + msg); };
const ok = () => { checks++; };

// ---- the stub document ----

// A 2D context that takes any call and draws nothing.
const ctx2d = () => new Proxy({}, {
  get(t, p) {
    if (typeof p !== "string") return undefined;
    if (p in t) return t[p];
    if (p === "measureText") return () => ({ width: 10 });
    if (/Gradient$/.test(p)) return () => ({ addColorStop() {} });
    return () => {};
  },
  set(t, p, v) { t[p] = v; return true; }
});

class El {
  constructor(tag, id) {
    this.tagName = tag.toUpperCase(); this.id = id || ""; this.children = []; this.parent = null;
    this._html = ""; this._text = ""; this.hidden = false; this.className = ""; this.title = "";
    this.dataset = {}; this.style = {}; this.disabled = false; this.listeners = {};
    const self = this;
    this.classList = {
      contains: (n) => self.className.split(/\s+/).includes(n),
      add: (n) => { if (!self.classList.contains(n)) self.className = (self.className + " " + n).trim(); },
      remove: (n) => { self.className = self.className.split(/\s+/).filter(x => x && x !== n).join(" "); },
      toggle: (n, force) => { const on = force === undefined ? !self.classList.contains(n) : !!force; if (on) self.classList.add(n); else self.classList.remove(n); return on; }
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this._text = ""; for (const c of this.children) c.parent = null; this.children = []; }
  get textContent() { return this._text + this._html.replace(/<[^>]*>/g, "") + this.children.map(c => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this._html = ""; for (const c of this.children) c.parent = null; this.children = []; }
  appendChild(c) { this.insertBefore(c, null); return c; }
  append(...cs) { for (const c of cs) this.appendChild(c); }
  prepend(c) { if (c.parent) c.remove(); c.parent = this; this.children.unshift(c); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } }
  replaceWith(c) { const p = this.parent; if (!p) return; const i = p.children.indexOf(this); if (c.parent) c.remove(); c.parent = p; p.children.splice(i, 1, c); this.parent = null; }
  scrollIntoView() {}
  focus() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 0, height: this.height || 0 }; }
  getContext() { return ctx2d(); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  dispatch(type, ev) { for (const fn of this.listeners[type] || []) fn(ev); }
  // every element in the tree below this one, this one included
  all() { return [this].concat(...this.children.map(c => c.all())); }
  find(pred) { return this.all().find(pred) || null; }
}

// Every element the HTML gives an id, with its `hidden` and a canvas's size.
const byId = {};
for (const tag of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
  const attrs = tag[2], id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
  if (!id) continue;
  const el = new El(tag[1], id);
  el.hidden = /\bhidden\b/.test(attrs);
  const w = attrs.match(/\bwidth="(\d+)"/), h = attrs.match(/\bheight="(\d+)"/);
  if (w) el.width = Number(w[1]);
  if (h) el.height = Number(h[1]);
  byId[id] = el;
}
if (!byId.scene || !(byId.scene.width > 0)) fail("the HTML has no canvas#scene with a width");

const store = {};
let now = 0, rafCb = null;
const T = 1700000000000; // a fixed Date.now, so the seeded spawn is the same on every run
const sandbox = {
  console,
  document: { getElementById: (id) => byId[id] || null, createElement: (tag) => new El(tag), querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  performance: { now: () => now }
};
sandbox.globalThis = sandbox;

// A plate kept by an earlier version of the page: the shutter as a number
// and an animal the cast no longer has (the meerkat left on the first day).
const legacy = [{ when: 1, range: "amber", light: "heat", shutter: 250, animal: "meerkat", behaviour: "sentinel", stars: 3, keeper: true, lines: ["Keeper."], iso: 100 }];
store["psr.sheet"] = JSON.stringify(legacy);

vm.createContext(sandbox);
vm.runInContext("Date.now = () => " + T + ";", sandbox);
try {
  vm.runInContext(m[1], sandbox, { filename: "index.html" });
} catch (e) {
  fail("the page did not boot: " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | "));
  console.log(checks + " checks, " + fails + " failures");
  process.exit(1);
}
const R = sandbox.RANGE;
if (!R) { fail("the script did not export RANGE"); console.log(checks + " checks, " + fails + " failures"); process.exit(1); }

// ---- the player's hands ----

const $ = (id) => byId[id];
const stage = $("stage");
// a key pressed and released on the stage, as the keyboard does it
const key = (k) => { const ev = { key: k, preventDefault() {} }; stage.dispatch("keydown", ev); stage.dispatch("keyup", ev); };
// the frame loop, pumped at twenty frames a second of the page's own clock
const run = (seconds) => {
  for (let i = 0, n = Math.round(seconds * 20); i < n; i++) {
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error("the frame loop stopped");
    now += 50; cb(now);
  }
};
const button = (el, text) => el.find(e => e.tagName === "BUTTON" && e.textContent === text);
const hudClock = () => { const k = $("hud").children[0]; const mm = k && k.textContent.match(/^(\d\d):(\d\d)/); return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null; };
const castNamed = (text, rangeKey) => Object.keys(R.RANGES[rangeKey].cast).some(a => text.includes(R.ANIMALS[a].name));

// ---- at camp, as the page opens ----
if ($("camp").hidden) fail("the page did not open at camp");
if (!/At camp/.test($("hud").textContent)) fail("the HUD at camp does not say so: " + $("hud").textContent);
if (!$("pause").hidden || !$("radio").hidden) fail("a card or the radio is showing at camp");
for (const k in R.RANGES) if (!button($("range-pick"), R.RANGES[k].name)) fail("the camp has no button for " + R.RANGES[k].name);
const lit = $("range-pick").find(e => e.tagName === "BUTTON" && e.className === "on");
if (!lit || lit.textContent !== R.RANGES.zambezi.name) fail("the camp does not light the Zambezi hide, where the page opens (2026-09-27): " + (lit && lit.textContent));
for (const k in R.BODIES) if (!button($("body-pick"), R.BODIES[k].name)) fail("the camp has no button for the " + R.BODIES[k].name);
// the sheet saved by an earlier version reads back: the numeric shutter as a fraction, the lost animal as a dash
if (!/1 plate kept, 1 keeper/.test($("sheet-line").textContent)) fail("a legacy sheet did not read back: " + $("sheet-line").textContent);
if (!/1\/250/.test($("sheet").textContent) || !/—/.test($("sheet").textContent)) fail("a legacy plate's numeric shutter or lost animal is not shown as the page promises: " + $("sheet").textContent);
$("clear").onclick();
if ($("sheet-line").textContent !== "No plates yet." || store["psr.sheet"] !== "[]") fail("Clear the sheet did not clear it");
ok();

// ---- every range, from its button to the pack-up ----
for (const k in R.RANGES) {
  const Rk = R.RANGES[k], day = R.dayFor(k), seat = Rk.seat;
  const where = Rk.name + " (" + seat + ")";
  try {
    $("plates").innerHTML = "";
    const b = button($("range-pick"), Rk.name);
    b.onclick();
    if (!$("camp").hidden) fail(where + ": picking the range did not set out");
    if (!$("range-line").textContent.startsWith(Rk.name)) fail(where + ": the header does not name the range: " + $("range-line").textContent);
    if ($("radio").hidden || !/Spotter|Guide/.test($("radio").innerHTML)) fail(where + ": nobody spoke on setting out");
    const first = $("radio").innerHTML;
    // the guide's first words are the seat's rule
    if (seat === "drive" && !/Stay in the vehicle/.test(first)) fail(where + ": the jeep's guide did not say stay in the vehicle: " + first);
    if (seat === "walk" && !Rk.wood && !/Single file/.test(first)) fail(where + ": the walking guide did not say single file: " + first);
    if (seat === "hide" && !/Sit still/.test(first)) fail(where + ": the hide's guide did not say sit still: " + first);
    const t0 = hudClock();
    if (day ? t0 !== R.hm(day[0].from) : t0 !== null) fail(where + ": the clock did not start at the day's first leg: " + $("hud").textContent);
    // thirty seconds of the outing: the spotter calls something from the cast, and nothing throws
    let called = false, named = false;
    for (let s = 0; s < 30; s++) {
      run(1);
      if (!$("radio").hidden && castNamed($("radio").innerHTML, k)) called = true;
      if (castNamed($("asked").textContent, k)) named = true;
    }
    if (!called) fail(where + ": in thirty seconds the spotter never called an animal of the cast");
    if (!named) fail(where + ": in thirty seconds the Asked panel never named a subject");
    if (!$("asked").textContent.trim()) fail(where + ": the Asked panel is blank");
    if (day) {
      const t1 = hudClock();
      if (t1 === null || Math.abs(t1 - (t0 + 30 * R.CLOCK_RATE)) > 1) fail(where + ": the clock did not run at CLOCK_RATE: " + $("hud").textContent);
    }
    // every key the controls help prints, with the camera down and up: none may throw
    for (const kk of ["s", "a", "m", "tab", "[", "]", ",", ".", "z", "b", "arrowup", "arrowdown", "arrowleft", "arrowright", "c"]) { key(kk); run(0.2); }
    // a shot: Space raises the camera if it is down and fires if it is up
    const before = $("plates").children.length;
    key(" "); run(0.5);
    if ($("plates").children.length === before) { key(" "); run(0.5); }
    const card = $("plates").children[0];
    if (!card || $("plates").children.length === before) fail(where + ": Space did not make a plate");
    else {
      const text = card.textContent;
      if (!/[★☆]{3}/.test(text)) fail(where + ": the plate card has no stars: " + text);
      if (!/Keeper\.|One for the folder\./.test(text)) fail(where + ": the plate card has no verdict: " + text);
      if (!text.includes(R.BODIES[R.bodyFor(k)].name)) fail(where + ": the plate card does not name the range's own body: " + text);
      // its two buttons: keep, when there was something to keep, and the folder or clear
      const keep = button(card, "Keep this"), drop = card.find(e => e.tagName === "BUTTON" && (e.textContent === R.WORDS.toFolder || e.textContent === R.WORDS.clear));
      if (!keep || !drop) fail(where + ": the plate card is missing its buttons");
      else if (keep.disabled !== /☆☆☆/.test(text)) fail(where + ": Keep this is " + (keep.disabled ? "disabled" : "enabled") + " on " + text.match(/[★☆]{3}/)[0]);
      else if (!keep.disabled) {
        keep.onclick();
        if (!/1 plate kept/.test($("sheet-line").textContent)) fail(where + ": a kept plate did not reach the sheet: " + $("sheet-line").textContent);
        if (!JSON.parse(store["psr.sheet"]).length) fail(where + ": a kept plate was not saved");
        if (card.parent) fail(where + ": a kept plate's card stayed");
        $("clear").onclick();
      } else {
        const kept = store["psr.sheet"];
        drop.onclick();
        if (card.parent) fail(where + ": the folder button left the card");
        if (store["psr.sheet"] !== kept) fail(where + ": the folder button changed the sheet");
      }
    }
    if (day) {
      // N takes the day to its first break: the card shows the leg's words and Continue resumes on the next leg
      const pauseAt = day.findIndex(l => l.pause);
      if (pauseAt > 0) {
        for (let i = 0; i < pauseAt; i++) { key("n"); run(0.2); }
        const p = $("pause");
        if (p.hidden || !p.textContent.includes(day[pauseAt].pause)) fail(where + ": N did not bring the break card for " + day[pauseAt].name + ": " + p.textContent);
        const cont = button(p, "Continue");
        if (!cont) fail(where + ": the break card has no Continue");
        else { cont.onclick(); run(0.2); }
        if (!p.hidden) fail(where + ": Continue did not close the break card");
        if (hudClock() < R.hm(day[pauseAt].to)) fail(where + ": the clock did not move to the end of the break: " + $("hud").textContent);
        if (!$("hud").textContent.includes(day[pauseAt + 1].name)) fail(where + ": after the break the HUD does not name " + day[pauseAt + 1].name + ": " + $("hud").textContent);
      }
      // N to the end of the day (a break card takes one N to continue and
      // the next leg another): the end card, the day's tally, and the
      // printed key packs up
      const p = $("pause");
      const end = day[day.length - 1];
      for (let i = 0; i < 2 * day.length + 2 && (p.hidden || !p.textContent.includes(end.end)); i++) { key("n"); run(0.2); }
      if (p.hidden || !p.textContent.includes(end.end)) fail(where + ": N did not reach the end of the day: " + p.textContent);
      if (!button(p, "Pack up")) fail(where + ": the end card has no Pack up");
      if (!/kept from|keeper today|No shots today/.test(p.textContent)) fail(where + ": the end card gives no tally: " + p.textContent);
      key("escape"); run(0.2);
      if ($("camp").hidden) { fail(where + ": Esc on the end card did not pack up, though the pad prints it"); button(p, "Pack up").onclick(); }
    } else {
      // no day: Esc with a shot fired shows the day so far, and Esc again packs up
      key("escape"); run(0.2);
      if ($("pause").hidden || !$("pause").textContent.includes(R.COACH.packEarly)) fail(where + ": Esc after a shot did not show the day so far: " + $("pause").textContent);
      const pack = button($("pause"), "Pack up");
      if (!pack) fail(where + ": the packing-up card has no Pack up");
      key("escape"); run(0.2);
      if ($("camp").hidden) { fail(where + ": Esc on the packing-up card did not pack up, though the pad prints it"); if (pack) pack.onclick(); }
    }
    if (!$("pause").hidden || !$("radio").hidden) fail(where + ": a card or the radio stayed after packing up");
    if (!$("range-line").textContent.startsWith(Rk.name)) fail(where + ": back at camp the header does not name the range");
    if (!/At camp/.test($("hud").textContent)) fail(where + ": back at camp the HUD does not say so");
    run(1);
    ok();
  } catch (e) {
    fail(where + ": " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | "));
    // back to camp for the next range, if the page can get there
    try { if ($("camp").hidden) { key("escape"); run(0.2); const pack = button($("pause"), "Pack up"); if (pack) pack.onclick(); } } catch (e2) { /* the next range reports its own */ }
  }
}

// ---- with the camera down, only the clock redraws the HUD ----
// on a trip of its own after the ranges, so these seconds move no range's seeded spawn
try {
  button($("range-pick"), R.RANGES.amber.name).onclick();
  run(30); key("c"); run(0.2); // whatever the spotter raised, the camera comes down
  const c0 = hudClock();
  run(2);
  if ($("pause").hidden && hudClock() === c0) fail("with the camera down the HUD's clock stood still: " + $("hud").textContent);
  key("escape"); run(0.2);
  const pack = button($("pause"), "Pack up"); if (pack) pack.onclick();
  if ($("camp").hidden) fail("could not pack up after the clock check");
  ok();
} catch (e) {
  fail("the clock with the camera down: " + String(e.stack || e).slice(0, 300));
}

// ---- a break never interrupts a shot: the stop is held while the camera is up on a subject ----
// On the hide, where the camera is up from the first minute and nothing
// drives, the clock is run to a few minutes before a break and an animal is
// put in the frame (the aim swept across the bank if none is there); then
// the clock crosses into the break with the camera up on it. No card may
// come: the HUD names the leg waiting, the guide says it can wait, and the
// clock runs on. C puts the camera down and the card comes on the next
// tick, at the clock's own time, not the leg's start; Continue goes on to
// the leg after the break, never back. The day's second break is taken at
// once with N from the same hold. Then the hide is sat a second time and
// the first break held again, and this time nothing is pressed: the aim
// moves a pixel with the subject still in the frame and the break is still
// held, then goes to a piece of empty sky, the subject is out of the frame,
// and the card comes on its own, at the clock's own time.
try {
  const k = "zambezi", Rk = R.RANGES[k], day = R.dayFor(k);
  const where = Rk.name + ", a break held for a shot";
  button($("range-pick"), Rk.name).onclick();
  let aim = null; // where the aim was last put, so it can be moved a pixel
  const aimAt = (x, y) => { aim = { x, y }; stage.dispatch("pointermove", { target: byId.scene, clientX: x, clientY: y }); };
  const cameraUp = () => $("hud").textContent.includes("Space: shoot");
  const focused = () => cameraUp() && castNamed($("asked").textContent, k);
  // the camera up on an animal of the cast: the hide's is up already unless
  // a card put it down, else Space; the aim swept if the frame is empty
  const findSubject = () => {
    if (!cameraUp()) { key(" "); run(0.05); }
    for (let y = 0.35; y <= 0.85 && !focused(); y += 0.15) for (let x = 0.06; x <= 0.95 && !focused(); x += 0.08) { aimAt(x * byId.scene.width, y * byId.scene.height); run(0.05); }
    return focused();
  };
  // the clock to a minute, a second at a time and then a frame at a time, so it does not overshoot
  const runTo = (min) => { for (let i = 0; i < 400 && hudClock() < min - 2; i++) run(1); for (let i = 0; i < 100 && hudClock() < min; i++) run(0.05); };
  const cardClock = () => { const mm = $("pause").innerHTML.match(/· (\d\d):(\d\d)<\/h2>/); return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null; };
  // cross into the stop with the camera up on a subject; true when the leg is held as the page promises
  const holdInto = (stopAt) => {
    const stop = day[stopAt];
    runTo(R.hm(stop.from) - 5);
    if (!findSubject()) { fail(where + ": could not put an animal of the cast in the frame before " + stop.name + ": " + $("asked").textContent); return false; }
    const waitLine = R.WORDS.wait.replace("{leg}", stop.name);
    let said = false;
    for (let i = 0; i < 200 && (hudClock() < R.hm(stop.from) || i < 2); i++) { run(0.05); if (!$("radio").hidden && $("radio").innerHTML.includes(waitLine)) said = true; }
    let held = true;
    if (!$("pause").hidden) { fail(where + ": the card for " + stop.name + " came while the camera was up on a subject"); held = false; }
    if (!$("hud").textContent.includes(stop.name + " waits")) { fail(where + ": the HUD does not say " + stop.name + " waits: " + $("hud").textContent); held = false; }
    if (!said) { fail(where + ": the guide did not say the break can wait: " + $("radio").innerHTML); held = false; }
    return held;
  };
  const stopAt = day.findIndex(l => l.pause);
  const stop = day[stopAt];
  if (holdInto(stopAt)) {
    // the clock runs on while the break waits
    const c1 = hudClock(); run(1); const c2 = hudClock();
    if (!(c2 > c1)) fail(where + ": the clock stood still while " + stop.name + " waited: " + $("hud").textContent);
    if (!$("pause").hidden) fail(where + ": the card came before the camera was down");
    // C puts the camera down: the card comes, at the clock's own time
    key("c"); run(0.1);
    const p = $("pause");
    if (p.hidden || !p.textContent.includes(stop.pause)) fail(where + ": C did not bring the card for " + stop.name + ": " + (p.hidden ? "no card" : p.textContent));
    const cc = cardClock();
    if (cc === null || cc <= R.hm(stop.from) || cc < c2) fail(where + ": the card's clock was turned back: " + p.innerHTML.slice(0, 80));
    const cont = button(p, "Continue");
    if (!cont) fail(where + ": the held break's card has no Continue");
    else { cont.onclick(); run(0.2); }
    if (hudClock() < R.hm(stop.to) || hudClock() < cc) fail(where + ": Continue turned the clock back: " + $("hud").textContent);
    if (!$("hud").textContent.includes(day[stopAt + 1].name)) fail(where + ": after the held break the HUD does not name " + day[stopAt + 1].name + ": " + $("hud").textContent);
  }
  // the next break, held the same way and taken at once with N
  const nextAt = day.findIndex((l, i) => i > stopAt && l.pause);
  if (nextAt > 0 && holdInto(nextAt)) {
    const next = day[nextAt];
    key("n"); run(0.05);
    const p = $("pause");
    if (p.hidden || !p.textContent.includes(next.pause)) fail(where + ": N did not take the held " + next.name + " at once: " + (p.hidden ? "no card" : p.textContent));
    const cont = button(p, "Continue");
    if (cont) { cont.onclick(); run(0.2); }
    if (hudClock() < R.hm(next.to)) fail(where + ": Continue after the held " + next.name + " turned the clock back: " + $("hud").textContent);
  }
  // the subject leaving the frame releases the hold without a key: the hide
  // sat again from camp, the first break held again, then the aim moved to a
  // piece of empty sky (the top of the picture, swept until the Asked panel
  // says nothing is in the frame, or until the card has already come)
  key("escape"); run(0.2);
  const packed = button($("pause"), "Pack up"); if (packed) packed.onclick();
  if ($("camp").hidden) fail(where + ": could not pack up before the second sit");
  button($("range-pick"), Rk.name).onclick();
  aimAt(byId.scene.width / 2, byId.scene.height * 0.7); run(0.05);
  const emptyFrame = () => cameraUp() && $("asked").textContent === R.emptyWords(k, "frame");
  const released = () => !$("pause").hidden || emptyFrame();
  const findSky = () => {
    for (let y = 0.02; y <= 0.3 && !released(); y += 0.07) for (let x = 0.02; x <= 0.98 && !released(); x += 0.08) { aimAt(x * byId.scene.width, y * byId.scene.height); run(0.05); }
    return released();
  };
  if (holdInto(stopAt)) {
    // a second with the subject held, so the clock is past the leg's start before the release
    run(1); const c0 = hudClock();
    // the aim moving is not the subject leaving: a pixel's move with the
    // subject still in the frame, and the break is still held
    aimAt(aim.x + 1, aim.y); run(0.1);
    if (!$("pause").hidden) fail(where + ": the card came on the aim moving a pixel with the subject still in the frame");
    else if (!focused()) fail(where + ": a pixel's move of the aim lost the subject: " + $("asked").textContent);
    else if (!$("hud").textContent.includes(stop.name + " waits")) fail(where + ": the HUD dropped " + stop.name + " waits on the aim moving a pixel: " + $("hud").textContent);
    if (!findSky()) fail(where + ": could not find a piece of empty sky to aim at: " + $("asked").textContent);
    else {
      // the camera is still up, with nothing in the frame, until the next tick brings the card
      if ($("pause").hidden && !cameraUp()) fail(where + ": the camera went down on its own when the subject left the frame");
      run(0.1);
      const p = $("pause");
      if (p.hidden || !p.textContent.includes(stop.pause)) fail(where + ": the subject leaving the frame did not bring the card for " + stop.name + ", with no key pressed: " + (p.hidden ? "no card" : p.textContent));
      const cc = cardClock();
      if (cc === null || cc <= R.hm(stop.from) || cc < c0) fail(where + ": the card's clock was turned back when the subject left the frame (held to " + R.clockLabel(c0) + "): " + p.innerHTML.slice(0, 80));
      if ($("hud").textContent.includes(stop.name + " waits")) fail(where + ": the HUD still says " + stop.name + " waits after the subject left the frame: " + $("hud").textContent);
      const cont = button(p, "Continue");
      if (cont) { cont.onclick(); run(0.2); }
      if (hudClock() < R.hm(stop.to) || hudClock() < cc) fail(where + ": Continue after the released " + stop.name + " turned the clock back: " + $("hud").textContent);
      if (!$("hud").textContent.includes(day[stopAt + 1].name)) fail(where + ": after the released break the HUD does not name " + day[stopAt + 1].name + ": " + $("hud").textContent);
    }
  }
  key("escape"); run(0.2);
  const pack = button($("pause"), "Pack up"); if (pack) pack.onclick();
  if ($("camp").hidden) fail("could not pack up after the hold check");
  ok();
} catch (e) {
  fail("a break held for a shot: " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | "));
}

// ---- a body chosen at camp carries onto the range ----
try {
  const other = Object.keys(R.BODIES).find(b => b !== R.bodyFor("amber"));
  button($("body-pick"), R.BODIES[other].name).onclick();
  const own = $("body-pick").find(e => e.tagName === "BUTTON" && e.className === "on");
  if (!own || own.textContent !== R.BODIES[other].name) fail("choosing a body at camp did not light it");
  $("plates").innerHTML = "";
  button($("range-pick"), R.RANGES.amber.name).onclick();
  run(2); key(" "); run(0.5); if (!$("plates").children.length) { key(" "); run(0.5); }
  const card = $("plates").children[0];
  if (!card || !card.textContent.includes(R.BODIES[other].name + " ·")) fail("a body chosen at camp is not the body on the plate: " + (card && card.textContent));
  key("escape"); run(0.2); key("escape"); run(0.2);
  if ($("camp").hidden) { fail("could not pack up after the body check"); const pack = button($("pause"), "Pack up"); if (pack) pack.onclick(); }
  button($("body-pick"), "The body the range was shot on").onclick();
  ok();
} catch (e) {
  fail("the body choice: " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | "));
}

console.log(checks + " checks, " + fails + " failures");
process.exit(fails ? 1 : 0);
