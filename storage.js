/* storage.js — versioned localStorage persistence + normalization + export/import */

const STORE_KEY = 'fivetwo.state';
const STORE_VERSION = 12;

/* attr/url-safe id shape for anything interpolated into templates */
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

let storageWarned = false;

/* Equipment profiles (v39). `home` lists what is physically there, so the app
   only offers loads that can be built; `other` is a gym found while traveling
   and keeps free entry. platePairs holds one entry per PAIR of plates. */
function defaultEquipment() {
  return {
    active: 'home',
    home: {
      bars: { barbell: 10, trap_bar: 10 },
      platePairs: [25, 20, 15, 10, 5, 1.25, 1.25],
      dumbbells: [8, 12, 16, 18, 20, 24],
      kettlebells: [4, 16, 18],
    },
    other: { free: true, bars: { barbell: 20, trap_bar: 20 }, step: 2.5, dumbbellStep: 2 },
  };
}

function cleanNumList(list, lo, hi, cap, unique) {
  let out = (Array.isArray(list) ? list : []).map((n) => parseFloat(n))
    .filter((n) => isFinite(n) && n >= lo && n <= hi).slice(0, cap);
  if (unique) out = out.filter((n, i) => out.indexOf(n) === i);
  return out.sort((a, b) => b - a);
}

function cleanEquipment(eq) {
  const def = defaultEquipment();
  if (!eq || typeof eq !== 'object') return def;
  const bar = (v, d) => (isFinite(v) && v >= 0 && v <= 50 ? Number(v) : d);
  const home = (eq.home && typeof eq.home === 'object') ? eq.home : def.home;
  const other = (eq.other && typeof eq.other === 'object') ? eq.other : def.other;
  const hb = home.bars || {}, ob = other.bars || {};
  return {
    active: eq.active === 'other' ? 'other' : 'home',
    home: {
      bars: { barbell: bar(hb.barbell, 10), trap_bar: bar(hb.trap_bar, 10) },
      // capped: buildable loads enumerate every subset of the pairs
      platePairs: cleanNumList(home.platePairs, 0.25, 50, 14, false),
      dumbbells: cleanNumList(home.dumbbells, 0.5, 100, 30, true).reverse(),
      kettlebells: cleanNumList(home.kettlebells, 0.5, 100, 30, true).reverse(),
    },
    other: {
      free: true,
      bars: { barbell: bar(ob.barbell, 20), trap_bar: bar(ob.trap_bar, 20) },
      step: [1.25, 2.5, 5].includes(other.step) ? other.step : 2.5,
      dumbbellStep: [1, 2, 2.5].includes(other.dumbbellStep) ? other.dumbbellStep : 2,
    },
  };
}

/* a load record { weight, count? } as stored in S.work and on sets */
function cleanLoadFields(x) {
  if (x.count != null && x.count !== 1 && x.count !== 2) delete x.count;
}

/* Numbers get interpolated into markup, so a field that should be a number
   and is not (only reachable via an imported or hand-edited state) is reset.
   A valid number is never touched. */
function numField(obj, key, lo, hi, fallback) {
  if (!obj || obj[key] == null) return;
  if (typeof obj[key] !== 'number' || !isFinite(obj[key]) || obj[key] < lo || obj[key] > hi) obj[key] = fallback;
}

function cleanSet(x) {
  if (!x || typeof x !== 'object') return;
  cleanLoadFields(x);
  ['round', 'amount', 'weight'].forEach((k) => { if (typeof x[k] !== 'number' || !isFinite(x[k])) x[k] = 0; });
  if (x.slot != null && ![0, 1, 2, 3, 4].includes(x.slot)) delete x.slot;
  if (typeof x.ex !== 'string' || !SAFE_ID_RE.test(x.ex)) x.ex = 'unknown';
}

/* one round entry of an in-progress lift session: true when every field that
   reaches the markup has the shape the app wrote */
function okEntry(en, exercises) {
  const num = (v) => typeof v === 'number' && isFinite(v);
  if (!en || typeof en !== 'object' || typeof en.ex !== 'string' || !exercises[en.ex]) return false;
  if (!num(en.amount) || !num(en.weight)) return false;
  if (en.count != null && en.count !== 1 && en.count !== 2) return false;
  if (en.v39) {
    if (![0, 1, 2, 3, 4].includes(en.slot) || !num(en.pct)) return false;
    if (!Array.isArray(en.reps) || en.reps.length !== 2 || !num(en.reps[0]) || !num(en.reps[1])) return false;
    if (!['', 'Warm-up', 'Top set', 'Back-off', 'Primer', 'Fast'].includes(en.role)) return false;
    return true;
  }
  if (en.ladder != null && !num(en.ladder)) return false;
  if (en.ladderLabel != null && !/^[0-9·]*$/.test(String(en.ladderLabel))) return false;
  if (en.sugg && !(num(en.sugg.from) && num(en.sugg.add) && /^[0-9·+-]*$/.test(String(en.sugg.bucket || '')))) return false;
  return true;
}

