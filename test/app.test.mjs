/* Headless end-to-end run of the whole app (storage.js + engine.js + data.js +
   app.js) against a stubbed DOM: every view renders, and the v39 flows run
   from Start to the saved session. No browser, no dependencies.

   When a real export exists outside the repo (path in FIVE_TWO_FIXTURE) the legacy checks run against it as well. It is never copied in. */
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SRC = ['storage.js', 'engine.js', 'data.js', 'app.js'].map(read).join('\n');

let pass = 0, fail = 0;
function is(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}
const has = (label, html, needle, want = true) => is(label, html.includes(needle), want);

/* boot the app in a sandbox; `stored` is the localStorage blob or null */
function boot(stored, startAt) {
  const env = { offset: 0, alerts: [], confirms: [], answer: () => true, els: {} };
  const RealDate = Date;
  const base = startAt != null ? startAt - RealDate.now() : 0;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(FakeDate.now()); }
    static now() { return RealDate.now() + base + env.offset; }
  }
  const app = { innerHTML: '' };
  const classList = { toggle() {}, add() {}, remove() {} };
  const document = {
    getElementById: (id) => (id === 'app' ? app : (env.els[id] || null)),
    addEventListener() {}, visibilityState: 'visible',
    documentElement: { style: { setProperty() {} } },
    body: { classList, appendChild() {} },
    createElement: () => ({ click() {}, remove() {} }),
  };
  const store = {};
  if (stored) store['fivetwo.state'] = JSON.stringify(stored);
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const window = { addEventListener() {}, scrollTo() {} };
  const run = new Function('document', 'window', 'navigator', 'localStorage', 'confirm', 'alert',
    'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'location', 'console',
    `${SRC}\nreturn (code) => eval(code);`)(
    document, window, {}, localStorage,
    (m) => { env.confirms.push(m); return env.answer(m); }, (m) => { env.alerts.push(m); },
    () => 1, () => {}, () => 1, () => {}, FakeDate, { reload() {} },
    { error: (...a) => { env.errors = (env.errors || []).concat([a.map(String).join(' ')]); }, log() {} });
  env.$ = run;
  env.html = () => app.innerHTML;
  env.view = (name, params) => { run(`go(${JSON.stringify(name)}, ${JSON.stringify(params || {})})`); return app.innerHTML; };
  env.S = () => run('S');
  env.saved = () => JSON.parse(store['fivetwo.state']);
  return env;
}
const BROKEN = 'Something went wrong';

/* log the remaining rounds of a pyramid session as prefilled; `look` sees each round first */
function runPyramid(env, look) {
  while (env.S().current && env.S().current.phase === 'lift') {
    if (look) look(env.S().current.round, env.S().current.roundEntries);
    env.$('commitRound()');
    env.$('finishCardio()');
  }
}

// ---------- a fresh install still works ----------
let A = boot(null);
has('fresh install: home renders', A.html(), 'Next up');
has('fresh install: no render error', A.html(), BROKEN, false);
['journal', 'progress', 'program', 'settings', 'activation', 'deactivation'].forEach((v) => has('fresh install: ' + v + ' renders', A.view(v), BROKEN, false));
has('settings: equipment section', A.view('settings'), 'Equipment · home');
has('settings: sprint lead-in', A.html(), 'Sprint lead-in');
is('app and store versions', [A.$('APP_VERSION'), A.S().version], ['v42', 12]);
is('sw cache name matches the app version', /const CACHE = 'fivetwo-(v\d+)'/.exec(read('sw.js'))[1], A.$('APP_VERSION'));
is('sw caches every script the page loads',
  [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !read('sw.js').includes(`'${f}'`)), []);

