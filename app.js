/* app.js — 5+2 Journeys: views, accumulator engine, cardio timer, logging */

let S = loadState() || seedState();
saveState(S);

let view = { name: 'home' };
let timer = null;       // { endTs, total, interval, finished }
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

function save() { saveState(S); }

function go(name, params) { view = Object.assign({ name }, params || {}); render(); }

function journey() { return S.journeys.find((j) => j.id === S.activeJourneyId) || null; }

function ex(id) {
  return S.exercises[id] || { id, name: String(id || 'unknown'), measure: 'reps', bucket: null, group: '?', pattern: 'hold', cue: '', desc: '' };
}

function dayType(j, dayIndex) { return j.weekPlan[dayIndex] || 'ZONE2'; }

function slotsFor(j, week, type) {
  if (!j || type === 'ZONE2') return [];
  const block = j.blocks[blockForWeek(week)] || {};
  return (block[type] || []).filter(Boolean);
}

function sessionFor(jid, week, dayIndex) {
  return S.sessions.find((s) => s.journeyId === jid && s.week === week && s.dayIndex === dayIndex);
}

function nextSlot(j) {
  for (let w = 1; w <= j.weekCount; w++) {
    for (let d = 0; d < 7; d++) {
      if (!sessionFor(j.id, w, d)) return { week: w, dayIndex: d };
    }
  }
  return null;
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

function bucketFloor(bucket) {
  if (!bucket) return 30; // secs default
  return parseInt(bucket, 10) || 10;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.4, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) { /* audio unavailable */ }
}

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

function startSession(week, dayIndex) {
  const j = journey();
  if (!j) { go('home'); return; }
  week = clampNum(week, 1, j.weekCount, 1);
  dayIndex = clampNum(dayIndex, 0, 6, 0);
  const type = dayType(j, dayIndex);

  if (S.current) {
    if (S.current.week === week && S.current.dayIndex === dayIndex) { go('workout'); return; }
    if (!confirm('A session is already in progress. Discard it and start this one?')) return;
    S.current = null;
    stopTimer();
  }
  if (sessionFor(j.id, week, dayIndex)) {
    if (!confirm('This day is already logged. Log it again?')) return;
  }
  if (type === 'ZONE2') { go('zone2', { week, dayIndex }); return; }

  const slots = slotsFor(j, week, type);
  if (!slots.length) {
    alert('This day has no exercises configured yet — add them under Program first.');
    go('program');
    return;
  }
  S.current = {
    journeyId: j.id, week, dayIndex, dayType: type,
    round: 1, phase: 'lift',
    sets: [], cardio: [],
    roundEntries: null,
    lastModality: S.lastModality || CARDIO_MODALITIES[0],
    startedTs: Date.now(),
  };
  initRound();
  save();
  requestWake();
  go('workout');
}

