# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## What this is

A one-file browser arcade about wildlife photography. Open `index.html` in
any browser: no server, no build, no dependencies, no network, no
framework. The player drives a range or sits a hide, raises the camera on
an animal, reads what the animal is doing, matches the shutter the spotter
asks for, and shoots. The plate scores on that match and on the framing.
The contact sheet saves to localStorage.

It began on 2026-09-17 as the rebuild of four hosted-builder prototypes
that Dermot abandoned that day (and retired outright on 2026-09-19: they
are not named or linked anywhere in this repository): the builder could not keep the
apps consistent across changes. The design features worth keeping were
written down first (in design notes on his machine, summarised in the README) and the source was not exported. This is not a
port of any of them.

## The prime directive

**Everything the player can meet lives in the WORLD DATA section at the
top of `index.html`'s script, and the engine below it never needs editing
to add an animal, a behaviour, a range or a light.** The rules follow from
that, and they are the `four-islands-quest` rules this repository inherits:

- **No dependencies, no build step, no network calls, no framework.** Not
  in the page, not in the tools. `tools/check.js` runs on the Node that
  ships with the CI runner and installs nothing.
- **One reviewable file.** Plain literals in one place; don't split,
  minify, or move content into JSON the page fetches.
- **Never rewrite `index.html` programmatically.** Author by hand or with
  an assistant. The check loads the script into a bare VM context (no
  `document`) and reads the `RANGE` export at the end of the engine's pure
  section; everything that needs a document sits below that export inside
  the `if (typeof document !== "undefined")` block.
- **The page works with no picture files.** The animals are canvas
  silhouettes, and a plate with no frame shows the crop alone.
- **The photograph comes after the verdict, as a comparison.** `PLATES`
  lists the author's own frames (file, animal, behaviours, title, alt,
  caption), copied at site size from the portfolio under its licence.
  After a shot that hit something, `plateFor` picks a frame of the same
  animal and behaviour, else any of the animal, and the card shows it
  under *The frame this was learned on*, with the player's crop inset. It
  never stands in for the score; the stars and the verdict are the
  player's plate. Dermot's choice, 2026-09-17, over generated sprites
  ("option 1"): the frames are the one asset no other safari game has.
  Captions state no settings unless the point of the frame is the
  settings (The Break); the site JPEGs carry no EXIF, so nothing is
  invented. The check holds every plate to a file, an animal, behaviours
  that animal has, and words, and every file under `images/` to a plate.
  Only the author's own photographs, ever.
- **A folder plate may show the frame the author got wrong the same
  way** (Dermot, 2026-09-25, "1 - Yes" to a miss plate by the coaching
  key). `MISSES` lists his own misses, each with a `fault` that is a key
  of `COACH.tips` (dark, slow, fast, noise, small, cut, diffraction,
  miss), an optional `animal`, and file, title, alt and caption. After a
  shot that is not a keeper, `missFor(fault, animal)` picks the plate's
  own animal first, else any frame of that fault, and `showPlate` shows
  it under *The frame this was got wrong on* with the crop inset, exactly
  as a keeper shows its frame; a fault with no frame shows the crop
  alone as before. Real frames from the archive at site size, as shot
  except for a healed dust spot; the caption may state settings, since
  the settings are the point, and the alt never does. The check holds
  every miss to those fields, to a fault the coaching knows, and every
  file under `images/` to a plate or a miss. The plate's second button
  reads *To the folder* when the frame had an animal in it and *Clear*
  when it was empty (Dermot, the same day: a non-keeper is a negative
  example to learn from, so *Discard* said the wrong thing). It only
  removes the card; the day's record keeps every shot for the coaching
  either way.

## The one rule the game teaches

The shutter follows the animal. Every behaviour in `BEHAVIOURS` carries
the shutter it asks for and a one-line ethogram note; the scorer
(`score`) gives three stars for a match with a clean frame, loses one for
a stop slow, two for two stops slow, one for two stops fast, one for a
frame-edge cut, one for a speck. Two stars is a keeper. A stop fast is
free except for the ISO it costs, and the verdict names the noise at 1600
or more. Change a threshold only when the field notes in
`dermot-cochran-photography` change; say which note.

