# Kairo 3D icon pack — generation prompts

Generate with ChatGPT (image generation). **Do all of them in ONE conversation** so the style
stays consistent: after the first image comes out right, say *"Perfect — keep this exact style,
material, palette and camera angle for every icon that follows."*

## Master style block (paste before every subject)

> A minimal 3D cartoon icon of **[SUBJECT]**, soft matte clay render, smooth rounded shapes with
> gentle bevels, cute but not childish, palette: deep teal #0C9384, porcelain white #F4F7F6,
> grass green #4CA75B, sky blue #4E93C9, soft lilac #8D7BD4, deep green-charcoal #1C2624 accents,
> soft studio lighting, subtle ambient occlusion, slight 3/4 top-down angle, single object
> centered, **fully transparent background, PNG, no text, no floor, no drop shadow on ground**,
> high resolution.

> **Note (2026-07-26):** ignore the teal palette above. All 30 icons
> use the warm coral/cream/espresso palette, and they read as one consistent set. A new
> icon in teal would be the odd one out — match the existing warm style instead. Switching to
> teal is only worth doing as a full 27-icon regeneration, never piecemeal.

## Specs

- **Format:** PNG with real transparency (check by previewing on a dark background — if you see a
  white or checkerboard square baked in, ask ChatGPT to "make the background truly transparent")
- **Size:** 1024×1024 (they'll be shown at 14–120 px, so shapes must be chunky and readable small)
- **Framing:** don't worry about how much of the frame the subject fills — the downscale step
  below trims the transparent margin and re-pads every icon to a uniform 92%, so they all end up
  the same optical size no matter how they were generated
- **Naming:** save with the exact filenames below into `public/img/`

---

## Tier 1 — list icons (replaces the emoji picker) — 12 images

| File | Subject |
| --- | --- |
| `list-folder.png` | a rounded document folder, cream with coral tab |
| `list-work.png` | a small rounded briefcase, espresso with coral clasp |
| `list-home.png` | a tiny cozy house, cream walls, coral roof, sage door |
| `list-heart.png` | a plump glossy heart, coral |
| `list-errands.png` | a mini shopping cart with one coral bag inside |
| `list-books.png` | a stack of three rounded books, coral / sage / lilac |
| `list-fitness.png` | a small dumbbell, espresso handles, coral weights |
| `list-art.png` | a painter's palette with a tiny brush, dabs of coral/sage/lilac |
| `list-travel.png` | a cute toy airplane, cream body, coral wings |
| `list-growth.png` | a young sprout with two leaves in a coral pot |
| `list-mind.png` | a soft rounded brain, lilac |
| `list-goals.png` | an archery target with an arrow in the center, coral rings |

## Tier 2 — key moments & empty states — 8 images

| File | Subject | Used for | Status |
| --- | --- | --- | --- |
| `sunrise.png` | a smiling-free sun rising between two soft cream hills, coral sun with rounded rays | Fresh Start sweep, landing | ✅ |
| `moon.png` | a chubby crescent moon with two tiny stars, lilac and cream | Someday | ✅ |
| `inbox.png` | an inbox tray with one letter sticking out, cream tray, coral letter | Inbox | ✅ |
| `party.png` | a party popper mid-burst with a few chunky confetti pieces, coral/sage/lilac | Day won 🎉 | ✅ |
| `bird.png` | a calm little origami paper plane gliding, cream with coral fold lines | Inbox zero | ✅ |
| `book.png` | an open book with softly curved pages, cream pages, coral cover | Log empty state | ✅ |
| `lock.png` | a friendly rounded padlock, espresso body, coral shackle | Locked lists | ✅ |
| `sparkle.png` | a cluster of three chunky four-point sparkle stars, coral + lilac | AI refinements | ✅ |

## Tier 3 — small property icons (task editor & menus) — 7 images

| File | Subject | Used for | Status |
| --- | --- | --- | --- |
| `sun.png` | a simple round sun with short rounded rays, coral | Planned day / Do today | ✅ |
| `sun-cloud.png` | a small sun peeking from behind a puffy cream cloud | Tomorrow | ✅ |
| `timer.png` | a rounded stopwatch, cream face, coral button and hand | Estimate | ✅ |
| `flag.png` | a small waving flag on a rounded pole, coral flag | Deadline | ✅ |
| `pencil.png` | a stubby rounded pencil at a slight angle, coral body, espresso tip | Edit | ✅ |
| `leaf.png` | a single soft leaf drifting, sage green | Let it go | ✅ |
| `feather.png` | a light fluffy feather, cream with a coral tip | Capture (landing) | ✅ |

## Tier 4 — recurring, reminders & support — 3 images

| File | Subject | Used for | Status |
| --- | --- | --- | --- |
| `repeat.png` | two chunky rounded arrows chasing each other in a circle, each with a fat triangular arrowhead, coral — a loop, **not** a spiral or a clock | Recurring tasks | ✅ |
| `bell.png` | a plump rounded notification bell, coral body with a small espresso clapper below and a tiny cream cap on top, tilted slightly as if it just rang | Reminders | ✅ |
| `coffee.png` | a **western takeaway coffee cup** — tall rounded paper cup with a domed lid and a sip hole, a chunky textured sleeve around the middle, and two soft curls of steam rising. Cream cup, coral sleeve, espresso lid. Think Starbucks-style to-go cup, **not** a chai glass, kulhad, saucer or teacup | Buy me a coffee | ✅ |

---

**Total: 30 — all done.**

## Status

- **Tier 1** — all 12 done (2026-07-22).
- **Tier 2** — all 8 done. `inbox.png` was regenerated on 2026-07-26 with several coloured
  letters; the first version is kept as `assets-src/img-original/inbox-v1.png`.
- **Tier 3** — all 7 done (2026-07-26).
- **Tier 4** — all 3 done (2026-07-26).

## Adding a new one

1. Drop the 1024×1024 PNG into `public/img/` with the exact filename above.
2. Run the pipeline — it archives the master to `assets-src/img-original/` (gitignored, so the
   repo never carries ~1.4 MB per icon), trims the transparent margin, and re-pads to a uniform
   92% fill at 256px so every icon has the same optical weight:

   ```sh
   node scripts/process-icons.mjs coffee     # one icon
   node scripts/process-icons.mjs            # or reprocess all of them
   ```

3. Add the key to `SYSTEM_ICONS` or `PROPERTY_ICONS` in `components/img3d.tsx` — every key
   there must have a matching PNG.

Then use it with `<Icon3d name="coffee" size={20} />`. Because of the normalisation in step 2,
`size` is the real rendered size — no need to inflate it to compensate for empty margin.
