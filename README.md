# Photo Safari Range

A wildlife-photography arcade in one page. Open `index.html` in any
browser — no server, no build, no dependencies, no network — or play it as
served from `main` at
https://dermot-r-cochran.github.io/photo-safari-range/ , which is the same
file and nothing else. The contact sheet saves to that browser's
localStorage only.

## What it is

You are in a vehicle on open grassland, sitting a floating hide on the
Zambezi at eye level with the drinking line, or on foot in South Luangwa
behind the guide, by day or on a night drive where only the lamp's circle
can be seen or shot. Animals are on the range, and
each one is always doing something: resting, grazing, on sentry, walking,
stalking, running, in flight. Raise the camera and the spotter names the
animal, what it is doing, and the shutter that needs. Set the shutter,
frame the animal, shoot. The plate scores on one rule, the field's rule:
the shutter follows the animal, not the light meter. A keeper is two stars
or better; the sheet keeps what you keep.

The loop, in four beats:

1. **Drive** to the animals (A and D), or sit still in the hide.
2. **Camera** up (Space). The plate rectangle follows the mouse or the
   arrow keys; Z walks the three pulls on the glass — context, working,
   tighter.
3. **Match** the shutter to what the spotter asked ([ and ]). Tab picks
   another animal when several are in the frame.
4. **Shoot** (Space). Keep the plate or discard it.

Drive at an animal fast and the shy ones run; the plate is the tail end.
Cats and elephants do not run from a jeep. Nothing is killed on the range.

## What it teaches

- **Behaviour first.** A resting lion wants 1/60; a walking zebra 1/250; a
  running cheetah 1/1000; a fish eagle in flight 1/2000. The spotter's
  ethogram note says what to look for, and the plate scores on whether the
  shutter agreed with the animal at the moment the shutter fired.
- **The cost of the wrong shutter.** A stop slow smears the movement; a
  stop fast is bought with ISO the light did not have. Last light at
  1/2000 is ISO 3200 on this camera, and the verdict says so.
- **Framing.** An animal cut by the frame edge loses a star; a speck loses
  a star; an animal that fills the working pull is the plate you wanted.
  Tighter is head and shoulders, and the note is the field's: long glass
  stacks the background, which is compression, not walking closer.
- **Stay in the vehicle.** The guide's one hard rule, and the game's. On
  foot the rule is the walking guide's: single file, stop when he stops,
  because nothing runs from a still person and everything runs from a
  moving one.
- **The small ones are the range.** In South Luangwa a keeper of a serval,
  a hyrax, a genet or a carmine bee-eater is a hard plate and the sheet
  says so; an elephant is an elephant. The genet only comes out on the
  night drive, and on a night drive everything is ISO 3200.

## Where it came from

The game descends from a set of prototypes built in a hosted app builder
in September 2026 (four apps, three of them called Sundrift). Those were
abandoned on 17 September 2026: every prompt rewrote the whole app and
regressed it, single fixes took ten minutes of build, and publishing failed
without a message. What was worth keeping — the asked shutter, the ethogram
captions, the focus list, the three pulls, hide versus drive, the light
windows — is written up in the author's design notes and rebuilt here in
the same shape as the author's other one-file repositories:
[four-islands-quest](https://github.com/dermot-r-cochran/four-islands-quest)
and
[photo-safari-tutorial-game](https://github.com/dermot-r-cochran/photo-safari-tutorial-game).
The tutorial holds the lessons and the author's own frames; this is the
range.

**The camera is the author's own**, an older Nikon crop-sensor DSLR, and
the ISO the light windows charge is that body's: 400 clean, 800 fine, 1600
showing chroma noise, 3200 a last resort. A newer body is cleaner. The
decisions generalise; the thresholds are the ones to check against your
own camera.

## The frames

After a shot that hit something, the plate card shows **the frame this was
learned on**: the author's own photograph of that animal doing that thing,
from the outings the range was written from, with your crop inset in the
corner and a caption that says what the frame is. It is a comparison, not
the answer: the stars and the verdict are about your plate; the photograph
is what the same moment looked like when it was got. Twenty-eight frames
so far, under `images/`, at portfolio size, chosen by animal and
behaviour; an animal with no frame yet (the meerkat, the hippo, the puku)
shows the crop alone, and the page works with no picture files at all.

The animals on the range are placeholder silhouettes drawn on the canvas.
The author's portfolio carries no generated images; if generated sprites
ever come, they go under `images/` at this address and nowhere near the
portfolio.

## Tools

`tools/check.js` loads the page's script into a bare VM context — no
`document`, so the page never boots — and holds the world data and the
scorer to shape: every behaviour asks for a shutter the camera has, every
animal's states are behaviours, every range's cast is animals, every light
prices every shutter, the scorer stays within 0–3 and a matched shutter
with a clean frame is always a keeper, and a spawn plan is deterministic
and spaced. CI runs it and installs nothing.

## Licence

The engine is MIT (`LICENSE`); the range content — the animals, notes,
ranges, plate captions and verdict words — is CC BY 4.0
(`CONTENT-LICENSE.md`); the photographs are CC BY-NC-ND 4.0
(`LICENSE-PHOTOS.md`), the portfolio's own terms.
