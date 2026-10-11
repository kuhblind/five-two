/* Headless tests for engine.js (v39): buildable loads, slot prescriptions,
   verdicts, dumbbell steps, backfill, scoreboard lines, the timer lead-in.
   engine.js is pure, so it is evaluated whole and its functions returned. */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../engine.js', import.meta.url), 'utf8');
const E = new Function(`${src}
  return { buildableTotals, platesPerSide, loadTotal, dumbbellLadder, loadOptions, scaleLoad, stepLoad, fmtLoad,
    slotScheme, prescribe, prescribedSet, plateauSince, backfillOffer, topSet,
    leadTimer, leadCount, slopePrefill };`)();

let pass = 0, fail = 0;
function is(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}

const HOME = {
  bars: { barbell: 10, trap_bar: 10 },
  platePairs: [25, 20, 15, 10, 5, 1.25, 1.25],
  dumbbells: [8, 12, 16, 18, 20, 24],
  kettlebells: [4, 16, 18],
};
const OTHER = { free: true, bars: { barbell: 20, trap_bar: 20 }, step: 2.5, dumbbellStep: 2 };

const TRAP = { id: 'trap_bar_deadlift', implement: 'trap_bar', measure: 'reps', scheme: 'topset', backoffReps: 6 };
const BENCH = { id: 'bench_press', implement: 'barbell', measure: 'reps', scheme: 'topset' };
const OHP = { id: 'overhead_press', implement: 'barbell', measure: 'reps', scheme: 'topset' };
const BOX = { id: 'paused_box_squat', implement: 'barbell', measure: 'reps', scheme: 'power', power: true };
const ROW = { id: 'chest_supported_row', implement: 'dumbbell', measure: 'reps', range: [8, 10] };
const BSS = { id: 'bulgarian_split_squat', implement: 'dumbbell', measure: 'reps', range: [6, 8] };
const RDL = { id: 'romanian_deadlift', implement: 'dumbbell', measure: 'reps', range: [8, 12] };
const CARRY = { id: 'trap_bar_carry', implement: 'trap_bar', measure: 'secs', range: [30, 30] };
const NORDIC = { id: 'nordic_curl', implement: 'bodyweight', measure: 'reps', range: [6, 8] };

// --- 1. buildable totals ---
const totals = E.buildableTotals(10, HOME.platePairs);
is('buildable contains 25, 30, 52.5, 60, 62.5', [25, 30, 52.5, 60, 62.5].every((t) => totals.includes(t)), true);
is('buildable skips the x7.5 totals', [17.5, 27.5, 37.5, 47.5, 57.5, 67.5, 77.5].filter((t) => totals.includes(t)), []);
is('buildable starts at the empty bar', totals[0], 10);
is('plates for 60: per side 25', E.platesPerSide(60, 10, HOME.platePairs), [25]);
is('plates for 52.5: per side 20 + 1.25', E.platesPerSide(52.5, 10, HOME.platePairs), [20, 1.25]);
is('plates for 47.5: cannot be built', E.platesPerSide(47.5, 10, HOME.platePairs), null);
is('a new 2.5 pair makes 47.5 buildable', E.buildableTotals(10, HOME.platePairs.concat([2.5])).includes(47.5), true);

// --- 2. prescriptions ---
const rounds = (e, slot, work) => [1, 2, 3, 4, 5].map((r) => E.prescribedSet(e, slot, r, work, HOME))
  .filter(Boolean).map((p) => p.load.weight + ' × ' + p.amount);
