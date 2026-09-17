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

It began on 2026-09-17 as the rebuild of four Grok-builder prototypes
(animal-photo-shoot, photo-safari, photo-tutorial, photo-safari-group, all
on grok.me) that Dermot abandoned that day: the builder could not keep the
apps consistent across changes. The design features worth keeping were
written down first (`F:\CLAUDE\Grok Apps Design Notes.md` on his machine,
summarised in the README) and the source was not exported. This is not a
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

## The one rule the game teaches

The shutter follows the animal. Every behaviour in `BEHAVIOURS` carries
the shutter it asks for and a one-line ethogram note; the scorer
(`score`) gives three stars for a match with a clean frame, loses one for
a stop slow, two for two stops slow, one for two stops fast, one for a
frame-edge cut, one for a speck. Two stars is a keeper. A stop fast is
free except for the ISO it costs, and the verdict names the noise at 1600
or more. Change a threshold only when the field notes in
`dermot-cochran-photography` change; say which note.

## Tone

- Nothing is killed on the range. Predators stalk and rush; prey runs;
  the count does not drop.
- Stay in the vehicle is the guide's hard rule and the spotter says it.
- Written by a novice for other novices; no judging register, no claims
  of expertise. The camera's numbers are one camera's and the README says
  so.
- The portfolio carries no generated images. This game may, under
  `images/`, at its own address, never inside the portfolio's pages.

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