function localDate(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return normalizeState(migrate(JSON.parse(raw)));
  } catch (e) {
    console.error('loadState failed', e);
    // keep the corrupt blob around for manual rescue instead of silently losing it
    try { localStorage.setItem(STORE_KEY + '.corrupt', localStorage.getItem(STORE_KEY) || ''); } catch (e2) { /* full */ }
    return null;
  }
}

function saveState(state) {
  state.version = STORE_VERSION;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
    if (!storageWarned) {
      storageWarned = true;
      alert('Could not save — device storage may be full. Export a backup from Settings as soon as possible.');
    }
  }
}

function migrate(state) {
  if (!state.version) state.version = 1;
  // v1 -> v2: week restructured to 2x legs, 2x upper, 1x sprint, 1x mixed, 1x rest;
  // Zone 2 moved out of the schedule into weekly checkmarks.
  if (state.version < 2) {
    (state.journeys || []).forEach((j) => {
      j.weekPlan = ['LEGS1', 'UPPER1', 'SPRINT', 'LEGS2', 'UPPER2', 'MIXED1', 'REST'];
    });
    state.zone2Checks = {};
    // an in-progress v1 session doesn't map onto the new phase machine — drop it
    state.current = null;
    state.version = 2;
  }
  // v2 -> v3: Mixed and Sprint swap default positions (Mixed mid-week, Sprint day 6)
  if (state.version < 3) {
    (state.journeys || []).forEach((j) => {
      if (!Array.isArray(j.weekPlan)) return;
      const si = j.weekPlan.indexOf('SPRINT');
      const mi = j.weekPlan.indexOf('MIXED1');
      if (si >= 0 && mi >= 0) {
        j.weekPlan[si] = 'MIXED1';
        j.weekPlan[mi] = 'SPRINT';
      }
    });
    state.version = 3;
  }
  // v3 -> v4: travel-mode library release (seed merge now happens on every
  // load in normalizeState; nothing version-specific left to do)
  if (state.version < 4) {
    state.version = 4;
  }
  // v4 -> v5: exercise library upgrade (spine-sparing variants).
  // Days still matching the old seed get the v5 seed wholesale (FROZEN
  // snapshot — never the live seed, so this step stays reproducible);
  // customized days only have deleted exercises replaced.
  if (state.version < 5) {
    const DELETED = { db_front_squat: 'trap_bar_deadlift', russian_twist: 'dead_bug' };
    const OLD_BLOCKS = {
      early: {
        LEGS1:  ['box_squat', 'reverse_lunge', 'hip_thrust', 'box_step_up', 'band_lateral_walk'],
        UPPER1: ['pull_up', 'db_bench_press', 'overhead_press', 'bent_over_row', 'ab_rollout'],
        MIXED1: ['box_jump', 'kb_swing', 'thruster', 'plank_to_pike', 'farmers_carry'],
        LEGS2:  ['goblet_squat', 'bulgarian_split_squat', 'romanian_deadlift', 'calf_raise', 'wall_sit'],
        UPPER2: ['incline_db_press', 'lat_pulldown', 'dips', 'shoulder_matrix', 'face_pull'],
        MIXED2: ['burpee', 'walking_lunge', 'renegade_row', 'med_ball_slam', 'mountain_climbers'],
      },
      late: {
        LEGS1:  ['paused_box_squat', 'deficit_reverse_lunge', 'single_leg_hip_thrust', 'lateral_box_step', 'band_matrix'],
        UPPER1: ['weighted_pull_up', 'bench_press', 'arnold_press', 'single_arm_row', 'hanging_knee_raise'],
        MIXED1: ['broad_jump', 'kb_clean_press', 'db_snatch', 'v_up', 'suitcase_carry'],
        LEGS2:  ['db_front_squat', 'lateral_lunge', 'single_leg_rdl', 'jump_squat', 'wall_sit'],
        UPPER2: ['weighted_dip', 'chin_up', 'cable_chest_fly', 'lateral_raise', 'pallof_press'],
        MIXED2: ['devil_press', 'box_jump_over', 'sprawl', 'russian_twist', 'bear_crawl'],
      },
    };
    const NEW_BLOCKS_V5 = {
      early: {
        LEGS1:  ['box_squat', 'reverse_lunge', 'hip_thrust', 'box_step_up', 'band_lateral_walk'],
        UPPER1: ['pull_up', 'db_bench_press', 'overhead_press', 'chest_supported_row', 'ab_rollout'],
        MIXED1: ['box_jump', 'kb_swing', 'thruster', 'plank_to_pike', 'farmers_carry'],
        LEGS2:  ['trap_bar_deadlift', 'bulgarian_split_squat', 'goblet_squat', 'calf_raise', 'wall_sit'],
        UPPER2: ['incline_db_press', 'lat_pulldown', 'dips', 'shoulder_matrix', 'face_pull'],
        MIXED2: ['burpee', 'walking_lunge', 'renegade_row', 'med_ball_slam', 'mountain_climbers'],
      },
      late: {
        LEGS1:  ['paused_box_squat', 'deficit_reverse_lunge', 'single_leg_hip_thrust', 'lateral_box_step', 'band_matrix'],
        UPPER1: ['weighted_pull_up', 'bench_press', 'arnold_press', 'single_arm_row', 'hanging_knee_raise'],
        MIXED1: ['broad_jump', 'kb_clean_press', 'db_snatch', 'mcgill_curl_up', 'suitcase_carry'],
        LEGS2:  ['trap_bar_deadlift', 'lateral_lunge', 'single_leg_rdl', 'jump_squat', 'wall_sit'],
        UPPER2: ['weighted_dip', 'chin_up', 'cable_chest_fly', 'lateral_raise', 'pallof_press'],
        MIXED2: ['devil_press', 'box_jump_over', 'sprawl', 'dead_bug', 'bear_crawl'],
      },
    };
    (state.journeys || []).forEach((j) => {
      if (!j.blocks) return;
      ['early', 'late'].forEach((b) => {
        Object.keys(j.blocks[b] || {}).forEach((day) => {
          const cur = j.blocks[b][day];
          if (!Array.isArray(cur)) return;
          const old = OLD_BLOCKS[b] && OLD_BLOCKS[b][day];
          const neu = NEW_BLOCKS_V5[b] && NEW_BLOCKS_V5[b][day];
          if (old && neu && JSON.stringify(cur) === JSON.stringify(old)) {
            j.blocks[b][day] = neu.slice();
          } else {
            j.blocks[b][day] = cur.map((id) => DELETED[id] || id);
          }
        });
      });
    });
    if (state.exercises) {
      delete state.exercises.db_front_squat;
      delete state.exercises.russian_twist;
    }
    state.version = 5;
  }
  // v5 -> v6: no medicine ball in the kit — drop the slam
  if (state.version < 6) {
    (state.journeys || []).forEach((j) => {
      if (!j.blocks) return;
      ['early', 'late'].forEach((b) => {
        Object.keys(j.blocks[b] || {}).forEach((day) => {
          if (Array.isArray(j.blocks[b][day])) {
            j.blocks[b][day] = j.blocks[b][day].map((id) => (id === 'med_ball_slam' ? 'db_snatch' : id));
          }
        });
      });
    });
    if (state.exercises) delete state.exercises.med_ball_slam;
    state.version = 6;
  }
  // v6 -> v7: Big Three tracking (seed field refresh now happens on every
  // load in normalizeState)
  if (state.version < 7) {
    state.bigThree = {};
    state.version = 7;
  }
  // v7 -> v8: leg days re-themed hinge-led (LEGS1) / squat-led (LEGS2).
  // Frozen snapshots: days still matching the v7 seed get the v8 seed;
  // customized days stay untouched.
  if (state.version < 8) {
    const OLD_V7 = {
      early: {
        LEGS1: ['box_squat', 'reverse_lunge', 'hip_thrust', 'box_step_up', 'band_lateral_walk'],
        LEGS2: ['trap_bar_deadlift', 'bulgarian_split_squat', 'goblet_squat', 'calf_raise', 'wall_sit'],
      },
      late: {
        LEGS1: ['paused_box_squat', 'deficit_reverse_lunge', 'single_leg_hip_thrust', 'lateral_box_step', 'band_matrix'],
        LEGS2: ['trap_bar_deadlift', 'lateral_lunge', 'single_leg_rdl', 'jump_squat', 'wall_sit'],
      },
    };
    const NEW_V8 = {
      early: {
        LEGS1: ['trap_bar_deadlift', 'box_squat', 'slider_leg_curl', 'farmers_carry', 'band_lateral_walk'],
        LEGS2: ['box_squat', 'reverse_lunge', 'slider_leg_curl', 'seated_calf_raise', 'lateral_lunge'],
      },
      late: {
        LEGS1: ['trap_bar_deadlift', 'box_squat', 'romanian_deadlift', 'slider_leg_curl', 'farmers_carry'],
        LEGS2: ['paused_box_squat', 'bulgarian_split_squat', 'single_leg_rdl', 'seated_calf_raise', 'lateral_lunge'],
      },
    };
    (state.journeys || []).forEach((j) => {
      if (!j.blocks) return;
      ['early', 'late'].forEach((b) => {
        ['LEGS1', 'LEGS2'].forEach((day) => {
          const cur = (j.blocks[b] || {})[day];
          if (!Array.isArray(cur)) return;
          if (JSON.stringify(cur) === JSON.stringify(OLD_V7[b][day])) {
            j.blocks[b][day] = NEW_V8[b][day].slice();
          }
        });
      });
    });
    state.version = 8;
  }
  // v8 -> v9: leg days flipped (LEGS1 squat-led on day 1, LEGS2 hinge-led)
  // and hip thrust restored to the hinge day. Frozen snapshots as always.
  if (state.version < 9) {
    const OLD_V8 = {
      early: {
        LEGS1: ['trap_bar_deadlift', 'box_squat', 'slider_leg_curl', 'farmers_carry', 'band_lateral_walk'],
        LEGS2: ['box_squat', 'reverse_lunge', 'slider_leg_curl', 'seated_calf_raise', 'lateral_lunge'],
      },
      late: {
        LEGS1: ['trap_bar_deadlift', 'box_squat', 'romanian_deadlift', 'slider_leg_curl', 'farmers_carry'],
        LEGS2: ['paused_box_squat', 'bulgarian_split_squat', 'single_leg_rdl', 'seated_calf_raise', 'lateral_lunge'],
      },
    };
    const NEW_V9 = {
      early: {
        LEGS1: ['box_squat', 'reverse_lunge', 'slider_leg_curl', 'seated_calf_raise', 'lateral_lunge'],
        LEGS2: ['trap_bar_deadlift', 'box_squat', 'slider_leg_curl', 'hip_thrust', 'farmers_carry'],
      },
      late: {
        LEGS1: ['paused_box_squat', 'bulgarian_split_squat', 'single_leg_rdl', 'seated_calf_raise', 'lateral_lunge'],
        LEGS2: ['trap_bar_deadlift', 'box_squat', 'romanian_deadlift', 'slider_leg_curl', 'hip_thrust'],
      },
    };
    (state.journeys || []).forEach((j) => {
      if (!j.blocks) return;
      ['early', 'late'].forEach((b) => {
        ['LEGS1', 'LEGS2'].forEach((day) => {
          const cur = (j.blocks[b] || {})[day];
          if (!Array.isArray(cur)) return;
          if (JSON.stringify(cur) === JSON.stringify(OLD_V8[b][day])) {
            j.blocks[b][day] = NEW_V9[b][day].slice();
          }
        });
      });
    });
    state.version = 9;
  }

  // v9 -> v10: no cable machine in the kit — cable chest fly and lat pulldown
  // leave the library; their slots get the DB fly / chin-up equivalents.
  // Same pattern as the v6 med-ball removal: remap ids in ALL journey blocks
  // (customized days keep their customization, only the dead id is swapped),
  // delete from the exercise map, leave session history untouched.
  if (state.version === 9) {
    const SWAP = { cable_chest_fly: 'incline_db_fly', lat_pulldown: 'chin_up' };
    (state.journeys || []).forEach((j) => {
      if (!j.blocks) return;
      ['early', 'late'].forEach((b) => {
        if (!j.blocks[b]) return;
        Object.keys(j.blocks[b]).forEach((day) => {
          if (!Array.isArray(j.blocks[b][day])) return;
          j.blocks[b][day] = j.blocks[b][day].map((id) => SWAP[id] || id);
        });
      });
    });
    if (state.exercises) {
      delete state.exercises.cable_chest_fly;
      delete state.exercises.lat_pulldown;
    }
    state.version = 10;
  }

  // v10 -> v11: Journey 2. One data repair: db_bench_press was logged per
  // hand and then, in the same session, as the pair total. The progression
  // engine compares kg literally, so those rows halve back to per-hand.
  // Windowed to the sessions where it happened so a genuine heavy dumbbell is
  // never touched. Everything else in v11 is additive (per-interval sprint
  // memory, bodyweight log, journey scoreboard) and is filled in by
  // normalizeState.
  if (state.version === 10) {
    const lo = new Date('2026-08-10T00:00:00').getTime();
    const hi = new Date('2026-08-21T00:00:00').getTime();
    (state.sessions || []).forEach((s) => {
      if (!(s.ts >= lo && s.ts < hi) || s.travel) return;
      (s.sets || []).forEach((x) => {
        if (x.ex === 'db_bench_press' && x.weight >= 45) x.weight = x.weight / 2;
      });
    });
    state.version = 11;
  }

  // v11 -> v12: Journey 3 (Oct 2026). Additive only: equipment profiles, the
  // sprint lead-in, one work weight per lift, test results, and the 'light'
  // missed kind (a whitelist entry in normalizeState). No session is rewritten.
  if (state.version === 11) {
    if (!state.settings || typeof state.settings !== 'object') state.settings = {};
    if (!state.settings.equipment) state.settings.equipment = defaultEquipment();
    if (state.settings.sprintLeadIn == null) state.settings.sprintLeadIn = 3;
    if (!state.work) state.work = {};
    if (!state.tests) state.tests = [];
    state.version = 12;
  }
  return state;
}

