/* app.js — 5+2 Journeys: views, accumulator engine, cardio timer, logging */
// keep in sync with the CACHE name in sw.js
const APP_VERSION = 'v43';

let S = loadState() || normalizeState(seedState());
saveState(S);

let view = { name: 'home' };
let timer = null;       // { endTs, total, interval, finished, paused, pausedLeft }
let wakeLock = null;

/* ---------- icons (inline SVG, stroke-based) ---------- */

function svg(paths, size, vb) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" fill="none"
    stroke="currentColor" stroke-width="${vb > 24 ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const NAV_ICONS = {
  home: '<path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V15 H10 V21 H4 a1 1 0 0 1 -1 -1 Z"/>',
  journal: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8 h6 M9 12 h6 M9 16 h4"/>',
  progress: '<path d="M3 17 L9 11 L13 15 L21 7 M15 7 H21 V13"/>',
  program: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12 h6 M9 16 h6"/>',
  settings: '<path d="M4 6 h16 M4 12 h16 M4 18 h16"/><circle cx="10" cy="6" r="2" fill="var(--bg)"/><circle cx="16" cy="12" r="2" fill="var(--bg)"/><circle cx="8" cy="18" r="2" fill="var(--bg)"/>',
};

/* movement-pattern pictograms: tiny stick figures as visual reminders */
const PATTERN_ICONS = {
  squat:  '<circle cx="30" cy="9" r="4"/><path d="M28 13 L20 26 M20 26 L32 29 M32 29 L32 40 M32 40 L38 40 M26 17 L37 21"/>',
  hinge:  '<circle cx="33" cy="9" r="4"/><path d="M31 12 L18 22 M18 22 L18 40 M18 40 L25 40 M26 16 L26 31"/>',
  bridge: '<circle cx="10" cy="26" r="4"/><path d="M13 28 L28 22 M28 22 L34 30 M34 30 L34 40 M6 40 L42 40"/>',
  lunge:  '<circle cx="24" cy="8" r="4"/><path d="M24 12 L24 24 M24 24 L33 28 L33 40 M24 24 L16 33 L21 40"/>',
  push:   '<circle cx="38" cy="19" r="4"/><path d="M34 22 L12 28 M28 24 L28 37 M6 40 L42 40"/>',
  press:  '<circle cx="24" cy="13" r="4"/><path d="M24 17 L24 32 M24 32 L18 42 M24 32 L30 42 M20 15 L15 7 M28 15 L33 7 M11 6 L37 6"/>',
  pull:   '<path d="M8 6 L40 6 M18 8 L21 15 M30 8 L27 15"/><circle cx="24" cy="20" r="4"/><path d="M24 24 L24 34 M24 34 L19 41 M24 34 L29 41"/>',
  raise:  '<circle cx="24" cy="10" r="4"/><path d="M24 14 L24 32 M24 32 L19 42 M24 32 L29 42 M22 18 L8 15 M26 18 L40 15"/>',
  core:   '<circle cx="12" cy="31" r="3.5"/><path d="M15 29 L27 17 M27 17 L41 38 M6 40 L42 40"/>',
  carry:  '<circle cx="24" cy="8" r="4"/><path d="M24 12 L24 30 M24 30 L18 42 M24 30 L30 42 M19 16 L18 27 M29 16 L30 27"/><rect x="14" y="27" width="7" height="7"/><rect x="27" y="27" width="7" height="7"/>',
  jump:   '<circle cx="24" cy="9" r="4"/><path d="M24 13 L24 25 M22 15 L13 8 M26 15 L35 8 M24 25 L16 31 M24 25 L32 31 M8 42 L18 42 M30 42 L40 42"/>',
  swing:  '<circle cx="19" cy="10" r="4"/><path d="M19 14 L26 26 M26 26 L21 40 M26 26 L32 40 M23 18 L37 13"/><circle cx="40" cy="12" r="3.5"/>',
  band:   '<path d="M16 22 L16 40 M32 22 L32 40 M16 22 L32 22 M16 29 C21 25 27 25 32 29 M16 33 C21 37 27 37 32 33"/>',
  hold:   '<path d="M37 6 L37 40 M8 40 L42 40"/><circle cx="30" cy="13" r="4"/><path d="M33 17 L33 27 M33 27 L21 27 M21 27 L21 40"/>',
};

function patternIcon(pattern, size) {
  return svg(PATTERN_ICONS[pattern] || PATTERN_ICONS.hold, size || 30, 48);
}

/* ---------- helpers ---------- */

const $app = document.getElementById('app');

let saveTimer = null;

function save() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saveState(S);
}

/* high-frequency inputs (stepper taps) coalesce writes; anything that must
   persist immediately calls save(), which also flushes a pending write */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveState(S); }, 300);
}

window.addEventListener('pagehide', () => { if (saveTimer) save(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveTimer) save();
});

function go(name, params) { view = Object.assign({ name }, params || {}); render(); }

function journey() { return S.journeys.find((j) => j.id === S.activeJourneyId) || null; }

function ex(id) {
  return S.exercises[id] || { id, name: String(id || 'unknown'), measure: 'reps', bucket: null, group: '?', pattern: 'hold', cue: '', desc: '' };
}

function dayType(j, dayIndex) { return j.weekPlan[dayIndex] || 'REST'; }

function isV39(j) { return !!j && j.scheme === 'v39'; }

function journeyOf(rec) { return rec ? (S.journeys.find((j) => j.id === rec.journeyId) || null) : null; }

function travelSub(id) {
  return (TRAVEL_SUBS[id] && S.exercises[TRAVEL_SUBS[id]]) ? TRAVEL_SUBS[id] : id;
}

/* a hotel-room session carries travel: true. Outside a session the remembered
   choice (settings.travelMode) decides what the Home preview shows. */
function inTravel() { return S.current ? !!S.current.travel : !!S.settings.travelMode; }

/* the equipment profile a session runs on, as the kit engine.js expects */
function kitFor(c) {
  const eq = S.settings.equipment;
  return ((c && c.gym) || eq.active) === 'other' ? eq.other : eq.home;
}

function cardioList() { return inTravel() ? TRAVEL_CARDIO : CARDIO_MODALITIES; }

function toggleBigThree() {
  const key = localDate();
  if (S.bigThree[key]) delete S.bigThree[key];
  else S.bigThree[key] = true;
  save(); render();
}

function bigThreeWeekCount() {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (S.bigThree[localDate(new Date(Date.now() - i * 86400000))]) n++;
  }
  return n;
}

/* snack sessions: reference + memory, never logged. reps/kg/band are
   user-owned fields on the exercise record (same doctrine as bucket). */
function setSnackField(exId, field, value) {
  const e = S.exercises[exId];
  if (!e || !['snackRounds', 'snackReps', 'snackKg', 'snackBand'].includes(field)) return;
  if (field === 'snackBand') {
    e.snackBand = String(value || '').slice(0, 24);
  } else {
    const max = field === 'snackKg' ? 500 : (field === 'snackRounds' ? 20 : 999);
    e[field] = clampNum(value, 0, max, 0);
  }
  save(); render();
}

function adjustSnackField(exId, field, delta) {
  const e = S.exercises[exId];
  if (!e) return;
  setSnackField(exId, field, (Number(e[field]) || 0) + delta);
}

function snackStepperHTML(exId, field, value, unit, step) {
  return `<div class="stepper">
    <button onclick="adjustSnackField('${exId}', '${field}', ${-step})" aria-label="less ${unit}">−</button>
    <input class="val" inputmode="decimal" value="${value}" onchange="setSnackField('${exId}', '${field}', this.value)" aria-label="${unit}">
    <button onclick="adjustSnackField('${exId}', '${field}', ${step})" aria-label="more ${unit}">+</button>
    <span class="unit">${unit}</span>
  </div>`;
}

function toggleSnackInfo(exId) {
  if (!view.info) view.info = {};
  view.info[exId] = !view.info[exId];
  render();
}

function setBucket(exId, bucket) {
  if (!S.exercises[exId]) return;
  S.exercises[exId].bucket = bucket || null;
  save(); render();
}

/* pyramid days. On a v39 journey Core is a circuit, not a pyramid. */
function is52Day(type, j) {
  if (['ZONE2', 'REST', 'SPRINT', 'LIGHT'].includes(type)) return false;
  return !(type === 'CORE' && isV39(j));
}

function slotsFor(j, week, type) {
  if (!j || !is52Day(type, j)) return [];
  const block = j.blocks[blockForWeek(week)] || {};
  return (block[type] || []).filter(Boolean);
}

function sessionFor(jid, week, dayIndex) {
  return S.sessions.find((s) => s.journeyId === jid && s.week === week && s.dayIndex === dayIndex);
}

/* one pass over sessions -> O(1) done-lookups for the 42-cell grid */
function doneDaySet(j) {
  const done = new Set();
  S.sessions.forEach((s) => { if (s.journeyId === j.id) done.add(s.week + ':' + s.dayIndex); });
  return done;
}

function missedKind(j, week, dayIndex) {
  return (S.missed || {})[j.id + ':' + week + ':' + dayIndex] || null;
}

function markMissed(week, dayIndex, kind) {
  const j = journey();
  if (!j) return;
  S.missed[j.id + ':' + week + ':' + dayIndex] = kind;
  view.cant = false;
  save(); render();
}

function nextSlot(j, done) {
  done = done || doneDaySet(j);
  for (let w = 1; w <= j.weekCount; w++) {
    for (let d = 0; d < 7; d++) {
      if (!done.has(w + ':' + d) && !missedKind(j, w, d)) return { week: w, dayIndex: d };
    }
  }
  return null;
}

const MISSED_LABEL = { sick: 'Sick', blocked: 'No time', light: 'Light' };

/* backfill: a missed day (sick, no time, light) may take over the next open
   day, by priority. The rules live in engine.js (backfillOffer). */
function backfillFor(j, week, dayIndex, now) {
  const missedDays = {};
  for (let d = 0; d < 7; d++) {
    const mk = missedKind(j, week, d);
    if (mk) missedDays[d] = mk;
  }
  return backfillOffer({
    weekPlan: j.weekPlan, week, dayIndex, weekCount: j.weekCount, missedDays,
    sessions: S.sessions.map((s) => ({ journey: s.journeyId === j.id, week: s.week, dayIndex: s.dayIndex, dayType: s.dayType, ts: s.ts })),
    now: now || Date.now(),
  });
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch (e) { return String(ts); }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function clampNum(v, lo, hi, fallback) {
  const n = parseFloat(String(v).replace(',', '.'));
  if (isNaN(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function lastLogged(exId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const sets = S.sessions[i].sets || [];
    for (let k = sets.length - 1; k >= 0; k--) {
      if (sets[k].ex === exId) return sets[k];
    }
  }
  return null;
}

/* Per-round memory: what this exercise did at THIS round number, most recently.
   The accumulator means a slot's rounds are deliberately unequal — an A-slot
   ramp (light rounds 1-2, working weight 3-5) or a reverse pyramid on a B-slot
   anchor (round 1 ~80%, round 2 top, then back down). Carrying the previous
   set forward gets every one of those rounds wrong; round 2 would prefill from
   round 1's ramp weight, and next session's round 1 would prefill from last
   session's lightest back-off set. Matching round to round reproduces the
   shape instead of flattening it. */
function lastLoggedAtRound(exId, round) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const hit = (S.sessions[i].sets || []).find((x) => x.ex === exId && x.round === round);
    if (hit) return Object.assign({}, hit, { jid: S.sessions[i].journeyId || null });
  }
  return null;
}

/* Did a heavier round of this exercise exist last time it was trained? Used to
   put the +kg suggestion on the top set only — on a reverse pyramid that is
   round 2, not round 1. */
function hasHeavierRound(exId, round) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const sets = (S.sessions[i].sets || []).filter((x) => x.ex === exId);
    if (!sets.length) continue;
    const here = sets.find((x) => x.round === round);
    if (!here) return false;
    return sets.some((x) => (x.weight || 0) > (here.weight || 0));
  }
  return false;
}

function bucketFloor(bucket) {
  if (!bucket) return 30; // secs default
  return parseInt(bucket, 10) || 10;
}

function bucketTop(bucket) {
  if (!bucket) return null;
  const m = String(bucket).match(/(\d+)\s*\+?$/);
  return m ? parseInt(m[1], 10) : null;
}

/* ---------- rep ladders (Journey 2) ---------- */

function ladderFor(e) {
  if (typeof LADDERS === 'undefined') return null;
  return e && e.barbell ? LADDERS.barbell : LADDERS.general;
}

/* rep target for slot `slot` (0 = A) in round `round`; null for time-based
   exercises or rounds the slot is not in */
function ladderReps(slot, round, e) {
  if (!e || e.measure !== 'reps') return null;
  const L = ladderFor(e);
  if (!L || slot < 0 || slot > 4) return null;
  const idx = round - slot - 1;
  return idx >= 0 && idx < L[slot].length ? L[slot][idx] : null;
}

function ladderLabel(slot, e) {
  const L = ladderFor(e);
  if (!L || !e || e.measure !== 'reps' || slot < 0 || slot > 4) return '';
  return L[slot].join('·');
}

/* the slot an exercise occupied in a logged session = its first round - 1
   (slot A appears from round 1, B from round 2, …); tired-mode reversal keeps
   the same invariant because it reverses the slot list before rounds start */
function slotIndexIn(sets) {
  let first = Infinity;
  sets.forEach((x) => { if (x.round < first) first = x.round; });
  return first === Infinity ? -1 : first - 1;
}

/* did every logged round of this exercise meet its ladder rep? */
function toppedLadder(sets, e) {
  const slot = slotIndexIn(sets);
  if (slot < 0) return false;
  return sets.every((x) => {
    const need = ladderReps(slot, x.round, e);
    return need == null ? true : x.amount >= need;
  });
}

/* progression (journeys before v39): ladder met on every round in the last N
   gym appearances at an unchanged top weight -> suggest +kg on the top-weight
   round. N = 1 for barbell anchors, N = 2 for everything else. Hip thrust
   moves +5. */
function progressionSuggestion(exId) {
  const e = ex(exId);
  const j = journey();
  if (!j || !e || e.measure !== 'reps' || e.travel) return null;
  if (S.current && S.current.travel) return null; // second stepper is band level, not kg
  const need = e.barbell ? 1 : 2;
  const appearances = [];
  for (let i = S.sessions.length - 1; i >= 0 && appearances.length < need; i--) {
    const s = S.sessions[i];
    if (s.travel || s.journeyId !== j.id) continue;
    const sets = (s.sets || []).filter((x) => x.ex === exId);
    if (sets.length) appearances.push(sets);
  }
  if (appearances.length < need) return null;
  const maxes = appearances.map((sets) => Math.max(...sets.map((x) => x.weight || 0)));
  if (maxes.some((m) => m !== maxes[0])) return null; // weight already moved
  const w = maxes[0];
  // at 0 kg only loadable bodyweight moves (pull-up, dip) graduate to added load;
  // burpees, jumps and band drills never get a kg suggestion
  if (w === 0 && !e.loadable) return null;
  if (!appearances.every((sets) => toppedLadder(sets, e))) return null;
  const add = exId === 'hip_thrust' ? 5 : Math.max(2.5, S.settings.weightStep || 2.5);
  return { from: w, add, bucket: ladderLabel(slotIndexIn(appearances[0]), e) || e.bucket, once: need === 1 };
}

/* ---------- scoreboard + bodyweight (Journey 2) ---------- */

/* best top set in this journey: max weight among sets with amount >= reps,
   non-travel; plus the best weight at any reps as a fallback read */
function scoreboardRows(j) {
  if (!j || !Array.isArray(j.scoreboard)) return [];
  return j.scoreboard.map((it) => {
    let atReps = 0, any = 0;
    S.sessions.forEach((s) => {
      if (s.journeyId !== j.id || s.travel) return;
      (s.sets || []).forEach((x) => {
        if (x.ex !== it.ex) return;
        const w = x.weight || 0;
        if (w > any) any = w;
        if (x.amount >= it.reps && w > atReps) atReps = w;
      });
    });
    return { ex: it.ex, reps: it.reps, target: it.target, atReps, any };
  });
}