// a journey before v39 keeps its own logic: round memory, ladders, no power marking
A.$("startSession(1, 0, 'home')");
is('legacy journey: session opens straight on the lift, no readiness phase', A.S().current.phase, 'lift');
has('legacy journey: ladder target', A.html(), 'ladder ');
has('legacy journey: A/B/C labels', A.html(), 'A · ');
has('legacy journey: no readiness question', A.html(), 'How are you today', false);
runPyramid(A);
is('legacy journey: finishes without an effort phase', [A.S().current, A.S().sessions.length], [null, 1]);
is('legacy journey: no v39 fields on its sets or session', [Object.keys(A.S().sessions[0].sets[0]).sort(), 'verdicts' in A.S().sessions[0]], [['amount', 'ex', 'round', 'weight'], false]);
has('legacy journey: summary has no effort line', A.html(), 'Felt:', false);

// ---------- Journey 3 ----------
const MON = new Date('2026-10-19T08:00:00').getTime();
A = boot(null, MON);
A.els.njDate = { value: '2026-10-19' };
A.els.njProg = { value: 'j3' };
A.$('newJourney()');
let j = A.$('journey()');
is('Journey 3: scheme and start date', [j.scheme, j.startDate], ['v39', '2026-10-19']);
is('Journey 3: the week', j.weekPlan.map((t) => A.$(`dayLabel('${t}')`)), ['Legs 1', 'Zone 2', 'Core', 'Legs 2', 'Upper 1', 'Sprint', 'Upper 2']);
is('Journey 3: work weights seeded', [A.S().work.bench_press, A.S().work.bulgarian_split_squat], [{ weight: 52.5 }, { weight: 12, count: 2 }]);
let home = A.view('home');
has('home: one primary action', home, '>Train<');
is('home: where to train is one segmented choice', ['>Home<', '>Other gym<', '>Hotel room<'].map((t) => home.includes(t)), [true, true, true]);
has('home: can’t train', home, 'Can’t train');
has('home: four lifts card', home, 'The four lifts');
has('home: no targets wording', home, 'Graded', false);
has('home: no scaffolding wording', home, 'scaffolding', false);
has('home: no Zone 2 check field', home, 'z2check', false);
has('home: no scapula snack card on a v39 journey', home, "go('snack', { key: 'scapula' })", false);
has('home: volume snack card stays', home, "go('snack', { key: 'volume' })");
has('home: no travel toggle', home, 'Travel mode', false);
A.$('view.cant=true;render()');
has('can’t train: sick, no time, light day', A.html(), 'Sick</button>');
has('can’t train: light day', A.html(), 'Light day</button>');
['journal', 'progress', 'program', 'settings'].forEach((v) => has('Journey 3: ' + v + ' renders', A.view(v), BROKEN, false));
has('program: P1 volume label', A.view('program'), 'volume · 6–8 reps');
has('program: no rest-day mover on a v39 journey', A.html(), 'restDaySel', false);
has('program: Core is not a pyramid day', A.html(), ">Core</button>", false);