## No makes or models

Dermot's rule, 2026-09-17: the game (and the tutorial) name no camera or
lens make or model, so nothing reads as endorsement or criticism. His
photography site is transparent about the gear; here the bodies are "the
older DSLR" and "the newer mirrorless", the lenses "the long zoom at
400 mm" and "the 70 mm macro", and the numbers are stated as one camera's
without the name. The frames under `images/` carry no EXIF, so nothing
leaks that way either. Keep it that way in data, verdicts, comments, the
README and the check's messages.

## Animals belong where they live

Dermot, 17 Sept 2026: "I did not see any Meerkats in Kenya last year."
Quite right: meerkats are southern Africa's, and the Mara's sentinel on a
termite mound is the banded mongoose, which replaced it the same day. The
prototype had put the meerkat there and it was carried over unchecked.
Before adding an animal to a range, check that it lives there; the
spotter's calls are only worth anything if they are true.

## Tone

- Nothing is killed on the range. Predators stalk and rush; prey runs;
  the count does not drop.
- Stay in the vehicle is the guide's hard rule and the spotter says it.
- Written by a novice for other novices; no judging register, no claims
  of expertise. The camera's numbers are one camera's and the README says
  so.
- The portfolio carries no generated images. This game may, under
  `images/`, at its own address, never inside the portfolio's pages.

## The clock is the limit, not a stroke count

Dermot, 2026-09-19: *Range game is time limited rather than counting
shots. It was no penalty for non-keepers.* The tutorial scores like golf
(every press a stroke, par one a stop); this game does not, and should
not be made to. The day's clock is the whole constraint: a plate for the
folder costs the minutes it took and nothing else, the sheet counts what
was kept, and the end-of-day card gives keepers from shots as a tally
with one piece of coaching, never as a score against par. Don't add
strokes, par or a penalty for a miss here.

## South Luangwa

Added 2026-09-17 for Dermot's 2027 Zambia trip, on his choice of small hard
subjects over elephants: `seat: "walk"` (a third of the jeep's pace, and
the shy ones run from anyone moving within a longer range), a `night`
light with `lamp: 1` (dark outside a circle that follows the aim; an
animal outside it cannot be focused or shot, and the ISO is 3200 at every
shutter), animals marked `prize` (a keeper is a "hard plate", counted on
the sheet) and `night` (spawns only on a lamp light). A range lists its
`lights`; the default is the three day windows. There are no frames for
these animals yet; the plate shows the crop alone until he has been.

## Night Sky

Added 2026-09-17 at Dermot's one word, *Astrophotography*, and his
choice of a range in the game over a trip note or a tutorial stop. It
introduced the one structural change since the first commit: shutters are
strings on named `SCALES` (`day` in fractions, `sky` in seconds and
minutes, both ordered slowest to fastest so the scorer's stop arithmetic
is unchanged), a range names its `scale`, a light names the scale it
prices, and `SCALE_WORDS` overrides the verdict words where a stop over
means lines rather than smear. Sky subjects are animals with `sky: 1`
(hung at a height of the frame, drawn by `drawSky`), `unique: 1` (one
moon), and `only: [lights]` (no moon on a new moon, no core under the
moon). The seat is `tripod`: nothing drives, nothing spooks. Saved plates
from before the change carry a numeric shutter; `shutterLabel` reads both.
The numbers are one camera's again: the 500 rule at the 18 mm end of the
zoom on the crop body, and ISO 3200 as its ceiling.

## Beech Wood, the macro range (named Home Ground until 2026-09-19)

