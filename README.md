# 5+2 Journeys

Personal strength & fitness PWA built on the 5–2 accumulator method (five exercises, short cardio bursts in between): 6-week journeys, guided workouts, set/reps/weight logging with a large-font gym-friendly interface.

## Method

Each strength session is an accumulator pyramid: exercise 1 → cardio → 1, 2 → cardio → 1, 2, 3 → … → all five → cardio. Slot 1 is performed five times per session and slot 5 once. Cardio bursts run 2 or 3 minutes; the default modality is the heavy bag on leg days and the bike on upper days.

Journeys carry a `scheme`. Everything below describes journeys with `scheme: 'v39'` (Journey 3). Earlier journeys keep the logic they were logged under (rep ladders, per-round weight memory, a target scoreboard) and stay readable in Journal and Progress.

### The week (v39)

Legs 1 · Zone 2 · Core · Legs 2 · Upper 1 · Sprint · Upper 2. Seven days, no rest day in the grid. Zone 2 is a 45-minute easy session with a count-up clock. Core is a two-block circuit with timed stations, not a pyramid.

### One work weight per lift

Each lift has one work weight. Every round is computed from it by the slot it sits in (`engine.js`, `prescribe`):

| Slot | Scheme | Rounds |
|---|---|---|
| P1 | volume | first round 8 reps at 75%, then the work weight for the lift's rep range |
| P2 | top set | warm-up 6 at 75% · top set 5 at 100% · two back-offs at 90% |
| P2 | power (box squat) | primer 5 at 75% · three fast sets of 5 at 100% |
| P3–P5 | straight | the work weight for the rep range, every round |

From round 2 the P2 anchor is shown first. Editing the weight on a round at 100% changes the work weight; editing a warm-up, primer or back-off round is logged as lifted and leaves the prescription alone.

### Equipment

Settings → Equipment lists the bars, plate pairs, dumbbells and kettlebells at home. Weight entry only offers what that list can build: barbell lifts step between buildable totals and show the plates per side, dumbbell lifts step through the rack with a `1 ×` / `2 ×` count, always as equal weights. An "other gym" profile keeps free entry.

### Progression and the plateau warning

There is no automatic progression. A work weight moves only when it is changed by hand, on a round at 100%. The one nudge is a plateau warning: when a lift has been trained at the same work weight for two weeks, the rounds at that weight, the session summary and the scoreboard flag it. Any step up or down clears it. Hotel-room sessions never count.

### Three choices per day

Train at home, in another gym, or in a hotel room (band and bodyweight substitutes), or Can't train: Sick, No time, or Light day (20 easy minutes). A missed session is offered again on the next open day by priority (Legs 2, Legs 1, Zone 2, Upper 1, Upper 2, Sprint, Core), never as a second leg day in a row. With one missed day in a week, Zone 2 survives and the Core circuit gives way.

### Scoreboard (v39)

Four lifts, no targets. Each shows one number: the heaviest set of 5 or more reps in the journey. Hotel-room sessions are excluded.

### Sprint day

Two warm-ups and up to six 20-second sprints. Each interval starts after a 3-2-1 lead-in and is logged net. Work intervals prefill the last slope + 0.5. The last week offers a 12-minute test instead; results live under Progress.

## Stack

Zero-dependency vanilla HTML/CSS/JS PWA. No build step, no backend. All data lives in `localStorage` on the device; Settings → Backup exports/imports JSON. Service worker caches the shell for offline gym use.

## Use

Serve statically (GitHub Pages) and open on a phone → Share → *Add to Home Screen*. Local dev: `python3 -m http.server` and open `http://localhost:8000`.

Tests: `for t in test/*.test.mjs; do node $t; done`. No dependencies, no runner. `engine.test.mjs` covers the pure logic, `migration.test.mjs` the store, `app.test.mjs` runs the whole app headless against a stubbed DOM, and `prefill.test.mjs` keeps the pre-v39 path honest. Set `FIVE_TWO_FIXTURE` to a real export to run the migration and render checks against it; training data never goes into the repo.

Exercise names are generic gym vocabulary; program structure inspired by Simon Waterson's *Intelligent Fitness* books (no book content included).