function scoreboardCardHTML(j) {
  if (isV39(j)) return fourLiftsCardHTML(j);
  const rows = scoreboardRows(j);
  if (!rows.length) return '';
  const end = j.startDate ? new Date(j.startDate + 'T12:00:00') : null;
  if (end) end.setDate(end.getDate() + j.weekCount * 7 - 1);
  return `<div class="card">
    <h3>The four numbers</h3>
    <p class="muted small">Top set of clean reps, this journey. ${end ? 'Graded ' + esc(end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '.' : ''} Everything else is scaffolding.</p>
    ${rows.map((r) => {
      const pct = Math.max(0, Math.min(100, Math.round(100 * r.atReps / r.target)));
      return `<div class="score-row">
        <div class="row spread"><span>${esc(ex(r.ex).name)}</span>
          <span class="muted small">${r.atReps ? r.atReps + ' kg' : '—'} <span class="of">/ ${r.target} kg × ${r.reps}</span>${!r.atReps && r.any ? ' · best any reps ' + r.any : ''}</span></div>
        <div class="score-bar"><div class="score-fill ${r.atReps >= r.target ? 'hit' : ''}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('')}
  </div>`;
}

/* v39 scoreboard: no targets, one number per lift — the heaviest set of at
   least 5 reps in this journey's gym sessions */
function fourLiftsRows(j) {
  const sessions = S.sessions.filter((s) => s.journeyId === j.id && !s.travel);
  return (j.scoreboard || []).map((it) => ({ ex: it.ex, top: topSet(ex(it.ex), sessions, 5), plateau: !!plateauFor(it.ex, j.id) }));
}

function fourLiftsCardHTML(j) {
  const rows = fourLiftsRows(j);
  if (!rows.length) return '';
  return `<div class="card">
    <h3>The four lifts</h3>
    <p class="muted small">Top set of 5 or more reps, this journey.</p>
    ${rows.map((r) => `<div class="set-row"><span>${esc(ex(r.ex).name)}${r.plateau ? ' <span class="plateau-tag">plateau</span>' : ''}</span>
      <span class="score-num">${r.top == null ? '—' : r.top + ' kg'}</span></div>`).join('')}
  </div>`;
}

function isoWeekKey(d) {
  // Monday of the week containing d, as YYYY-MM-DD — one bodyweight entry per week
  d = new Date(d || Date.now());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return localDate(d);
}

function setBodyweight(value) {
  const n = clampNum(value, 30, 250, NaN);
  const key = isoWeekKey();
  if (isNaN(n)) delete S.bodyweight[key];
  else S.bodyweight[key] = Math.round(n * 10) / 10;
  save(); render();
}

function bodyweightCardHTML() {
  const key = isoWeekKey();
  const cur = S.bodyweight[key];
  const keys = Object.keys(S.bodyweight).sort();
  const prevKey = keys.filter((k) => k < key).pop();
  const prev = prevKey ? S.bodyweight[prevKey] : null;
  const hint = cur == null
    ? (prev != null ? `Last logged ${prev} kg. One entry a week, same morning, after the bathroom, before breakfast.` : 'One entry a week, same morning, after the bathroom, before breakfast.')
    : (prev != null ? `${cur > prev ? '+' : ''}${Math.round((cur - prev) * 10) / 10} kg vs last entry.` : 'Logged for this week.');
  return `<div class="card">
    <div class="row spread">
      <div class="grow"><h3>Bodyweight · this week</h3><p class="muted small">${hint}</p></div>
      <div class="stepper">
        <input class="val" inputmode="decimal" value="${cur != null ? cur : ''}" placeholder="kg" onchange="setBodyweight(this.value)" aria-label="bodyweight in kg">
        <span class="unit">kg</span>
      </div>
    </div>
  </div>`;
}

function suggApplied(en) {
  return !!en.sugg && en.weight === en.sugg.from + en.sugg.add;
}

/* one shared audio context, created and resumed on a tap: iOS only lets a
   context that was started inside a user gesture make sound later */
let audioCtx = null;

function primeAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
}

function tone(freq, at, len) {
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.4, audioCtx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + at + len);
    o.start(audioCtx.currentTime + at);
    o.stop(audioCtx.currentTime + at + len);
  } catch (e) { /* audio unavailable */ }
}

function beep() {
  primeAudio();
  [0, 0.35, 0.7].forEach((t) => tone(880, t, 0.3));
}

/* lead-in: one short count beep per second, a higher one on go */
function countBeep(go) { tone(go ? 1175 : 660, 0, go ? 0.3 : 0.12); }

async function requestWake() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* denied */ }
}
function releaseWake() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.current) requestWake();
});

/* ---------- workout engine ---------- */

/* how a session runs: 'home' or 'other' equipment profile, or 'hotel' (travel
   substitutes). Without an explicit choice the remembered one applies. */
function sessionMode(mode) {
  if (mode === 'hotel' || mode === 'home' || mode === 'other') return mode;
  if (S.settings.travelMode) return 'hotel';
  return S.settings.equipment.active === 'other' ? 'other' : 'home';
}

/* the view that belongs to the live session's phase */
function sessionView() {
  const p = S.current ? S.current.phase : null;
  return { sprint: 'sprint', zone2: 'zone2', light: 'light', circuit: 'circuit' }[p] || 'workout';
}

function newSprintSession(base) {
  const first = sprintPrefill(0);
  return Object.assign(base, {
    dayType: 'SPRINT', phase: 'sprint',
    sprints: [],
    slope: first.slope,
    speed: first.speed,
    modality: null,
  });
}

function startSession(week, dayIndex, mode) {
  const j = journey();
  if (!j) { go('home'); return; }
  week = clampNum(week, 1, j.weekCount, 1);
  dayIndex = clampNum(dayIndex, 0, 6, 0);
  const type = dayType(j, dayIndex);

  if (S.current) {
    if (S.current.week === week && S.current.dayIndex === dayIndex) { go(sessionView()); return; }
    if (!confirm('A session is already in progress. Discard it and start this one?')) return;
    S.current = null;
    stopTimer();
  }
  const mk = missedKind(j, week, dayIndex);
  if (mk) {
    if (!confirm('This day is marked ' + MISSED_LABEL[mk].toLowerCase() + '. Clear the mark and train it now?')) return;
    delete S.missed[j.id + ':' + week + ':' + dayIndex];
    save();
  }
  if (sessionFor(j.id, week, dayIndex)) {
    if (!confirm('This day is already logged. Log it again?')) return;
  }
  if (type === 'REST') { go('rest', { week, dayIndex }); return; }

  // backfill: offer the highest-priority missed session of this week instead
  let sessionType = type;
  const bf = backfillFor(j, week, dayIndex);
  if (bf.offer !== type && confirm(dayLabel(bf.offer) + ' was missed this week. Do it now instead? ' + dayLabel(type) + ' stays open until the week ends.')) {
    sessionType = bf.offer;
  }

  mode = sessionMode(mode);
  S.settings.travelMode = mode === 'hotel';   // remembered as the default choice
  view.where = null;
  view.cant = false;
  const base = {
    journeyId: j.id, week, dayIndex, dayType: sessionType,
    travel: mode === 'hotel', gym: mode === 'hotel' ? null : mode,
    startedTs: Date.now(),
  };

  if (sessionType === 'SPRINT') {
    S.current = newSprintSession(base);
    save();
    requestWake();
    go('sprint', { week, dayIndex });
    return;
  }
  if (sessionType === 'ZONE2') {
    S.current = Object.assign(base, { phase: 'zone2', target: 45, clockStart: null, modality: null, minutes: null, hr: null });
    save();
    requestWake();
    go('zone2');
    return;
  }
  if (sessionType === 'CORE' && isV39(j)) {
    beginCircuit(base, CORE_CIRCUIT.map((b, i) => i), null);
    return;
  }

  let slots = slotsFor(j, week, sessionType).slice(0, 5);
  if (!slots.length) {
    alert('This day has no exercises configured yet — add them under Program first.');
    go('program');
    return;
  }
  if (base.travel) slots = slots.map(travelSub);
  // cardio default by day kind: heavy bag on leg days, bike on upper days
  const kind = (DAY_TYPES[sessionType] || {}).kind;
  const list = base.travel ? TRAVEL_CARDIO : CARDIO_MODALITIES;
  const byKind = base.travel ? null : (kind === 'legs' ? 'Heavy bag' : kind === 'upper' ? 'Bike' : null);
  S.current = Object.assign(base, {
    round: 1, phase: 'lift',
    slots,
    sets: [], cardio: [],
    roundEntries: null,
    cardioMin: S.settings.cardioMinutes,
    lastModality: byKind || (list.includes(S.lastModality) ? S.lastModality : list[0]),
  });
  initRound();
  save();
  requestWake();
  go('workout');
}

/* ---------- v39: one work weight per lift ---------- */

/* the work record of a lift: { weight, count? }. It changes only by hand. */
function workFor(exId) {
  const w = S.work[exId];
  if (!w) return null;
  const out = { weight: w.weight };
  if (w.count != null) out.count = w.count;
  return out;
}

/* plateau warning: two weeks of gym sessions at the current work weight */
function plateauFor(exId, jid) {
  const w = workFor(exId);
  if (!w) return null;
  const sessions = S.sessions.filter((s) => s.journeyId === jid && !s.travel).reverse();
  return plateauSince(ex(exId), w, sessions, Date.now());
}

function lastGymSetAtRound(exId, round, jid) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const s = S.sessions[i];
    if (s.journeyId !== jid || s.travel) continue;
    const hit = (s.sets || []).find((x) => x.ex === exId && x.round === round);
    if (hit) return hit;
  }
  return null;
}

function lastTravelSet(exId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    if (!S.sessions[i].travel) continue;
    const sets = (S.sessions[i].sets || []).filter((x) => x.ex === exId);
    if (sets.length) return sets[sets.length - 1];
  }
  return null;
}

/* v39: the prescription wins over round memory. Reps and weight for every
   round come from the slot scheme and the lift's one work weight. */
function v39Entry(c, exId, slot) {
  const e = ex(exId);
  const blank = { ex: exId, v39: true, slot, fresh: false, skipped: false, info: false, sugg: null };
  if (c.travel) {
    // hotel room: the scheme sets the reps, the second stepper is a band level
    const p = prescribe(e, slot, c.round, null);
    const prev = lastTravelSet(exId);
    return Object.assign(blank, { scheme: p.scheme, role: p.role, pct: p.pct, reps: p.reps, amount: p.reps[0], weight: prev ? prev.weight : 0 });
  }
  const kit = kitFor(c);
  // a lift without a work weight yet starts at the lightest load on the rack
  if (!S.work[exId]) S.work[exId] = scaleLoad(e, kit, { weight: 0 }, 1);
  const p = prescribedSet(e, slot, c.round, workFor(exId), kit);
  // inside a rep range, pick up where this round ended last time at this load
  let amount = p.reps[0];
  if (p.reps[1] > p.reps[0]) {
    const last = lastGymSetAtRound(exId, c.round, c.journeyId);
    if (last && Math.abs(loadTotal(last) - loadTotal(p.load)) < 0.001) {
      amount = Math.min(p.reps[1], Math.max(p.reps[0], last.amount));
    }
  }
  const en = Object.assign(blank, {
    scheme: p.scheme, role: p.role, pct: p.pct, reps: p.reps, amount, weight: p.load.weight,
    // shown on rounds at the work weight, where an edit is what ends it
    plateau: p.pct === 1 && !!plateauFor(exId, c.journeyId),
  });
  if (p.load.count) en.count = p.load.count;
  return en;
}

/* An edit on a round at the full work weight IS the new work weight. An edit
   on a warm-up, primer or back-off round is logged as lifted and leaves the
   prescription alone. Hotel-room sessions never change S.work. */
function commitLoadEdit(en) {
  const c = S.current;
  if (!en.v39 || !c || c.travel || en.pct !== 1) return;
  const w = { weight: en.weight };
  if (en.count) w.count = en.count;
  S.work[en.ex] = w;
  en.plateau = !!plateauFor(en.ex, c.journeyId);   // any step off the old weight clears it
}

function setEntryLoad(en, load) {
  en.weight = load.weight;
  if (load.count) en.count = load.count; else delete en.count;
  commitLoadEdit(en);
  scheduleSave(); render();
}

function stepEntryLoad(i, dir) {
  const en = entryAt(i);
  if (!en) return;
  const next = stepLoad(ex(en.ex), kitFor(S.current), en, dir);
  if (next) setEntryLoad(en, next);
}

/* a typed bar weight snaps to the nearest load the plates can build */
function typeEntryLoad(i, value) {
  const en = entryAt(i);
  if (!en) { render(); return; }
  const options = loadOptions(ex(en.ex), kitFor(S.current), en.count);
  const n = clampNum(value, 0, 500, en.weight);
  const hit = options && options.length ? nearestLoad(options, n) : { weight: n };
  setEntryLoad(en, hit);
}

function setBellCount(i, n) {
  const en = entryAt(i);
  if (en) setEntryLoad(en, { weight: en.weight, count: n === 1 ? 1 : 2 });
}

function initRound() {
  const c = S.current;
  const slots = (c.slots || []).slice(0, c.round);
  if (isV39(journeyOf(c))) {
    c.roundEntries = slots.map((exId, slot) => v39Entry(c, exId, slot));
    return;
  }
  // journeys before v39: round memory wins
  c.roundEntries = slots.map((exId) => {
    // prefill, in order: this round last time (keeps a ramp or reverse pyramid
    // intact), else the latest set this session, else any history, else the
    // bucket floor at 0 kg
    const atRound = lastLoggedAtRound(exId, c.round);
    const inSession = c.sets.slice().reverse().find((s) => s.ex === exId);
    const prev = atRound || inSession || lastLogged(exId);
    const e = ex(exId);
    // the progression bump belongs on the top-weight round only; offering it on
    // a ramp or back-off round would walk the whole shape up together
    const isTopRound = atRound ? !hasHeavierRound(exId, c.round) : !inSession;
    const sug = (prev && isTopRound) ? progressionSuggestion(exId) : null;
    // roundEntries index = slot index (A=0): the slice above keeps slot order
    const slot = slots.indexOf(exId);
    const ladder = ladderReps(slot, c.round, e);
    // reps: memory from THIS journey wins; a previous journey's rep count is
    // not a target under a new ladder, so the ladder takes over at a journey
    // boundary while the weight still carries across
    const sameJourney = !!(atRound && atRound.jid === c.journeyId);
    const amount = (atRound && sameJourney) ? atRound.amount
      : (ladder != null ? ladder : (prev ? prev.amount : bucketFloor(e.bucket)));
    return {
      ex: exId,
      amount,
      weight: sug ? sug.from + sug.add : (prev ? prev.weight : 0),
      fresh: !prev,
      shaped: !!atRound,
      crossJourney: !!(atRound && !sameJourney),
      skipped: false,
      info: false,
      sugg: sug,
      ladder,
      ladderLabel: ladderLabel(slot, e),
      // the speed set is the slot's FIRST round (a B-slot anchor first appears in round 2)
      speedSet: !!(e.speed && c.round === slot + 1 && !c.travel),
    };
  });
}

function entryAt(i) {
  return (S.current && Array.isArray(S.current.roundEntries)) ? S.current.roundEntries[i] : null;
}

function adjustEntry(i, field, delta) {
  const en = entryAt(i);
  if (!en) return;
  const hi = field === 'weight' ? 500 : 999;
  en[field] = clampNum(Math.round((en[field] + delta) * 100) / 100, 0, hi, 0);
  if (field === 'weight') commitLoadEdit(en);
  scheduleSave(); render();
}

function setEntry(i, field, value) {
  const en = entryAt(i);
  if (!en) { render(); return; }
  const hi = field === 'weight' ? 500 : 999;
  en[field] = clampNum(value, 0, hi, en[field]);
  if (field === 'weight') commitLoadEdit(en);
  scheduleSave(); render();
}

function toggleEntrySkip(i) {
  const en = entryAt(i);
  if (!en) return;
  en.skipped = !en.skipped;
  scheduleSave(); render();
}

function toggleSugg(i) {
  const en = entryAt(i);
  if (!en || !en.sugg) return;
  // applied-state is derived from the weight itself, so manual stepper edits
  // can never leave a stale chip label behind
  en.weight = suggApplied(en) ? en.sugg.from : en.sugg.from + en.sugg.add;
  scheduleSave(); render();
}

function toggleEntryInfo(i) {
  const en = entryAt(i);
  if (!en) return;
  en.info = !en.info;
  render();
}

function commitRound() {
  const c = S.current;
  if (!c || c.phase !== 'lift' || !Array.isArray(c.roundEntries)) return;
  // skipped exercises and zero-amount entries are not phantom-logged
  c.roundEntries.forEach((en) => {
    if (en.skipped || !(en.amount > 0)) return;
    const set = { round: c.round, ex: en.ex, amount: en.amount, weight: en.weight };
    if (en.count) set.count = en.count;
    c.sets.push(set);
  });
  c.roundEntries = null;
  c.phase = 'cardio';
  // timer stays armed until the user picks a modality and taps Start
  save(); render();
}

const TIMER_VIEWS = ['workout', 'sprint', 'circuit'];

function timerTick() {
  if (!timer || timer.paused) return;
  // lead-in: a beep per count, the work clock has not started yet
  const lead = leadCount(timer, Date.now());
  if (lead > 0) {
    if (lead !== timer.lastLead) { timer.lastLead = lead; countBeep(false); }
    if (TIMER_VIEWS.includes(view.name)) updateClock();
    return;
  }
  if (timer.lastLead) { timer.lastLead = 0; countBeep(true); }
  if (remainingSecs() <= 0 && !timer.finished) {
    timer.finished = true;
    clearInterval(timer.interval);
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    // settle the interval even when another screen is open, or it would be lost
    if (timer.sprint) { sprintRepDone(); return; }
    if (timer.station != null) { stationTimerDone(); return; }
    if (TIMER_VIEWS.includes(view.name)) render();
    return;
  }
  if (TIMER_VIEWS.includes(view.name)) updateClock();
}

/* guided sprint: tap -> 3-2-1 lead-in (settings.sprintLeadIn) -> countdown -> auto-log.
   The work interval is net: the lead-in is not part of the logged seconds. */
function startSprint(secs) {
  stopTimer();
  requestWake();
  primeAudio();
  timer = Object.assign(leadTimer(Date.now(), secs, S.settings.sprintLeadIn),
    { finished: false, paused: false, pausedLeft: 0, sprint: true, bare: true });
  armTick();
  render();
}

/* per-interval memory: what interval n (0 = warm-up 1 … 7 = sprint 6) ran at
   last time, falling back to the last session-wide setting, then defaults.
   The same round-memory doctrine as the lift days: a sprint day is a shape
   (two easy warm-ups, then slope climbing), not one number. */
function sprintMemory(n) {
  const rounds = Array.isArray(S.lastSprintRounds) ? S.lastSprintRounds : [];
  if (rounds[n]) return { slope: rounds[n].slope, speed: rounds[n].speed, remembered: true };
  const last = S.lastSprint || {};
  return { slope: last.slope != null ? last.slope : 0, speed: last.speed != null ? last.speed : 12, remembered: false };
}

/* work intervals climb: last slope for this interval + 0.5, capped at 15.
   Warm-up intervals keep plain memory. */
function sprintPrefill(n) {
  const mem = sprintMemory(n);
  if (n < 2 || !mem.remembered) return mem;
  return { slope: slopePrefill(mem.slope), speed: mem.speed, remembered: true, lastSlope: mem.slope };
}

function sprintRepDone() {
  const c = S.current;
  if (!c || c.phase !== 'sprint' || !Array.isArray(c.sprints) || !timer) return;
  c.sprints.push({
    kind: c.sprints.length < 2 ? 'warm' : 'work',
    secs: timer.total,
    slope: c.slope,
    speed: c.speed,
  });
  stopTimer();
  // prefill the next interval from the same interval last time; if there is
  // no memory the settings simply carry forward
  const next = sprintPrefill(c.sprints.length);
  if (next.remembered) { c.slope = next.slope; c.speed = next.speed; }
  save();
  render();
}

function cancelSprintRep() { stopTimer(); render(); }

function finishSprintSession(week, dayIndex) {
  const j = journey();
  const c = S.current;
  if (!j || !c || c.phase !== 'sprint') { go('home'); return; }
  const done = c.sprints || [];
  const work = done.filter((x) => x.kind === 'work').length;
  const activeSecs = done.reduce((a, x) => a + x.secs, 0);
  S.lastSprintMod = c.modality;
  S.lastSprint = { slope: c.slope, speed: c.speed };
  S.lastSprintRounds = done.slice(0, 8).map((x) => ({ slope: x.slope, speed: x.speed }));
  S.current = null;
  pushSession({
    journeyId: j.id, week, dayIndex, dayType: 'SPRINT', travel: c.travel || false,
    sprint: {
      modality: c.modality, intervals: work,
      minutes: Math.round(activeSecs / 60 * 10) / 10,
      sprints: done,
    },
  });
  stopTimer();
  releaseWake();
  go('home');
}

/* 12-minute test: offered on the sprint day of the last week in place of the
   intervals. The result is kept in S.tests as well as in the session. */
function startCooper() {
  const c = S.current;
  if (!c || c.phase !== 'sprint' || !c.cooper) return;
  c.cooperEnd = Date.now() + 720000;
  save();
  startTimer(720);
  render();
}

function finishCooper() {
  const c = S.current;
  if (!c || c.phase !== 'sprint') { go('home'); return; }
  const meters = Math.round(clampNum(c.meters, 0, 6000, 0));
  if (!(meters > 0)) { alert('Enter the distance in meters first.'); return; }
  S.tests.push({ ts: Date.now(), kind: 'cooper12', meters });
  S.current = null;
  pushSession({
    journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: 'SPRINT', travel: c.travel || false,
    sprint: { modality: c.modality, intervals: 0, minutes: 12, sprints: [], test: { kind: 'cooper12', meters } },
  });
  stopTimer();
  releaseWake();
  go('home');
}

function addTestResult() {
  const dateEl = document.getElementById('testDate');
  const mEl = document.getElementById('testMeters');
  const meters = Math.round(clampNum(mEl ? mEl.value : '', 0, 6000, 0));
  const date = dateEl && /^\d{4}-\d{2}-\d{2}$/.test(dateEl.value) ? dateEl.value : localDate();
  if (!(meters > 0)) { alert('Enter the distance in meters.'); return; }
  S.tests.push({ ts: new Date(date + 'T12:00:00').getTime(), kind: 'cooper12', meters });
  S.tests.sort((a, b) => a.ts - b.ts);
  view.addTest = false;
  save(); render();
}

function deleteTestResult(ts) {
  if (!confirm('Delete this test result?')) return;
  S.tests = S.tests.filter((t) => t.ts !== ts);
  save(); render();
}

function armTick() {
  if (!timer) return;
  if (timer.interval) clearInterval(timer.interval);
  timer.interval = setInterval(timerTick, 250);
}

function startTimer(totalSecs) {
  stopTimer();
  primeAudio();
  timer = { endTs: Date.now() + totalSecs * 1000, total: totalSecs, finished: false, paused: false, pausedLeft: 0 };
  armTick();
}

function stopTimer() { if (timer && timer.interval) clearInterval(timer.interval); timer = null; }

function remainingSecs() {
  if (!timer) return 0;
  if (timer.paused) return timer.pausedLeft;
  // capped at total so a lead-in delay (sprint start) displays the full time
  return Math.min(timer.total, Math.max(0, Math.ceil((timer.endTs - Date.now()) / 1000)));
}

function togglePause() {
  if (!timer || timer.finished) return;
  if (timer.paused) {
    timer.endTs = Date.now() + timer.pausedLeft * 1000;
    timer.paused = false;
    armTick();
  } else {
    timer.pausedLeft = remainingSecs();
    timer.paused = true;
    clearInterval(timer.interval);
  }
  render();
}

function extendTimer(secs) {
  if (!timer) return;
  if (timer.paused) {
    timer.pausedLeft = Math.max(0, timer.pausedLeft + secs);
    timer.total = Math.max(0, timer.total + secs);
  } else {
    timer.endTs = Math.max(Date.now(), timer.endTs + secs * 1000);
    timer.total = Math.max(0, timer.total + secs);
    if (remainingSecs() > 0) {
      timer.finished = false;
      armTick();
    }
  }
  render();
}

function pickModality(m) {
  if (!S.current) return;
  S.current.lastModality = m;
  S.lastModality = m;
  save(); render();
}

function cardioSecs(c) { return ((c && c.cardioMin) || S.settings.cardioMinutes) * 60; }

/* 2 / 3 minute toggle on the armed timer, for this session only */
function setCardioMin(n) {
  if (!S.current || ![2, 3].includes(n)) return;
  S.current.cardioMin = n;
  save(); render();
}

function finishCardio() {
  const c = S.current;
  if (!c || c.phase !== 'cardio') return;
  const total = timer ? timer.total : cardioSecs(c);
  // timer never started after a reload -> honest zero, not phantom cardio
  const doneSecs = timer ? (timer.finished ? total : Math.max(0, total - remainingSecs())) : 0;
  c.cardio.push({ round: c.round, modality: c.lastModality, seconds: doneSecs });
  stopTimer();
  if (c.round >= 5) { finishSession(); return; }
  c.round += 1;
  c.phase = 'lift';
  initRound();
  save(); render();
}

function pushSession(fields) {
  const rec = Object.assign({ id: 's' + Date.now() + '-' + S.sessions.length, ts: Date.now() }, fields);
  S.sessions.push(rec);
  save();
  return rec;
}

function finishSession() {
  const c = S.current;
  const fields = {
    journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: c.dayType,
    travel: c.travel || false,
    sets: c.sets, cardio: c.cardio,
  };
  if (c.gym === 'other') fields.gym = 'other';
  const rec = pushSession(fields);
  S.current = null;
  releaseWake();
  stopTimer();
  save();
  go('summary', { sessionId: rec.id, fresh: true });
}

function abandonSession() {
  if (!confirm('Discard this session? Nothing will be saved.')) return;
  S.current = null;
  releaseWake();
  stopTimer();
  save();
  go('home');
}


function saveRest(week, dayIndex) {
  const j = journey();
  if (!j) { go('home'); return; }
  pushSession({ journeyId: j.id, week, dayIndex, dayType: 'REST' });
  go('home');
}

function deleteSession(id) {
  if (!confirm('Delete this session from the journal?')) return;
  const gone = S.sessions.find((s) => s.id === id);
  S.sessions = S.sessions.filter((s) => s.id !== id);
  if (gone) {
    const test = gone.sprint && gone.sprint.test;
    if (test) S.tests = S.tests.filter((t) => !(t.meters === test.meters && Math.abs(t.ts - gone.ts) < 60000));
  }
  save();
  go('journal');
}

function moveRestDay(pos) {
  const j = journey();
  if (!j || isV39(j)) return;   // a v39 week has no rest day to move
  pos = clampNum(pos, 1, 7, 7) - 1;
  const plan = j.weekPlan.filter((t) => t !== 'REST');
  plan.splice(pos, 0, 'REST');
  j.weekPlan = plan;
  save(); render();
}

/* ---------- views ---------- */

function render() {
  try {
    document.documentElement.style.setProperty('--font-scale', S.settings.fontScale);
    const views = {
      home: vHome, workout: vWorkout, sprint: vSprint, rest: vRest,
      summary: vSummary, journal: vJournal, session: vSession, progress: vProgress,
      program: vProgram, settings: vSettings, snack: vSnack,
      zone2: vZone2, light: vLight, circuit: vCircuit,
      activation: () => vReading('Activation', ACTIVATION_IDEAS,
        'Ten minutes before the first exercise. Lower-body days: bike 5 min → cat-cow ×8 → glute bridge ×15 → band side-steps ×15 → ankle rockers ×10 per side → ramp sets. Upper days: swap in arm circles and band pull-aparts. Then check in: sleep, energy, focus.',
        ACTIVATION_STRETCHES),
      deactivation: () => vReading('Deactivation', DEACTIVATION_IDEAS,
        'Ten to fifteen minutes after the last cardio burst. Lower the heart rate, stretch what you trained, breathe, refuel. This marks the end of the session.'),
    };
    $app.innerHTML = (views[view.name] || vHome)() + navBar();
    // fire phase: cardio bursts + sprint day carry the Fire accent, strength stays Earth amber
    document.body.classList.toggle('fire-phase',
      (view.name === 'workout' && S.current && S.current.phase === 'cardio') || view.name === 'sprint');
  } catch (e) {
    console.error('render failed', e);
    document.body.classList.remove('fire-phase');
    $app.innerHTML = `<div class="card mt">
      <h3>Something went wrong</h3>
      <p class="muted small">${esc(e.message)}</p>
      <button class="btn-primary mt" onclick="view={name:'home'};render()">Back to Home</button>
      <p class="muted small mt">Your data is safe — if this keeps happening, export a backup in Settings.</p>
    </div>` + navBar();
  }
}

window.addEventListener('error', () => {
  // last-resort safety net: never leave a dead white screen
  if ($app && !$app.innerHTML) {
    view = { name: 'home' };
    try { render(); } catch (e2) { /* give up quietly */ }
  }
});

function navBar() {
  const items = [
    ['home', 'home', 'Home'], ['journal', 'journal', 'Journal'],
    ['progress', 'progress', 'Progress'], ['program', 'program', 'Program'], ['settings', 'settings', 'Settings'],
  ];
  return `<div class="nav">${items.map(([n, ico, label]) =>
    `<button class="${view.name === n ? 'active' : ''}" onclick="go('${n}')" aria-label="${label}">${svg(NAV_ICONS[ico], 24, 24)}<span>${label}</span></button>`
  ).join('')}</div>`;
}

function dayBadge(type) {
  const t = DAY_TYPES[type] || { label: type, kind: 'zone2' };
  return `<span class="badge ${t.kind}">${esc(t.label)}</span>`;
}

function dayLabel(type) { return esc((DAY_TYPES[type] || { label: type }).label); }

function bigThreeCardHTML() {
  const doneToday = !!S.bigThree[localDate()];
  const ids = ['bird_dog', 'side_plank', 'mcgill_curl_up'];
  const detail = view.b3open
    ? ids.map((id) => {
        const e = ex(id);
        return `<div class="lib-item"><span class="pattern-ico">${patternIcon(e.pattern, 30)}</span>
          <div class="grow"><b>${esc(e.name)}</b><p class="muted small">${esc(e.desc)}</p></div></div>`;
      }).join('')
    : '';
  return `<div class="card">
    <div class="row spread">
      <div onclick="view.b3open=!view.b3open;render()" style="cursor:pointer">
        <h3>Big Three ${doneToday ? '· done' : ''}</h3>
        <p class="muted small">Bird dog · side plank · McGill curl-up — ~5 min daily back insurance. ${bigThreeWeekCount()}/7 this week ${view.b3open ? '▾' : '▸'}</p>
      </div>
      <button class="z2check ${doneToday ? 'on' : ''}" onclick="toggleBigThree()" aria-label="mark Big Three done today">${doneToday ? '✓' : '·'}</button>
    </div>
    ${detail}
  </div>`;
}

function snackCardHTML(key) {
  const sn = SNACK_SESSIONS[key];
  if (!sn) return '';
  return `<div class="card snack-card" onclick="go('snack', { key: '${key}' })">
    <div class="row spread">
      <div class="grow">
        <h3>${esc(sn.name)}</h3>
        <p class="muted small">${esc(sn.blurb)}</p>
        <p class="muted small accent">${sn.items.length} moves · ~${sn.minutes} min · ${esc(sn.freq)}</p>
      </div>
      <span class="chev muted">›</span>
    </div>
  </div>`;
}

function vSnack() {
  const sn = SNACK_SESSIONS[view.key];
  if (!sn) { go('home'); return ''; }
  const rows = sn.items.map((it, i) => {
    const e = ex(it.ex);
    const isReps = e.measure !== 'secs';
    const open = !!(view.info || {})[it.ex];
    return `<div class="card">
      <div class="row spread">
        <div class="row exhead grow">
          <span class="pattern-ico">${patternIcon(e.pattern, 34)}</span>
          <div class="grow">
            <div class="exname">${i + 1} · ${esc(e.name)}</div>
            <div class="target">${esc(it.target)}</div>
          </div>
        </div>
        <button class="btn-small btn-ghost" onclick="toggleSnackInfo('${it.ex}')" aria-label="how to do this exercise">?</button>
      </div>
      ${open ? `<p class="muted small how-to">${esc(e.desc || e.cue || '')}</p>` : ''}
      <div class="row wrap mt" style="gap:0.6rem">
        ${snackStepperHTML(it.ex, 'snackRounds', e.snackRounds || 0, 'rounds', 1)}
        ${snackStepperHTML(it.ex, 'snackReps', e.snackReps || 0, isReps ? 'reps' : 'secs', 1)}
        ${snackStepperHTML(it.ex, 'snackKg', e.snackKg || 0, 'kg', S.settings.weightStep)}
      </div>
      <label class="field" for="band_${it.ex}">Band / note</label>
      <input type="text" id="band_${it.ex}" class="band-input" inputmode="text" maxlength="24"
        placeholder="e.g. red, light loop"
        value="${esc(e.snackBand || '')}"
        onchange="setSnackField('${it.ex}', 'snackBand', this.value)">
    </div>`;
  }).join('');
  return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button>
      <span class="title">${esc(sn.name)}</span><span class="muted small">${esc(sn.freq)}</span></div>
    <div class="card highlight"><p class="muted">${esc(sn.intro)}</p></div>
    ${rows}
    <p class="muted small center mb">Not logged to the journal — these numbers are your memory only.</p>`;
}