Added 2026-09-17 at Dermot's "a macro range for flowers, insects and
mushrooms". Same day scale, `seat: "walk"`, `wood: 1` (trunks instead of
crowns on the horizon), and the first range with its own `pulls`: the
three magnifications 1:4, 1:2 and 1:1, each with a `note` for the HUD and
the last two with a `verdict` line the scorer appends to any plate that
hit (`pullsFor`). The depth-of-field numbers are the tutorial's: about a
millimetre at 1:1 and f/8, a few millimetres at 1:2, diffraction from
f/11 and the effective aperture two stops darker at 1:1. Behaviours
`still` (1/125, the hand-held floor at 70 mm), `breeze` (1/250),
`working` (1/500) and `crawling` (1/250); insects `spook` on foot. Three
lights: bright overcast (the macro light), dappled sun, the woodland
floor. Seventeen frames from the portfolio's Macro and Nature pages;
two are stored under their page slug because the site file is a camera
name (dsc_1030, dsc_1000). Aperture is still not a control the player
sets; the pulls carry its cost in words. If that ever changes, it is a
second axis on the scorer, not a new range.

## Fifteen Acres

Added 2026-09-19 at Dermot's word (*Fifteen Acres range sounds great*),
the evening of the club's Phoenix Park deer morning in mist. The range is
the Saturday Shutters deer outing on the walk seat: a `shutters` day (the
rut at nine, the herd in mist, coffee at half eleven, back across the
acres under overcast, home at one), three behaviours of its own (`alert`,
`groaning`, `sparring`), fallow buck and doe with a jackdaw and a hooded
crow, and a rutting buck that spawns under the rut's light alone through
`only: ["rut"]`, the first use of `only` for a day light rather than a
sky one. The park's fifty metres is the range's own rule, the way "stay in
the vehicle" is the jeep's: the herd keeps it, so the long zoom is the
lens, and the note says what 50 mm gives at that distance (the field, with
deer in it a fortieth of the frame each). Its two plates are from 19
September 2026 at 50 mm, and their captions name the focal length because
the lens is the point of the frame, which is the one case captions state
a setting. Dermot's rule the same day, for this game and the tutorial:
example frames need not be on the portfolio site, but every one must be a
real photograph or an edit of a real photograph. No frame of the rut yet;
the rut on 24 October 2026 is the shooting list.

## A break never interrupts a shot

Dermot, 2026-09-19: *don't suddenly stop for a break in the middle of an
active shoot*. Until then `tickClock` showed the pause card the instant
the clock crossed into a `pause` or `end` leg, and `showPause` put the
camera down on whatever it was on. Now a leg that stops the outing
(`stopsFor`) is held while the player is shooting (`shooting`: the camera
up with an animal in focus, which on a hide clears when the plate
empties): `holdLeg` records it in `state.waiting`, the guide says
`WORDS.wait`, the HUD clock names the leg waiting, and the card comes on
the first tick after the camera is down or the focus is gone, or at once
on N. The clock runs on while a stop waits and `clockAfter` keeps
`resumeAfterPause` from rewinding it, so a break taken late is short and
the legs after it come at their own times. A light window is not held:
it changes over the finder as before. The check holds `stopsFor` to the
legs' own words and `clockAfter` to never turning the clock back.

## The sky follows the hour and the weather; short grass; a jeep

Dermot, 2026-09-25, three notes in a row: *show sunrise and sunsets in
the background graphics at appropriate times of day*, *otherwise the
background sky could be blue or gray depending on the weather*, *the
foreground could include short grass*, and *the vehicle icon could look
more like a jeep*. Each light in `LIGHTS` carries a `sky` (top and
bottom); `first` and `last` carry `sun: "rising"` or `"setting"`, and
`skyAt(range, light, clock)` in the pure section gives the sky's two
colours and the sun's height, 0 on the horizon at the start of first
light and the end of last light, 1 well up, the colours going to the
heat's blue as it climbs; without a day clock the sun sits a third of
the way up. Overcast and mist are grey, the heat and dappled sun blue,
night dark; the night sky range keeps its own scene. `draw` paints the
sun with a glow before the far band, so it sets behind it; a band of
short grass, dense and low, scrolls at the jeep's speed across the
foreground; and the jeep is a safari vehicle in profile, bonnet low at
the front, an open cab under a canvas roof on a roll cage, wheel arches,
a spare on the back and a bar on the front. The range's own `sky` is the
fallback for a light without one. The About card's *the thresholds are
one camera's* became the author's two cameras' the same day (his note:
*not just based on one camera*), since the two bodies score differently.

