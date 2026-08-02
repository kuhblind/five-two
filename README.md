# 5+2 Journeys

Personal strength & fitness PWA built on the 5–2 accumulator method (five exercises, short cardio bursts in between): 6-week journeys, guided workouts, set/reps/weight logging with a large-font gym-friendly interface.

## Method

Each session is an accumulator pyramid — Exercise A → cardio → A,B → cardio → A,B,C → … → A–E → cardio. Slot A is performed five times per session, slot E once, so the anchor lifts live in slots A/B. Cardio bursts default to 2 minutes (3 optional) across eight modalities (run, bike, row, SkiErg, heavy bag, battle ropes, skipping, plyo).

Weekly rhythm: 2× legs, 2× upper, 2× mixed/plyo (all 5+2), plus one Zone-2 day (~60 min, log-only). Rep targets use four buckets — 6–8 / 9–12 / 13–16 / 17–20+ — shown as guidance; the log always records the actual reps done.

### Per-round weight memory

A slot's rounds are deliberately unequal: an A-slot ramp runs light in rounds 1–2 and reaches working weight by 3, and a B-slot anchor can run a reverse pyramid (round 2 ~80%, round 3 the top set, then back down). Each round therefore prefills from **the same round last time**, falling back to the last set this session, then to any history, then to the bucket floor at 0 kg. A prefill taken from history shows a "Round N last time" note. The `+kg` progression suggestion is offered on the top-weight round only, so applying it moves the top set rather than walking the whole shape up together.

### Recommended day setups

Program → Days offers a recommended five for each leg and upper day, per block — the slots, what each one replaces, and why that order. Applying is always an explicit tap; nothing is auto-applied and past logs are never touched. The rule behind them: slot A runs five times a session, so it holds the exercise you can accumulate the most volume on, not the heaviest lift — the barbell anchor sits at B.

Weeks 4–6 keep the same five roles and harden the variant. The anchor at B is the constrained slot: it may only move to a variant needing *less* absolute load for the same stimulus (box squat → paused box squat), never one that deepens the start or lengthens the range — which is why the trap bar does not change at all. The E slot rotates its anti-movement rather than hardening, so anti-extension, anti-lateral-flexion and anti-rotation are all covered across a journey.

## Stack

Zero-dependency vanilla HTML/CSS/JS PWA. No build step, no backend. All data lives in `localStorage` on the device; Settings → Backup exports/imports JSON. Service worker caches the shell for offline gym use.

## Use

Serve statically (GitHub Pages) and open on a phone → Share → *Add to Home Screen*. Local dev: `python3 -m http.server` and open `http://localhost:8000`.

Tests: `node test/prefill.test.mjs` — no dependencies, no runner.

Exercise names are generic gym vocabulary; program structure inspired by Simon Waterson's *Intelligent Fitness* books (no book content included).
