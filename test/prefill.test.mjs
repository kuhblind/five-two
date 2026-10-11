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

// v38 rep ladders + ladder-based progression gate. LADDERS comes from data.js;
// ex()/journey() are stubbed so progressionSuggestion runs against a bare state.
const dataSrc = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const laddersLit = dataSrc.slice(dataSrc.indexOf('const LADDERS = {'), dataSrc.indexOf('};', dataSrc.indexOf('const LADDERS = {')) + 2);
const ladderCode = [grab('ladderFor'), grab('ladderReps'), grab('ladderLabel'), grab('slotIndexIn'), grab('toppedLadder'), grab('progressionSuggestion')].join('\n');
const buildLadder = new Function('S', `${laddersLit}
  function ex(id) { return S.exercises[id] || { id, measure: 'reps', bucket: null }; }
  function journey() { return { id: 'j' }; }
  ${ladderCode}
  return { ladderReps, ladderLabel, slotIndexIn, toppedLadder, progressionSuggestion };`);


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


// --- v38: rep ladders ---
const BB = { id: 'trap_bar_deadlift', barbell: true, measure: 'reps', bucket: '6-8' };
const GEN = { id: 'bulgarian_split_squat', measure: 'reps', bucket: '9-12' };
const HT = { id: 'hip_thrust', barbell: true, measure: 'reps', bucket: '9-12' };
const SECS = { id: 'suitcase_carry', measure: 'secs', bucket: null };
const mk = (sessions) => buildLadder({ settings: { weightStep: 2.5, travelMode: false }, exercises: { trap_bar_deadlift: BB, bulgarian_split_squat: GEN, hip_thrust: HT, suitcase_carry: SECS }, sessions });
const L = mk([]);
is('barbell slot A round 1 = 15', L.ladderReps(0, 1, BB), 15);
is('barbell slot A round 5 = 6', L.ladderReps(0, 5, BB), 6);
is('barbell slot B round 2 = 12', L.ladderReps(1, 2, BB), 12);
is('slot B has no round 1', L.ladderReps(1, 1, BB), null);
is('general slot A round 1 = 25', L.ladderReps(0, 1, GEN), 25);
is('general slot E round 5 = 10', L.ladderReps(4, 5, GEN), 10);
is('time-based has no ladder', L.ladderReps(0, 1, SECS), null);
is('ladder label for B barbell', L.ladderLabel(1, BB), '12·10·8·6');
is('slot index = first round - 1', L.slotIndexIn([{ round: 3 }, { round: 4 }]), 2);
is('topped when every round meets its rep', L.toppedLadder([{ round: 2, amount: 12 }, { round: 3, amount: 10 }, { round: 4, amount: 8 }, { round: 5, amount: 6 }], BB), true);
is('one short round is not topped', L.toppedLadder([{ round: 2, amount: 12 }, { round: 3, amount: 9 }], BB), false);

// --- v38: progression gate ---
const topped = (ex, w, id) => ({ id, journeyId: 'j', sets: [
  { round: 2, ex, amount: 12, weight: w * 0.7 }, { round: 3, ex, amount: 10, weight: w * 0.8 },
  { round: 4, ex, amount: 8, weight: w * 0.9 }, { round: 5, ex, amount: 6, weight: w },
] });
is('barbell anchor: +2.5 after ONE topped session', (mk([topped('trap_bar_deadlift', 60, 'a')]).progressionSuggestion('trap_bar_deadlift') || {}).add, 2.5);
is('suggestion is from the top weight', (mk([topped('trap_bar_deadlift', 60, 'a')]).progressionSuggestion('trap_bar_deadlift') || {}).from, 60);
is('barbell anchor: a missed round blocks it', mk([{ id: 'a', journeyId: 'j', sets: [{ round: 2, ex: 'trap_bar_deadlift', amount: 9, weight: 50 }, { round: 5, ex: 'trap_bar_deadlift', amount: 8, weight: 70 }] }]).progressionSuggestion('trap_bar_deadlift'), null);
is('hip thrust moves +5', (mk([topped('hip_thrust', 40, 'a')]).progressionSuggestion('hip_thrust') || {}).add, 5);
const genOnce = { id: 'g1', journeyId: 'j', sets: [1, 2, 3, 4, 5].map((r) => ({ round: r, ex: 'bulgarian_split_squat', amount: [25, 20, 15, 12, 10][r - 1], weight: 20 })) };
is('general: one topped session is not enough', mk([genOnce]).progressionSuggestion('bulgarian_split_squat'), null);
is('general: two topped sessions → +2.5', (mk([genOnce, Object.assign({}, genOnce, { id: 'g2' })]).progressionSuggestion('bulgarian_split_squat') || {}).add, 2.5);
is('travel session is ignored', mk([Object.assign(topped('trap_bar_deadlift', 60, 'a'), { travel: true })]).progressionSuggestion('trap_bar_deadlift'), null);
is('time-based never suggests', mk([{ id: 'a', journeyId: 'j', sets: [{ round: 1, ex: 'suitcase_carry', amount: 50, weight: 25 }] }]).progressionSuggestion('suitcase_carry'), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