is('trap bar at 60', rounds(TRAP, 1, { weight: 60 }), ['45 × 6', '60 × 5', '55 × 6', '55 × 6']);
is('bench at 52.5', rounds(BENCH, 1, { weight: 52.5 }), ['40 × 6', '52.5 × 5', '45 × 8', '45 × 8']);
is('overhead press at 25', rounds(OHP, 1, { weight: 25 }).map((s) => parseFloat(s)), [20, 25, 22.5, 22.5]);
is('box squat at 40', rounds(BOX, 1, { weight: 40 }), ['30 × 5', '40 × 5', '40 × 5', '40 × 5']);
is('roles on the top-set slot', [2, 3, 4, 5].map((r) => E.prescribe(BENCH, 1, r, {}).role), ['Warm-up', 'Top set', 'Back-off', 'Back-off']);
is('roles on the power slot', [2, 3, 4, 5].map((r) => E.prescribe(BOX, 1, r, {}).role), ['Primer', 'Fast', 'Fast', 'Fast']);
is('slot P2 has no round 1', E.prescribe(BENCH, 1, 1, {}), null);
is('P1 volume: round 1 is 8 reps at 2 × 8', (() => { const p = E.prescribedSet(BSS, 0, 1, { weight: 12, count: 2 }, HOME); return [p.amount, E.fmtLoad(p.load, BSS)]; })(), [8, '2 × 8 kg']);
is('P1 volume: later rounds at the work weight, low end of the range', (() => { const p = E.prescribedSet(BSS, 0, 2, { weight: 12, count: 2 }, HOME); return [p.amount, E.fmtLoad(p.load, BSS)]; })(), [6, '2 × 12 kg']);
is('P3 straight uses the range', E.prescribe(RDL, 2, 3, {}).reps, [8, 12]);
is('scheme override needs three rounds: bench at P4 runs straight', E.slotScheme(BENCH, 3), 'straight');
is('other gym: free entry scales to the plain step', E.scaleLoad(BENCH, OTHER, { weight: 52.5 }, 0.9).weight, 47.5);

// --- 3. plateau warning: two weeks at the same work weight ---
const D0 = new Date('2026-10-19T18:00:00').getTime();
const at = (days, w, hour) => ({ ts: D0 + days * 86400000 + (hour || 0) * 3600000, sets: [
  { round: 2, ex: 'bench_press', amount: 6, weight: 40 }, { round: 3, ex: 'bench_press', amount: 5, weight: w }, { round: 4, ex: 'bench_press', amount: 8, weight: 45 }] });
const now = (days) => D0 + days * 86400000;
is('two sessions a week apart, checked on day 14: plateau', E.plateauSince(BENCH, { weight: 52.5 }, [at(7, 52.5), at(0, 52.5)], now(14)) != null, true);
is('… also when the day-14 session starts earlier in the day', E.plateauSince(BENCH, { weight: 52.5 }, [at(7, 52.5), at(0, 52.5)], now(14) - 10 * 3600000) != null, true);
is('day 13 is not two weeks yet', E.plateauSince(BENCH, { weight: 52.5 }, [at(7, 52.5), at(0, 52.5)], now(13)), null);
is('one session is not a plateau, however old', E.plateauSince(BENCH, { weight: 52.5 }, [at(0, 52.5)], now(30)), null);
is('any step up clears it', E.plateauSince(BENCH, { weight: 55 }, [at(14, 52.5), at(7, 52.5), at(0, 52.5)], now(14)), null);
is('a step down clears it too', E.plateauSince(BENCH, { weight: 50 }, [at(14, 52.5), at(7, 52.5), at(0, 52.5)], now(14)), null);
is('the run counts only sessions at the current weight', E.plateauSince(BENCH, { weight: 55 }, [at(14, 55), at(7, 55), at(0, 52.5)], now(15)), null);
is('… and fires once that run is two weeks old', E.plateauSince(BENCH, { weight: 55 }, [at(21, 55), at(14, 55), at(7, 55), at(0, 52.5)], now(21)) != null, true);
is('sessions without the lift are skipped, not a break', E.plateauSince(BENCH, { weight: 52.5 }, [{ ts: now(10), sets: [] }, at(7, 52.5), at(0, 52.5)], now(14)) != null, true);
is('dumbbells compare the pair total', E.plateauSince(ROW, { weight: 18, count: 2 },
  [0, 7].reverse().map((d) => ({ ts: now(d), sets: [{ ex: 'chest_supported_row', amount: 8, weight: 18, count: 2 }] })), now(14)) != null, true);
