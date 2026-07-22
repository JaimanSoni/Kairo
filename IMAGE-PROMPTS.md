# Kairo 3D icon pack — generation prompts

Generate with ChatGPT (image generation). **Do all of them in ONE conversation** so the style
stays consistent: after the first image comes out right, say *"Perfect — keep this exact style,
material, palette and camera angle for every icon that follows."*

## Master style block (paste before every subject)

> A minimal 3D cartoon icon of **[SUBJECT]**, soft matte clay render, smooth rounded shapes with
> gentle bevels, cute but not childish, palette: violet indigo #6E62E5, cool porcelain white
> #F6F7FB, mint green #2F9E6F, sky blue #4795CF, charcoal #23252E accents, soft studio lighting,
> subtle ambient occlusion, slight 3/4 top-down angle, single object centered, **fully transparent
> background, PNG, no text, no floor, no drop shadow on ground**, high resolution.

> **Note (2026-07-22):** the app's theme moved from warm coral/cream to this cool violet palette.
> The 15 icons already generated use the old warm colors — they still work, but regenerating them
> with this updated block will match the new look. New icons should use this block.

## Specs

- **Format:** PNG with real transparency (check by previewing on a dark background — if you see a
  white or checkerboard square baked in, ask ChatGPT to "make the background truly transparent")
- **Size:** 1024×1024 (they'll be shown at 20–120 px, so shapes must be chunky and readable small)
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

| File | Subject | Used for |
| --- | --- | --- |
| `sunrise.png` | a smiling-free sun rising between two soft cream hills, coral sun with rounded rays | Fresh Start sweep, landing |
| `moon.png` | a chubby crescent moon with two tiny stars, lilac and cream | Someday |
| `inbox.png` | an inbox tray with one letter sticking out, cream tray, coral letter | Inbox |
| `party.png` | a party popper mid-burst with a few chunky confetti pieces, coral/sage/lilac | Day won 🎉 |
| `bird.png` | a calm little origami paper plane gliding, cream with coral fold lines | Inbox zero |
| `book.png` | an open book with softly curved pages, cream pages, coral cover | Log empty state |
| `lock.png` | a friendly rounded padlock, espresso body, coral shackle | Locked lists |
| `sparkle.png` | a cluster of three chunky four-point sparkle stars, coral + lilac | AI refinements |

## Tier 3 — small property icons (task editor & menus) — 7 images

| File | Subject | Used for |
| --- | --- | --- |
| `sun.png` | a simple round sun with short rounded rays, coral | Planned day / Do today |
| `sun-cloud.png` | a small sun peeking from behind a puffy cream cloud | Tomorrow |
| `timer.png` | a rounded stopwatch, cream face, coral button and hand | Estimate |
| `flag.png` | a small waving flag on a rounded pole, coral flag | Deadline |
| `pencil.png` | a stubby rounded pencil at a slight angle, coral body, espresso tip | Edit |
| `leaf.png` | a single soft leaf drifting, sage green | Let it go |
| `feather.png` | a light fluffy feather, cream with a coral tip | Capture (landing) |

---

**Total: 27.** If you want to start smaller, generate Tier 1 + `sunrise.png`, `moon.png`,
`inbox.png` first (15 images) — that covers ~90% of what's visible daily; I can wire tiers as
they arrive.