// --- Legs 1 ---
A.$("startSession(1, 0, 'home')");
let c = A.S().current;
is('Legs 1 opens on the lift, no readiness', [c.phase, c.round, c.gym], ['lift', 1, 'home']);
is('round 1: split squat, 8 reps at 2 × 8', [c.roundEntries[0].ex, c.roundEntries[0].amount, c.roundEntries[0].weight, c.roundEntries[0].count], ['bulgarian_split_squat', 8, 8, 2]);
has('round 1: shows 2 × 8 kg', A.html(), '2 × 8 kg');
has('round 1: knee prep card', A.html(), 'Knee prep: 2 × 45 s Spanish squat hold');
is('leg day cardio defaults to the heavy bag', c.lastModality, 'Heavy bag');
A.$('commitRound()');
has('cardio after round 1: easy pace line', A.html(), 'Easy pace. The top set is next.');
has('cardio: 2 / 3 minute toggle', A.html(), 'setCardioMin(3)');
A.$('setCardioMin(3)');
is('cardio toggle sets the burst length', A.$('cardioSecs(S.current)'), 180);
A.$('finishCardio()');
c = A.S().current;
is('round 2: box squat primer at 30 kg', [c.roundEntries[1].ex, c.roundEntries[1].role, c.roundEntries[1].weight, c.roundEntries[1].amount], ['paused_box_squat', 'Primer', 30, 5]);
is('round 2: split squat back at the work weight', [c.roundEntries[0].weight, c.roundEntries[0].count, c.roundEntries[0].amount], [12, 2, 6]);
let html = A.html();
is('round 2: the anchor is shown first', html.indexOf('Paused box squat') < html.indexOf('Bulgarian split squat') && html.indexOf('Paused box squat') > 0, true);
has('round 2: POWER chip', html, 'power-chip">POWER');
has('round 2: power cue line', html, 'class="power-cue"');
has('round 2: role label', html, 'role-chip">Primer');
has('round 2: plates per side', html, '>per side 10<');
is('entry index stays the slot index', c.roundEntries.map((e) => e.slot), [0, 1]);
// a warm-up edit is logged but does not move the work weight
A.$('stepEntryLoad(1, 1)');
is('editing the primer does not change the work weight', [A.S().current.roundEntries[1].weight, A.S().work.paused_box_squat.weight], [32.5, 40]);
A.$('stepEntryLoad(1, -1)');
A.$('commitRound()');
has('cardio after round 2: easy pace line', A.html(), 'Easy pace. The top set is next.');
A.$('finishCardio()');
c = A.S().current;
is('round 3: fast fives at 40 kg', [c.roundEntries[1].role, c.roundEntries[1].weight], ['Fast', 40]);
// an edit at the full work weight IS the new work weight
A.$('stepEntryLoad(1, 1)');
is('editing a work round updates S.work', A.S().work.paused_box_squat.weight, 42.5);
A.$('stepEntryLoad(1, -1)');
is('… and back', A.S().work.paused_box_squat.weight, 40);
// dumbbells: the stepper walks the rack, always as equal weights
A.$('stepEntryLoad(2, 1)');
is('dumbbell step: 2 × 16 → 2 × 18', [A.S().current.roundEntries[2].weight, A.S().current.roundEntries[2].count], [18, 2]);
has('count toggle shows both options', A.html(), '1 × 18 kg');
has('no mixed pairs anywhere', A.html(), ' + 18 kg', false);
A.$('stepEntryLoad(2, -1)');
for (let r = 3; r <= 5; r++) { A.$('commitRound()'); if (r === 3) has('cardio after round 3: no easy pace line', A.html(), 'Easy pace', false); A.$('finishCardio()'); }
let s = A.S().sessions[A.S().sessions.length - 1];
is('Legs 1 saved', [s.dayType, s.travel, s.sets.length, A.S().current], ['LEGS1', false, 15, null]);
is('sets carry count', s.sets[0], { round: 1, ex: 'bulgarian_split_squat', amount: 8, weight: 8, count: 2 });
is('no readiness or effort on a new session', ['readiness' in s, 'effort' in s], [false, false]);
has('summary: no automatic suggestions', A.html(), 'Next time', false);
has('summary: shoulder-blade block offered after Legs 1', A.html(), 'Shoulder-blade block, 10 min');
A.$(`startBlock('${s.id}', 1)`);
c = A.S().current;
is('the block runs block 2 of the circuit', [c.phase, c.blocks, c.attach], ['circuit', [1], s.id]);
has('block: shoulder blades header', A.html(), 'Shoulder blades');
c.clockStart -= 9 * 60000;
[0, 1, 2, 3].forEach((si) => A.$(`circuitToggle(${si})`)); A.$('circuitNext()');
[0, 1].forEach((si) => A.$(`circuitToggle(${si})`)); A.$('circuitNext()');
s = A.S().sessions[A.S().sessions.length - 1];
is('the block is saved inside the Legs 1 session', [A.S().sessions.length, s.dayType, s.circuit.name, s.circuit.log.length, s.circuit.minutes], [1, 'LEGS1', 'Shoulder blades', 6, 9]);
has('journal: Legs 1 with the block renders', A.view('session', { sessionId: s.id }), 'Shoulder blades');

