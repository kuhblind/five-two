# 5+2 Journeys

Personal strength & fitness PWA built on the 5–2 accumulator method (five exercises, short cardio bursts in between): 6-week journeys, guided workouts, set/reps/weight logging with a large-font gym-friendly interface.

## Method

Each session is an accumulator pyramid — Exercise A → cardio → A,B → cardio → A,B,C → … → A–E → cardio. Slot A is performed five times per session, slot E once, so the anchor lifts live in slots A/B. Cardio bursts default to 2 minutes (3 optional) across eight modalities (run, bike, row, SkiErg, heavy bag, battle ropes, skipping, plyo).

Weekly rhythm: 2× legs, 2× upper, 2× mixed/plyo (all 5+2), plus one Zone-2 day (~60 min, log-only). Rep targets use four buckets — 6–8 / 9–12 / 13–16 / 17–20+ — shown as guidance; the log always records the actual reps done.

## Stack

Zero-dependency vanilla HTML/CSS/JS PWA. No build step, no backend. All data lives in `localStorage` on the device; Settings → Backup exports/imports JSON. Service worker caches the shell for offline gym use.

## Use

Serve statically (GitHub Pages) and open on a phone → Share → *Add to Home Screen*. Local dev: `python3 -m http.server` and open `http://localhost:8000`.

Exercise names are generic gym vocabulary; program structure inspired by Simon Waterson's *Intelligent Fitness* books (no book content included).