is('a bodyweight lift at 0 kg never warns', E.plateauSince(NORDIC, { weight: 0 }, [0, 7].map((d) => ({ ts: now(d), sets: [{ ex: 'nordic_curl', amount: 8, weight: 0 }] })), now(40)), null);
is('a band lift never warns', E.plateauSince({ id: 'face_pull', implement: 'band' }, { weight: 2 }, [0, 7].map((d) => ({ ts: now(d), sets: [{ ex: 'face_pull', amount: 15, weight: 2 }] })), now(40)), null);
is('other gym: a dumbbell work weight is not rounded at 100%', E.scaleLoad(ROW, OTHER, { weight: 9, count: 2 }, 1).weight, 9);

// --- 4. dumbbell steps ---
const walk = (e, start, n) => { const out = [E.fmtLoad(start, e)]; let l = start; for (let i = 0; i < n; i++) { l = E.stepLoad(e, HOME, l, 1); out.push(E.fmtLoad(l, e)); } return out; };
is('row: 2 × 12 → 2 × 16', walk(ROW, { weight: 12, count: 2 }, 1), ['2 × 12 kg', '2 × 16 kg']);
is('split squat: always a matching pair, 2 × 16 → 2 × 18 → 2 × 20', walk(BSS, { weight: 16, count: 2 }, 2), ['2 × 16 kg', '2 × 18 kg', '2 × 20 kg']);
is('no ladder ever mixes two weights', E.dumbbellLadder(HOME.dumbbells, 2).every((l) => l.count === 2 && Object.keys(l).length === 2), true);
is('top of the rack has no next step', E.stepLoad(ROW, HOME, { weight: 24, count: 2 }, 1), null);
is('one dumbbell steps through the same rack', E.fmtLoad(E.stepLoad(ROW, HOME, { weight: 16, count: 1 }, 1), ROW), '1 × 18 kg');
is('total load of a pair', E.loadTotal({ weight: 16, count: 2 }), 32);
is('a set without count totals its bare weight', E.loadTotal({ weight: 16 }), 16);

// --- 5. backfill ---
const J3 = ['LEGS1', 'ZONE2', 'CORE', 'LEGS2', 'UPPER1', 'SPRINT', 'UPPER2'];
const MON = new Date('2026-10-19T08:00:00').getTime();
const day = (n) => MON + n * 86400000;
const sess = (dayIndex, dayType, n) => ({ journey: true, week: 1, dayIndex, dayType, ts: day(n == null ? dayIndex : n) });
const offer = (dayIndex, missedDays, sessions) => E.backfillOffer({
  weekPlan: J3, week: 1, dayIndex, weekCount: 6, missedDays, sessions, now: day(dayIndex),
}).offer;
is('Monday missed, Tuesday open → Legs 1', offer(1, { 0: 'blocked' }, []), 'LEGS1');
is('Thursday missed, Friday open → Legs 2', offer(4, { 3: 'sick' }, [sess(0, 'LEGS1'), sess(1, 'ZONE2'), sess(2, 'CORE')]), 'LEGS2');
is('Legs 2 trained Friday, Saturday open, Legs 1 missed → not Legs 1',
  offer(5, { 0: 'blocked', 3: 'blocked' }, [sess(4, 'LEGS2')]) !== 'LEGS1', true);
