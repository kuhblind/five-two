/* Headless harness for the per-round prefill logic.
   Pulls the three functions out of app.js and runs them against synthetic
   session histories. S is injected as a parameter so each case is isolated. */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function grab(name) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error('not found: ' + name);
  let depth = 0, started = false;
  for (let k = i; k < src.length; k++) {
    if (src[k] === '{') { depth++; started = true; }
    else if (src[k] === '}') { depth--; if (started && depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

const code = [grab('lastLogged'), grab('lastLoggedAtRound'), grab('hasHeavierRound')].join('\n');
// S is a parameter of the factory, so the extracted functions close over exactly
// the state each case passes in — no shared/global binding to leak between cases.
const build = new Function('S', `${code}\nreturn { lastLogged, lastLoggedAtRound, hasHeavierRound };`);

let pass = 0, fail = 0;
function is(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}

// --- reverse pyramid on a B-slot anchor (B first appears in round 2) ---
// round 2 = 80%, round 3 = top, rounds 4-5 back down
const F = build({ sessions: [{
  id: 's1', sets: [
    { round: 1, ex: 'bulgarian_split_squat', amount: 8, weight: 20 },
    { round: 2, ex: 'bulgarian_split_squat', amount: 8, weight: 22.5 },
    { round: 2, ex: 'trap_bar_deadlift', amount: 8, weight: 100 },
    { round: 3, ex: 'bulgarian_split_squat', amount: 8, weight: 22.5 },
    { round: 3, ex: 'trap_bar_deadlift', amount: 5, weight: 125 },
    { round: 4, ex: 'trap_bar_deadlift', amount: 6, weight: 110 },
    { round: 5, ex: 'trap_bar_deadlift', amount: 8, weight: 100 },
  ],
}] });

is('old behaviour: lastLogged returns the FINAL (lightest) set', F.lastLogged('trap_bar_deadlift').weight, 100);
is('round 2 prefills 80% weight', F.lastLoggedAtRound('trap_bar_deadlift', 2).weight, 100);
is('round 3 prefills the TOP weight', F.lastLoggedAtRound('trap_bar_deadlift', 3).weight, 125);
is('round 3 prefills the top set reps', F.lastLoggedAtRound('trap_bar_deadlift', 3).amount, 5);
is('round 4 prefills the first back-off', F.lastLoggedAtRound('trap_bar_deadlift', 4).weight, 110);
is('round 5 prefills the last back-off', F.lastLoggedAtRound('trap_bar_deadlift', 5).weight, 100);
is('round never trained returns null', F.lastLoggedAtRound('trap_bar_deadlift', 1), null);
is('top round is not flagged as having a heavier round', F.hasHeavierRound('trap_bar_deadlift', 3), false);
is('round 2 IS below a heavier round', F.hasHeavierRound('trap_bar_deadlift', 2), true);
is('back-off round 4 is below a heavier round', F.hasHeavierRound('trap_bar_deadlift', 4), true);
is('flat exercise: no heavier round anywhere', F.hasHeavierRound('bulgarian_split_squat', 2), false);

// --- A-slot ascending ramp (the app's own doctrine for anchors at A) ---
const R = build({ sessions: [{ id: 'r', sets: [
  { round: 1, ex: 'box_squat', amount: 8, weight: 60 },
  { round: 2, ex: 'box_squat', amount: 8, weight: 80 },
  { round: 3, ex: 'box_squat', amount: 6, weight: 100 },
  { round: 4, ex: 'box_squat', amount: 6, weight: 100 },
  { round: 5, ex: 'box_squat', amount: 6, weight: 100 },
] }] });
is('ramp round 1 stays light', R.lastLoggedAtRound('box_squat', 1).weight, 60);
is('ramp round 3 reaches working weight', R.lastLoggedAtRound('box_squat', 3).weight, 100);
is('ramp rounds 1-2 are below the top', R.hasHeavierRound('box_squat', 1), true);
is('ramp working round is the top', R.hasHeavierRound('box_squat', 5), false);

// --- an older session must not shadow a newer one ---
const F2 = build({ sessions: [
  { id: 'old', sets: [{ round: 3, ex: 'trap_bar_deadlift', amount: 5, weight: 110 }] },
  { id: 'new', sets: [{ round: 3, ex: 'trap_bar_deadlift', amount: 5, weight: 125 }] },
] });
is('most recent session wins', F2.lastLoggedAtRound('trap_bar_deadlift', 3).weight, 125);

// --- a session that never reached the round falls back to an older one ---
const F3 = build({ sessions: [
  { id: 'old', sets: [{ round: 4, ex: 'trap_bar_deadlift', amount: 6, weight: 110 }] },
  { id: 'cutshort', sets: [{ round: 2, ex: 'trap_bar_deadlift', amount: 8, weight: 100 }] },
] });
is('round missing from the newest session falls back', F3.lastLoggedAtRound('trap_bar_deadlift', 4).weight, 110);
is('cut-short session still answers for the round it has', F3.lastLoggedAtRound('trap_bar_deadlift', 2).weight, 100);

// --- empty / absent history ---
const F4 = build({ sessions: [] });
is('no history returns null', F4.lastLoggedAtRound('trap_bar_deadlift', 2), null);
is('no history is not "heavier"', F4.hasHeavierRound('trap_bar_deadlift', 2), false);

const F5 = build({ sessions: [{ id: 'x', sets: [{ round: 1, ex: 'box_squat', amount: 8, weight: 60 }] }] });
is('unknown exercise returns null', F5.lastLoggedAtRound('trap_bar_deadlift', 1), null);
is('sets array missing does not throw', build({ sessions: [{ id: 'y' }] }).lastLoggedAtRound('box_squat', 1), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
