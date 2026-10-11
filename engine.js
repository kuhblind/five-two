/* engine.js — pure training logic: equipment maths, slot prescriptions,
   the plateau check, backfill, scoreboard, timer lead-in. No DOM and no global
   state: every function takes its inputs as arguments, so the tests run it
   headless. A "load" is { weight, count? } — weight is the bar total or ONE
   dumbbell, count is 1 or 2 dumbbells of that same weight. A "kit" is one equipment profile (see defaultEquipment in storage.js). */

/* legs first, then Zone 2, then upper: with one missed day in a week the
   Zone 2 session survives and the Core circuit is what gives way */
const BACKFILL_PRIORITY = ['LEGS2', 'LEGS1', 'ZONE2', 'UPPER1', 'UPPER2', 'SPRINT', 'CORE'];
const LEG_TYPES = ['LEGS1', 'LEGS2'];

function r2(n) { return Math.round(n * 100) / 100; }

function roundTo(n, step) { return step > 0 ? r2(Math.round(n / step) * step) : n; }

/* ---------- equipment ---------- */

const buildableCache = {};

/* every total the bar can be loaded to: bar + 2 × (any subset of the pairs) */
function buildableTotals(bar, platePairs) {
  const key = bar + '|' + platePairs.join(',');
  if (buildableCache[key]) return buildableCache[key];
  let sums = new Set([0]);
  platePairs.forEach((p) => {
    const next = new Set(sums);
    sums.forEach((s) => next.add(r2(s + p)));
    sums = next;
  });
  const out = [...sums].map((s) => r2(bar + 2 * s)).sort((a, b) => a - b);
  buildableCache[key] = out;
  return out;
}

/* plates on one side for a total, largest first; null when it cannot be built */
function platesPerSide(total, bar, platePairs) {
  const plates = platePairs.slice().sort((a, b) => b - a);
  const need = r2((total - bar) / 2);
  if (need < 0) return null;
  const pick = (i, left) => {
    if (Math.abs(left) < 0.001) return [];
    if (left < 0 || i >= plates.length) return null;
    const withIt = pick(i + 1, r2(left - plates[i]));
    if (withIt) return [plates[i]].concat(withIt);
    return pick(i + 1, left);
  };
  return pick(0, need);
}

function loadTotal(l) {
  if (!l) return 0;
  return r2((l.weight || 0) * (l.count || 1));
}

/* dumbbells always come as equal weights: one, or a matching pair */
function dumbbellLadder(dumbbells, count) {
  return dumbbells.slice().sort((a, b) => a - b).map((w) => ({ weight: w, count }));
}

function isBar(e) { return !!e && (e.implement === 'barbell' || e.implement === 'trap_bar'); }
function isBell(e) { return !!e && (e.implement === 'dumbbell' || e.implement === 'kettlebell'); }

/* the discrete loads this exercise can use on this kit, lightest first;
   null means free entry (other gym, band level, added bodyweight load) */
function loadOptions(e, kit, count) {
  if (!e || !kit || kit.free) return null;
  if (isBar(e)) {
    return buildableTotals((kit.bars || {})[e.implement] || 0, kit.platePairs || []).map((w) => ({ weight: w }));
  }
  if (e.implement === 'dumbbell') return dumbbellLadder(kit.dumbbells || [], count === 1 ? 1 : 2);
  if (e.implement === 'kettlebell') return dumbbellLadder(kit.kettlebells || [], 1);
  return null;
}

function freeStep(e, kit) {
  if (e && e.implement === 'band') return 1;
  if (isBell(e)) return (kit && kit.dumbbellStep) || 2;
  return (kit && kit.step) || 2.5;
}

function cleanLoad(l) {
  const out = { weight: l.weight };
  if (l.count) out.count = l.count;
  return out;
}

/* nearest option to a target total, ties rounding down */
function nearestLoad(options, total) {
  let best = null, gap = Infinity;
  options.forEach((o) => {
    const g = Math.abs(loadTotal(o) - total);
    if (g < gap - 0.001) { best = o; gap = g; }
  });
  return best ? cleanLoad(best) : null;
}