function nextUpDetailHTML(j, week, type, hotel) {
  if (type === 'REST') return '<p class="muted">Rest & recover — adaptation happens today.</p>';
  if (type === 'SPRINT') {
    return `<p class="muted">2 warm-ups (30 s) + up to 6 sprints (20 s). Work intervals prefill the last slope + 0.5.${week === j.weekCount ? ' Last week: the 12-minute test is on offer instead.' : ''}</p>`;
  }
  if (type === 'ZONE2') return '<p class="big">Zone 2 · 45 min</p><p class="muted small">Easy pace. You should be able to talk.</p>';
  if (type === 'CORE' && isV39(j)) {
    return `<p class="muted small">Circuit · 30 min · ${CORE_CIRCUIT.map((b) => esc(b.name) + ' × ' + b.rounds).join(' · ')}</p>`;
  }
  const slots = slotsFor(j, week, type);
  const tag = (i) => (isV39(j) ? 'P' + (i + 1) : 'ABCDE'[i]);
  return `<p class="muted small">${slots.map((id, i) => `${tag(i)} ${esc(ex(hotel ? travelSub(id) : id).name)}`).join(' · ')}</p>`;
}

function vHome() {
  const j = journey();
  if (!j) {
    return `<h1>5+2</h1><div class="card"><h3>No journey found</h3>
      <p class="muted">Start fresh below.</p>
      <button class="btn-primary mt" onclick="resetAll()">Set up new journey</button></div>`;
  }
  const done = doneDaySet(j);
  const next = nextSlot(j, done);
  let html = `<h1>5+2 <span class="muted small">· ${esc(j.name)}</span></h1>`;

  let bfNext = null;
  if (S.current) {
    const c = S.current;
    const where = c.phase === 'sprint' ? (c.cooper ? '12-minute test' : (c.sprints || []).length + '/8 sprints done')
      : c.phase === 'circuit' ? esc(circuitBlock(c).name) + ' · round ' + c.round
      : c.phase === 'zone2' ? 'Zone 2'
      : c.phase === 'light' ? 'Light day'
      : 'Round ' + c.round + '/5';
    html += `<div class="card highlight">
      <h3>Session in progress</h3>
      <p class="muted">Week ${c.week} · ${dayLabel(c.dayType)} · ${where}</p>
      <button class="btn-primary mt" onclick="go(sessionView())">Resume</button>
      <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard</button>
    </div>`;
  } else if (next) {
    const planned = dayType(j, next.dayIndex);
    bfNext = planned === 'REST' ? { offer: planned } : backfillFor(j, next.week, next.dayIndex);
    const type = bfNext.offer;
    // where: one segmented choice, remembered; one primary action below it
    const where = view.where || (S.settings.travelMode ? 'hotel' : 'home');
    const upcoming = j.startDate && j.startDate > localDate()
      ? `<p class="muted small">Starts ${esc(fmtDate(new Date(j.startDate + 'T12:00:00').getTime()))}.</p>` : '';
    html += `<div class="card highlight">
      <div class="row spread"><h3>Next up</h3>${dayBadge(type)}</div>
      <p class="big">Week ${next.week} · Day ${next.dayIndex + 1}</p>
      ${upcoming}
      ${type !== planned ? `<p class="muted small">${dayLabel(type)} was missed, so it takes this day. ${dayLabel(planned)} stays open until the week ends.</p>` : ''}
      ${nextUpDetailHTML(j, next.week, type, where === 'hotel')}
      ${type === 'REST'
        ? `<button class="btn-primary mt" onclick="startSession(${next.week}, ${next.dayIndex})">Start</button>`
        : `<div class="seg mt" role="group" aria-label="where you train">
            ${[['home', 'Home'], ['other', 'Other gym'], ['hotel', 'Hotel room']].map(([k, l]) =>
              `<button class="${where === k ? 'on' : ''}" onclick="view.where='${k}';render()" aria-pressed="${where === k}">${l}</button>`).join('')}
          </div>
          <button class="btn-primary mt" onclick="startSession(${next.week}, ${next.dayIndex}, '${where}')">Train</button>`}
      ${view.cant
        ? `<div class="row wrap mt" style="justify-content:center">
            <button class="btn-small miss-sick" onclick="markMissed(${next.week},${next.dayIndex},'sick')">Sick</button>
            <button class="btn-small miss-blocked" onclick="markMissed(${next.week},${next.dayIndex},'blocked')">No time</button>
            <button class="btn-small miss-light" onclick="startLight(${next.week},${next.dayIndex})">Light day</button>
            <button class="btn-small btn-ghost" onclick="view.cant=false;render()">Cancel</button>
          </div>
          <p class="muted small center mt" style="margin-top:0.5rem">Sick and No time mark the day and move on. Light day opens 20 easy minutes and marks the day too. A missed session is offered again on the next open day.</p>`
        : (type === 'REST' ? '' : `<button class="btn-link mt" onclick="view.cant=true;render()">Can’t train</button>`)}
    </div>`;
    // a v39 week has no rest day to hold the week review, so last week's
    // review sits here until the new week has its first session
    if (isV39(j) && next.week > 1 && !S.sessions.some((s) => s.journeyId === j.id && s.week === next.week && s.dayType !== 'LIGHT')) {
      html += reviewCardHTML(next.week - 1, true);
    }
    html += scoreboardCardHTML(j);
    html += bodyweightCardHTML();
    // on a v39 journey the scapula work lives in the Core circuit and after Legs 1
    if (!isV39(j)) html += snackCardHTML('scapula');
    html += snackCardHTML('volume');
  } else {
    html += `<div class="card highlight"><h3>Journey complete</h3>
      <p class="muted">All ${j.weekCount} weeks done. Start a new journey in Settings.</p></div>`;
    if (isV39(j)) html += reviewCardHTML(j.weekCount, true);
    html += scoreboardCardHTML(j);
  }

  // week grids — done days show what was ACTUALLY trained (a backfill can
  // land a missed session on another day)
  const typeByDay = {};
  S.sessions.forEach((s) => { if (s.journeyId === j.id) typeByDay[s.week + ':' + s.dayIndex] = s.dayType; });
  html += '<h2>Journey</h2>';
  for (let w = 1; w <= j.weekCount; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const isDone = done.has(w + ':' + d);
      const miss = missedKind(j, w, d);
      const isNext = next && next.week === w && next.dayIndex === d;
      const trained = isDone ? typeByDay[w + ':' + d] : null;
      const cellOffer = isNext && bfNext ? bfNext.offer : null;
      const label = !isDone && miss
        ? MISSED_LABEL[miss]
        : dayLabel(trained || cellOffer || dayType(j, d)).replace(' ', '');
      days.push(`<div class="day ${isDone ? 'done' : ''} ${trained === 'LIGHT' ? 'light' : ''} ${!isDone && miss ? miss : ''} ${isNext ? 'next' : ''}" onclick="startSession(${w},${d})">
        <span class="n">${d + 1}</span><span>${label}</span></div>`);
    }
    html += `<div class="wk-label">Week ${w}</div><div class="week-grid">${days.join('')}</div>`;
  }
  return html;
}

