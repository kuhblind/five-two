/* app.js — 5+2 Journeys: views, accumulator engine, cardio timer, logging */

let S = loadState() || seedState();
saveState(S);

let view = { name: 'home' };
let timer = null;       // { endTs, total, interval, finished }
let wakeLock = null;

/* ---------- helpers ---------- */

const $app = document.getElementById('app');

function save() { saveState(S); }

function go(name, params) { view = Object.assign({ name }, params || {}); render(); }

function journey() { return S.journeys.find((j) => j.id === S.activeJourneyId); }

function ex(id) { return S.exercises[id] || { id, name: id, measure: 'reps', bucket: null, group: '?' }; }

function dayType(j, dayIndex) { return j.weekPlan[dayIndex]; }

function slotsFor(j, week, type) {
  if (type === 'ZONE2') return [];
  return j.blocks[blockForWeek(week)][type] || [];
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
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

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
function releaseWake() { if (wakeLock) { wakeLock.release(); wakeLock = null; } }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.current) requestWake();
});

/* ---------- workout engine ---------- */

function startSession(week, dayIndex) {
  const j = journey();
  const type = dayType(j, dayIndex);
  if (type === 'ZONE2') { go('zone2', { week, dayIndex }); return; }
  S.current = {
    journeyId: j.id, week, dayIndex, dayType: type,
    round: 1, phase: 'lift',
    sets: [], cardio: [],
    roundEntries: null,
    lastModality: S.current && S.current.lastModality ? S.current.lastModality : (S.lastModality || CARDIO_MODALITIES[0]),
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
    };
  });
}

function adjustEntry(i, field, delta) {
  const en = S.current.roundEntries[i];
  en[field] = Math.max(0, Math.round((en[field] + delta) * 100) / 100);
  save(); render();
}

function setEntry(i, field, value) {
  const v = parseFloat(String(value).replace(',', '.'));
  if (!isNaN(v) && v >= 0) { S.current.roundEntries[i][field] = v; save(); }
  render();
}

function toggleEntryDone(i) {
  const en = S.current.roundEntries[i];
  en.done = !en.done;
  save(); render();
}

function commitRound() {
  const c = S.current;
  c.roundEntries.forEach((en) => {
    c.sets.push({ round: c.round, ex: en.ex, amount: en.amount, weight: en.weight });
  });
  c.roundEntries = null;
  c.phase = 'cardio';
  startTimer(S.settings.cardioMinutes * 60);
  save(); render();
}

function startTimer(totalSecs) {
  stopTimer();
  timer = { endTs: Date.now() + totalSecs * 1000, total: totalSecs, finished: false };
  timer.interval = setInterval(() => {
    if (remainingSecs() <= 0 && !timer.finished) {
      timer.finished = true;
      clearInterval(timer.interval);
      beep();
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    }
    if (view.name === 'workout') updateClock();
  }, 250);
}

function stopTimer() { if (timer && timer.interval) clearInterval(timer.interval); timer = null; }

function remainingSecs() { return timer ? Math.max(0, Math.ceil((timer.endTs - Date.now()) / 1000)) : 0; }

function extendTimer(secs) { if (timer) { timer.endTs += secs * 1000; timer.total += secs; timer.finished = false; startTimerTickRestart(); render(); } }

function startTimerTickRestart() {
  if (!timer) return;
  if (timer.interval) clearInterval(timer.interval);
  timer.interval = setInterval(() => {
    if (remainingSecs() <= 0 && !timer.finished) {
      timer.finished = true;
      clearInterval(timer.interval);
      beep();
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    }
    if (view.name === 'workout') updateClock();
  }, 250);
}

function pickModality(m) {
  S.current.lastModality = m;
  S.lastModality = m;
  save(); render();
}