is('… the displaced Upper 1 is offered instead', offer(5, { 0: 'blocked', 3: 'blocked' }, [sess(1, 'ZONE2'), sess(4, 'LEGS2')]), 'UPPER1');
is('a light day counts as missed', offer(1, { 0: 'light' }, [sess(0, 'LIGHT')]), 'LEGS1');
is('nothing missed → the scheduled day', offer(1, {}, [sess(0, 'LEGS1')]), 'ZONE2');
is('a leg day is not placed directly before tomorrow’s leg day: Zone 2 goes first', offer(2, { 0: 'blocked', 1: 'blocked' }, []), 'ZONE2');
is('a missed Zone 2 takes the Core day', offer(2, { 1: 'blocked' }, [sess(0, 'LEGS1')]), 'ZONE2');
is('a missed Core does not displace an upper day', offer(4, { 2: 'blocked' }, [sess(0, 'LEGS1'), sess(1, 'ZONE2'), sess(3, 'LEGS2')]), 'UPPER1');
// one missed day in the week: Zone 2 survives, the Core circuit gives way
{
  const done = []; const missedDays = { 0: 'blocked' };
  for (let d = 1; d < 7; d++) {
    const o = E.backfillOffer({ weekPlan: J3, week: 1, dayIndex: d, weekCount: 6, missedDays, sessions: done, now: day(d) }).offer;
    done.push(sess(d, o));
  }
  is('Monday missed: the week still trains both legs and Zone 2, Core gives way', done.map((s) => s.dayType), ['LEGS1', 'ZONE2', 'LEGS2', 'UPPER1', 'SPRINT', 'UPPER2']);
}
is('a backfilled type is not offered twice', offer(2, { 0: 'blocked' }, [sess(1, 'LEGS1')]), 'ZONE2');
is('the displaced type stays eligible later in the week',
  E.backfillOffer({ weekPlan: J3, week: 1, dayIndex: 6, weekCount: 6, missedDays: { 0: 'blocked' },
    sessions: [sess(1, 'LEGS1'), sess(2, 'ZONE2'), sess(3, 'LEGS2'), sess(4, 'UPPER1'), sess(5, 'SPRINT')], now: day(6) }).missed, ['CORE']);
is('the previous-day check reads real dates, not the grid', offer(1, { 0: 'blocked' }, [{ journey: false, dayType: 'LEGS2', ts: day(0) }]), 'ZONE2');
is('rest days are never displaced', E.backfillOffer({ weekPlan: ['LEGS1', 'UPPER1', 'CORE', 'LEGS2', 'REST', 'UPPER2', 'SPRINT'],
  week: 1, dayIndex: 4, weekCount: 6, missedDays: { 3: 'blocked' }, sessions: [], now: day(4) }).offer, 'REST');

// --- 6. scoreboard: one number, the top set of 5 or more reps ---
const benchLog = [
  { sets: [{ ex: 'bench_press', amount: 5, weight: 52.5 }, { ex: 'bench_press', amount: 8, weight: 45 }] },
  { sets: [{ ex: 'bench_press', amount: 5, weight: 55 }, { ex: 'bench_press', amount: 4, weight: 57.5 }] },
];
is('top set: heaviest load at 5+ reps', E.topSet(BENCH, benchLog, 5), 55);
is('dumbbell sets without count are excluded; load is the pair total', E.topSet(BSS, [
  { sets: [{ ex: 'bulgarian_split_squat', amount: 8, weight: 40 }] },                 // pre-v39 log, no count
  { sets: [{ ex: 'bulgarian_split_squat', amount: 6, weight: 12, count: 2 }] },
  { sets: [{ ex: 'bulgarian_split_squat', amount: 4, weight: 18, count: 2 }] },
], 5), 24);
is('a lift with no qualifying set shows nothing', E.topSet(BENCH, [{ sets: [{ ex: 'bench_press', amount: 3, weight: 60 }] }], 5), null);

// --- 9. sprint timer lead-in ---
const t = E.leadTimer(1000000, 20, 3);
is('lead-in counts 3, 2, 1, then 0', [100, 1100, 2100, 3000].map((ms) => E.leadCount(t, 1000000 + ms)), [3, 2, 1, 0]);
is('the logged interval is 20 seconds net', [t.total, (t.endTs - t.startTs) / 1000], [20, 20]);
is('no lead-in → the clock runs at once', E.leadCount(E.leadTimer(1000000, 20, 0), 1000000), 0);
is('slope prefill adds 0.5', E.slopePrefill(4), 4.5);
is('slope prefill caps at 15', E.slopePrefill(15), 15);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
