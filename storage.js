/* storage.js — versioned localStorage persistence + export/import */

const STORE_KEY = 'fivetwo.state';
const STORE_VERSION = 1;

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return migrate(state);
  } catch (e) {
    console.error('loadState failed', e);
    return null;
  }
}

function saveState(state) {
  state.version = STORE_VERSION;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function migrate(state) {
  // future migrations bump STORE_VERSION and transform here
  if (!state.version) state.version = 1;
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
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const state = migrate(JSON.parse(reader.result));
      if (!state.exercises || !state.journeys) throw new Error('not a five-two backup');
      saveState(state);
      onDone(null, state);
    } catch (e) {
      onDone(e, null);
    }
  };
  reader.readAsText(file);
}