function initRound() {
  const c = S.current;
  const j = journey();
  const slots = slotsFor(j, c.week, c.dayType).slice(0, c.round);
  c.roundEntries = slots.map((exId) => {
    // prefill: latest set this session, else history, else bucket floor / 0 kg
    const inSession = c.sets.slice().reverse().find((s) => s.ex === exId);
    const prev = inSession || lastLogged(exId);
    const e = ex(exId);
    return {
      ex: exId,
      amount: prev ? prev.amount : bucketFloor(e.bucket),
      weight: prev ? prev.weight : 0,
      done: false,
      info: false,
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
  save(); render();
}

function setEntry(i, field, value) {
  const en = entryAt(i);
  if (!en) { render(); return; }
  const hi = field === 'weight' ? 500 : 999;
  en[field] = clampNum(value, 0, hi, en[field]);
  save(); render();
}

function toggleEntryDone(i) {
  const en = entryAt(i);
  if (!en) return;
  en.done = !en.done;
  save(); render();
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
  c.roundEntries.forEach((en) => {
    c.sets.push({ round: c.round, ex: en.ex, amount: en.amount, weight: en.weight });
  });
  c.roundEntries = null;
  c.phase = 'cardio';
  startTimer(S.settings.cardioMinutes * 60);
  save(); render();
}

function timerTick() {
  if (!timer) return;
  if (remainingSecs() <= 0 && !timer.finished) {
    timer.finished = true;
    clearInterval(timer.interval);
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    if (view.name === 'workout') render();
    return;
  }
  if (view.name === 'workout') updateClock();
}

function startTimer(totalSecs) {
  stopTimer();
  timer = { endTs: Date.now() + totalSecs * 1000, total: totalSecs, finished: false };
  timer.interval = setInterval(timerTick, 250);
}

function stopTimer() { if (timer && timer.interval) clearInterval(timer.interval); timer = null; }

function remainingSecs() { return timer ? Math.max(0, Math.ceil((timer.endTs - Date.now()) / 1000)) : 0; }

function extendTimer(secs) {
  if (!timer) return;
  timer.endTs = Math.max(Date.now(), timer.endTs + secs * 1000);
  timer.total = Math.max(0, timer.total + secs);
  if (remainingSecs() > 0) {
    timer.finished = false;
    clearInterval(timer.interval);
    timer.interval = setInterval(timerTick, 250);
  }
  render();
}

function pickModality(m) {
  if (!S.current) return;
  S.current.lastModality = m;
  S.lastModality = m;
  save(); render();
}

function finishCardio() {
  const c = S.current;
  if (!c || c.phase !== 'cardio') return;
  const total = timer ? timer.total : S.settings.cardioMinutes * 60;
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

function finishSession() {
  const c = S.current;
  S.sessions.push({
    id: 's' + Date.now(),
    ts: Date.now(),
    journeyId: c.journeyId, week: c.week, dayIndex: c.dayIndex, dayType: c.dayType,
    sets: c.sets, cardio: c.cardio,
  });
  S.current = null;
  releaseWake();
  stopTimer();
  save();
  go('summary', { sessionId: S.sessions[S.sessions.length - 1].id });
}

function abandonSession() {
  if (!confirm('Discard this session? Nothing will be saved.')) return;
  S.current = null;
  releaseWake();
  stopTimer();
  save();
  go('home');
}

function saveZone2(week, dayIndex, modality, minutes) {
  const j = journey();
  if (!j) { go('home'); return; }
  S.sessions.push({
    id: 's' + Date.now(), ts: Date.now(),
    journeyId: j.id, week, dayIndex, dayType: 'ZONE2',
    zone2: { modality, minutes: clampNum(minutes, 5, 600, 60) },
  });
  save();
  go('home');
}

function deleteSession(id) {
  if (!confirm('Delete this session from the journal?')) return;
  S.sessions = S.sessions.filter((s) => s.id !== id);
  save();
  go('journal');
}

/* ---------- views ---------- */

function render() {
  try {
    document.documentElement.style.setProperty('--font-scale', S.settings.fontScale);
    const views = {
      home: vHome, workout: vWorkout, zone2: vZone2, summary: vSummary,
      journal: vJournal, session: vSession, progress: vProgress,
      program: vProgram, settings: vSettings,
    };
    $app.innerHTML = (views[view.name] || vHome)() + navBar();
  } catch (e) {
    console.error('render failed', e);
    $app.innerHTML = `<div class="card mt">
      <h3>Something went wrong</h3>
      <p class="muted small">${esc(e.message)}</p>
      <button class="btn-primary mt" onclick="view={name:'home'};render()">Back to Home</button>
      <p class="muted small mt">Your data is safe — if this keeps happening, export a backup in Settings.</p>
    </div>` + navBar();
  }
}

window.addEventListener('error', (e) => {
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

function vHome() {
  const j = journey();
  if (!j) {
    return `<h1>5+2</h1><div class="card"><h3>No journey found</h3>
      <p class="muted">Start fresh below.</p>
      <button class="btn-primary mt" onclick="resetAll()">Set up new journey</button></div>`;
  }
  const next = nextSlot(j);
  let html = `<h1>5+2 <span class="muted small">· ${esc(j.name)}</span></h1>`;

  if (S.current) {
    html += `<div class="card highlight">
      <h3>Session in progress</h3>
      <p class="muted">Week ${S.current.week} · ${(DAY_TYPES[S.current.dayType] || {}).label || S.current.dayType} · Round ${S.current.round}/5</p>
      <button class="btn-primary mt" onclick="go('workout')">Resume</button>
      <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard</button>
    </div>`;
  } else if (next) {
    const type = dayType(j, next.dayIndex);
    const slots = slotsFor(j, next.week, type);
    html += `<div class="card highlight">
      <div class="row spread"><h3>Next up</h3>${dayBadge(type)}</div>
      <p class="big">Week ${next.week} · Day ${next.dayIndex + 1}</p>
      ${type === 'ZONE2'
        ? '<p class="muted">Zone 2 — ~60 min easy pace</p>'
        : `<p class="muted small">${slots.map((id, i) => `${'ABCDE'[i]} ${esc(ex(id).name)}`).join(' · ')}</p>`}
      <button class="btn-primary mt" onclick="startSession(${next.week}, ${next.dayIndex})">Start</button>
    </div>`;
  } else {
    html += `<div class="card highlight"><h3>Journey complete</h3>
      <p class="muted">All ${j.weekCount} weeks done. Start a new journey in Settings.</p></div>`;
  }

  // week grids
  html += '<h2>Journey</h2>';
  for (let w = 1; w <= j.weekCount; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const done = !!sessionFor(j.id, w, d);
      const isNext = next && next.week === w && next.dayIndex === d;
      const t = DAY_TYPES[dayType(j, d)] || { label: '?' };
      days.push(`<div class="day ${done ? 'done' : ''} ${isNext ? 'next' : ''}" onclick="startSession(${w},${d})">
        <span class="n">${d + 1}</span><span>${t.label.replace(' ', '')}</span></div>`);
    }
    html += `<div class="muted small">Week ${w}</div><div class="week-grid">${days.join('')}</div>`;
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

function vWorkout() {
  const c = S.current;
  if (!c) return vHome();
  const title = `W${c.week} · ${(DAY_TYPES[c.dayType] || {}).label || c.dayType}`;
  const dots = [1, 2, 3, 4, 5].map((r) =>
    `<div class="dot ${r < c.round ? 'done' : ''} ${r === c.round ? 'now' : ''}"></div>`).join('');

  if (c.phase === 'lift') {
    if (!Array.isArray(c.roundEntries)) { initRound(); save(); }
    const blocks = c.roundEntries.map((en, i) => {
      const e = ex(en.ex);
      const isReps = e.measure === 'reps';
      return `<div class="card exercise-block ${en.done ? 'done-block' : ''}">
        <div class="row spread">
          <div class="row exhead">
            <span class="pattern-ico">${patternIcon(e.pattern, 34)}</span>
            <div>
              <div class="exname">${'ABCDE'[i]} · ${esc(e.name)}</div>
              <div class="target">${e.bucket ? 'target ' + e.bucket + ' reps' : 'time-based'}</div>
            </div>
          </div>
          <div class="row" style="gap:0.4rem">
            <button class="btn-small btn-ghost" onclick="toggleEntryInfo(${i})" aria-label="how to do this exercise">?</button>
            <button class="btn-small ${en.done ? '' : 'btn-ghost'}" onclick="toggleEntryDone(${i})" aria-label="mark done">✓</button>
          </div>
        </div>
        ${en.info ? `<p class="muted small how-to">${esc(e.desc || e.cue || 'No description yet.')}</p>` : ''}
        <div class="set-row">
          ${stepperHTML(i, 'amount', en.amount, isReps ? 'reps' : 'secs', isReps ? -1 : -5, isReps ? 1 : 5)}
          ${stepperHTML(i, 'weight', en.weight, 'kg', -S.settings.weightStep, S.settings.weightStep)}
        </div>
      </div>`;
    }).join('');

    return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button><span class="title">${title}</span>
        <span class="muted">Round ${c.round}/5</span></div>
      <div class="progress-dots">${dots}</div>
      ${blocks}
      <button class="btn-primary" onclick="commitRound()">Log round → Cardio</button>
      <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard session</button>`;
  }

  // cardio phase
  const noTimer = !timer;
  const secs = remainingSecs();
  const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
  const finished = timer && timer.finished;
  return `<div class="topbar"><span class="title">${title}</span><span class="muted">Cardio ${c.round}/5</span></div>
    <div class="progress-dots">${dots}</div>
    <div class="modality-grid">${CARDIO_MODALITIES.map((m) =>
      `<button class="${c.lastModality === m ? 'sel' : ''}" onclick="pickModality('${m}')">${m}</button>`).join('')}</div>
    <div class="timer-wrap">
      ${noTimer
        ? `<div class="timer-clock">${S.settings.cardioMinutes}:00</div>
           <button class="btn-big" onclick="startTimer(S.settings.cardioMinutes * 60); render()">Start timer</button>`
        : `<div class="timer-clock ${finished ? 'done' : ''}" id="clock">${finished ? 'DONE' : mm + ':' + ss}</div>
           <div class="row" style="justify-content:center">
             <button onclick="extendTimer(60)">+1 min</button>
             <button onclick="extendTimer(-30)">−30 s</button>
           </div>`}
    </div>
    <button class="btn-primary" onclick="finishCardio()">${c.round >= 5 ? 'Finish session' : 'Next round →'}</button>`;
}

function updateClock() {
  const el = document.getElementById('clock');
  if (!el || !timer) return;
  const secs = remainingSecs();
  if (timer.finished) { el.textContent = 'DONE'; el.classList.add('done'); return; }
  el.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
}

function vZone2() {
  const w = view.week, d = view.dayIndex;
  if (!view.z2mod) view.z2mod = S.lastZ2Mod || 'Bike';
  if (!view.z2min) view.z2min = 60;
  return `<div class="topbar"><button onclick="go('home')" aria-label="back">←</button><span class="title">Zone 2 · Week ${w}</span></div>
    <div class="card">
      <h3>Modality</h3>
      <div class="modality-grid">${ZONE2_MODALITIES.map((m) =>
        `<button class="${view.z2mod === m ? 'sel' : ''}" onclick="view.z2mod='${m}';render()">${m}</button>`).join('')}</div>
      <h3 class="mt">Duration</h3>
      <div class="row" style="justify-content:center" >
        <div class="stepper">
          <button onclick="view.z2min=Math.max(10,view.z2min-5);render()" aria-label="less minutes">−</button>
          <input class="val" inputmode="numeric" value="${view.z2min}" onchange="view.z2min=Math.round(clampNum(this.value,5,600,60));render()" aria-label="minutes">
          <button onclick="view.z2min=Math.min(600,view.z2min+5);render()" aria-label="more minutes">+</button>
          <span class="unit">min</span>
        </div>
      </div>
      <button class="btn-primary mt" onclick="S.lastZ2Mod=view.z2mod;saveZone2(${w},${d},view.z2mod,view.z2min)">Save Zone 2</button>
    </div>`;
}

function vSummary() {
  const s = S.sessions.find((x) => x.id === view.sessionId);
  if (!s) return vHome();
  return `<h1>Session done</h1>
    <div class="card">
      <div class="row spread"><h3>W${s.week} · ${(DAY_TYPES[s.dayType] || {}).label || s.dayType}</h3>${dayBadge(s.dayType)}</div>
      ${sessionDetailHTML(s)}
    </div>
    <button class="btn-primary" onclick="go('home')">Home</button>`;
}

function sessionDetailHTML(s) {
  if (s.dayType === 'ZONE2') {
    const z = s.zone2 || { modality: '?', minutes: 0 };
    return `<p class="big">${esc(z.modality)} · ${z.minutes} min</p>`;
  }
  const byEx = {};
  (s.sets || []).forEach((set) => {
    (byEx[set.ex] = byEx[set.ex] || []).push(set);
  });
  const lifts = Object.keys(byEx).map((exId) => {
    const e = ex(exId);
    const sets = byEx[exId].map((x) => `${x.amount}${e.measure === 'secs' ? 's' : ''}${x.weight ? '×' + x.weight + 'kg' : ''}`).join(', ');
    return `<div class="set-row"><span>${esc(e.name)}</span><span class="muted small">${sets}</span></div>`;
  }).join('');
  const cardio = (s.cardio || []).map((cd) =>
    `<div class="set-row"><span>Cardio ${cd.round}</span><span class="muted small">${esc(cd.modality)} · ${Math.round(cd.seconds / 60 * 10) / 10} min</span></div>`).join('');
  return lifts + cardio;
}

function vJournal() {
  const items = S.sessions.slice().reverse().map((s) =>
    `<div class="session-item" onclick="go('session', {sessionId: '${s.id}'})">
      <div><b>W${s.week} · ${(DAY_TYPES[s.dayType] || {}).label || s.dayType}</b><br><span class="muted small">${fmtDate(s.ts)}</span></div>
      ${dayBadge(s.dayType)}
    </div>`).join('');
  return `<h1>Journal</h1><div class="card">${items || '<p class="muted">No sessions yet. Your logged workouts will appear here.</p>'}</div>`;
}

function vSession() {
  const s = S.sessions.find((x) => x.id === view.sessionId);
  if (!s) return vJournal();
  return `<div class="topbar"><button onclick="go('journal')" aria-label="back">←</button><span class="title">${fmtDate(s.ts)}</span></div>
    <div class="card">
      <div class="row spread"><h3>W${s.week} · ${(DAY_TYPES[s.dayType] || {}).label || s.dayType}</h3>${dayBadge(s.dayType)}</div>
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
          maxW: Math.max(...sets.map((x) => x.weight)),
          topAmount: Math.max(...sets.map((x) => x.amount)),
        });
      }
    });
    chart = trendSVG(points) + `<p class="muted small center">max weight per session (kg) · latest: ${points.length ? points[points.length - 1].maxW + ' kg × ' + points[points.length - 1].topAmount : '—'}</p>`;
  }
  return `<h1>Progress</h1>
    <div class="card">
      ${loggedIds.length ? `<select onchange="view.exId=this.value;render()" aria-label="choose exercise">
        ${loggedIds.map((id) => `<option value="${id}" ${view.exId === id ? 'selected' : ''}>${esc(ex(id).name)}</option>`).join('')}
      </select>` : ''}
      <div class="trend mt">${chart}</div>
    </div>
    <div class="card">
      <h3>Zone 2</h3>
      ${S.sessions.filter((s) => s.dayType === 'ZONE2').slice(-6).reverse().map((s) =>
        `<div class="set-row"><span>${fmtDate(s.ts)}</span><span class="muted">${esc((s.zone2 || {}).modality || '?')} · ${(s.zone2 || {}).minutes || 0} min</span></div>`).join('') || '<p class="muted">None yet.</p>'}
    </div>`;
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

  let body = view.tab === 'library' ? programLibraryHTML() : programDaysHTML(j);

  return `<h1>Program</h1>
    <div class="row mb tabs">
      <button class="btn-small ${view.tab === 'days' ? '' : 'btn-ghost'}" onclick="view.tab='days';render()">Training days</button>
      <button class="btn-small ${view.tab === 'library' ? '' : 'btn-ghost'}" onclick="view.tab='library';render()">Exercise library</button>
    </div>
    ${body}`;
}

function programDaysHTML(j) {
  if (!view.block) view.block = 'early';
  if (!view.day || !j.blocks[view.block][view.day]) view.day = j.weekPlan.find((t) => t !== 'ZONE2') || 'LEGS1';
  const dayKeys = j.weekPlan.filter((t) => t !== 'ZONE2');
  const slots = j.blocks[view.block][view.day] || [];

  const slotRows = slots.map((exId, i) => {
    const e = ex(exId);
    return `<div class="set-row">
      <div class="row exhead">
        <span class="pattern-ico">${patternIcon(e.pattern, 30)}</span>
        <div><b>${'ABCDE'[i]}</b> · ${esc(e.name)}<br>
          <span class="muted small">${e.bucket ? 'target ' + e.bucket : 'time-based'} · ${esc(e.group)}</span></div>
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
      <h3>Swap slot ${'ABCDE'[view.editSlot]}</h3>
      <select id="swapSel">${options}</select>
      <div class="row mt">
        <button class="btn-big grow" onclick="applySwap()">Apply</button>
        <button class="btn-ghost btn-big grow" onclick="view.editSlot=null;render()">Cancel</button>
      </div>
      <p class="muted small mt">Applies from your next session. Past logs stay untouched. A/B are done most often — keep anchors there.</p>
    </div>`;
  }

  return `<div class="row wrap mb">
      <button class="btn-small ${view.block === 'early' ? '' : 'btn-ghost'}" onclick="view.block='early';view.editSlot=null;render()">Weeks 1–3</button>
      <button class="btn-small ${view.block === 'late' ? '' : 'btn-ghost'}" onclick="view.block='late';view.editSlot=null;render()">Weeks 4–6</button>
    </div>
    <div class="row wrap mb">
      ${dayKeys.map((t) => `<button class="btn-small ${view.day === t ? '' : 'btn-ghost'}"
        onclick="view.day='${t}';view.editSlot=null;render()">${(DAY_TYPES[t] || {}).label || t}</button>`).join('')}
    </div>
    ${editHTML}
    <div class="card">${slotRows || '<p class="muted">No exercises configured for this day.</p>'}</div>
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
            <span class="badge">${e.bucket ? e.bucket + ' reps' : 'seconds'}</span>
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
      <h3>New journey</h3>
      <p class="muted small">Starts a fresh 6 weeks with the current program (all swaps carried over). The old journey stays in the journal.</p>
      <button class="btn-big mt" onclick="newJourney()">Start new journey</button>
    </div>
    <div class="card">
      <h3>Backup</h3>
      <div class="row mt">
        <button class="btn-big grow" onclick="exportJSON(S)">Export JSON</button>
        <button class="btn-big grow btn-ghost" onclick="document.getElementById('importFile').click()">Import</button>
      </div>
      <input type="file" id="importFile" accept="application/json" style="display:none"
        onchange="importJSON(this.files[0], (err, st) => { if (err) alert('Import failed: ' + err.message); else { S = st; view={name:'home'}; render(); } })">
    </div>
    <div class="card">
      <h3>Danger zone</h3>
      <button class="btn-danger btn-big mt" onclick="resetAll()">Reset all data</button>
    </div>`;
}

function newJourney() {
  if (!confirm('Start a new 6-week journey?')) return;
  const j = journey();
  if (!j) { resetAll(); return; }
  const n = S.journeys.length + 1;
  const nj = {
    id: 'j' + Date.now(),
    name: 'Journey ' + n,
    startDate: new Date().toISOString().slice(0, 10),
    weekCount: 6,
    weekPlan: j.weekPlan.slice(),
    blocks: JSON.parse(JSON.stringify(j.blocks)),
  };
  S.journeys.push(nj);
  S.activeJourneyId = nj.id;
  S.current = null;
  save();
  go('home');
}

function resetAll() {
  if (!confirm('Delete ALL data — journeys, sessions, everything?')) return;
  if (!confirm('Really sure? Consider exporting a backup first.')) return;
  S = seedState();
  save();
  go('home');
}

render();
