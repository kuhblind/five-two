/* Headless tests for storage.js: the v11 -> v12 migration and the v39 parts of
   normalizeState. storage.js, data.js and engine.js are evaluated together.

   The last block loads a real export from OUTSIDE the repo when it is present
   (path in FIVE_TWO_FIXTURE) and is skipped otherwise.
   Training data never enters the repo. */
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const load = () => new Function('localStorage', `${read('storage.js')}\n${read('engine.js')}\n${read('data.js')}
  return { migrate, normalizeState, seedState, defaultEquipment, STORE_VERSION, WEEK_PLAN_J3, J3_BLOCKS, J3_SCOREBOARD };`)(
  { getItem: () => null, setItem: () => {} });
const M = load();

let pass = 0, fail = 0;
function is(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const run = (st) => M.normalizeState(M.migrate(clone(st)));

// a v11 state the way v38 wrote it
const v11 = () => {
  const s = clone(M.seedState());
  s.version = 11;
  s.settings = { cardioMinutes: 3, fontScale: 0.9, weightStep: 2.5, travelMode: false };
  delete s.work; delete s.tests; delete s.circuitDose;
  s.sessions = [
    { id: 's1', ts: 1, journeyId: 'j1', week: 1, dayIndex: 0, dayType: 'LEGS1', readiness: 'good', effort: 'solid', travel: false,
      sets: [{ round: 1, ex: 'bulgarian_split_squat', amount: 12, weight: 20 }], cardio: [{ round: 1, modality: 'Bike', seconds: 180 }] },
    { id: 's2', ts: 2, journeyId: 'j1', week: 1, dayIndex: 6, dayType: 'REST' },
  ];
  return s;
};

is('store version is 12', M.STORE_VERSION, 12);
let out = run(v11());
is('v11 migrates to v12', out.version, 12);
is('migration adds the home equipment profile', out.settings.equipment, M.defaultEquipment());
is('migration adds the sprint lead-in', out.settings.sprintLeadIn, 3);
is('migration adds work, tests', [out.work, out.tests], [{}, []]);
is('user settings survive', [out.settings.cardioMinutes, out.settings.fontScale], [3, 0.9]);
is('no session is rewritten', out.sessions, v11().sessions);
is('a legacy journey keeps its rest day and gains no scheme', [out.journeys[0].weekPlan.includes('REST'), 'scheme' in out.journeys[0]], [true, false]);

// v39 journey: seven training days, scoreboard rows without targets
const withJ3 = () => {
  const s = v11();
  s.version = 12;
  s.journeys.push({ id: 'j3', name: 'Journey 3', startDate: '2026-10-19', weekCount: 6, scheme: 'v39',
    weekPlan: M.WEEK_PLAN_J3.slice(), blocks: { early: clone(M.J3_BLOCKS), late: clone(M.J3_BLOCKS) }, scoreboard: clone(M.J3_SCOREBOARD) });
  s.activeJourneyId = 'j3';
  return s;
};
out = run(withJ3());
const j3 = out.journeys.find((j) => j.id === 'j3');
is('a v39 week plan keeps all seven days', j3.weekPlan, M.WEEK_PLAN_J3);
is('a v39 scoreboard keeps rows without targets', j3.scoreboard.length, 4);
is('the Core circuit day gets no pyramid block', 'CORE' in j3.blocks.early, false);

// work weights, tests, missed kinds, set fields
let s = withJ3();
s.work = { bench_press: { weight: 52.5, backoff: 9, sugg: { weight: 55, kind: 'up', text: 'Up' } }, nope: { weight: 10 }, romanian_deadlift: { weight: 16, count: 2 },
  tempo_curl: { weight: 12, count: 3 }, overhead_press: { weight: 'x' } };
s.tests = [{ ts: 5, kind: 'cooper12', meters: 2400.4 }, { ts: 6, kind: 'other', meters: 1 }, { ts: 7, kind: 'cooper12', meters: -5 }];
s.missed = { 'j3:1:0': 'light', 'j3:1:1': 'bogus' };
s.sessions.push({ id: 's3', ts: 3, journeyId: 'j3', week: 1, dayIndex: 0, dayType: 'LEGS1',
  sets: [{ round: 1, ex: 'bulgarian_split_squat', amount: 8, weight: 8, count: 2 }, { round: 2, ex: 'romanian_deadlift', amount: 8, weight: 16, count: 7 }] });
out = run(s);
is('work keeps known lifts; stored suggestions and back-off targets from v39/v40 are dropped', out.work, { bench_press: { weight: 52.5 }, romanian_deadlift: { weight: 16, count: 2 }, tempo_curl: { weight: 12 } });
is('tests keep valid results only', out.tests, [{ ts: 5, kind: 'cooper12', meters: 2400 }]);
is('the light missed kind is kept, unknown kinds dropped', out.missed, { 'j3:1:0': 'light' });
is('set count must be 1 or 2', out.sessions[2].sets.map((x) => x.count), [2, undefined]);

// equipment validation
s = withJ3();
s.settings.equipment = { active: 'nowhere', home: { bars: { barbell: 900, trap_bar: 12 }, platePairs: [20, 'x', 2.5, 2.5, -1], dumbbells: [12, 8, 12, 999], kettlebells: 'no' } };
out = run(s);
is('equipment: bad active profile falls back to home', out.settings.equipment.active, 'home');
is('equipment: bars clamp, plates keep duplicates, dumbbells dedupe and sort',
  [out.settings.equipment.home.bars, out.settings.equipment.home.platePairs, out.settings.equipment.home.dumbbells, out.settings.equipment.home.kettlebells],
  [{ barbell: 10, trap_bar: 12 }, [20, 2.5, 2.5], [8, 12], []]);
is('equipment: the other gym is restored when missing', out.settings.equipment.other, M.defaultEquipment().other);

// in-progress sessions from v38
s = v11();
s.current = { journeyId: 'j1', week: 1, dayIndex: 0, dayType: 'LEGS1', round: 1, phase: 'readiness', slots: null, readiness: null, effort: null, sets: [], cardio: [], roundEntries: null };
out = run(s);
is('a session caught in readiness starts lifting with the default slots', [out.current.phase, out.current.slots.length], ['lift', 5]);
s = v11();
s.current = { journeyId: 'j1', week: 1, dayIndex: 1, dayType: 'UPPER1', round: 5, phase: 'effort', slots: ['bench_press'], readiness: 'good', effort: null,
  sets: [{ round: 5, ex: 'bench_press', amount: 6, weight: 50 }], cardio: [] };
out = run(s);
is('a session caught in effort is finished and saved', [out.current, out.sessions.length, out.sessions[2].dayType, out.sessions[2].sets.length], [null, 3, 'UPPER1', 1]);

// in-progress v39 sessions resume
s = withJ3();
s.current = { journeyId: 'j3', week: 1, dayIndex: 2, dayType: 'CORE', phase: 'circuit', blocks: [0, 1], bi: 0, round: 2, done: {}, log: [], startedTs: 1 };
is('an in-progress circuit resumes', run(s).current.phase, 'circuit');
s.current = { journeyId: 'j3', week: 1, dayIndex: 2, dayType: 'CORE', phase: 'circuit', blocks: [0, 1], bi: 5, round: 2, done: {}, log: [] };
is('a circuit with a bad shape is dropped', run(s).current, null);
s.current = { journeyId: 'j3', week: 1, dayIndex: 1, dayType: 'ZONE2', phase: 'zone2' };
is('an in-progress Zone 2 session resumes', run(s).current.phase, 'zone2');
s.current = { journeyId: 'j3', week: 1, dayIndex: 1, dayType: 'ZONE2', phase: 'constructor' };
is('an unknown phase is dropped', run(s).current, null);
s.current = { journeyId: 'gone', week: 1, dayIndex: 1, dayType: 'ZONE2', phase: 'zone2' };
is('a session of a missing journey is dropped', run(s).current, null);

// imported state is the trust boundary: fields that reach the markup are forced into shape
const EVIL = '"><img src=x onerror=alert(1)>';
s = withJ3();
s.journeys[1].weekPlan[1] = EVIL;
s.exercises.x_custom = { id: 'x_custom', name: 'Custom', group: 'legs', measure: 'reps', bucket: '9-12', range: EVIL, scheme: EVIL, backoffReps: EVIL, implement: EVIL };
s.sessions.push({ id: 's9', ts: 9, journeyId: 'j3', week: EVIL, dayIndex: 1, dayType: 'ZONE2', zone2: { modality: 'Bike', minutes: EVIL, hr: EVIL } });
s.sessions.push({ id: 's10', ts: 10, journeyId: 'j3', week: 1, dayIndex: 0, dayType: 'LEGS1', sets: [{ round: 1, ex: 'bench_press', amount: EVIL, weight: EVIL, slot: 9 }], circuit: { minutes: EVIL, log: [] } });
s.current = { journeyId: 'j3', week: 1, dayIndex: 1, dayType: 'ZONE2', phase: 'zone2', target: EVIL, minutes: EVIL, hr: EVIL, modality: EVIL };
out = run(s);
is('no injected markup survives a load', JSON.stringify(out).includes('<img'), false);
is('a bad day type becomes a rest day', out.journeys[1].weekPlan[1], 'REST');
is('bad numbers are reset, the session is kept', [out.sessions[2].zone2.minutes, out.sessions[3].sets[0].amount, 'slot' in out.sessions[3].sets[0]], [0, 0, false]);
s = withJ3();
s.current = { journeyId: 'j3', week: 1, dayIndex: 0, dayType: 'LEGS1', phase: 'lift', round: 1, slots: ['bulgarian_split_squat'], sets: [], cardio: [],
  roundEntries: [{ ex: 'bulgarian_split_squat', v39: true, slot: 0, amount: 8, weight: 8, count: 2, pct: 0.75, role: 'Warm-up', reps: EVIL }] };
is('a malformed round entry list is rebuilt, not rendered', run(s).current.roundEntries, null);
s.current.roundEntries[0].reps = [8, 8];
is('a well-formed round entry list survives a reload', run(s).current.roundEntries.length, 1);
s.current = { journeyId: 'j3', week: 1, dayIndex: 2, dayType: 'CORE', phase: 'circuit', blocks: [0, 1], bi: 0, round: 1, log: [] };
is('a circuit without done/pick maps gets them', [run(s).current.done, run(s).current.pick], [{}, {}]);

// --- the real export, when present (never copied into the repo) ---
const fixture = process.env.FIVE_TWO_FIXTURE;
if (fixture && fs.existsSync(fixture)) {
  const raw = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  const res = run(raw);
  is('fixture: loads', !!res, true);
  is('fixture: version 12', res.version, 12);
  is('fixture: session count unchanged', res.sessions.length, raw.sessions.length);
  is('fixture: no field of any old session altered', JSON.stringify(res.sessions) === JSON.stringify(raw.sessions), true);
  is('fixture: journeys unchanged', JSON.stringify(res.journeys) === JSON.stringify(raw.journeys), true);
  is('fixture: active journey kept', res.activeJourneyId, raw.activeJourneyId);
  is('fixture: bodyweight log unchanged', res.bodyweight, raw.bodyweight);
  is('fixture: missed marks unchanged', res.missed, raw.missed);
  is('fixture: a second load is stable', JSON.stringify(run(res).sessions) === JSON.stringify(raw.sessions), true);
} else {
  console.log('SKIP  fixture: set FIVE_TWO_FIXTURE to a real export to run these');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