function finishCardio() {
  const c = S.current;
  const total = timer ? timer.total : S.settings.cardioMinutes * 60;
  const doneSecs = timer && !timer.finished ? Math.max(0, total - remainingSecs()) : total;
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
  S.sessions.push({
    id: 's' + Date.now(), ts: Date.now(),
    journeyId: journey().id, week, dayIndex, dayType: 'ZONE2',
    zone2: { modality, minutes },
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
  document.documentElement.style.setProperty('--font-scale', S.settings.fontScale);
  const views = {
    home: vHome, workout: vWorkout, zone2: vZone2, summary: vSummary,
    journal: vJournal, session: vSession, progress: vProgress,
    program: vProgram, settings: vSettings,
  };
  $app.innerHTML = (views[view.name] || vHome)() + navBar();
}

function navBar() {
  const items = [
    ['home', '🏠', 'Home'], ['journal', '📓', 'Journal'],
    ['progress', '📈', 'Progress'], ['program', '📋', 'Program'], ['settings', '⚙️', 'Settings'],
  ];
  return `<div class="nav">${items.map(([n, ico, label]) =>
    `<button class="${view.name === n ? 'active' : ''}" onclick="go('${n}')"><span class="ico">${ico}</span>${label}</button>`
  ).join('')}</div>`;
}

function dayBadge(type) {
  const t = DAY_TYPES[type];
  return `<span class="badge ${t.kind}">${t.label}</span>`;
}

function vHome() {
  const j = journey();
  const next = nextSlot(j);
  let html = `<h1>5+2 <span class="muted small">· ${esc(j.name)}</span></h1>`;

  if (S.current) {
    html += `<div class="card highlight">
      <h3>Session in progress</h3>
      <p class="muted">Week ${S.current.week} · ${DAY_TYPES[S.current.dayType].label} · Round ${S.current.round}/5</p>
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
    html += `<div class="card highlight"><h3>Journey complete 🎉</h3>
      <p class="muted">All ${j.weekCount} weeks done. Start a new journey in Settings.</p></div>`;
  }

  // week grids
  html += '<h2>Journey</h2>';
  for (let w = 1; w <= j.weekCount; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const done = !!sessionFor(j.id, w, d);
      const isNext = next && next.week === w && next.dayIndex === d;
      const t = DAY_TYPES[dayType(j, d)];
      days.push(`<div class="day ${done ? 'done' : ''} ${isNext ? 'next' : ''}" onclick="startSession(${w},${d})">
        <span class="n">${d + 1}</span><span>${t.label.replace(' ', '')}</span></div>`);
    }
    html += `<div class="muted small">Week ${w}</div><div class="week-grid">${days.join('')}</div>`;
  }
  return html;
}

function stepperHTML(i, field, value, unit, stepDown, stepUp) {
  return `<div class="stepper">
    <button onclick="adjustEntry(${i}, '${field}', ${stepDown})">−</button>
    <input class="val" inputmode="decimal" value="${value}" onchange="setEntry(${i}, '${field}', this.value)">
    <button onclick="adjustEntry(${i}, '${field}', ${stepUp})">+</button>
    <span class="unit">${unit}</span>
  </div>`;
}

function vWorkout() {
  const c = S.current;
  if (!c) return vHome();
  const j = journey();
  const title = `W${c.week} · ${DAY_TYPES[c.dayType].label}`;
  const dots = [1, 2, 3, 4, 5].map((r) =>
    `<div class="dot ${r < c.round ? 'done' : ''} ${r === c.round ? 'now' : ''}"></div>`).join('');

  if (c.phase === 'lift') {
    const blocks = c.roundEntries.map((en, i) => {
      const e = ex(en.ex);
      const isReps = e.measure === 'reps';
      return `<div class="card exercise-block ${en.done ? 'done-block' : ''}">
        <div class="row spread">
          <div>
            <div class="exname">${'ABCDE'[i]} · ${esc(e.name)}</div>
            <div class="target">${e.bucket ? 'target ' + e.bucket + ' reps' : 'time-based'}${e.cue ? ` <span class="muted">· ${esc(e.cue)}</span>` : ''}</div>
          </div>
          <button class="btn-small ${en.done ? '' : 'btn-ghost'}" onclick="toggleEntryDone(${i})">✓</button>
        </div>
        <div class="set-row">
          ${stepperHTML(i, 'amount', en.amount, isReps ? 'reps' : 'secs', isReps ? -1 : -5, isReps ? 1 : 5)}
          ${stepperHTML(i, 'weight', en.weight, 'kg', -S.settings.weightStep, S.settings.weightStep)}
        </div>
      </div>`;
    }).join('');

    return `<div class="topbar"><button onclick="go('home')">←</button><span class="title">${title}</span>
        <span class="muted">Round ${c.round}/5</span></div>
      <div class="progress-dots">${dots}</div>
      ${blocks}
      <button class="btn-primary" onclick="commitRound()">Log round → Cardio</button>
      <button class="btn-ghost btn-big mt" onclick="abandonSession()">Discard session</button>`;
  }

  // cardio phase
  const secs = remainingSecs();
  const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
  const finished = timer && timer.finished;
  return `<div class="topbar"><span class="title">${title}</span><span class="muted">Cardio ${c.round}/5</span></div>
    <div class="progress-dots">${dots}</div>
    <div class="modality-grid">${CARDIO_MODALITIES.map((m) =>
      `<button class="${c.lastModality === m ? 'sel' : ''}" onclick="pickModality('${m}')">${m}</button>`).join('')}</div>
    <div class="timer-wrap">
      <div class="timer-clock ${finished ? 'done' : ''}" id="clock">${finished ? 'DONE' : mm + ':' + ss}</div>
      <div class="row" style="justify-content:center">
        <button onclick="extendTimer(60)">+1 min</button>
        <button onclick="extendTimer(-30)">−30 s</button>
      </div>
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
  return `<div class="topbar"><button onclick="go('home')">←</button><span class="title">Zone 2 · Week ${w}</span></div>
    <div class="card">
      <h3>Modality</h3>
      <div class="modality-grid">${ZONE2_MODALITIES.map((m) =>
        `<button class="${view.z2mod === m ? 'sel' : ''}" onclick="view.z2mod='${m}';render()">${m}</button>`).join('')}</div>
      <h3 class="mt">Duration</h3>
      <div class="row" style="justify-content:center" >
        <div class="stepper">
          <button onclick="view.z2min=Math.max(10,view.z2min-5);render()">−</button>
          <input class="val" inputmode="numeric" value="${view.z2min}" onchange="view.z2min=parseInt(this.value)||60;render()">
          <button onclick="view.z2min+=5;render()">+</button>
          <span class="unit">min</span>
        </div>
      </div>
      <button class="btn-primary mt" onclick="S.lastZ2Mod=view.z2mod;saveZone2(${w},${d},view.z2mod,view.z2min)">Save Zone 2</button>
    </div>`;
}

function vSummary() {
  const s = S.sessions.find((x) => x.id === view.sessionId);
  if (!s) return vHome();
  return `<h1>Session done 💪</h1>
    <div class="card">
      <div class="row spread"><h3>W${s.week} · ${DAY_TYPES[s.dayType].label}</h3>${dayBadge(s.dayType)}</div>
      ${sessionDetailHTML(s)}
    </div>
    <button class="btn-primary" onclick="go('home')">Home</button>`;
}

function sessionDetailHTML(s) {
  if (s.dayType === 'ZONE2') {
    return `<p class="big">${esc(s.zone2.modality)} · ${s.zone2.minutes} min</p>`;
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
      <div><b>W${s.week} · ${DAY_TYPES[s.dayType].label}</b><br><span class="muted small">${fmtDate(s.ts)}</span></div>
      ${dayBadge(s.dayType)}
    </div>`).join('');
  return `<h1>Journal</h1><div class="card">${items || '<p class="muted">No sessions yet.</p>'}</div>`;
}

function vSession() {
  const s = S.sessions.find((x) => x.id === view.sessionId);
  if (!s) return vJournal();
  return `<div class="topbar"><button onclick="go('journal')">←</button><span class="title">${fmtDate(s.ts)}</span></div>
    <div class="card">
      <div class="row spread"><h3>W${s.week} · ${DAY_TYPES[s.dayType].label}</h3>${dayBadge(s.dayType)}</div>
      ${sessionDetailHTML(s)}
    </div>
    <button class="btn-danger btn-big" onclick="deleteSession('${s.id}')">Delete session</button>`;
}

function vProgress() {
  const loggedIds = [...new Set(S.sessions.flatMap((s) => (s.sets || []).map((x) => x.ex)))];
  if (!view.exId) view.exId = loggedIds[0] || null;
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
      <select onchange="view.exId=this.value;render()">
        ${loggedIds.map((id) => `<option value="${id}" ${view.exId === id ? 'selected' : ''}>${esc(ex(id).name)}</option>`).join('')}
      </select>
      <div class="trend mt">${chart}</div>
    </div>
    <div class="card">
      <h3>Zone 2</h3>
      ${S.sessions.filter((s) => s.dayType === 'ZONE2').slice(-6).reverse().map((s) =>
        `<div class="set-row"><span>${fmtDate(s.ts)}</span><span class="muted">${esc(s.zone2.modality)} · ${s.zone2.minutes} min</span></div>`).join('') || '<p class="muted">None yet.</p>'}
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
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
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
  if (!view.block) view.block = 'early';
  if (!view.day) view.day = 'LEGS1';
  const dayKeys = j.weekPlan.filter((t) => t !== 'ZONE2');
  const slots = j.blocks[view.block][view.day];

  const slotRows = slots.map((exId, i) => {
    const e = ex(exId);
    return `<div class="set-row">
      <div><b>${'ABCDE'[i]}</b> · ${esc(e.name)}<br>
        <span class="muted small">${e.bucket ? 'target ' + e.bucket : 'time-based'} · ${e.group}</span></div>
      <button class="btn-small btn-ghost" onclick="go('program', {block:'${view.block}', day:'${view.day}', editSlot:${i}})">Swap</button>
    </div>`;
  }).join('');

  let editHTML = '';
  if (view.editSlot !== undefined) {
    const groups = ['legs', 'upper', 'core', 'mixed'];
    const options = groups.map((g) =>
      `<optgroup label="${g}">${Object.values(S.exercises).filter((e) => e.group === g)
        .map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
    editHTML = `<div class="card highlight">
      <h3>Swap slot ${'ABCDE'[view.editSlot]}</h3>
      <select id="swapSel">${options}</select>
      <div class="row mt">
        <button class="btn-big grow" onclick="applySwap()">Apply</button>
        <button class="btn-ghost btn-big grow" onclick="go('program', {block:'${view.block}', day:'${view.day}'})">Cancel</button>
      </div>
      <p class="muted small mt">Applies from your next session. Past logs stay untouched. A/B are done most often — keep anchors there.</p>
    </div>`;
  }

  return `<h1>Program</h1>
    <div class="row wrap mb">
      <button class="btn-small ${view.block === 'early' ? '' : 'btn-ghost'}" onclick="go('program',{block:'early', day:'${view.day}'})">Weeks 1–3</button>
      <button class="btn-small ${view.block === 'late' ? '' : 'btn-ghost'}" onclick="go('program',{block:'late', day:'${view.day}'})">Weeks 4–6</button>
    </div>
    <div class="row wrap mb">
      ${dayKeys.map((t) => `<button class="btn-small ${view.day === t ? '' : 'btn-ghost'}"
        onclick="go('program',{block:'${view.block}', day:'${t}'})">${DAY_TYPES[t].label}</button>`).join('')}
    </div>
    ${editHTML}
    <div class="card">${slotRows}</div>
    <div class="card">
      <h3>Add exercise to library</h3>
      <label class="field">Name</label><input type="text" id="newExName">
      <label class="field">Group</label>
      <select id="newExGroup"><option>legs</option><option>upper</option><option>core</option><option>mixed</option></select>
      <label class="field">Measure</label>
      <select id="newExMeasure"><option value="reps">reps</option><option value="secs">seconds</option></select>
      <label class="field">Target bucket</label>
      <select id="newExBucket"><option value="">none (time-based)</option>${BUCKETS.map((b) => `<option ${b === '9-12' ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <button class="btn-big mt" onclick="addExercise()">Add</button>
    </div>`;
}

function applySwap() {
  const sel = document.getElementById('swapSel');
  const j = journey();
  j.blocks[view.block][view.day][view.editSlot] = sel.value;
  save();
  go('program', { block: view.block, day: view.day });
}

function addExercise() {
  const name = document.getElementById('newExName').value.trim();
  if (!name) { alert('Name required'); return; }
  const id = 'x_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  S.exercises[id] = {
    id, name,
    group: document.getElementById('newExGroup').value,
    measure: document.getElementById('newExMeasure').value,
    bucket: document.getElementById('newExBucket').value || null,
    cue: '',
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
        onchange="importJSON(this.files[0], (err, st) => { if (err) alert('Import failed: ' + err.message); else { S = st; render(); } })">
    </div>
    <div class="card">
      <h3>Danger zone</h3>
      <button class="btn-danger btn-big mt" onclick="resetAll()">Reset all data</button>
    </div>`;
}

function newJourney() {
  if (!confirm('Start a new 6-week journey?')) return;
  const j = journey();
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