function stepperHTML(i, field, value, unit, stepDown, stepUp) {
  return `<div class="stepper">
    <button onclick="adjustEntry(${i}, '${field}', ${stepDown})" aria-label="decrease ${unit}">−</button>
    <input class="val" inputmode="decimal" value="${value}" onchange="setEntry(${i}, '${field}', this.value)" aria-label="${unit}">
    <button onclick="adjustEntry(${i}, '${field}', ${stepUp})" aria-label="increase ${unit}">+</button>
    <span class="unit">${unit}</span>
  </div>`;
}

/* weight control of one entry. Before v39: a plain kg (or band) stepper. v39:
   by implement — plates step through buildable totals, dumbbells and
   kettlebells pick from the rack, bands log a level, the rest is free entry. */
function loadControlHTML(i, en, e) {
  const c = S.current;
  if (c.travel || (en.v39 && e.implement === 'band')) return stepperHTML(i, 'weight', en.weight, 'band', -1, 1);
  if (!en.v39) return stepperHTML(i, 'weight', en.weight, 'kg', -S.settings.weightStep, S.settings.weightStep);
  const kit = kitFor(c);
  const options = loadOptions(e, kit, en.count);
  if (options && isBar(e)) {
    const plates = platesPerSide(en.weight, kit.bars[e.implement], kit.platePairs);
    return `<div class="load-col">
      <div class="stepper">
        <button onclick="stepEntryLoad(${i}, -1)" aria-label="lighter">−</button>
        <input class="val" inputmode="decimal" value="${en.weight}" onchange="typeEntryLoad(${i}, this.value)" aria-label="kg">
        <button onclick="stepEntryLoad(${i}, 1)" aria-label="heavier">+</button>
        <span class="unit">kg</span>
      </div>
      <div class="load-note">${plates == null ? 'not buildable with these plates' : plates.length ? 'per side ' + plates.join(' + ') : 'empty bar'}</div>
    </div>`;
  }
  if (isBell(e)) {
    // the stepper walks the rack; dumbbells add a one or two toggle
    const count = en.count || 2;
    return `<div class="load-col">
      <div class="stepper">
        <button onclick="stepEntryLoad(${i}, -1)" aria-label="lighter">−</button>
        <span class="val">${en.weight}</span>
        <button onclick="stepEntryLoad(${i}, 1)" aria-label="heavier">+</button>
        <span class="unit">kg</span>
      </div>
      ${e.implement === 'dumbbell' ? `<div class="seg" role="group" aria-label="number of dumbbells">
        ${[1, 2].map((n) => `<button class="${count === n ? 'on' : ''}" onclick="setBellCount(${i}, ${n})" aria-pressed="${count === n}">${n} × ${en.weight} kg</button>`).join('')}
      </div>` : ''}
    </div>`;
  }
  const step = kit.free ? kit.step : S.settings.weightStep;
  return stepperHTML(i, 'weight', en.weight, 'kg', -step, step);
}

function liftBlockHTML(c, en, i) {
  const e = ex(en.ex);
  const isReps = e.measure === 'reps';
  let target;
  if (en.skipped) {
    target = 'skipped — will not be logged';
  } else if (en.v39) {
    const reps = en.reps[0] === en.reps[1] ? String(en.reps[0]) : en.reps[0] + '–' + en.reps[1];
    target = reps + (isReps ? ' reps' : ' s') + (en.pct < 1 ? ' at ' + Math.round(en.pct * 100) + '%' : '');
  } else {
    target = en.ladder != null ? 'ladder ' + esc(en.ladderLabel) + ' · this round <b>' + en.ladder + '</b>' + (e.barbell ? ' · weight up each round' : '')
      : (e.bucket ? 'target ' + esc(e.bucket) + ' reps' : 'time-based');
  }
  const power = en.v39 && e.power && !c.travel;
  let chip = '';
  if (en.v39) {
    if (en.plateau && !en.skipped) chip = '<p class="plateau">Plateau · two weeks at this weight. One step up clears it.</p>';
  } else if (en.sugg && !en.skipped && !c.travel) {
    // journeys before v39 keep their ladder-based +kg chip
    chip = `<button class="sugg-chip ${suggApplied(en) ? 'on' : ''}" onclick="toggleSugg(${i})">${suggApplied(en)
      ? '↑ +' + en.sugg.add + ' kg — ladder ' + esc(en.sugg.bucket) + ' met ' + (en.sugg.once ? 'last session' : 'twice') + ' · tap to undo'
      : '↑ +' + en.sugg.add + ' kg suggested · tap to apply'}</button>`;
  }
  return `<div class="card exercise-block ${en.skipped ? 'done-block' : ''}">
    <div class="row spread">
      <div class="row exhead">
        <span class="pattern-ico">${patternIcon(e.pattern, 34)}</span>
        <div>
          <div class="exname">${en.v39 ? 'P' + (i + 1) : 'ABCDE'[i]} · ${esc(e.name)}${en.v39 && en.role && !en.skipped ? ` <span class="role-chip">${esc(en.role)}</span>` : ''}${power ? ' <span class="power-chip">POWER</span>' : ''}</div>
          <div class="target">${target}</div>
        </div>
      </div>
      <div class="row" style="gap:0.4rem">
        <button class="btn-small btn-ghost" onclick="toggleEntryInfo(${i})" aria-label="how to do this exercise">?</button>
        <button class="btn-small ${en.skipped ? '' : 'btn-ghost'}" onclick="toggleEntrySkip(${i})" aria-label="skip this exercise">${en.skipped ? 'Undo' : 'Skip'}</button>
      </div>
    </div>
    ${power && !en.skipped ? `<p class="power-cue">${esc(e.cue)}. The set ends at the first slow rep.</p>` : ''}
    ${chip}
    ${en.speedSet && !en.skipped ? `<p class="muted small fresh-hint">Speed set: ~50% of your top set, 6 reps, as fast as the bar moves. Power first, then the ladder.</p>` : ''}
    ${en.info ? `<p class="muted small how-to">${esc(e.desc || e.cue || 'No description yet.')}</p>` : ''}
    ${!en.v39 && en.fresh && en.weight === 0 && isReps && !c.travel ? `<p class="muted small fresh-hint">First time: think of your max weight, then go ~25% lighter.</p>` : ''}
    ${!en.v39 && en.shaped && !en.skipped && !en.fresh ? `<p class="muted small">${en.crossJourney ? 'Weight from the last journey · reps reset to the ladder.' : 'Round ' + c.round + ' last time.'}</p>` : ''}
    <div class="set-row">
      ${stepperHTML(i, 'amount', en.amount, isReps ? 'reps' : 'secs', isReps ? -1 : -5, isReps ? 1 : 5)}
      ${loadControlHTML(i, en, e)}
    </div>
  </div>`;
}