// --- Tuesday: Zone 2 ---
A.offset = 86400000;
home = A.view('home');
has('Tuesday: next up is Zone 2 · 45 min', home, 'Zone 2 · 45 min');
A.$("startSession(1, 1, 'home')");
has('Zone 2 screen', A.html(), 'You should be able to talk.');
A.$('startUpClock()'); A.offset += 44.6 * 60000;
A.$('S.current.hr = 128');
A.$('finishZone2()');
s = A.S().sessions[A.S().sessions.length - 1];
is('Zone 2 logged', [s.dayType, s.zone2], ['ZONE2', { modality: 'Bike', minutes: 45, hr: 128 }]);

// --- Wednesday: Core circuit ---
A.offset = 2 * 86400000;
has('Wednesday: next up is the circuit', A.view('home'), 'Circuit · 30 min');
A.$("startSession(1, 2, 'home')");
c = A.S().current;
is('Core opens as a circuit', [c.phase, c.blocks, c.round], ['circuit', [0, 1], 1]);
html = A.html();
has('circuit: block name and round', html, 'Trunk and hips');
has('circuit: round of rounds', html, 'Round 1 of 3');
has('circuit: body saw preselected', html, `chip on" onclick="circuitPick(1, 'body_saw')"`);
is('circuit: three alternatives', (html.match(/class="chip " onclick="circuitPick\(1, /g) || []).length, 3);
has('circuit: suitcase carry dose and kg', html, '40 m each side · 24 kg');
has('circuit: next line', html, 'Next: Up to 40 s, then the long lever');
has('circuit: session clock', html, 'id="upclock"');
A.$("circuitPick(1, 'dead_bug')");
A.$('circuitAdjust(1, \'amount\', 1)');
A.$('circuitToggle(1)'); A.$('circuitToggle(0)');
// timed station: lead-in, side 1, switch, side 2, auto-done
A.$('startStation(2)');
is('timed station: lead-in shows 3', A.$('clockText()'), '3');
A.offset += 3100; is('timed station: then the 30 s hold', A.$('clockText()'), '30');
A.offset += 30000; A.$('timerTick()');
is('timed station: switches sides with a fresh count', [A.$('timer.side'), A.$('clockText()')], [2, '3']);
A.offset += 33100; A.$('timerTick()');
is('timed station: marks itself done', [!!A.S().current.done[2], A.$('timer')], [true, null]);
is('round 1 has the Spanish squat', A.$('circuitStations(S.current).length'), 5);
A.$('circuitNext()'); A.$('circuitNext()');
is('round 3 drops the Spanish squat', [A.S().current.round, A.$('circuitStations(S.current).length')], [3, 4]);
has('the chosen option is remembered for the session', A.html(), `chip on" onclick="circuitPick(1, 'dead_bug')"`);
has('each option keeps its own dose', A.html(), '9 reps');
A.$('circuitNext()');
is('then block 2', [A.S().current.bi, A.S().current.round], [1, 1]);
A.$('circuitNext()'); A.$('circuitNext()');
s = A.S().sessions[A.S().sessions.length - 1];
is('circuit logged with the option that was done', [s.dayType, s.circuit.log.map((l) => l.ex)], ['CORE', ['dead_bug', 'suitcase_carry', 'copenhagen_plank']]);
is('circuit log rows', s.circuit.log[0], { block: 0, round: 1, station: 1, ex: 'dead_bug', reps: 9 });
is('circuit log: kg on the carry', s.circuit.log[1].kg, 24);
has('journal: circuit session renders', A.view('session', { sessionId: s.id }), 'Dead bug');

// --- Thursday can’t train (no time); Friday offers Legs 2 ---
A.offset = 3 * 86400000;
A.$("markMissed(1, 3, 'blocked')");
A.offset = 4 * 86400000;
home = A.view('home');
has('Friday: the missed Legs 2 takes the day', home, 'Legs 2 was missed, so it takes this day');
A.$("startSession(1, 4, 'home')");
is('backfill: confirm was asked', A.confirms.some((m) => m.includes('Legs 2 was missed this week')), true);
c = A.S().current;
is('backfill: Legs 2 runs on Friday', [c.dayType, c.dayIndex, c.slots[1]], ['LEGS2', 4, 'trap_bar_deadlift']);
runPyramid(A, (r, en) => {
  if (r === 2) is('trap bar warm-up 45 × 6', [en[1].weight, en[1].amount, en[1].role], [45, 6, 'Warm-up']);
  if (r === 3) is('trap bar top set 60 × 5', [en[1].weight, en[1].amount, en[1].role], [60, 5, 'Top set']);
  if (r === 4) is('trap bar back-off 55 × 6', [en[1].weight, en[1].amount, en[1].role], [55, 6, 'Back-off']);
  if (r === 3) is('carry: 30 s at 60 kg', [en[2].ex, en[2].amount, en[2].weight], ['trap_bar_carry', 30, 60]);
});
s = A.S().sessions[A.S().sessions.length - 1];
is('no automatic progression: the work weight stays where it was set', [A.S().work.trap_bar_deadlift, 'verdicts' in s], [{ weight: 60 }, false]);
// Saturday: Legs 2 was yesterday; Upper 1 (displaced) outranks Sprint
A.offset = 5 * 86400000;
is('Saturday: the displaced Upper 1 is offered', A.$('backfillFor(journey(), 1, 5).offer'), 'UPPER1');
A.answer = (m) => !m.includes('was missed this week');   // decline the backfill
A.$("startSession(1, 5, 'home')");
is('declining the backfill keeps the scheduled Sprint', A.S().current.dayType, 'SPRINT');
A.answer = () => true;

// --- sprint: 3-2-1, then 20 s net ---
has('sprint: warm-up card', A.html(), 'Leg swings, high-knee skips, then two build-up runs.');
has('sprint week 1: no 12-minute test', A.html(), '12-minute test', false);
A.$('startSprint(30)');
is('sprint lead-in shows 3, 2, 1', [0, 1000, 2000].map((ms) => { const t = A.offset; A.offset += ms; const v = A.$('clockText()'); A.offset = t; return v; }), ['3', '2', '1']);
A.offset += 3050; is('then the clock shows the full interval', A.$('clockText()'), '30');
A.offset += 30000; A.$('timerTick()');
A.$('startSprint(30)'); A.offset += 33100; A.$('timerTick()');
A.$('S.current.slope = 4');
A.$('startSprint(20)'); A.offset += 23100; A.$('timerTick()');
is('the logged work interval is 20 s net', A.S().current.sprints[2], { kind: 'work', secs: 20, slope: 4, speed: 12 });
for (let i = 0; i < 3; i++) { A.$('startSprint(20)'); A.offset += 23100; A.$('timerTick()'); }
A.$('finishSprintSession(1, 5)');
is('sprint saved', [A.S().sessions[A.S().sessions.length - 1].sprint.intervals, A.S().lastSprintRounds.length], [4, 6]);
is('next sprint day: work intervals prefill slope + 0.5, warm-ups keep memory', [A.$('sprintPrefill(2).slope'), A.$('sprintPrefill(0).slope')], [4.5, 0]);

// --- Sunday: hotel room ---
A.offset = 6 * 86400000;
const workBefore = JSON.stringify(A.S().work);
A.$("startSession(1, 6, 'hotel')");
c = A.S().current;
is('hotel room: Upper 1 still open, travel substitutes', [c.dayType, c.travel, c.slots], ['UPPER1', true, ['band_row', 'push_up', 'band_triceps_pushdown', 'band_overhead_press', 'band_pull_apart']]);
has('hotel room: band stepper', A.html(), '>band<');
runPyramid(A);
s = A.S().sessions[A.S().sessions.length - 1];
is('hotel room: saved as travel', s.travel, true);
is('hotel room: S.work untouched', JSON.stringify(A.S().work), workBefore);
is('hotel room is remembered as the default choice', A.S().settings.travelMode, true);

// --- week 2: light day, the chip, the bench ---
A.offset = 7 * 86400000;
A.$('startLight(2, 0)'); A.$("pickLightOption('stretch')");
has('light day: stretching list', A.html(), 'Leg swings');
A.$('S.current.minutes = 20'); A.$('finishLight()');
s = A.S().sessions[A.S().sessions.length - 1];
is('light day logged and the day marked missed', [s.dayType, s.light, A.S().missed[j.id + ':2:0']], ['LIGHT', { option: 'stretch', modality: null, minutes: 20 }, 'light']);
has('grid shows the light day', A.view('home'), 'day done light');
has('week 2, nothing logged yet: last week’s review is on Home', A.view('home'), 'Week 1 review');
A.offset = 8 * 86400000;
is('the light day is backfilled: Tuesday offers Legs 1', A.$('backfillFor(journey(), 2, 1).offer'), 'LEGS1');

A.answer = (m) => !m.includes('was missed this week');   // keep the scheduled day
A.$("startSession(2, 4, 'home')");   // Upper 1, week 2
A.answer = () => true;
c = A.S().current;
is('upper day cardio defaults to the bike', [c.dayType, c.lastModality], ['UPPER1', 'Bike']);
A.$('commitRound()'); A.$('finishCardio()');
is('bench warm-up 40 × 6', [A.S().current.roundEntries[1].weight, A.S().current.roundEntries[1].amount], [40, 6]);
A.$('commitRound()'); A.$('finishCardio()');
has('bench top set: per side 20 + 1.25', A.html(), '>per side 20 + 1.25<');
const seen = [];
for (let i = 0; i < 6; i++) { seen.push(A.S().current.roundEntries[1].weight); A.$('stepEntryLoad(1, 1)'); }
is('the bench stepper only offers buildable loads', seen, [52.5, 55, 60, 62.5, 65, 70]);
A.$('typeEntryLoad(1, 47.5)');
is('typing 47.5 snaps to a buildable load', A.S().current.roundEntries[1].weight, 45);
A.$('typeEntryLoad(1, 52.5)');
has('dumbbell lifts show 2 × 18 kg', A.html(), '2 × 18 kg');
A.$('abandonSession()');

// plateau warning: a second trap bar session at 60, then two weeks have passed
A.$("startSession(2, 3, 'home')");
has('no suggestion chip anywhere', (A.$('commitRound()'), A.$('finishCardio()'), A.html()), 'sugg-chip', false);
runPyramid(A, (r, en) => { if (r === 3) is('second session: still 60, no warning after 4 days', [en[1].weight, en[1].plateau], [60, false]); });
has('summary: no plateau card yet', A.html(), '<h3>Plateau</h3>', false);
has('once the week has a session the review leaves Home', A.view('home'), 'Week 1 review', false);
A.offset = 18 * 86400000;
is('two weeks on 60: plateau', !!A.$('plateauFor("trap_bar_deadlift", journey().id)'), true);
has('home: the lift is flagged on the scoreboard', A.view('home'), 'plateau-tag">plateau');
A.answer = (m) => !m.includes('was missed this week');
A.$("startSession(3, 3, 'home')"); A.answer = () => true;
A.$('commitRound()'); A.$('finishCardio()');
is('warm-up round: no warning on the trap bar (an edit there does not move the work weight); the lunge at its work weight is flagged', A.S().current.roundEntries.map((e) => e.plateau), [true, false]);
A.$('commitRound()'); A.$('finishCardio()');
has('top-set round: plateau warning', A.html(), 'Plateau · two weeks at this weight');
A.$('stepEntryLoad(1, 1)');
is('one step up moves the work weight', A.S().work.trap_bar_deadlift.weight, 62.5);
is('… and its warning is gone', A.S().current.roundEntries[1].plateau, false);
runPyramid(A);
is('no plateau after the step', A.$('plateauFor("trap_bar_deadlift", journey().id)'), null);
has('summary lists the lifts still stuck, not the one that moved', A.html(), 'Trap bar deadlift</span>\n          <span class="small plateau-tag"', false);

// --- other gym: free entry, counts for the work weight ---
A.$("startSession(2, 6, 'other')");
c = A.S().current;
is('other gym session', [c.gym, c.dayType], ['other', 'UPPER2']);
A.$('commitRound()'); A.$('finishCardio()');
A.$('commitRound()'); A.$('finishCardio()');
has('other gym: plain kg stepper, no plates line', A.html(), 'per side', false);
A.$("adjustEntry(1, 'weight', 2.5)");
is('other gym: 27.5 is allowed and becomes the work weight', [A.S().current.roundEntries[1].weight, A.S().work.overhead_press.weight], [27.5, 27.5]);
A.$("adjustEntry(1, 'weight', -2.5)");
for (let r = 3; r <= 5; r++) { A.$('commitRound()'); A.$('finishCardio()'); }
s = A.S().sessions[A.S().sessions.length - 1];
is('other gym: saved with the gym, the work weight is what was set', [s.gym, A.S().work.overhead_press], ['other', { weight: 25 }]);

// --- scoreboard: one number per lift ---
home = A.view('home');
has('scoreboard: no estimate line', home, 'Estimated', false);
has('scoreboard: top set of 5 or more', home, 'Top set of 5 or more reps');
is('scoreboard: trap bar top set', A.$('fourLiftsRows(journey())').find((r) => r.ex === 'trap_bar_deadlift').top, 62.5);
is('scoreboard: hotel-room sessions are excluded (no bench yet)', A.$('fourLiftsRows(journey())').find((r) => r.ex === 'bench_press').top, null);
is('scoreboard: split squat shows the pair total', A.$('fourLiftsRows(journey())').find((r) => r.ex === 'bulgarian_split_squat').top, 24);

// --- review fixes ---
// a sprint that ends while another screen is open is still logged
A.answer = (m) => !m.includes('was missed this week');
A.$('startSession(4, 5)'); A.answer = () => true;
A.$('startSprint(30)'); A.$("go('home')"); A.offset += 34000; A.$('timerTick()');
is('a sprint finishing off-screen is logged', A.S().current.sprints.length, 1);
A.$('abandonSession()');
// a timed circuit station that ends off-screen moves on to side 2
A.answer = (m) => !m.includes('was missed this week');
A.$('startSession(4, 2)'); A.answer = () => true;
A.$('startStation(2)'); A.$("go('home')"); A.offset += 34000; A.$('timerTick()');
is('a station finishing off-screen switches sides', A.$('timer.side'), 2);
A.$('abandonSession()');
// the 12-minute test clock survives a reload
A.$('startSession(6, 5)'); A.$('S.current.cooper = true'); A.$('startCooper()');
A.offset += 5 * 60000; A.$('timer = null'); A.$('render()');
is('12-minute test: the clock is rebuilt from its stored end', A.$('clockText()'), '7:00');
A.$('abandonSession()');
// a clock left running does not log an absurd session
A.answer = (m) => !m.includes('was missed this week');
A.$("startSession(5, 1, 'home')"); A.answer = () => true;
A.$('startUpClock()'); A.offset += 14 * 3600000; A.$('finishZone2()');
is('Zone 2 minutes are capped at three times the target', A.S().sessions[A.S().sessions.length - 1].zone2.minutes, 135);

// --- week 6: the 12-minute test; Progress ---
A.$('startSession(6, 5)');
has('week 6 sprint day offers the 12-minute test', A.html(), '12-minute test');
A.$('S.current.cooper = true'); A.$('render()');
has('12-minute test screen', A.html(), 'Distance in meters');
A.$('finishCooper()');
is('test needs a distance', A.alerts.pop(), 'Enter the distance in meters first.');
A.$('S.current.meters = 2450'); A.$('finishCooper()');
is('test stored', A.S().tests.map((t) => [t.kind, t.meters]), [['cooper12', 2450]]);
A.els.testDate = { value: '2026-10-17' }; A.els.testMeters = { value: '2300' };
A.$('addTestResult()');
is('a baseline can be added with its own date', A.S().tests.map((t) => [new Date(t.ts).getDate(), t.meters]), [[17, 2300], [A.$('new Date()').getDate(), 2450]]);
has('progress lists the results', A.view('progress'), '2300 m');
has('progress: no effort trend', A.html(), 'Effort by session type', false);
has('settings: other gym profile', A.view('settings'), 'Equipment · other gym');

// --- equipment edits ---
A.els.add_platePairs = { value: '2.5' };
A.$("addEquip('platePairs')");
is('a 2.5 kg pair can be added and 47.5 becomes buildable', [A.S().settings.equipment.home.platePairs.includes(2.5), A.$('buildableTotals(10, S.settings.equipment.home.platePairs)').includes(47.5)], [true, true]);
A.$("removeEquip('platePairs', " + A.S().settings.equipment.home.platePairs.indexOf(2.5) + ')');
is('… and removed again', A.$('buildableTotals(10, S.settings.equipment.home.platePairs)').includes(47.5), false);

// every view of the fully used state still renders, and the state reloads clean
['home', 'journal', 'progress', 'program', 'settings'].forEach((v) => has('after the full run: ' + v + ' renders', A.view(v), BROKEN, false));
A.S().sessions.forEach((x) => { if (A.view('session', { sessionId: x.id }).includes(BROKEN)) is('session view ' + x.dayType, 'broken', 'ok'); });
is('no render errors were logged', A.errors || [], []);
const B = boot(A.saved(), MON + A.offset);
is('the saved state reloads unchanged', [B.S().sessions.length, JSON.stringify(B.S().work), B.S().journeys.length], [A.S().sessions.length, JSON.stringify(A.S().work), A.S().journeys.length]);
has('… and renders', B.html(), BROKEN, false);

// ---------- the real export, when present ----------
const fixture = process.env.FIVE_TWO_FIXTURE;
if (fixture && fs.existsSync(fixture)) {
  const raw = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  const F = boot(raw, MON - 2 * 86400000);
  has('fixture: home renders', F.html(), BROKEN, false);
  ['journal', 'progress', 'program', 'settings'].forEach((v) => has('fixture: ' + v + ' renders', F.view(v), BROKEN, false));
  const broken = raw.sessions.filter((x) => F.view('session', { sessionId: x.id }).includes(BROKEN)).length;
  is('fixture: every old session opens in the Journal', broken, 0);
  is('fixture: both journeys keep their sessions', raw.journeys.map((jj) => F.S().sessions.filter((x) => x.journeyId === jj.id).length),
    raw.journeys.map((jj) => raw.sessions.filter((x) => x.journeyId === jj.id).length));
  has('fixture: Journey 2 keeps the v38 scoreboard', F.view('progress'), 'The four numbers');
  has('fixture: no effort shown in the Journal', F.view('journal'), 'brutal', false);
  is('fixture: stored effort fields are untouched', F.S().sessions.filter((x) => x.effort).length, raw.sessions.filter((x) => x.effort).length);
  F.els.njDate = { value: '2026-10-19' }; F.els.njProg = { value: 'j3' };
  F.$('newJourney()');
  is('fixture: Journey 3 starts beside the old two', [F.S().journeys.length, F.$('journey()').name, F.$('journey()').scheme], [3, 'Journey 3', 'v39']);
  has('fixture: home shows the four lifts', F.view('home'), 'The four lifts');
  F.$("startSession(1, 0, 'home')");
  is('fixture: Legs 1 round 1 is 8 reps at 2 × 8', [F.S().current.roundEntries[0].amount, F.S().current.roundEntries[0].weight, F.S().current.roundEntries[0].count], [8, 8, 2]);
  runPyramid(F);
  is('fixture: old sessions unchanged after a Journey 3 session', JSON.stringify(F.S().sessions.slice(0, raw.sessions.length)) === JSON.stringify(raw.sessions), true);
  is('fixture: pre-v39 dumbbell sets stay out of the v39 scoreboard', F.$('fourLiftsRows(journey())').find((r) => r.ex === 'bulgarian_split_squat').top, 24);
  is('fixture: no render errors', F.errors || [], []);
} else {
  console.log('SKIP  fixture: set FIVE_TWO_FIXTURE to a real export to run these');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