/* Make any loaded/imported state safe to run against: fill missing fields,
   drop dangling references, clamp bad values. Never throws. */
function normalizeState(state) {
  if (!state || typeof state !== 'object') return null;

  const defaults = { cardioMinutes: 2, fontScale: 1, weightStep: 2.5, travelMode: false, sprintLeadIn: 3 };
  state.settings = Object.assign({}, defaults, (state.settings && typeof state.settings === 'object') ? state.settings : {});
  if (![2, 3].includes(state.settings.cardioMinutes)) state.settings.cardioMinutes = 2;
  if (!(state.settings.fontScale >= 0.8 && state.settings.fontScale <= 1.6)) state.settings.fontScale = 1;
  if (![1.25, 2.5, 5].includes(state.settings.weightStep)) state.settings.weightStep = 2.5;
  state.settings.travelMode = !!state.settings.travelMode;
  if (!(state.settings.sprintLeadIn >= 0 && state.settings.sprintLeadIn <= 10)) state.settings.sprintLeadIn = 3;
  state.settings.sprintLeadIn = Math.round(state.settings.sprintLeadIn);
  state.settings.equipment = cleanEquipment(state.settings.equipment);

  if (!state.exercises || typeof state.exercises !== 'object') state.exercises = {};
  if (!Array.isArray(state.journeys)) state.journeys = [];
  if (!Array.isArray(state.sessions)) state.sessions = [];
  if (!state.zone2Checks || typeof state.zone2Checks !== 'object') state.zone2Checks = {};
  if (!state.bigThree || typeof state.bigThree !== 'object') state.bigThree = {};

  // ids get interpolated into HTML attributes — drop anything unsafe
  // (only reachable via imported or hand-edited state)
  Object.keys(state.exercises).forEach((k) => {
    if (!SAFE_ID_RE.test(k)) delete state.exercises[k];
  });

  // seed sync on every load: merge missing seed exercises and refresh
  // seed-owned fields (name/cue/desc/pattern/measure/group); bucket is
  // user-owned and never touched. Runs outside migrations so seed-only
  // releases reach existing installs without a version bump.
  if (typeof SEED_EXERCISES !== 'undefined') {
    SEED_EXERCISES.forEach((e) => {
      const cur = state.exercises[e.id];
      if (!cur) { state.exercises[e.id] = Object.assign({}, e); return; }
      cur.name = e.name; cur.group = e.group; cur.measure = e.measure;
      cur.pattern = e.pattern; cur.cue = e.cue; cur.desc = e.desc;
      cur.travel = e.travel || false;
      cur.loadable = e.loadable || false;
      cur.snack = e.snack || false;
      cur.barbell = e.barbell || false;
      cur.speed = e.speed || false;
      // v39: implement drives the weight control, the rest drive the prescription
      cur.implement = e.implement || 'bodyweight';
      delete cur.unilateralLoad;   // v39 only; mixed pairs are gone
      delete cur.powerCap;
      ['power', 'scheme', 'range', 'backoffReps'].forEach((f) => {
        if (e[f] != null) cur[f] = e[f]; else delete cur[f];
      });
    });
  }
  // v39 exercise fields are rendered and computed with: keep only well-formed ones
  Object.keys(state.exercises).forEach((id) => {
    const e = state.exercises[id];
    if (!e || typeof e !== 'object') { delete state.exercises[id]; return; }
    const num = (v) => typeof v === 'number' && isFinite(v);
    if (e.range != null && !(Array.isArray(e.range) && e.range.length === 2 && num(e.range[0]) && num(e.range[1]))) delete e.range;
    if (e.backoffReps != null && !num(e.backoffReps)) delete e.backoffReps;
    if (e.scheme != null && !['topset', 'power'].includes(e.scheme)) delete e.scheme;
    if (e.implement != null && !['barbell', 'trap_bar', 'dumbbell', 'kettlebell', 'band', 'bodyweight'].includes(e.implement)) delete e.implement;
  });
  // v39 additive state: one work weight per lift (changed by hand only; the
  // automatic suggestions of v39/v40 are gone and any stored one is dropped),
  // test results, circuit dose memory
  if (!state.work || typeof state.work !== 'object' || Array.isArray(state.work)) state.work = {};
  Object.keys(state.work).forEach((id) => {
    const w = state.work[id];
    if (!state.exercises[id] || !w || typeof w !== 'object' || typeof w.weight !== 'number'
      || !(isFinite(w.weight) && w.weight >= 0 && w.weight <= 500)) { delete state.work[id]; return; }
    const out = { weight: w.weight };
    if (w.count === 1 || w.count === 2) out.count = w.count;
    state.work[id] = out;
  });
  if (!Array.isArray(state.tests)) state.tests = [];
  state.tests = state.tests.filter((t) => t && isFinite(t.ts) && t.kind === 'cooper12'
    && isFinite(t.meters) && t.meters > 0 && t.meters <= 6000).slice(-100)
    .map((t) => ({ ts: t.ts, kind: 'cooper12', meters: Math.round(t.meters) }));
  if (!state.circuitDose || typeof state.circuitDose !== 'object' || Array.isArray(state.circuitDose)) state.circuitDose = {};
  Object.keys(state.circuitDose).forEach((id) => {
    const d = state.circuitDose[id];
    if (!state.exercises[id] || !d || typeof d !== 'object') { delete state.circuitDose[id]; return; }
    const out = {};
    if (isFinite(d.amount) && d.amount > 0 && d.amount <= 999) out.amount = Number(d.amount);
    if (isFinite(d.load) && d.load >= 0 && d.load <= 500) out.load = Number(d.load);
    state.circuitDose[id] = out;
  });
  // v11 additive state: per-interval sprint memory, weekly bodyweight log
  if (!Array.isArray(state.lastSprintRounds)) state.lastSprintRounds = [];
  state.lastSprintRounds = state.lastSprintRounds.slice(0, 8).map((r) => ({
    slope: (r && isFinite(r.slope)) ? Math.min(15, Math.max(0, r.slope)) : 0,
    speed: (r && isFinite(r.speed)) ? Math.min(30, Math.max(0, r.speed)) : 12,
  }));
  if (!state.bodyweight || typeof state.bodyweight !== 'object' || Array.isArray(state.bodyweight)) state.bodyweight = {};
  Object.keys(state.bodyweight).forEach((k) => {
    const n = parseFloat(state.bodyweight[k]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isFinite(n) || n < 30 || n > 250) delete state.bodyweight[k];
    else state.bodyweight[k] = n;
  });
  // snack-session memory is user-owned free input: clamp numbers, cap the text
  // (it is rendered back into markup)
  Object.keys(state.exercises).forEach((id) => {
    const e = state.exercises[id];
    ['snackRounds', 'snackReps', 'snackKg'].forEach((f) => {
      if (e[f] == null) return;
      const n = parseFloat(e[f]);
      if (!isFinite(n) || n < 0) { delete e[f]; return; }
      e[f] = Math.min(n, f === 'snackKg' ? 500 : (f === 'snackRounds' ? 20 : 999));
    });
    if (e.snackBand != null) e.snackBand = String(e.snackBand).slice(0, 24);
  });
  // missed-day marks: '<journeyId>:<week>:<dayIndex>' -> 'sick' | 'blocked' | 'light'
  if (!state.missed || typeof state.missed !== 'object' || Array.isArray(state.missed)) state.missed = {};
  Object.keys(state.missed).forEach((k) => {
    if (!/^[a-zA-Z0-9_-]+:\d+:\d+$/.test(k) || !['sick', 'blocked', 'light'].includes(state.missed[k])) {
      delete state.missed[k];
    }
  });

  // v24 rename: 'Run / Sprints' cardio modality became 'Treadmill'
  if (state.lastModality === 'Run / Sprints') state.lastModality = 'Treadmill';
  if (state.current && state.current.lastModality === 'Run / Sprints') state.current.lastModality = 'Treadmill';

  // bucket is user-owned but must be one of the known bucket strings: it is
  // interpolated into HTML and parsed by bucketFloor/bucketTop, so an imported
  // backup with a mangled bucket gets reset (seed value, else the compound default)
  if (typeof BUCKETS !== 'undefined') {
    const seedBucket = {};
    if (typeof SEED_EXERCISES !== 'undefined') SEED_EXERCISES.forEach((e) => { seedBucket[e.id] = e.bucket; });
    Object.keys(state.exercises).forEach((id) => {
      const cur = state.exercises[id];
      if (cur.bucket != null && !BUCKETS.includes(cur.bucket)) {
        cur.bucket = seedBucket[id] || '9-12';
      }
    });
  }

  state.journeys = state.journeys.filter((j) => j && j.id && j.blocks && Array.isArray(j.weekPlan) && j.weekPlan.length === 7);
  state.journeys.forEach((j) => {
    if (!(j.weekCount >= 1 && j.weekCount <= 12)) j.weekCount = 6;
    // a v39 journey trains seven days: Zone 2 and the Core circuit are real days
    const v39 = j.scheme === 'v39';
    if (!v39) delete j.scheme;
    // day types end up in markup and handlers: unknown ones become a rest day
    if (typeof DAY_TYPES !== 'undefined') j.weekPlan = j.weekPlan.map((t) => (Object.prototype.hasOwnProperty.call(DAY_TYPES, t) ? t : 'REST'));
    if (!v39 && !j.weekPlan.includes('REST')) j.weekPlan[6] = 'REST';
    // scoreboard: the lifts a journey is read on (optional). Journey 2 rows
    // carry a target top set; v39 rows are just the lift, start → current.
    if (!Array.isArray(j.scoreboard)) j.scoreboard = [];
    j.scoreboard = j.scoreboard.filter((it) => it && typeof it.ex === 'string' && SAFE_ID_RE.test(it.ex)
      && (v39 || (isFinite(it.target) && it.target > 0 && isFinite(it.reps) && it.reps > 0))).slice(0, 6);
    ['early', 'late'].forEach((b) => {
      if (!j.blocks[b] || typeof j.blocks[b] !== 'object') j.blocks[b] = {};
      j.weekPlan.forEach((t) => {
        if (['ZONE2', 'REST', 'SPRINT'].includes(t) || (v39 && t === 'CORE')) return;
        if (!Array.isArray(j.blocks[b][t])) j.blocks[b][t] = [];
        j.blocks[b][t] = j.blocks[b][t].slice(0, 5);
      });
    });
  });

  if (!state.journeys.find((j) => j.id === state.activeJourneyId)) {
    state.activeJourneyId = state.journeys.length ? state.journeys[0].id : null;
  }

  state.sessions = state.sessions.filter((s) => s && s.id && SAFE_ID_RE.test(String(s.id)) && s.dayType);
  // v39 set field: count (1 or 2 dumbbells of the same weight). Sets logged
  // before v39 do not carry it and are left exactly as they are.
  state.sessions.forEach((s) => {
    if (Array.isArray(s.sets)) s.sets.forEach(cleanSet);
    numField(s, 'week', 1, 12, 1);
    numField(s, 'dayIndex', 0, 6, 0);
    numField(s, 'ts', 0, 1e14, 0);
    numField(s.zone2, 'minutes', 0, 1000, 0); numField(s.zone2, 'hr', 0, 250, null);
    numField(s.light, 'minutes', 0, 1000, 0);
    numField(s.circuit, 'minutes', 0, 1000, 0);
    if (s.sprint && typeof s.sprint === 'object') {
      numField(s.sprint, 'intervals', 0, 100, 0); numField(s.sprint, 'minutes', 0, 1000, 0);
      numField(s.sprint.test, 'meters', 0, 6000, 0);
      if (Array.isArray(s.sprint.sprints)) s.sprint.sprints.forEach((x) => { ['secs', 'speed', 'slope'].forEach((k) => numField(x, k, 0, 1000, 0)); });
    }
  });

  // bigThree keys: only the last 7 days are ever read — prune beyond 30
  const cutoff = Date.now() - 30 * 86400000;
  Object.keys(state.bigThree).forEach((k) => {
    const t = new Date(k + 'T12:00:00').getTime();
    if (!(t > cutoff)) delete state.bigThree[k];
  });

  // a stored in-progress session must reference a live journey and have sane
  // shape; a lift session must carry its frozen slot list, or a resumed
  // session would silently log empty rounds
  let c = state.current;
  const cj = c && c.journeyId ? state.journeys.find((j) => j.id === c.journeyId) : null;
  // v39 removed the readiness and effort questions. A session caught in
  // readiness starts lifting with the day's default slots; one caught in
  // effort had finished its last round, so it is saved.
  if (c && cj && c.phase === 'readiness') {
    const blk = cj.blocks[c.week <= 3 ? 'early' : 'late'] || {};
    let slots = (blk[c.dayType] || []).filter(Boolean).slice(0, 5);
    if (state.settings.travelMode) {
      if (typeof TRAVEL_SUBS !== 'undefined') slots = slots.map((id) => (TRAVEL_SUBS[id] && state.exercises[TRAVEL_SUBS[id]] ? TRAVEL_SUBS[id] : id));
      c.travel = true;
    }
    c.slots = slots;
    c.phase = 'lift';
    c.roundEntries = null;
  }
  if (c && cj && c.phase === 'effort' && Array.isArray(c.sets)) {
    state.sessions.push({
      id: 's' + Date.now() + '-' + state.sessions.length, ts: Date.now(),
      journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: c.dayType,
      readiness: c.readiness || null, effort: null, travel: c.travel || false,
      sets: c.sets, cardio: Array.isArray(c.cardio) ? c.cardio : [],
    });
    c = state.current = null;
  }
  if (c) {
    const shapes = {
      sprint: () => Array.isArray(c.sprints) && c.sprints.length <= 8,
      zone2: () => true,
      light: () => true,
      circuit: () => Array.isArray(c.log) && Array.isArray(c.blocks) && c.blocks.length > 0
        && c.bi >= 0 && c.bi < c.blocks.length && c.round >= 1 && c.round <= 9,
      lift: () => c.round >= 1 && c.round <= 5 && Array.isArray(c.sets) && Array.isArray(c.cardio)
        && Array.isArray(c.slots) && c.slots.length > 0,
    };
    shapes.cardio = shapes.lift;
    const okShape = cj && c.week >= 1 && c.dayIndex >= 0 && c.dayIndex <= 6
      && Object.prototype.hasOwnProperty.call(shapes, c.phase) && shapes[c.phase]();
    if (!okShape) state.current = null;
    else {
      if (Array.isArray(c.sets)) c.sets.forEach(cleanSet);
      // an entry list that is not exactly what the app wrote is rebuilt by initRound
      if (c.roundEntries != null && !(Array.isArray(c.roundEntries) && c.roundEntries.every((en) => okEntry(en, state.exercises)))) c.roundEntries = null;
      if (Array.isArray(c.slots)) c.slots = c.slots.filter((id) => typeof id === 'string' && SAFE_ID_RE.test(id)).slice(0, 5);
      if (c.phase === 'circuit') {
        if (!c.done || typeof c.done !== 'object') c.done = {};
        if (!c.pick || typeof c.pick !== 'object') c.pick = {};
        Object.keys(c.pick).forEach((k) => { if (typeof c.pick[k] !== 'string' || !state.exercises[c.pick[k]]) delete c.pick[k]; });
        c.log = c.log.filter((l) => l && typeof l === 'object' && typeof l.ex === 'string' && state.exercises[l.ex]);
        if (c.attach != null && !SAFE_ID_RE.test(String(c.attach))) c.attach = null;
      }
      numField(c, 'target', 1, 600, 45); numField(c, 'minutes', 0, 600, null); numField(c, 'hr', 0, 250, null);
      numField(c, 'clockStart', 0, 1e14, null); numField(c, 'cooperEnd', 0, 1e14, null);
      numField(c, 'speed', 0, 30, 12); numField(c, 'slope', 0, 15, 0); numField(c, 'meters', 0, 6000, 0);
      if (c.cardioMin != null && ![2, 3].includes(c.cardioMin)) c.cardioMin = state.settings.cardioMinutes;
      if (Array.isArray(c.sprints)) c.sprints.forEach((x) => { ['secs', 'speed', 'slope'].forEach((k) => numField(x, k, 0, 1000, 0)); });
      if (c.modality != null) c.modality = String(c.modality).replace(/[^a-zA-Z0-9 /-]/g, '').slice(0, 30);
      if (c.lastModality != null) c.lastModality = String(c.lastModality).replace(/[^a-zA-Z0-9 /-]/g, '').slice(0, 30);
      if (c.option != null && !['zone2', 'stretch'].includes(c.option)) c.option = null;
    }
  }
  if (state.lastSprint && typeof state.lastSprint === 'object') { numField(state.lastSprint, 'slope', 0, 15, 0); numField(state.lastSprint, 'speed', 0, 30, 12); }
  else delete state.lastSprint;

  return state;
}

function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `five-two-backup-${localDate()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function importJSON(file, onDone) {
  if (!file) { onDone(new Error('no file selected'), null); return; }
  const reader = new FileReader();
  reader.onerror = () => onDone(new Error('could not read file'), null);
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !parsed.exercises || !parsed.journeys) {
        throw new Error('not a five-two backup file');
      }
      if (parsed.version > STORE_VERSION) {
        throw new Error('backup was made by a newer app version');
      }
      const state = normalizeState(migrate(parsed));
      if (!state || !state.journeys.length) throw new Error('backup contains no usable journey');
      saveState(state);
      onDone(null, state);
    } catch (e) {
      onDone(e, null);
    }
  };
  reader.readAsText(file);
}