/* the load for a share of the work weight, on this kit */
function scaleLoad(e, kit, work, pct) {
  const w = work || { weight: 0 };
  const count = isBell(e) ? (w.count || (e.implement === 'kettlebell' ? 1 : 2)) : undefined;
  const options = loadOptions(e, kit, count);
  if (options && options.length) return nearestLoad(options, loadTotal(w) * pct);
  if (e && e.implement === 'band') return { weight: w.weight || 0 };
  if (isBell(e)) {
    // free entry: scale each dumbbell
    return { weight: pct === 1 ? (w.weight || 0) : roundTo((w.weight || 0) * pct, freeStep(e, kit)), count };
  }
  return { weight: pct === 1 ? (w.weight || 0) : roundTo((w.weight || 0) * pct, freeStep(e, kit)) };
}

/* one step up or down from a load; null at the end of the rack */
function stepLoad(e, kit, load, dir) {
  const cur = load || { weight: 0 };
  const options = loadOptions(e, kit, cur.count);
  if (options && options.length) {
    const t = loadTotal(cur);
    const pool = dir > 0 ? options.filter((o) => loadTotal(o) > t + 0.001)
      : options.filter((o) => loadTotal(o) < t - 0.001).reverse();
    return pool.length ? cleanLoad(pool[0]) : null;
  }
  // a plain bodyweight move has no load to step
  if (e && e.implement === 'bodyweight' && !e.loadable && !(cur.weight > 0)) return null;
  const next = r2((cur.weight || 0) + dir * freeStep(e, kit));
  if (next < 0) return null;
  const out = { weight: next };
  if (cur.count) out.count = cur.count;
  return out;
}

function fmtLoad(l, e) {
  if (!l) return '—';
  if (e && e.implement === 'band') return 'band ' + (l.weight || 0);
  if (isBell(e) && l.count) return l.count + ' × ' + l.weight + ' kg';
  return (l.weight || 0) + ' kg';
}

/* ---------- slot prescriptions ---------- */

/* scheme by slot position, with an exercise-level override. The override only
   counts where the slot has at least three rounds to shape. */
function slotScheme(e, slot) {
  if (e && (e.scheme === 'topset' || e.scheme === 'power') && slot <= 2) return e.scheme;
  return slot === 0 ? 'volume' : 'straight';
}

function exRange(e) {
  if (e && Array.isArray(e.range) && e.range.length === 2) return [e.range[0], e.range[1]];
  if (!e || e.measure === 'secs' || !e.bucket) return [30, 30];
  const lo = parseInt(e.bucket, 10) || 10;
  const m = String(e.bucket).match(/(\d+)\s*\+?$/);
  return [lo, m ? parseInt(m[1], 10) : lo];
}

function baseBackoff(e) { return (e && e.backoffReps) || 8; }

/* what slot `slot` (P1 = 0) does in round `round`: a role label, the share of
   the work weight and the rep target. null for rounds the slot is not in. */
function prescribe(e, slot, round, work) {
  const k = round - slot;
  if (slot < 0 || slot > 4 || k < 1 || round > 5) return null;
  const scheme = slotScheme(e, slot);
  const range = exRange(e);
  if (scheme === 'topset') {
    if (k === 1) return { scheme, role: 'Warm-up', pct: 0.75, reps: [6, 6] };
    if (k === 2) return { scheme, role: 'Top set', pct: 1, reps: [5, 5] };
    const b = baseBackoff(e);
    return { scheme, role: 'Back-off', pct: 0.9, reps: [b, b] };
  }
  if (scheme === 'power') {
    if (k === 1) return { scheme, role: 'Primer', pct: 0.75, reps: [5, 5] };
    return { scheme, role: 'Fast', pct: 1, reps: [5, 5] };
  }
  if (scheme === 'volume' && k === 1) {
    return { scheme, role: 'Warm-up', pct: 0.75, reps: e && e.measure === 'secs' ? range : [8, 8] };
  }
  return { scheme, role: '', pct: 1, reps: range };
}

/* prescription plus the load it resolves to on this kit */
function prescribedSet(e, slot, round, work, kit) {
  const p = prescribe(e, slot, round, work);
  if (!p) return null;
  return Object.assign({}, p, { load: scaleLoad(e, kit, work, p.pct), amount: p.reps[0] });
}

/* ---------- plateau ---------- */

function dayNumber(ts) { const d = new Date(ts); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }

/* There is no automatic progression: the work weight moves only when it is
   changed by hand. The one nudge is this warning. A lift is on a plateau when
   its last sessions were all trained at the current work weight and the first
   of them is two weeks old. Any change of the work weight ends it, because the
   run at the new weight starts empty. `sessions` = the journey's gym sessions,
   newest first. Returns the ts the run started at, or null. */
function plateauSince(e, work, sessions, now) {
  const cur = loadTotal(work);
  if (!e || e.implement === 'band' || !(cur > 0)) return null;   // nothing to step
  let first = null, n = 0;
  for (const s of sessions) {
    const sets = (s.sets || []).filter((x) => x.ex === e.id);
    if (!sets.length) continue;
    if (Math.abs(Math.max(...sets.map(loadTotal)) - cur) > 0.001) break;
    first = s.ts; n++;
  }
  return (n >= 2 && dayNumber(now) - dayNumber(first) >= 14) ? first : null;
}

/* ---------- backfill ---------- */

function dateKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Which session to offer on an open day. o = { weekPlan, week, dayIndex,
   weekCount, missedDays: { dayIndex: kind }, sessions: [{ journey, week,
   dayIndex, dayType, ts }], now }. `sessions` may span journeys: the week view
   uses the ones flagged journey: true, the previous-day check uses all of them.
   Returns { scheduled, offer, missed }. */
function backfillOffer(o) {
  const scheduled = o.weekPlan[o.dayIndex];
  const inWeek = o.sessions.filter((s) => s.journey && s.week === o.week);
  const trained = new Set(inWeek.map((s) => s.dayType));
  const missed = [];
  for (let d = 0; d < 7; d++) {
    if (d === o.dayIndex) continue;
    const t = o.weekPlan[d];
    const logged = inWeek.filter((s) => s.dayIndex === d);
    // a day counts as missed when it is marked, or when something else was trained in its place
    const displaced = logged.length > 0 && !logged.some((s) => s.dayType === t);
    if ((o.missedDays[d] || displaced) && !trained.has(t) && BACKFILL_PRIORITY.includes(t) && !missed.includes(t)) missed.push(t);
  }
  // rest days and legacy day types are never displaced
  if (!BACKFILL_PRIORITY.includes(scheduled) || !missed.length) return { scheduled, offer: scheduled, missed };

  const yesterday = dateKey(o.now - 86400000);
  const legYesterday = o.sessions.some((s) => LEG_TYPES.includes(s.dayType) && dateKey(s.ts) === yesterday);
  const tomorrow = o.dayIndex < 6 ? o.weekPlan[o.dayIndex + 1] : (o.week < o.weekCount ? o.weekPlan[0] : null);
  const candidates = [scheduled].concat(missed)
    .sort((a, b) => BACKFILL_PRIORITY.indexOf(a) - BACKFILL_PRIORITY.indexOf(b))
    .filter((t) => {
      if (!LEG_TYPES.includes(t)) return true;
      if (legYesterday) return false;
      return t === scheduled || !LEG_TYPES.includes(tomorrow);
    });
  return { scheduled, offer: candidates.length ? candidates[0] : scheduled, missed };
}

/* ---------- scoreboard (v39) ---------- */

/* The heaviest load lifted for at least `minReps` reps in the journey's gym
   sessions; null when there is none. Dumbbell sets only count once they carry
   a `count`, because older logs mixed one hand, per hand and pair totals. */
function topSet(e, sessions, minReps) {
  let top = null;
  sessions.forEach((s) => {
    (s.sets || []).forEach((x) => {
      if (x.ex !== e.id || !(x.amount >= minReps) || (isBell(e) && !x.count)) return;
      const load = loadTotal(x);
      if (top == null || load > top) top = load;
    });
  });
  return top;
}

/* ---------- timer lead-in + sprint prefill ---------- */

/* a countdown that starts after `lead` seconds of 3-2-1 */
function leadTimer(now, secs, lead) {
  const startTs = now + lead * 1000;
  return { startTs, endTs: startTs + secs * 1000, total: secs, lead };
}

/* the number to show during the lead-in; 0 once the work clock runs */
function leadCount(t, now) {
  return t && t.startTs && now < t.startTs ? Math.ceil((t.startTs - now) / 1000) : 0;
}

function slopePrefill(lastSlope) { return Math.min(15, r2((lastSlope || 0) + 0.5)); }
