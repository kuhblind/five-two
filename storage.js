/* storage.js — versioned localStorage persistence + normalization + export/import */

const STORE_KEY = 'fivetwo.state';
const STORE_VERSION = 4;

let storageWarned = false;

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
  // v3 -> v4: travel-mode library — merge any seed exercises the stored state
  // doesn't know yet (never overwrites user-edited entries)
  if (state.version < 4) {
    if (!state.exercises || typeof state.exercises !== 'object') state.exercises = {};
    if (typeof SEED_EXERCISES !== 'undefined') {
      SEED_EXERCISES.forEach((e) => { if (!state.exercises[e.id]) state.exercises[e.id] = e; });
    }
    state.version = 4;
  }
  return state;
}

/* Make any loaded/imported state safe to run against: fill missing fields,
   drop dangling references, clamp bad values. Never throws. */
function normalizeState(state) {
  if (!state || typeof state !== 'object') return null;

  const defaults = { cardioMinutes: 2, fontScale: 1, weightStep: 2.5 };
  state.settings = Object.assign({}, defaults, (state.settings && typeof state.settings === 'object') ? state.settings : {});
  if (![2, 3].includes(state.settings.cardioMinutes)) state.settings.cardioMinutes = 2;
  if (!(state.settings.fontScale >= 0.8 && state.settings.fontScale <= 1.6)) state.settings.fontScale = 1;
  if (![1.25, 2.5, 5].includes(state.settings.weightStep)) state.settings.weightStep = 2.5;
  state.settings.travelMode = !!state.settings.travelMode;

  if (!state.exercises || typeof state.exercises !== 'object') state.exercises = {};
  if (!Array.isArray(state.journeys)) state.journeys = [];
  if (!Array.isArray(state.sessions)) state.sessions = [];
  if (!state.zone2Checks || typeof state.zone2Checks !== 'object') state.zone2Checks = {};

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

  state.sessions = state.sessions.filter((s) => s && s.id && s.dayType);

  // a stored in-progress session must reference a live journey and have sane shape
  const c = state.current;
  if (c) {
    const okShape = c.journeyId && state.journeys.find((j) => j.id === c.journeyId)
      && c.round >= 1 && c.round <= 5 && ['readiness', 'lift', 'cardio', 'effort'].includes(c.phase)
      && Array.isArray(c.sets) && Array.isArray(c.cardio);
    if (!okShape) state.current = null;
  }

  return state;
}

function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `five-two-backup-${d}.json`;
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