function vWorkout() {
  const c = S.current;
  if (!c) return vHome();
  if (c.phase !== 'lift' && c.phase !== 'cardio') {
    // the live session belongs to another screen (sprint, Zone 2, circuit, light)
    view.name = sessionView();
    return ({ sprint: vSprint, zone2: vZone2, light: vLight, circuit: vCircuit }[view.name] || vHome)();
  }
  const title = `W${c.week} · ${dayLabel(c.dayType)}`;
  const v39 = isV39(journeyOf(c));
  const mode = c.travel ? ' · hotel room' : c.gym === 'other' ? ' · other gym' : '';

  const dots = [1, 2, 3, 4, 5].map((r) =>
    `<div class="dot ${r < c.round ? 'done' : ''} ${r === c.round ? 'now' : ''}"></div>`).join('');

  if (c.phase === 'lift') {
    if (!Array.isArray(c.roundEntries)) { initRound(); save(); }
    const opening = c.round === 1 && c.sets.length === 0;
    const activationBanner = opening
      ? `<div class="banner">Activated? ~10 min easy cardio + dynamic moves before Round 1.
          <button class="btn-small btn-ghost" onclick="go('activation')">Ideas →</button></div>`
      : '';
    const kneePrep = opening && v39 && (DAY_TYPES[c.dayType] || {}).kind === 'legs' && !c.kneePrep
      ? `<div class="banner">Knee prep: 2 × 45 s Spanish squat hold.
          <button class="btn-small btn-ghost" onclick="S.current.kneePrep=true;save();render()">Done</button></div>`
      : '';
    // anchor first: from round 2 the P2 lift is shown above P1. Display order
    // only — the roundEntries index stays the slot index.
    const order = c.roundEntries.map((en, i) => i);
    if (v39 && order.length >= 2) { order[0] = 1; order[1] = 0; }
    const blocks = order.map((i) => liftBlockHTML(c, c.roundEntries[i], i)).join('');

    return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button><span class="title">${title}</span>
        <span class="muted">Round ${c.round}/5</span></div>
      <div class="progress-dots">${dots}</div>
      ${mode ? `<p class="muted small center mb">${mode.slice(3)}</p>` : ''}
      ${activationBanner}
      ${kneePrep}
      ${blocks}
      <button class="btn-primary" onclick="commitRound()">Log round → Cardio</button>
      <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard session</button>`;
  }

  // cardio phase
  const noTimer = !timer;
  const finished = timer && timer.finished;
  const paused = timer && timer.paused;
  const cm = c.cardioMin || S.settings.cardioMinutes;
  return `<div class="topbar"><span class="title">${title}</span><span class="muted">Cardio ${c.round}/5</span></div>
    <div class="progress-dots">${dots}</div>
    ${v39 && c.round <= 2 ? '<p class="center easy-line">Easy pace. The top set is next.</p>' : ''}
    <div class="timer-wrap">
      ${noTimer
        ? `<div class="timer-clock tappable" role="button" aria-label="start timer" onclick="startTimer(cardioSecs(S.current)); render()">${cm}:00</div>
           <div class="row" style="justify-content:center; margin-bottom:0.8rem">
             ${[2, 3].map((n) => `<button class="chip ${cm === n ? 'on' : ''}" onclick="setCardioMin(${n})">${n} min</button>`).join('')}
           </div>
           <button class="btn-primary" onclick="startTimer(cardioSecs(S.current)); render()">Start timer · ${esc(c.lastModality)}</button>`
        : `<div class="timer-clock ${finished ? 'done' : ''} ${paused ? 'paused' : ''}" id="clock">${clockText()}</div>
           <div class="row" style="justify-content:center">
             ${finished ? '' : `<button onclick="togglePause()">${paused ? 'Resume' : 'Pause'}</button>`}
             <button onclick="extendTimer(60)">+1 min</button>
             <button onclick="extendTimer(-30)">−30 s</button>
           </div>`}
    </div>
    <div class="modality-grid">${cardioList().map((m) =>
      `<button class="${c.lastModality === m ? 'sel' : ''}" onclick="pickModality('${m}')">${m}</button>`).join('')}</div>
    <button class="${noTimer ? 'btn-big' : 'btn-primary'}" onclick="finishCardio()">${c.round >= 5 ? 'Finish workout' : 'Next round →'}</button>`;
}

/* what the countdown shows: the 3-2-1 lead-in, DONE, or the time left.
   Sprints and circuit holds show bare seconds, cardio shows m:ss. */
function clockText() {
  if (!timer) return '';
  const lead = leadCount(timer, Date.now());
  if (lead > 0) return String(lead);
  if (timer.finished) return 'DONE';
  const secs = remainingSecs();
  return timer.bare ? String(secs) : fmtClock(secs);
}

function fmtClock(secs) { return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'); }

function updateClock() {
  const el = document.getElementById('clock');
  if (!el || !timer) return;
  el.classList.toggle('lead', leadCount(timer, Date.now()) > 0);
  if (timer.finished) el.classList.add('done');
  const txt = clockText();
  // the 250ms tick outpaces the 1s display — skip identical writes
  if (el.textContent !== txt) el.textContent = txt;
}

/* count-up clocks (Zone 2, light day, circuit session clock) */
function elapsedSecs(c) { return c && c.clockStart ? Math.max(0, Math.floor((Date.now() - c.clockStart) / 1000)) : 0; }

setInterval(() => {
  const el = document.getElementById('upclock');
  if (!el || !S.current || !S.current.clockStart) return;
  const txt = fmtClock(elapsedSecs(S.current));
  if (el.textContent !== txt) el.textContent = txt;
}, 1000);

function vSprint() {
  let c = S.current;
  if (!c || c.phase !== 'sprint') {
    // reached without startSession (stale link) — set up a fresh persistent session
    stopTimer();
    const j = journey();
    if (!j) return `<div class="card"><h3>No journey found</h3></div>`;
    c = S.current = newSprintSession({
      journeyId: j.id,
      week: clampNum(view.week, 1, j.weekCount, 1),
      dayIndex: clampNum(view.dayIndex, 0, 6, 0),
      travel: S.settings.travelMode, gym: null,
      startedTs: Date.now(),
    });
    save();
  }
  const w = c.week, d = c.dayIndex;
  const mods = c.travel ? TRAVEL_SPRINT_MODALITIES : SPRINT_MODALITIES;
  const sj = journeyOf(c);
  if (!c.modality || !mods.includes(c.modality)) c.modality = mods.includes(S.lastSprintMod) ? S.lastSprintMod : mods[0];
  const n = c.sprints.length;
  const isWarm = n < 2;
  const secs = isWarm ? 30 : 20;
  const canFinish = n >= 6;   // 2 warm-ups + 4 sprints
  const maxed = n >= 8;       // 2 warm-ups + 6 sprints
  const running = !!timer && timer.sprint;
  const label = isWarm ? 'Warm-up ' + (n + 1) + ' of 2 · 30 s' : 'Sprint ' + (n - 1) + ' of 6 · 20 s';
  const doneRows = c.sprints.map((sp, i) =>
    `<div class="set-row"><span>${i < 2 ? 'Warm-up ' + (i + 1) : 'Sprint ' + (i - 1)} · ${sp.secs} s</span>
      <span class="muted small">${sp.speed} km/h · ${sp.slope} %</span></div>`).join('');
  const lead = S.settings.sprintLeadIn;
  let main;
  if (c.cooper) {
    if (!timer && c.cooperEnd) {
      // the test clock survives a reload: rebuild it from its stored end time
      timer = { endTs: c.cooperEnd, total: 720, finished: Date.now() >= c.cooperEnd, paused: false, pausedLeft: 0 };
      if (!timer.finished) armTick();
    }
    const t = timer && !timer.sprint ? timer : null;
    main = `<div class="card highlight">
      <h3>12-minute test</h3>
      <p class="muted small">Cover as much distance as you can in 12 minutes. An even pace beats a fast start.</p>
      <div class="timer-wrap">
        ${t ? `<div class="timer-clock ${t.finished ? 'done' : ''}" id="clock">${clockText()}</div>`
          : `<div class="timer-clock tappable" role="button" aria-label="start timer" onclick="startCooper()">12:00</div>
             <button class="btn-primary" onclick="startCooper()">Start · 12 min</button>`}
      </div>
      <label class="field" for="cooperM">Distance in meters</label>
      <input type="text" inputmode="numeric" id="cooperM" placeholder="e.g. 2400" value="${c.meters || ''}"
        oninput="S.current.meters=clampNum(this.value,0,6000,0);scheduleSave()">
      <button class="btn-primary mt" onclick="finishCooper()">Save test</button>
      <button class="btn-ghost btn-big mt" onclick="S.current.cooper=false;S.current.cooperEnd=null;stopTimer();save();render()">Back to intervals</button>
    </div>`;
  } else if (running) {
    main = `<div class="card highlight">
      <h3 class="center">${label}</h3>
      <div class="timer-wrap">
        <div class="timer-clock ${leadCount(timer, Date.now()) > 0 ? 'lead' : ''}" id="clock">${clockText()}</div>
        <p class="muted small">${lead > 0 ? 'Go after the count. The interval is ' + secs + ' seconds net.' : 'Go when the clock moves.'}</p>
      </div>
      <button class="btn-ghost btn-big" onclick="cancelSprintRep()">Cancel this sprint</button>
    </div>`;
  } else if (maxed) {
    main = `<div class="card highlight"><h3>All 8 done</h3>
      <p class="muted small">Two warm-ups and six sprints — full session. Save it below.</p></div>`;
  } else {
    const mem = sprintMemory(n);
    main = `<div class="card highlight">
      <h3>${label}</h3>
      <p class="muted small">Set the treadmill first. ${lead > 0 ? 'The clock counts ' + lead + ' down, then runs ' + secs + ' s.' : 'The clock starts on the tap.'}${mem.remembered ? ' This interval last time: ' + mem.speed + ' km/h · ' + mem.slope + ' %' + (!isWarm ? ', slope prefilled + 0.5.' : '.') : ''}</p>
      <div class="row mt" style="justify-content:center; gap:1rem; flex-wrap:wrap">
        <div class="stepper">
          <button onclick="S.current.speed=Math.max(0,Math.round((S.current.speed-0.5)*2)/2);scheduleSave();render()" aria-label="slower">−</button>
          <input class="val" inputmode="decimal" value="${c.speed}" onchange="S.current.speed=clampNum(this.value,0,30,12);scheduleSave();render()" aria-label="speed in km per h">
          <button onclick="S.current.speed=Math.min(30,Math.round((S.current.speed+0.5)*2)/2);scheduleSave();render()" aria-label="faster">+</button>
          <span class="unit">km/h</span>
        </div>
        <div class="stepper">
          <button onclick="S.current.slope=Math.max(0,Math.round((S.current.slope-0.5)*2)/2);scheduleSave();render()" aria-label="less slope">−</button>
          <input class="val" inputmode="decimal" value="${c.slope}" onchange="S.current.slope=clampNum(this.value,0,15,0);scheduleSave();render()" aria-label="slope percent">
          <button onclick="S.current.slope=Math.min(15,Math.round((S.current.slope+0.5)*2)/2);scheduleSave();render()" aria-label="more slope">+</button>
          <span class="unit">%</span>
        </div>
      </div>
      <button class="btn-primary mt" onclick="startSprint(${secs})">Start · ${secs} s</button>
    </div>`;
  }
  return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button><span class="title">Sprint · Week ${w}</span></div>
    <div class="banner">Warm up properly first — never sprint cold.
      <button class="btn-small btn-ghost" onclick="go('activation')">Ideas →</button></div>
    ${n === 0 && !running && !c.cooper && !c.warmCard ? `<div class="card">
      <h3>Warm-up</h3>
      <p class="muted small">Leg swings, high-knee skips, then two build-up runs.</p>
      <button class="btn-small btn-ghost mt" onclick="S.current.warmCard=true;save();render()">Done</button>
    </div>` : ''}
    ${n === 0 && !running && !c.cooper && sj && c.week === sj.weekCount ? `<div class="card">
      <h3>12-minute test</h3>
      <p class="muted small">Last week of the journey: run the test in place of the intervals.</p>
      <button class="btn-big mt" onclick="stopTimer();S.current.cooper=true;save();render()">12-minute test</button>
    </div>` : ''}
    ${n === 0 && !running ? `<div class="card">
      <h3>Modality</h3>
      <div class="modality-grid">${mods.map((m) =>
        `<button class="${c.modality === m ? 'sel' : ''}" onclick="S.current.modality='${m}';scheduleSave();render()">${m}</button>`).join('')}</div>
    </div>` : ''}
    ${main}
    ${n > 0 ? `<div class="card"><h3>Done</h3>${doneRows}</div>` : ''}
    ${canFinish && !running && !c.cooper ? `<button class="${maxed ? 'btn-primary' : 'btn-big'} mb" onclick="finishSprintSession(${w},${d})">Finish session · ${n - 2} sprints</button>` : ''}
    ${n > 0 && !canFinish && !running ? `<p class="muted small center mb">Finish unlocks after 4 sprints (2 warm-ups + 4).</p>` : ''}
    ${(n > 0 || c.cooper) && !running ? `<button class="btn-ghost btn-big mb" onclick="abandonSession()">Discard session</button>` : ''}`;
}

/* ---------- Zone 2 + light day ---------- */

function startUpClock() {
  if (!S.current) return;
  S.current.clockStart = Date.now();
  save(); render();
}

/* minutes to log: what was typed, else the clock (capped at three times the
   target, for a clock that was left running) */
function easyMinutes(c) { return c.minutes != null ? c.minutes : Math.min(3 * (c.target || 45), Math.round(elapsedSecs(c) / 60)); }

/* clock + modality + minutes, shared by the Zone 2 day and the light day */
function easyClockHTML(c, mods) {
  const secs = elapsedSecs(c);
  return `<div class="card highlight">
      <div class="timer-wrap">
        <div class="timer-clock ${secs >= c.target * 60 ? 'done' : ''}" id="upclock">${fmtClock(secs)}</div>
        <p class="muted">Target ${c.target} min.${mods ? ' You should be able to talk.' : ''}</p>
        ${c.clockStart ? '' : `<button class="btn-primary mt" onclick="startUpClock()">Start the clock</button>`}
      </div>
    </div>
    ${mods ? `<div class="card">
      <h3>Modality</h3>
      <div class="modality-grid">${mods.map((m) =>
        `<button class="${c.modality === m ? 'sel' : ''}" onclick="S.current.modality='${m}';save();render()">${m}</button>`).join('')}</div>
    </div>` : ''}
    <div class="card">
      <div class="row wrap" style="gap:1rem">
        <div class="stepper">
          <input class="val" inputmode="numeric" value="${c.minutes != null ? c.minutes : ''}" placeholder="${Math.round(secs / 60)}"
            onchange="S.current.minutes=this.value===''?null:clampNum(this.value,0,600,0);save();render()" aria-label="minutes">
          <span class="unit">min</span>
        </div>
        ${mods ? `<div class="stepper">
          <input class="val" inputmode="numeric" value="${c.hr || ''}" placeholder="—"
            onchange="S.current.hr=clampNum(this.value,0,230,0)||null;save();render()" aria-label="average heart rate">
          <span class="unit">bpm</span>
        </div>` : ''}
      </div>
      <p class="muted small mt">Minutes follow the clock unless you type them.${mods ? ' Average heart rate is optional.' : ''}</p>
    </div>`;
}

function vZone2() {
  const c = S.current;
  if (!c || c.phase !== 'zone2') return vHome();
  const mods = c.travel ? TRAVEL_ZONE2 : ZONE2_MODALITIES;
  if (!mods.includes(c.modality)) c.modality = mods.includes(S.lastZone2Mod) ? S.lastZone2Mod : mods[0];
  return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button>
      <span class="title">Zone 2 · Week ${c.week}</span><span class="muted">${c.travel ? 'hotel room' : c.target + ' min'}</span></div>
    ${easyClockHTML(c, mods)}
    <button class="btn-primary" onclick="finishZone2()">Finish</button>
    <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard session</button>`;
}

function finishZone2() {
  const c = S.current;
  if (!c || c.phase !== 'zone2') { go('home'); return; }
  const minutes = easyMinutes(c);
  if (!(minutes > 0) && !confirm('No minutes on the clock. Log the session anyway?')) return;
  S.lastZone2Mod = c.modality;
  S.current = null;
  const rec = pushSession({
    journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: 'ZONE2', travel: c.travel || false,
    zone2: { modality: c.modality, minutes, hr: c.hr || null },
  });
  releaseWake();
  go('summary', { sessionId: rec.id });
}

/* Light day: the fallback when a full session is not on. Twenty easy minutes,
   logged as its own session; the scheduled day is marked missed (kind light)
   so the backfill offers it again. */
function startLight(week, dayIndex) {
  const j = journey();
  if (!j) return;
  if (S.current && !confirm('A session is already in progress. Discard it and start a light day?')) return;
  stopTimer();
  S.current = {
    journeyId: j.id, week, dayIndex, dayType: 'LIGHT', phase: 'light',
    option: null, target: 20, clockStart: null, modality: null, minutes: null, hr: null,
    travel: S.settings.travelMode, startedTs: Date.now(),
  };
  view.cant = false;
  save();
  requestWake();
  go('light');
}

function pickLightOption(option) {
  const c = S.current;
  if (!c || c.phase !== 'light') return;
  c.option = option === 'stretch' ? 'stretch' : 'zone2';
  save(); render();
}

function vLight() {
  const c = S.current;
  if (!c || c.phase !== 'light') return vHome();
  const top = `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button>
    <span class="title">Light day · Week ${c.week}</span><span class="muted">20 min</span></div>`;
  if (!c.option) {
    return `${top}
      <div class="card highlight"><p class="muted">Twenty easy minutes. The scheduled session stays open and is offered again on the next day.</p></div>
      <div class="card choice" onclick="pickLightOption('zone2')">
        <div class="big">Zone 2</div>
        <p class="muted small">Easy pace with a timer. You should be able to talk.</p>
      </div>
      <div class="card choice" onclick="pickLightOption('stretch')">
        <div class="big">Stretching</div>
        <p class="muted small">The dynamic stretches and the wind-down list.</p>
      </div>
      <button class="btn-ghost btn-big mt" onclick="abandonSession()">Cancel</button>`;
  }
  const mods = c.travel ? TRAVEL_ZONE2 : ZONE2_MODALITIES;
  if (c.option === 'zone2' && !mods.includes(c.modality)) c.modality = mods.includes(S.lastZone2Mod) ? S.lastZone2Mod : mods[0];
  return `${top}
    ${easyClockHTML(c, c.option === 'zone2' ? mods : null)}
    <button class="btn-primary" onclick="finishLight()">Finish</button>
    <button class="btn-ghost btn-big mt mb" onclick="abandonSession()">Discard session</button>
    ${c.option === 'stretch' ? '<h2>Stretches</h2>' + vReadingInline(ACTIVATION_STRETCHES) + '<h2>Wind down</h2>' + vReadingInline(DEACTIVATION_IDEAS) : ''}`;
}

function finishLight() {
  const c = S.current;
  if (!c || c.phase !== 'light') { go('home'); return; }
  const minutes = easyMinutes(c);
  if (!(minutes > 0) && !confirm('No minutes on the clock. Log the light day anyway?')) return;
  if (c.option === 'zone2') S.lastZone2Mod = c.modality;
  S.missed[c.journeyId + ':' + c.week + ':' + c.dayIndex] = 'light';
  S.current = null;
  const rec = pushSession({
    journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: 'LIGHT', travel: c.travel || false,
    light: { option: c.option, modality: c.option === 'zone2' ? c.modality : null, minutes },
  });
  releaseWake();
  go('summary', { sessionId: rec.id });
}

/* ---------- core circuit ---------- */

/* blocks = indexes into CORE_CIRCUIT. attach = id of a logged session the
   result is saved into (the shoulder-blade block after Legs 1). */
function beginCircuit(base, blocks, attach) {
  S.current = Object.assign(base, {
    phase: 'circuit', blocks, bi: 0, round: 1,
    done: {}, pick: {}, log: [],
    attach: attach || null,
    clockStart: Date.now(),
  });
  view.cInfo = null; view.cEdit = null;
  save();
  requestWake();
  go('circuit');
}

function startBlock(sessionId, block) {
  const s = S.sessions.find((x) => x.id === sessionId);
  if (!s || !CORE_CIRCUIT[block] || S.current || s.circuit) return;
  beginCircuit({
    journeyId: s.journeyId, week: s.week, dayIndex: s.dayIndex, dayType: s.dayType,
    travel: s.travel || false, gym: s.gym || null, startedTs: Date.now(),
  }, [block], s.id);
}

function circuitBlock(c) { return CORE_CIRCUIT[c.blocks[c.bi]] || CORE_CIRCUIT[0]; }

/* Dose of a station: its prescription, overridden by what this exercise ran at
   last time (S.circuitDose), so every option keeps its own last dose. A
   dumbbell station reads its kg from the lift's work weight when it has one. */
function circuitDoseFor(c, st, chosen, exId) {
  const e = ex(exId);
  const swapped = exId !== chosen;           // hotel-room substitute
  const def = st.ex ? st : (CIRCUIT_DOSES[chosen] || {});
  const mem = S.circuitDose[exId] || {};
  const d = { unit: 'reps', amount: 0, text: '', guide: '', sides: !!st.sides || (swapped && !!st.dose), loadKind: null, load: 0 };
  if (st.dose && !swapped) { d.unit = 'text'; d.text = st.dose; }
  else if (e.measure === 'secs') { d.unit = 'secs'; d.amount = mem.amount || def.secs || 30; }
  else { d.amount = mem.amount || def.reps || bucketFloor(e.bucket); d.guide = swapped ? '' : (def.note || ''); }
  if (!c.travel && isBell(e)) {
    d.loadKind = 'kg';
    d.load = S.work[exId] ? S.work[exId].weight : (mem.load || 0);
  } else if (e.implement === 'band') {
    d.loadKind = 'band';
    d.load = mem.load || 0;
  }
  return d;
}

/* the stations of the current round: fixed or chosen exercise, hotel-room
   substitute, dose */
function circuitStations(c) {
  const b = c.blocks[c.bi];
  return circuitBlock(c).stations
    .map((st, si) => ({ st, si }))
    .filter((x) => !x.st.rounds || x.st.rounds.includes(c.round))
    .map(({ st, si }) => {
      const chosen = st.ex || (c.pick || {})[b + ':' + si] || st.default;
      const exId = c.travel ? travelSub(chosen) : chosen;
      return { st, si, chosen, exId, e: ex(exId), dose: circuitDoseFor(c, st, chosen, exId) };
    });
}

function circuitStation(si) {
  const c = S.current;
  return (c && c.phase === 'circuit') ? circuitStations(c).find((x) => x.si === si) : null;
}

function circuitLogIndex(c, si) {
  const b = c.blocks[c.bi];
  return c.log.findIndex((l) => l.block === b && l.round === c.round && l.station === si);
}

/* one tap marks a station done and logs what it ran at; a second tap undoes it */
function circuitToggle(si) {
  const c = S.current;
  const s = circuitStation(si);
  if (!s) return;
  const at = circuitLogIndex(c, si);
  if (at >= 0) {
    c.log.splice(at, 1);
    delete c.done[si];
  } else {
    const row = { block: c.blocks[c.bi], round: c.round, station: si, ex: s.exId };
    if (s.dose.unit === 'text') row.dose = s.dose.text; else row[s.dose.unit] = s.dose.amount;
    if (s.dose.loadKind === 'kg' && s.dose.load > 0) row.kg = s.dose.load;
    if (s.dose.loadKind === 'band' && s.dose.load > 0) row.band = s.dose.load;
    c.log.push(row);
    c.done[si] = true;
  }
  save(); render();
}

function circuitPick(si, exId) {
  const c = S.current;
  const s = circuitStation(si);
  if (!s || !s.st.options || !s.st.options.includes(exId)) return;
  if (c.done[si]) circuitToggle(si);          // the logged row was for the other option
  c.pick[c.blocks[c.bi] + ':' + si] = exId;
  save(); render();
}

function circuitAdjust(si, field, dir) {
  const c = S.current;
  const s = circuitStation(si);
  if (!s) return;
  const mem = S.circuitDose[s.exId] = S.circuitDose[s.exId] || {};
  if (field === 'amount') {
    if (s.dose.unit === 'text') return;
    mem.amount = clampNum(s.dose.amount + dir * (s.dose.unit === 'secs' ? 5 : 1), 1, 999, s.dose.amount);
  } else if (s.dose.loadKind === 'band') {
    mem.load = clampNum(s.dose.load + dir, 0, 20, 0);
  } else if (s.dose.loadKind === 'kg') {
    // one dumbbell in the hand: step through the rack
    const next = stepLoad(s.e, kitFor(c), { weight: s.dose.load, count: 1 }, dir);
    if (!next) return;
    if (S.work[s.exId]) S.work[s.exId] = { weight: next.weight, count: S.work[s.exId].count || 1 }; else mem.load = next.weight;
  }
  if (c.done[si]) { circuitToggle(si); circuitToggle(si); return; }   // re-log at the new dose
  save(); render();
}

function stationTimer(si, secs, side, lead) {
  return Object.assign(leadTimer(Date.now(), secs, lead),
    { finished: false, paused: false, pausedLeft: 0, station: si, side, bare: true });
}

/* timed station: 3-2-1, the hold, and on a per-side station the same again */
function startStation(si) {
  const s = circuitStation(si);
  if (!s || s.dose.unit !== 'secs') return;
  stopTimer();
  primeAudio();
  timer = stationTimer(si, s.dose.amount, s.dose.sides ? 1 : 0, S.settings.sprintLeadIn);
  armTick();
  render();
}

function stationTimerDone() {
  const c = S.current;
  const t = timer;
  if (!c || c.phase !== 'circuit' || !t) return;
  if (t.side === 1) {
    // switch sides: always a count, there is a body to turn over
    timer = stationTimer(t.station, t.total, 2, Math.max(3, S.settings.sprintLeadIn));
    armTick();
    render();
    return;
  }
  stopTimer();
  if (!c.done[t.station]) circuitToggle(t.station); else render();
}

function circuitNext() {
  const c = S.current;
  if (!c || c.phase !== 'circuit') return;
  stopTimer();
  view.cInfo = null; view.cEdit = null;
  const blk = circuitBlock(c);
  if (c.round < blk.rounds) { c.round += 1; c.done = {}; }
  else if (c.bi < c.blocks.length - 1) { c.bi += 1; c.round = 1; c.done = {}; }
  else { finishCircuit(); return; }
  save(); render();
  window.scrollTo(0, 0);
}

function finishCircuit() {
  const c = S.current;
  // capped: a clock left running overnight is not a four-hour circuit
  const circuit = { minutes: Math.min(120, Math.max(1, Math.round(elapsedSecs(c) / 60))), log: c.log };
  S.current = null;
  stopTimer();
  releaseWake();
  if (c.attach) {
    const s = S.sessions.find((x) => x.id === c.attach);
    if (s) s.circuit = Object.assign(circuit, { name: circuitBlock(c).name });
    save();
    go(s ? 'summary' : 'home', { sessionId: c.attach });
    return;
  }
  const rec = pushSession({
    journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: 'CORE', travel: c.travel || false,
    circuit,
  });
  go('summary', { sessionId: rec.id });
}

function circuitStepperHTML(si, field, value, unit) {
  return `<div class="stepper">
    <button onclick="circuitAdjust(${si}, '${field}', -1)" aria-label="less ${unit}">−</button>
    <span class="val">${value}</span>
    <button onclick="circuitAdjust(${si}, '${field}', 1)" aria-label="more ${unit}">+</button>
    <span class="unit">${unit}</span>
  </div>`;
}

function stationHTML(c, s) {
  const d = s.dose;
  const done = !!c.done[s.si];
  const running = !!timer && timer.station === s.si;
  const dose = (d.unit === 'text' ? d.text : d.amount + (d.unit === 'secs' ? ' s' : ' reps') + (d.sides ? ' each side' : ''))
    + (d.loadKind === 'kg' && d.load > 0 ? ' · ' + d.load + ' kg' : '')
    + (d.loadKind === 'band' ? ' · band ' + d.load : '');
  const options = s.st.options
    ? `<div class="row wrap option-row">${s.st.options.map((id) =>
        `<button class="chip ${s.chosen === id ? 'on' : ''}" onclick="circuitPick(${s.si}, '${id}')">${esc(ex(id).name)}</button>`).join('')}</div>`
    : '';
  const timerBlock = running
    ? `<div class="station-timer">
        <div class="timer-clock small ${leadCount(timer, Date.now()) > 0 ? 'lead' : ''}" id="clock">${clockText()}</div>
        <p class="muted small">${timer.side ? 'Side ' + timer.side + ' of 2' : 'Hold'}</p>
        <button class="btn-small btn-ghost" onclick="stopTimer();render()">Cancel</button>
      </div>`
    : `<div class="row mt station-actions">
        ${d.unit === 'secs' && !done ? `<button class="btn-small grow" onclick="startStation(${s.si})">Start ${d.amount} s</button>` : ''}
        <button class="btn-small grow ${done ? 'station-done' : ''}" onclick="circuitToggle(${s.si})">${done ? 'Done ✓' : 'Mark done'}</button>
      </div>`;
  const edit = view.cEdit === s.si && !running
    ? `<div class="row wrap mt" style="gap:0.8rem">
        ${d.unit !== 'text' ? circuitStepperHTML(s.si, 'amount', d.amount, d.unit === 'secs' ? 'secs' : 'reps') : ''}
        ${d.loadKind ? circuitStepperHTML(s.si, 'load', d.load, d.loadKind) : ''}
      </div>`
    : '';
  return `<div class="card exercise-block station ${done ? 'done-block' : ''}">
    <div class="row spread">
      <div class="row exhead">
        <span class="pattern-ico">${patternIcon(s.e.pattern, 34)}</span>
        <div>
          <div class="exname">${esc(s.e.name)}</div>
          <div class="target">${esc(dose)}</div>
        </div>
      </div>
      <div class="row" style="gap:0.4rem">
        <button class="btn-small btn-ghost" onclick="view.cInfo=view.cInfo===${s.si}?null:${s.si};render()" aria-label="how to do this exercise">?</button>
        ${d.unit !== 'text' || d.loadKind ? `<button class="btn-small btn-ghost" onclick="view.cEdit=view.cEdit===${s.si}?null:${s.si};render()" aria-label="adjust the dose">Edit</button>` : ''}
      </div>
    </div>
    ${options}
    ${d.guide ? `<p class="muted small">${esc(d.guide)}</p>` : ''}
    ${view.cInfo === s.si ? `<p class="muted small how-to">${esc(s.e.desc || s.e.cue || 'No description yet.')}</p>` : ''}
    ${s.st.next ? `<p class="muted small next-line">Next: ${esc(s.st.next)}</p>` : ''}
    ${timerBlock}
    ${edit}
  </div>`;
}

function vCircuit() {
  const c = S.current;
  if (!c || c.phase !== 'circuit') return vHome();
  const blk = circuitBlock(c);
  const stations = circuitStations(c);
  const open = stations.filter((s) => !c.done[s.si]).length;
  const lastRound = c.round >= blk.rounds;
  const lastBlock = c.bi >= c.blocks.length - 1;
  return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button>
      <span class="title">${esc(blk.name)}</span><span class="muted">Round ${c.round} of ${blk.rounds}</span></div>
    <div class="row spread mb">
      <span class="muted small">${c.blocks.length > 1 ? 'Block ' + (c.bi + 1) + ' of ' + c.blocks.length + ' · ' : ''}target ${c.attach ? 10 : 30} min${c.travel ? ' · hotel room' : ''}</span>
      <span class="session-clock" id="upclock">${fmtClock(elapsedSecs(c))}</span>
    </div>
    ${stations.map((s) => stationHTML(c, s)).join('')}
    <button class="btn-primary" onclick="circuitNext()">${lastRound && lastBlock ? 'Finish' : lastRound ? 'Next block →' : 'Next round →'}</button>
    ${open ? `<p class="muted small center mt">${open} station${open === 1 ? '' : 's'} not marked. Unmarked stations are not logged.</p>` : ''}
    <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard session</button>`;
}

function weekReview(w) {
  const j = journey();
  if (!j) return null;
  const training = S.sessions.filter((s) => s.journeyId === j.id && s.week === w && s.dayType !== 'REST' && s.dayType !== 'LIGHT');
  // lifts that moved: this week's max kg vs best of all earlier weeks in this
  // journey; travel sessions excluded — their weight field is a band level
  const maxByEx = {}, prevMaxByEx = {};
  S.sessions.forEach((s) => {
    if (s.journeyId !== j.id || s.travel || s.week > w) return;
    const tgt = s.week === w ? maxByEx : prevMaxByEx;
    (s.sets || []).forEach((x) => {
      if (x.weight > 0) tgt[x.ex] = Math.max(tgt[x.ex] || 0, x.weight);
    });
  });
  const moved = Object.keys(maxByEx)
    .filter((id) => prevMaxByEx[id] > 0 && maxByEx[id] > prevMaxByEx[id])
    .map((id) => ({ id, from: prevMaxByEx[id], to: maxByEx[id] }))
    .sort((a, b) => (b.to - b.from) - (a.to - a.from))
    .slice(0, 3);
  let sick = 0, blocked = 0, light = 0;
  for (let d = 0; d < 7; d++) {
    const mk = missedKind(j, w, d);
    if (mk === 'sick') sick++;
    if (mk === 'blocked') blocked++;
    if (mk === 'light') light++;
  }
  return {
    // distinct days, so re-logging a day can't fake a full week
    sessions: new Set(training.map((s) => s.dayIndex)).size,
    target: j.weekPlan.filter((t) => t !== 'REST').length,
    moved, sick, blocked, light,
    bw: S.bodyweight[isoWeekKey()] || null,
  };
}

function reviewVerdict(r) {
  if (r.sessions >= r.target) return 'Full week — everything on plan.';
  const short = r.target - r.sessions;
  let v = 'Light week: ' + short + ' session' + (short === 1 ? '' : 's') + ' short. Consistency beats catch-up.';
  if (r.sick > 0 && r.sick >= (r.target - r.sessions)) {
    v = 'Sick week: ' + r.sick + ' day' + (r.sick === 1 ? '' : 's') + ' marked. Recovery was the training — pick up at the next slot.';
  } else if (r.sick + r.blocked + r.light > 0) {
    v += ' (' + [r.sick ? r.sick + ' sick' : '', r.blocked ? r.blocked + ' no-time' : '', r.light ? r.light + ' light' : ''].filter(Boolean).join(', ') + ')';
  }
  return v;
}

/* `bare` leaves the scoreboard card off, for screens that already show it */
function reviewCardHTML(w, bare) {
  const r = weekReview(w);
  if (!r) return '';
  return `<div class="card">
    <h3>Week ${w} review</h3>
    <div class="review-stats">
      <div class="stat"><span class="n">${r.sessions}<span class="of">/${r.target}</span></span><span class="lbl">Sessions</span></div>
      <div class="stat"><span class="n">${r.moved.length}</span><span class="lbl">Lifts moved</span></div>
      <div class="stat"><span class="n">${r.bw != null ? r.bw : '—'}</span><span class="lbl">Bodyweight kg</span></div>
    </div>
    ${r.moved.length ? `<div class="mt">${r.moved.map((m) =>
      `<p class="small accent">↑ ${esc(ex(m.id).name)} ${m.from} → ${m.to} kg</p>`).join('')}</div>` : ''}
    <p class="small mt">${reviewVerdict(r)}</p>
  </div>` + (bare ? '' : scoreboardCardHTML(journey()));
}

function vRest() {
  const w = view.week, d = view.dayIndex;
  return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button><span class="title">Rest · Week ${w}</span></div>
    <div class="card highlight">
      <h3>Rest day</h3>
      <p class="muted">This is where the adaptation happens. Muscles grow between sessions, not during them.</p>
      <p class="muted small mt">Good uses of today: a long walk, stretching, sauna, early night, proper meals.</p>
      <p class="muted small mt">Today is genuinely off. A long walk still counts; heavy lifting does not.</p>
      <button class="btn-primary mt" onclick="saveRest(${w},${d})">Mark rest day done</button>
    </div>
    ${reviewCardHTML(w)}
    <div class="card">
      <h3>Ideas</h3>
      <p class="muted small">The deactivation page doubles as a rest-day menu — breathing, stretching doctrine, refuel.</p>
      <button class="btn-big btn-ghost mt" onclick="go('deactivation')">Open deactivation page</button>
    </div>`;
}

function vReading(title, ideas, intro, stretches) {
  const backBtn = S.current
    ? `<button class="btn-primary mb" onclick="go('workout')">← Back to session</button>`
    : '';
  return `<div class="topbar"><button onclick="go('${S.current ? 'workout' : 'program'}')" aria-label="back">←</button>
      <span class="title">${title}</span></div>
    ${backBtn}
    <div class="card highlight"><p class="muted">${intro}</p></div>
    ${vReadingInline(ideas)}
    ${stretches ? '<h2>Dynamic stretches</h2>' + vReadingInline(stretches) : ''}
    ${backBtn}`;
}

function sessionModeLabel(s) { return s.travel ? ' · hotel room' : s.gym === 'other' ? ' · other gym' : ''; }

function vSummary() {
  const s = S.sessions.find((x) => x.id === view.sessionId);
  if (!s) return vHome();
  const sj = journeyOf(s);
  const stuck = isV39(sj) && !s.travel
    ? [...new Set((s.sets || []).map((x) => x.ex))].filter((id) => plateauFor(id, sj.id)) : [];
  const plateaus = stuck.length
    ? `<div class="card">
        <h3>Plateau</h3>
        <p class="muted small">Two weeks at the same weight. One step up clears the warning.</p>
        ${stuck.map((id) => `<div class="set-row"><span>${esc(ex(id).name)}</span>
          <span class="small plateau-tag">${esc(fmtLoad(workFor(id), ex(id)))}</span></div>`).join('')}
      </div>`
    : '';
  // after Legs 1 on a v39 journey: the shoulder-blade block, saved inside this session
  const blockOffer = view.fresh && s.dayType === 'LEGS1' && isV39(journeyOf(s)) && !s.circuit && !S.current
    ? `<div class="card highlight">
        <h3>Shoulder-blade block, 10 min</h3>
        <p class="muted small">${CORE_CIRCUIT[1].stations.length} stations, ${CORE_CIRCUIT[1].rounds} rounds. Saved inside this session.</p>
        <button class="btn-big mt" onclick="startBlock('${s.id}', 1)">Start the block</button>
      </div>`
    : '';
  return `<h1>Session done</h1>
    <div class="card">
      <div class="row spread"><h3>W${s.week} · ${dayLabel(s.dayType)}</h3>${dayBadge(s.dayType)}</div>
      ${sessionModeLabel(s) ? `<p class="muted small">${sessionModeLabel(s).slice(3)}</p>` : ''}
      ${sessionDetailHTML(s)}
    </div>
    ${blockOffer}
    ${plateaus}
    <div class="banner">Deactivate: 10–15 min stretch + breathing, then refuel within 20–30 min (protein + fluids).
      <button class="btn-small btn-ghost" onclick="go('deactivation')">Guide →</button></div>
    <button class="btn-primary mt" onclick="go('home')">Home</button>`;
}

function circuitDetailHTML(cx) {
  const byEx = {};
  (cx.log || []).forEach((l) => { (byEx[l.ex] = byEx[l.ex] || []).push(l); });
  const rows = Object.keys(byEx).map((id) => {
    const parts = byEx[id].map((l) => (l.dose ? l.dose : l.secs != null ? l.secs + 's' : l.reps)
      + (l.kg ? ' @ ' + l.kg + 'kg' : l.band ? ' @ band ' + l.band : ''));
    return `<div class="set-row"><span>${esc(ex(id).name)}</span><span class="muted small">${esc(parts.join(', '))}</span></div>`;
  }).join('');
  return `<div class="set-row"><span><b>${esc(cx.name || 'Circuit')}</b></span><span class="muted small">${cx.minutes || 0} min</span></div>${rows}`;
}

/* one logged set. Sets from v39 carry a dumbbell count; older sets show their
   bare weight exactly as it was logged. */
function fmtSet(x, e, travel) {
  const amount = x.amount + (e.measure === 'secs' ? 's' : '');
  if (x.count) return amount + ' @ ' + x.count + '×' + x.weight + 'kg';
  return amount + (x.weight ? '×' + x.weight + (travel ? ' band' : 'kg') : '');
}

function sessionDetailHTML(s) {
  if (s.dayType === 'ZONE2') {
    const z = s.zone2 || { modality: '?', minutes: 0 };
    return `<p class="big">${esc(z.modality)} · ${z.minutes} min${z.hr ? ' · ' + z.hr + ' bpm' : ''}</p>`;
  }
  if (s.dayType === 'LIGHT') {
    const l = s.light || {};
    return `<p class="big">${l.option === 'stretch' ? 'Stretching' : 'Zone 2 · ' + esc(l.modality || '?')} · ${l.minutes || 0} min</p>`;
  }
  if (s.dayType === 'SPRINT') {
    const sp = s.sprint || { modality: '?', intervals: 0, minutes: 0 };
    if (sp.test) return `<p class="big">12-minute test · ${sp.test.meters} m</p><p class="muted small">${esc(sp.modality || '')}</p>`;
    const rows = Array.isArray(sp.sprints) ? sp.sprints.map((x, i) =>
      `<div class="set-row"><span>${i < 2 ? 'Warm-up ' + (i + 1) : 'Sprint ' + (i - 1)} · ${x.secs} s</span>
        <span class="muted small">${x.speed} km/h · ${x.slope} %</span></div>`).join('') : '';
    return `<p class="big">${esc(sp.modality)} · ${sp.intervals} sprints · ${sp.minutes} min</p>${rows}`;
  }
  if (s.dayType === 'REST') {
    return '<p class="big">Recovery day ✓</p>';
  }
  const byEx = {};
  (s.sets || []).forEach((set) => {
    (byEx[set.ex] = byEx[set.ex] || []).push(set);
  });
  const lifts = Object.keys(byEx).map((exId) => {
    const e = ex(exId);
    const sets = byEx[exId].map((x) => fmtSet(x, e, s.travel)).join(', ');
    return `<div class="set-row"><span>${esc(e.name)}</span><span class="muted small">${sets}</span></div>`;
  }).join('');
  const cardio = (s.cardio || []).map((cd) =>
    `<div class="set-row"><span>Cardio ${cd.round}</span><span class="muted small">${esc(cd.modality)} · ${cd.seconds > 0 ? Math.round(cd.seconds / 60 * 10) / 10 + ' min' : 'skipped'}</span></div>`).join('');
  return lifts + cardio + (s.circuit ? circuitDetailHTML(s.circuit) : '');
}

function vJournal() {
  const items = S.sessions.slice().reverse().map((s) =>
    `<div class="session-item" onclick="go('session', {sessionId: '${s.id}'})">
      <div><b>W${s.week} · ${dayLabel(s.dayType)}</b><br><span class="muted small">${fmtDate(s.ts)}${sessionModeLabel(s)}</span></div>
      ${dayBadge(s.dayType)}
    </div>`).join('');
  return `<h1>Journal</h1><div class="card">${items || '<p class="muted">No sessions yet. Your logged workouts will appear here.</p>'}</div>`;
}

function vSession() {
  const s = S.sessions.find((x) => x.id === view.sessionId);
  if (!s) return vJournal();
  return `<div class="topbar"><button onclick="go('journal')" aria-label="back">←</button><span class="title">${fmtDate(s.ts)}</span></div>
    <div class="card">
      <div class="row spread"><h3>W${s.week} · ${dayLabel(s.dayType)}</h3>${dayBadge(s.dayType)}</div>
      ${sessionModeLabel(s) ? `<p class="muted small">${sessionModeLabel(s).slice(3)}</p>` : ''}
      ${sessionDetailHTML(s)}
    </div>
    <button class="btn-danger btn-big" onclick="deleteSession('${s.id}')">Delete session</button>`;
}

function vProgress() {
  const loggedIds = [...new Set(S.sessions.flatMap((s) => (s.sets || []).map((x) => x.ex)))];
  if (!view.exId || !loggedIds.includes(view.exId)) view.exId = loggedIds[0] || null;
  let chart = '<p class="muted">Log some sessions to see trends.</p>';
  if (view.exId) {
    const points = [];
    S.sessions.forEach((s) => {
      const sets = (s.sets || []).filter((x) => x.ex === view.exId);
      if (sets.length) {
        points.push({
          ts: s.ts,
          maxW: Math.max(...sets.map((x) => x.weight || 0)),
          topAmount: Math.max(...sets.map((x) => x.amount)),
        });
      }
    });
    chart = trendSVG(points) + `<p class="muted small center">max weight per session (kg) · latest: ${points.length ? points[points.length - 1].maxW + ' kg × ' + points[points.length - 1].topAmount : '—'}</p>`;
  }

  const bwKeys = Object.keys(S.bodyweight).sort().slice(-8);
  const bwRows = bwKeys.map((k) => `<div class="set-row"><span>wk of ${esc(k)}</span><span class="muted">${S.bodyweight[k]} kg</span></div>`).join('');

  return `<h1>Progress</h1>
    ${scoreboardCardHTML(journey())}
    <div class="card">
      ${loggedIds.length ? `<select onchange="view.exId=this.value;render()" aria-label="choose exercise">
        ${loggedIds.map((id) => `<option value="${id}" ${view.exId === id ? 'selected' : ''}>${esc(ex(id).name)}</option>`).join('')}
      </select>` : ''}
      <div class="trend mt">${chart}</div>
    </div>
    <div class="card">
      <h3>Sprints</h3>
      ${S.sessions.filter((s) => s.dayType === 'SPRINT').slice(-4).reverse().map((s) => {
        const sp = s.sprint || {};
        const work = (sp.sprints || []).filter((x) => x.kind === 'work');
        const topSlope = work.length ? Math.max(...work.map((x) => x.slope || 0)) : null;
        const topSpeed = work.length ? Math.max(...work.map((x) => x.speed || 0)) : null;
        if (sp.test) return `<div class="set-row"><span>${fmtDate(s.ts)}</span><span class="muted">12-minute test · ${sp.test.meters} m</span></div>`;
        return `<div class="set-row"><span>${fmtDate(s.ts)}</span><span class="muted">${esc(sp.modality || '?')} · ${sp.intervals || 0}×${topSpeed != null ? ' · ' + topSpeed + ' km/h · ' + topSlope + ' %' : ''}</span></div>`;
      }).join('') || '<p class="muted small">No sprint days yet.</p>'}
    </div>
    <div class="card">
      <h3>12-minute test</h3>
      ${S.tests.filter((t) => t.kind === 'cooper12').slice().reverse().map((t) =>
        `<div class="set-row"><span>${fmtDate(t.ts)}</span>
          <span class="row"><span class="muted">${t.meters} m</span>
          <button class="btn-small btn-ghost" onclick="deleteTestResult(${t.ts})" aria-label="delete this result">×</button></span></div>`).join('')
        || '<p class="muted small">No results yet.</p>'}
      ${view.addTest
        ? `<label class="field" for="testDate">Date</label>
          <input type="date" id="testDate" value="${localDate()}">
          <label class="field" for="testMeters">Distance in meters</label>
          <input type="text" inputmode="numeric" id="testMeters" placeholder="e.g. 2400">
          <div class="row mt">
            <button class="btn-big grow" onclick="addTestResult()">Add</button>
            <button class="btn-big btn-ghost grow" onclick="view.addTest=false;render()">Cancel</button>
          </div>`
        : `<button class="btn-big btn-ghost mt" onclick="view.addTest=true;render()">Add test result</button>`}
    </div>
    ${bwRows ? `<div class="card"><h3>Bodyweight</h3>${bwRows}</div>` : ''}`;
}

function trendSVG(points) {
  if (points.length < 2) return points.length === 1 ? `<p class="big center">${points[0].maxW} kg</p>` : '<p class="muted">Need 2+ sessions for a trend.</p>';
  const W = 500, H = 120, P = 10;
  const ws = points.map((p) => p.maxW);
  const min = Math.min(...ws), max = Math.max(...ws);
  const span = max - min || 1;
  const pts = points.map((p, i) => {
    const x = P + (i / (points.length - 1)) * (W - 2 * P);
    const y = H - P - ((p.maxW - min) / span) * (H - 2 * P);
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="weight trend chart">
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((p, i) => {
      const x = P + (i / (points.length - 1)) * (W - 2 * P);
      const y = H - P - ((p.maxW - min) / span) * (H - 2 * P);
      return `<circle cx="${x}" cy="${y}" r="5" fill="var(--accent)"/>`;
    }).join('')}
  </svg>`;
}

function vProgram() {
  const j = journey();
  if (!j) return vHome();
  if (!view.tab) view.tab = 'days';

  const body = view.tab === 'library' ? programLibraryHTML()
    : view.tab === 'activation' ? vReadingInline(ACTIVATION_IDEAS) + '<h2>Dynamic stretches</h2>' + vReadingInline(ACTIVATION_STRETCHES)
    : view.tab === 'deactivation' ? vReadingInline(DEACTIVATION_IDEAS)
    : programDaysHTML(j);

  const tabs = [['days', 'Days'], ['library', 'Library'], ['activation', 'Activation'], ['deactivation', 'Deactivation']];
  return `<h1>Program</h1>
    <div class="row wrap mb tabs">
      ${tabs.map(([t, l]) => `<button class="btn-small ${view.tab === t ? '' : 'btn-ghost'}" onclick="view.tab='${t}';render()">${l}</button>`).join('')}
    </div>
    ${body}`;
}

function vReadingInline(ideas) {
  return ideas.map((it) => `<div class="card">
    <h3>${esc(it.name)}</h3>
    <p class="muted small">${esc(it.text)}</p>
  </div>`).join('');
}

/* what a slot does on a v39 journey, for the Program screen */
function slotSchemeLabel(e, slot) {
  const scheme = slotScheme(e, slot);
  const r = exRange(e);
  const range = (r[0] === r[1] ? r[0] : r[0] + '–' + r[1]) + (e.measure === 'secs' ? ' s' : ' reps');
  if (scheme === 'topset') return 'top set of 5, back-off ' + baseBackoff(e);
  if (scheme === 'power') return 'power · fast sets of 5';
  if (scheme === 'volume') return 'volume · ' + range;
  return 'straight · ' + range;
}

function programDaysHTML(j) {
  if (!view.block) view.block = 'early';
  const v39 = isV39(j);
  const dayKeys = j.weekPlan.filter((t) => is52Day(t, j));
  if (!view.day || !dayKeys.includes(view.day)) view.day = dayKeys[0];
  const slots = (j.blocks[view.block] || {})[view.day] || [];
  const restPos = j.weekPlan.indexOf('REST') + 1;

  const slotRows = slots.map((exId, i) => {
    const e = ex(exId);
    return `<div class="set-row">
      <div class="row exhead">
        <span class="pattern-ico">${patternIcon(e.pattern, 30)}</span>
        <div><b>${v39 ? 'P' + (i + 1) : 'ABCDE'[i]}</b> · ${esc(e.name)}<br>
          <span class="muted small">${v39 ? slotSchemeLabel(e, i) : (e.bucket ? 'target ' + esc(e.bucket) : 'time-based')} · ${esc(e.group)}</span></div>
      </div>
      <button class="btn-small btn-ghost" onclick="view.editSlot=${i};render()">Swap</button>
    </div>`;
  }).join('');

  let editHTML = '';
  if (view.editSlot !== undefined && view.editSlot !== null && slots[view.editSlot] !== undefined) {
    const groups = ['legs', 'upper', 'core', 'mixed'];
    const options = groups.map((g) =>
      `<optgroup label="${g}">${Object.values(S.exercises).filter((e) => e.group === g)
        .map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
    editHTML = `<div class="card highlight">
      <h3>Swap slot ${v39 ? 'P' + (view.editSlot + 1) : 'ABCDE'[view.editSlot]}</h3>
      <select id="swapSel">${options}</select>
      <div class="row mt">
        <button class="btn-big grow" onclick="applySwap()">Apply</button>
        <button class="btn-ghost btn-big grow" onclick="view.editSlot=null;render()">Cancel</button>
      </div>
      <p class="muted small mt">Applies from your next session. Past logs stay untouched. ${v39 ? 'P1 carries the volume, P2 is the anchor, P3 to P5 run straight sets.' : 'A/B are done most often — keep anchors there.'}</p>
    </div>`;
  }

  return `<div class="row wrap mb">
      <button class="btn-small ${view.block === 'early' ? '' : 'btn-ghost'}" onclick="view.block='early';view.editSlot=null;render()">Weeks 1–3</button>
      <button class="btn-small ${view.block === 'late' ? '' : 'btn-ghost'}" onclick="view.block='late';view.editSlot=null;render()">Weeks 4–6</button>
    </div>
    <div class="row wrap mb">
      ${dayKeys.map((t) => `<button class="btn-small ${view.day === t ? '' : 'btn-ghost'}"
        onclick="view.day='${t}';view.editSlot=null;render()">${dayLabel(t)}</button>`).join('')}
    </div>
    ${editHTML}
    <div class="card">${slotRows || '<p class="muted">No exercises configured for this day.</p>'}</div>
    ${v39 ? `<div class="card">
      <h3>Week layout</h3>
      <p class="muted small">${j.weekPlan.map((t) => esc(dayLabel(t))).join(' · ')}</p>
      <p class="muted small mt">Seven days. Zone 2 and the Core circuit are fixed days and have no slots to swap.</p>
    </div>` : `${recommendedHTML(j, slots)}
    <div class="card">
      <h3>Week layout</h3>
      <label class="field" for="restDaySel">Rest day position</label>
      <select id="restDaySel" onchange="moveRestDay(this.value)">
        ${[1, 2, 3, 4, 5, 6, 7].map((p) => `<option value="${p}" ${p === restPos ? 'selected' : ''}>Day ${p}</option>`).join('')}
      </select>
      <p class="muted small mt">Days keep their order; the rest day slides to where your week needs it.</p>
    </div>`}
    <div class="card">
      <h3>Add exercise to library</h3>
      <label class="field" for="newExName">Name</label><input type="text" id="newExName">
      <label class="field" for="newExGroup">Group</label>
      <select id="newExGroup"><option>legs</option><option>upper</option><option>core</option><option>mixed</option></select>
      <label class="field" for="newExMeasure">Measure</label>
      <select id="newExMeasure"><option value="reps">reps</option><option value="secs">seconds</option></select>
      <label class="field" for="newExBucket">Target bucket</label>
      <select id="newExBucket"><option value="">none (time-based)</option>${BUCKETS.map((b) => `<option ${b === '9-12' ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <button class="btn-big mt" onclick="addExercise()">Add</button>
    </div>`;
}

/* Recommended setup for the selected day: what it would become, what changes,
   and why. Applying is always an explicit tap — nothing here is automatic. */
function recommendedHTML(j, slots) {
  const rec = recommendedFor(view.day, view.block);
  if (!rec) return '';
  const missing = rec.slots.filter((id) => !S.exercises[id]);
  const applied = JSON.stringify(slots) === JSON.stringify(rec.slots);
  const blockLabel = view.block === 'early' ? 'Weeks 1–3' : 'Weeks 4–6';

  const rows = rec.slots.map((id, i) => {
    const e = ex(id);
    const same = slots[i] === id;
    return `<div class="set-row">
      <div class="row exhead">
        <span class="pattern-ico">${patternIcon(e.pattern, 30)}</span>
        <div><b>${'ABCDE'[i]}</b> · ${esc(e.name)}<br>
          <span class="muted small">${same ? 'unchanged' : 'replaces ' + esc(slots[i] ? ex(slots[i]).name : '—')}</span></div>
      </div>
    </div>`;
  }).join('');

  return `<div class="card${applied ? '' : ' highlight'}">
    <h3>Recommended · ${esc(rec.title)} · ${blockLabel}</h3>
    ${applied
      ? `<p class="muted small">${blockLabel} already match this setup.</p>`
      : `<p class="muted small">Anchor at B, not A — slot A is five rounds a session, so it holds the lift you can accumulate volume on.</p>`}
    ${rows}
    ${missing.length
      ? `<p class="muted small mt">Cannot apply — missing from the library: ${missing.map(esc).join(', ')}.</p>`
      : applied ? ''
        : `<button class="btn-big mt" onclick="applyRecommended()">Apply to ${blockLabel}</button>`}
    <details class="mt"><summary class="muted small">Why this order</summary>
      ${rec.why.map((w) => `<p class="muted small">${esc(w)}</p>`).join('')}
    </details>
  </div>`;
}

/* The recommendation for a day is block-specific: weeks 4-6 harden the variant
   in slots A/C/E while keeping the same five roles and the same anchor at B. */
function recommendedFor(day, block) {
  if (typeof RECOMMENDED_BLOCKS === 'undefined') return null;
  const day_ = RECOMMENDED_BLOCKS[day];
  const b = day_ && day_[block];
  return b ? { title: day_.title, slots: b.slots, why: b.why } : null;
}

function applyRecommended() {
  const j = journey();
  const rec = recommendedFor(view.day, view.block);
  if (!j || !rec || !j.blocks[view.block]) return;
  if (rec.slots.some((id) => !S.exercises[id])) return;
  const blockLabel = view.block === 'early' ? 'Weeks 1–3' : 'Weeks 4–6';
  if (!confirm(`Replace ${dayLabel(view.day)} (${blockLabel}) with the recommended setup? Past logs stay untouched.`)) return;
  j.blocks[view.block][view.day] = rec.slots.slice();
  view.editSlot = null;
  save(); render();
}

function programLibraryHTML() {
  const groups = [['legs', 'Legs'], ['upper', 'Upper body'], ['core', 'Core'], ['mixed', 'Mixed / full body']];
  const q = (view.libQ || '').toLowerCase();
  let html = `<input type="text" placeholder="Search exercises…" value="${esc(view.libQ || '')}"
    oninput="view.libQ=this.value;render()" class="mb" aria-label="search exercises">`;
  groups.forEach(([g, label]) => {
    const items = Object.values(S.exercises)
      .filter((e) => e.group === g)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) return;
    html += `<h2>${label}</h2><div class="card">` + items.map((e) => `
      <div class="lib-item">
        <span class="pattern-ico">${patternIcon(e.pattern, 40)}</span>
        <div class="grow">
          <div class="row spread">
            <b>${esc(e.name)}</b>
            ${e.measure === 'secs'
              ? '<span class="badge">seconds</span>'
              : `<select class="bucket-sel" onchange="setBucket('${e.id}', this.value)" aria-label="target bucket for ${esc(e.name)}">
                  ${BUCKETS.map((b) => `<option value="${b}" ${e.bucket === b ? 'selected' : ''}>${b}</option>`).join('')}
                </select>`}
          </div>
          <p class="muted small">${esc(e.desc || e.cue || '')}</p>
        </div>
      </div>`).join('') + '</div>';
  });
  return html;
}

function applySwap() {
  const sel = document.getElementById('swapSel');
  const j = journey();
  if (!sel || !j || view.editSlot === undefined || view.editSlot === null) return;
  if (!S.exercises[sel.value]) return;
  j.blocks[view.block][view.day][view.editSlot] = sel.value;
  save();
  view.editSlot = null;
  render();
}

function addExercise() {
  const nameEl = document.getElementById('newExName');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { alert('Name required'); return; }
  const id = 'x_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (S.exercises[id] && !confirm(`"${S.exercises[id].name}" already exists. Overwrite it?`)) return;
  S.exercises[id] = {
    id, name,
    group: document.getElementById('newExGroup').value,
    measure: document.getElementById('newExMeasure').value,
    bucket: document.getElementById('newExBucket').value || null,
    pattern: 'hold',
    cue: '', desc: '',
  };
  save(); render();
}

/* ---------- equipment (Settings) ---------- */

const EQUIP_LISTS = { platePairs: 'plate pair', dumbbells: 'dumbbell', kettlebells: 'kettlebell' };

function addEquip(key) {
  const el = document.getElementById('add_' + key);
  if (!EQUIP_LISTS[key] || !el) return;
  const n = clampNum(el.value, 0.25, 100, NaN);
  if (isNaN(n)) { alert('Enter a weight in kg.'); return; }
  S.settings.equipment.home[key].push(n);
  S.settings.equipment = cleanEquipment(S.settings.equipment);
  save(); render();
}

function removeEquip(key, index) {
  const list = EQUIP_LISTS[key] ? S.settings.equipment.home[key] : null;
  if (!list || list[index] == null) return;
  if (!confirm('Remove the ' + list[index] + ' kg ' + EQUIP_LISTS[key] + '?')) return;
  list.splice(index, 1);
  S.settings.equipment = cleanEquipment(S.settings.equipment);
  save(); render();
}

function setBarWeight(profile, bar, value) {
  const p = S.settings.equipment[profile];
  if (!p || !['barbell', 'trap_bar'].includes(bar)) return;
  p.bars[bar] = clampNum(value, 0, 50, p.bars[bar]);
  S.settings.equipment = cleanEquipment(S.settings.equipment);
  save(); render();
}

function equipmentCardHTML() {
  const eq = S.settings.equipment;
  const list = (key, label) => `<label class="field" for="add_${key}">${label}</label>
    <div class="row wrap eq-list">${eq.home[key].map((w, i) =>
      `<button class="chip on" onclick="removeEquip('${key}', ${i})" aria-label="remove ${w} kg">${w} <span class="x">×</span></button>`).join('')
      || '<span class="muted small">none yet</span>'}</div>
    <div class="row eq-add">
      <input type="text" inputmode="decimal" id="add_${key}" placeholder="kg">
      <button class="btn-small" onclick="addEquip('${key}')">Add</button>
    </div>`;
  const bars = (profile) => `<div class="row wrap" style="gap:1rem">
    ${[['barbell', 'Barbell'], ['trap_bar', 'Trap bar']].map(([k, l]) => `<div class="stepper">
      <span class="muted small">${l}</span>
      <input class="val" inputmode="decimal" value="${eq[profile].bars[k]}" onchange="setBarWeight('${profile}', '${k}', this.value)" aria-label="${l} weight, ${profile}">
      <span class="unit">kg</span></div>`).join('')}
  </div>`;
  const totals = buildableTotals(eq.home.bars.barbell, eq.home.platePairs);
  return `<div class="card">
    <h3>Equipment · home</h3>
    <p class="muted small">Weight entry only offers loads this list can build. Tap an item to remove it.</p>
    <label class="field">Bars</label>
    ${bars('home')}
    ${list('platePairs', 'Plates · one entry per pair')}
    ${list('dumbbells', 'Dumbbells · each as a pair')}
    ${list('kettlebells', 'Kettlebells')}
    <p class="muted small mt">Barbell: ${totals.length} loads from ${totals[0]} to ${totals[totals.length - 1]} kg.</p>
  </div>
  <div class="card">
    <h3>Equipment · other gym</h3>
    <p class="muted small">Free weight entry in ${eq.other.step} kg steps. Pick it on the Next-up card.</p>
    <label class="field">Bars</label>
    ${bars('other')}
  </div>`;
}

function vSettings() {
  const st = S.settings;
  return `<h1>Settings</h1>
    <div class="card">
      <h3>Cardio between exercises</h3>
      <div class="row mt">
        <button class="btn-big grow ${st.cardioMinutes === 2 ? '' : 'btn-ghost'}" onclick="S.settings.cardioMinutes=2;save();render()">2 min</button>
        <button class="btn-big grow ${st.cardioMinutes === 3 ? '' : 'btn-ghost'}" onclick="S.settings.cardioMinutes=3;save();render()">3 min</button>
      </div>
    </div>
    <div class="card">
      <h3>Font size</h3>
      <div class="row mt">
        ${[['0.9', 'S'], ['1', 'M'], ['1.15', 'L'], ['1.3', 'XL']].map(([v, l]) =>
          `<button class="btn-big grow ${String(st.fontScale) === v ? '' : 'btn-ghost'}" onclick="S.settings.fontScale=${v};save();render()">${l}</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Weight step</h3>
      <div class="row mt">
        ${[1.25, 2.5, 5].map((v) =>
          `<button class="btn-big grow ${st.weightStep === v ? '' : 'btn-ghost'}" onclick="S.settings.weightStep=${v};save();render()">${v} kg</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Sprint lead-in</h3>
      <p class="muted small">The 3-2-1 before a sprint or a timed hold. The interval itself is net.</p>
      <div class="row mt">
        ${[0, 1, 3, 5].map((v) =>
          `<button class="btn-big grow ${st.sprintLeadIn === v ? '' : 'btn-ghost'}" onclick="S.settings.sprintLeadIn=${v};save();render()">${v === 0 ? 'Off' : v + ' s'}</button>`).join('')}
      </div>
    </div>
    ${equipmentCardHTML()}
    <div class="card">
      <h3>New journey</h3>
      <p class="muted small">Starts a fresh 6 weeks. The old journey stays in the Journal.</p>
      ${view.nj
        ? `<label class="field" for="njProg">Program</label>
          <select id="njProg">
            <option value="j3">Journey 3 · ${WEEK_PLAN_J3.map((t) => esc(dayLabel(t))).join(' · ')}</option>
            <option value="keep">Keep the current days and swaps</option>
          </select>
          <label class="field" for="njDate">Start date</label>
          <input type="date" id="njDate" value="${localDate()}">
          <div class="row mt">
            <button class="btn-big grow" onclick="newJourney()">Start</button>
            <button class="btn-big btn-ghost grow" onclick="view.nj=false;render()">Cancel</button>
          </div>`
        : `<button class="btn-big mt" onclick="view.nj=true;render()">Start new journey</button>`}
    </div>
    <div class="card">
      <h3>Backup</h3>
      <div class="row mt">
        <button class="btn-big grow" onclick="exportJSON(S)">Export JSON</button>
        <button class="btn-big grow btn-ghost" onclick="document.getElementById('importFile').click()">Import</button>
      </div>
      <input type="file" id="importFile" accept="application/json" style="display:none"
        onchange="importJSON(this.files[0], (err, st) => { if (err) alert('Import failed: ' + err.message); else { S = st; stopTimer(); releaseWake(); view={name:'home'}; render(); } })">
    </div>
    <div class="card">
      <h3>Danger zone</h3>
      <button class="btn-danger btn-big mt" onclick="resetAll()">Reset all data</button>
    </div>
    <div class="card">
      <h3>App version</h3>
      <p class="muted small">Running ${APP_VERSION}. Updates install in the background and apply when you next reopen the app.</p>
      <button class="btn-big btn-ghost mt" onclick="manualUpdateCheck(this)">Check for updates now</button>
    </div>
    <p class="muted small center mb">5+2 Journeys · ${APP_VERSION}</p>`;
}

/* forces the service-worker update check, then reloads so the new files are
   the ones actually running (a claimed worker alone does not replace live JS) */
function manualUpdateCheck(btn) {
  if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }
  const done = () => { location.reload(); };
  if (typeof window.checkForUpdate === 'function') {
    Promise.resolve(window.checkForUpdate()).then(() => setTimeout(done, 1200));
  } else {
    setTimeout(done, 300);
  }
}

/* Journey 3 program (scheme 'v39'): seven days, the same five exercises in
   both blocks, the four-lift scoreboard. */
function journey3Program() {
  const copy = (x) => JSON.parse(JSON.stringify(x));
  return {
    scheme: 'v39', weekPlan: WEEK_PLAN_J3.slice(),
    blocks: { early: copy(J3_BLOCKS), late: copy(J3_BLOCKS) },
    scoreboard: copy(J3_SCOREBOARD),
  };
}

/* starting work weights of a v39 journey; a lift that already has a work
   weight keeps it */
function seedWork() {
  Object.keys(J3_START).forEach((id) => {
    if (S.work[id] || !S.exercises[id]) return;
    const v = J3_START[id];
    S.work[id] = typeof v === 'number' ? { weight: v } : { weight: v.w, count: v.count };
  });
}

function newJourney() {
  const j = journey();
  if (!j) { resetAll(); return; }
  const progEl = document.getElementById('njProg');
  const dateEl = document.getElementById('njDate');
  const useJ3 = !progEl || progEl.value === 'j3';
  const start = dateEl && /^\d{4}-\d{2}-\d{2}$/.test(dateEl.value) ? dateEl.value : localDate();
  const n = S.journeys.length + 1;
  if (!confirm('Start Journey ' + n + ' on ' + start + '?' + (S.current ? ' The session in progress is discarded.' : ''))) return;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const prog = useJ3 ? journey3Program()
    : { scheme: j.scheme, weekPlan: j.weekPlan.slice(), blocks: copy(j.blocks), scoreboard: copy(j.scoreboard || []) };
  const nj = {
    id: 'j' + Date.now(),
    name: 'Journey ' + n,
    startDate: start,
    weekCount: 6,
    weekPlan: prog.weekPlan,
    blocks: prog.blocks,
    scoreboard: prog.scoreboard,
  };
  if (prog.scheme) nj.scheme = prog.scheme;
  if (isV39(nj)) seedWork();
  S.journeys.push(nj);
  S.activeJourneyId = nj.id;
  S.current = null;
  view.nj = false;
  stopTimer();
  releaseWake();
  save();
  go('home');
}

function resetAll() {
  if (!confirm('Delete ALL data — journeys, sessions, everything?')) return;
  if (!confirm('Really sure? Consider exporting a backup first.')) return;
  S = normalizeState(seedState());
  stopTimer();
  releaseWake();
  save();
  go('home');
}

render();