## An animal scrolls with the ground it stands on

Dermot, 2026-09-25: *some animals appear to walk backwards*. The grass
rows scroll by depth when the jeep moves (`0.3 + 0.7 × depth`), but every
animal scrolled at 1, so a distant animal slid across its own ground and,
with the jeep reversing, walked backwards to the eye. `parallaxOf(a)` gives
an animal the ground's factor at its depth (birds and the sky at 1), and
`boxOf`, the spook check, the respawn and the new-cast placement all use
it. An animal's own walk is still `SPEED × (0.4 + 0.6 × depth) × dir`.

## The mover's buttons follow the seat

Dermot, 2026-09-19: *Driver buttons would be just Walk or Move buttons
for Ireland*. The pad's two off-camera buttons were "Driver" on every
range. `drawPad` now labels them from the seat: "Driver" in the jeep,
"Walk" on foot (the Irish ranges, and South Luangwa, which is walked
too), and hidden in the hide and at the tripod, where `driveOn` does
nothing. The three live lines that said "drive" ("drive closer", "Drive
on", "A or D: drive on") say walk on a walk seat. `buildCamp` calls
`drawPad` so the pad matches the range picked at camp before the outing
begins. Keyed on `seat`, not `country`: a future walked range anywhere
gets it, and a driven one in Ireland would not.

## Three mode buttons, the range sets out, the level follows the clock

Dermot, 2026-09-19, three directions in one line. **The mode dial is
three exclusive buttons** (*Mode dial on range game as three exclusive
buttons*): the rotating dial and its face are gone; `#modes` holds S, A
and M, `setMode` picks one, `drawPad` lights it, and the S, A and M keys
pick them (Dermot, 2026-09-25: *A should mean aperture mode*; until then
A and D drove and M walked the dial, and driving is the arrows alone now,
with the camera down). **Picking a range sets out** (*Once the
hide or range is selected the sit/drive/walk should be automatic*): the
camp card is the body row first (the range's own body, the DSLR, the
mirrorless: `state.bodyChoice`, null for the range's own), then the two
light choices the day does not make, then the ranges by country, and a
range button calls `begin` straight away; the Go button is gone, and
Space or Enter at camp still begins on the last range. **The light level
follows the clock** (*light level should depend on clock time of day*):
`evAt(range, clock, light)` in the pure section gives the exposure value
the clock has, a window's `ev` at the middle of its leg, straight between
the middles of the day's light legs, and `EDGE_DROP` (1.5 stops) darker
at the first lit minute and the last, so first light at a quarter past
six is not first light at half eight. A day whose legs name no light (the
wood's walkabout) keeps the window chosen at camp and still falls off to
its two ends; a lamp light is the lamp's at any hour; a range with no day
keeps its window's value. `lightNow()` in the page hands `{ key, ev }` to
`exposeFor` through `evOf`, which takes a key or such an object, so the
check's calls by key stand; the LCD shows the EV. The wood's weather and
the sky's moon are `state.lightChoice[range]`, the only lights still
chosen, and the check holds `evAt` to the window's own value at a leg's
middle, `EDGE_DROP` darker at the day's lit ends, inside the band between,
the lamp's value at any hour, and unmoved on a range with no day.

## The camera and the dial

Added 2026-09-17 at Dermot's "Shutter Speed, Aperture, ISO and other
settings", his choice of option 2 (the tutorial's three modes) over
shutter-only and over the full camera. `LIGHTS` are exposure values at ISO
100 (`ev`), a behaviour may override with its own (`sunlit`), each range
carries a `lens` (widest and narrowest stop, hand-held `floor` on its
scale), and `exposeFor(mode, shutter, aperture, light, behaviour, scale,
lens, support)` is the camera: S picks the smallest stop that keeps ISO
100 else opens up and raises ISO; A holds ISO 100 above the floor, raises
to `ISO_CAP`, then drops the shutter (`dropped`); M follows to the cap and
reports `under` and `over` in stops. The floor is four times longer on a
support. `score` takes the exposure, not a shutter, and adds the dark,
blown, diffraction and depth-of-field lines; a pull's `depth` words are by
aperture band (`apertureBand`). `ADVICE` is the guide's settings advice,
rules with `when` and `text`, first match spoken on focus every ten
seconds; `advise` is pure and the check runs it over modes, lights,
subjects and stops. Thresholds are the tutorial's and one camera's:
diffraction from f/11, plain at f/16; ISO 1600 noise, 3200 cap. The
things ruled out of the range on the same day, as the tutorial's job:
manual ISO, picture control and the vivid trap, focus modes, burst,
exposure compensation, white balance.

## The two bodies

Added 2026-09-17 at Dermot's question "what would the newer body do in that
situation in terms of autofocus?" and his "yes please" to a body option.
`BODIES` carries the older DSLR (the tutorial's numbers, `af: "centre"`) and
the newer mirrorless (`af: "eye"`, ISO steps to 12800, noise from 6400, diffraction
soft from f/8). A range names its default `body` (Zambia ranges the newer
body, Kenya and home the older) and may carry a `zlens`, the longer zoom the
newer body is paired with. `exposeFor`, `isoStep` and `score` take a body and
default to the older DSLR, so old calls stand; `ISO_STEPS`, `ISO_CAP` and
`DIFFRACTION` are the older body's by name. Focus: a centre body orders the
frame by distance from the aim; an eye body by size, and holds the pick
while it stays in the plate; the finder draws the eye box at the head end
the animal faces. The bodies are Dermot's own ([[camera-gear]] in his
memory): don't add a body he does not carry.

## Adding to the world

An animal: add to `ANIMALS` with `name`, `latin`, `size`, `shape` (one of
the silhouettes the engine draws: horse, antelope, bovid, elephant, cat,
upright, bird), `colour`, `states` (weights over `BEHAVIOURS`), `spook`
(0 for animals that do not run from a jeep), `fly` for birds. A behaviour:
add to `BEHAVIOURS` with `asked` (a `SHUTTERS` denominator), `verb`,
`note`, and a speed in the engine's `SPEED` table if it moves. A range:
add to `RANGES` with `seat` (drive or hide), sky and ground colours, a
`note` in the register, and a `cast`. Then `node tools/check.js`.

## Publishing

`.github/workflows/pages.yml` serves `index.html` from GitHub Pages on
every push to `main`, like the tutorial repo. CI (`ci.yml`) runs the check
on every PR and installs nothing. A subdomain of the photography site can
point at the Pages site later with a CNAME; it is not set up.

## Licence

Engine MIT (`LICENSE`); the range content CC BY 4.0
(`CONTENT-LICENSE.md`). Any photograph of the author's own added later is
CC BY-NC-ND 4.0, the portfolio's terms, and excluded from the CC BY grant.

## The author's shooting list

`wantedFor(range)` is the cast animals with no photograph in `PLATES`. It
is the author's own note, not a goal for the player: it was shown on the
camp card until 2026-09-19 and read as an instruction (Dermot's note that
day), so the page no longer shows it. `tools/check.js` prints it per
range instead, and a plate of an unphotographed animal says only that
the crop stands alone.

## Ranges are named for a place and grouped by country

Every range names a place or a feature, never a country (Dermot,
2026-09-19: *name the place and group by country*). Each carries a
`country`, and the camp card lists the ranges under a heading per
country, in the order the countries first appear in `RANGES`. The macro
range was Home Ground until that day and is Beech Wood now; the
tutorial's route of the same old name covers three places and keeps it.
