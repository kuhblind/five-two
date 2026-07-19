/* storage.js — versioned localStorage persistence + normalization + export/import */

const STORE_KEY = 'fivetwo.state';
const STORE_VERSION = 9;

/* attr/url-safe id shape for anything interpolated into templates */
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

let storageWarned = false;

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
  // v4 -> v5: back-safe exercise upgrade (52y / 1.99m / protected lumbar).
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
  return state;
}

/* Make any loaded/imported state safe to run against: fill missing fields,
   drop dangling references, clamp bad values. Never throws. */
function normalizeState(state) {
  if (!state || typeof state !== 'object') return null;

  const defaults = { cardioMinutes: 2, fontScale: 1, weightStep: 2.5, travelMode: false };
  state.settings = Object.assign({}, defaults, (state.settings && typeof state.settings === 'object') ? state.settings : {});
  if (![2, 3].includes(state.settings.cardioMinutes)) state.settings.cardioMinutes = 2;
  if (!(state.settings.fontScale >= 0.8 && state.settings.fontScale <= 1.6)) state.settings.fontScale = 1;
  if (![1.25, 2.5, 5].includes(state.settings.weightStep)) state.settings.weightStep = 2.5;
  state.settings.travelMode = !!state.settings.travelMode;

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
    });
  }
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
    if (!j.weekPlan.includes('REST')) j.weekPlan[6] = 'REST';
    ['early', 'late'].forEach((b) => {
      if (!j.blocks[b] || typeof j.blocks[b] !== 'object') j.blocks[b] = {};
      j.weekPlan.forEach((t) => {
        if (['ZONE2', 'REST', 'SPRINT'].includes(t)) return;
        if (!Array.isArray(j.blocks[b][t])) j.blocks[b][t] = [];
        j.blocks[b][t] = j.blocks[b][t].slice(0, 5);
      });
    });
  });

  if (!state.journeys.find((j) => j.id === state.activeJourneyId)) {
    state.activeJourneyId = state.journeys.length ? state.journeys[0].id : null;
  }

  state.sessions = state.sessions.filter((s) => s && s.id && SAFE_ID_RE.test(String(s.id)) && s.dayType);

  // bigThree keys: only the last 7 days are ever read — prune beyond 30
  const cutoff = Date.now() - 30 * 86400000;
  Object.keys(state.bigThree).forEach((k) => {
    const t = new Date(k + 'T12:00:00').getTime();
    if (!(t > cutoff)) delete state.bigThree[k];
  });

  // a stored in-progress session must reference a live journey and have sane
  // shape; past the readiness phase it must carry its frozen slot list, or a
  // resumed session would silently log empty rounds
  const c = state.current;
  if (c) {
    const okShape = c.journeyId && state.journeys.find((j) => j.id === c.journeyId)
      && c.round >= 1 && c.round <= 5 && ['readiness', 'lift', 'cardio', 'effort'].includes(c.phase)
      && Array.isArray(c.sets) && Array.isArray(c.cardio)
      && (c.phase === 'readiness' || (Array.isArray(c.slots) && c.slots.length > 0));
    if (!okShape) state.current = null;
  }

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
