'use strict';

/* =========================================================
   Loop — habit to-do list with XP, streaks and reminders
   Runs in a browser (for quick UI testing) and inside the
   Capacitor Android app (real notifications, haptics, storage).
   ========================================================= */

// ---------- Native bridges (present only inside the APK) ----------
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const P = (Cap && Cap.Plugins) || {};
const LN = isNative ? P.LocalNotifications : null;
const Haptics = isNative ? P.Haptics : null;
const Prefs = isNative ? P.Preferences : null;
const AppPlugin = isNative ? P.App : null;

// ---------- Constants ----------
const STORE_KEY = 'loop-state-v1';
const DIFF = { 1: 10, 2: 20, 3: 35 };
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const EMOJIS = ['✅', '💪', '🏃', '💧', '📚', '🧘', '🥗', '💊', '🛏️', '🧹', '💼', '📦', '📈', '🎯', '✍️', '🦷', '🌱', '🧠', '🎸', '💰'];
const RANKS = ['Rookie', 'Starter', 'Regular', 'Committed', 'Grinder', 'Machine', 'Relentless', 'Unstoppable', 'Legend'];
const NOTIF_HORIZON_DAYS = 14;
const NOTIF_MAX = 400;
const TEST_NOTIF_ID = 99999;

// ---------- Date helpers (all local time) ----------
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const todayKey = () => keyOf(new Date());
const weekStartKey = (k) => { const d = parseKey(k); return keyOf(addDays(d, -((d.getDay() + 6) % 7))); };
const fmtDate = (k) => parseKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ---------- Utilities ----------
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// =========================================================
// State & storage
// =========================================================
let state = { tasks: [], log: [], settings: { sound: true } };

async function loadState() {
  let raw = null;
  try {
    if (Prefs) raw = (await Prefs.get({ key: STORE_KEY })).value;
    else raw = localStorage.getItem(STORE_KEY);
  } catch (e) { console.warn('load failed', e); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { tasks: [], log: [], settings: { sound: true }, ...parsed };
      state.settings = { sound: true, ...(parsed.settings || {}) };
    } catch (e) { console.warn('bad saved data', e); }
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const json = JSON.stringify(state);
    try {
      if (Prefs) await Prefs.set({ key: STORE_KEY, value: json });
      else localStorage.setItem(STORE_KEY, json);
    } catch (e) { console.warn('save failed', e); }
  }, 120);
  scheduleNotifSync();
}

// =========================================================
// Habit logic
// =========================================================
// A "period" is what one check-off covers: a day, a week, or forever (one-time).
function periodOf(task, dateKey) {
  if (task.freq === 'weekly') return weekStartKey(dateKey);
  if (task.freq === 'once') return 'once';
  return dateKey;
}
const entriesFor = (task) => state.log.filter((e) => e.taskId === task.id);
function isDone(task, dateKey = todayKey()) {
  const p = periodOf(task, dateKey);
  return state.log.some((e) => e.taskId === task.id && periodOf(task, e.date) === p);
}
function isScheduledOn(task, date) {
  if (task.freq === 'days') return task.days.includes(date.getDay());
  return true;
}
function isDueToday(task) {
  if (task.freq === 'days') return task.days.includes(new Date().getDay());
  if (task.freq === 'once') return !task.date || task.date <= todayKey();
  return true;
}

function streakOf(task) {
  if (task.freq === 'once') return 0;
  const done = new Set(entriesFor(task).map((e) => periodOf(task, e.date)));
  let n = 0;
  if (task.freq === 'weekly') {
    let wk = parseKey(weekStartKey(todayKey()));
    if (!done.has(keyOf(wk))) wk = addDays(wk, -7); // this week still open
    while (done.has(keyOf(wk))) { n++; wk = addDays(wk, -7); }
    return n;
  }
  let d = startOfToday();
  if (!(isScheduledOn(task, d) && done.has(keyOf(d)))) d = addDays(d, -1); // today still open
  for (let i = 0; i < 1000; i++) {
    if (!isScheduledOn(task, d)) { d = addDays(d, -1); continue; }
    if (!done.has(keyOf(d))) break;
    n++; d = addDays(d, -1);
  }
  return n;
}

// Consecutive days with at least one completion.
function dayRun() {
  const days = new Set(state.log.filter((e) => e.taskId).map((e) => e.date));
  let d = startOfToday();
  if (!days.has(keyOf(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(keyOf(d))) { n++; d = addDays(d, -1); }
  return n;
}
function bestDayRun() {
  const days = [...new Set(state.log.filter((e) => e.taskId).map((e) => e.date))].sort();
  let best = 0, cur = 0, prev = null;
  for (const k of days) {
    cur = prev && keyOf(addDays(parseKey(prev), 1)) === k ? cur + 1 : 1;
    best = Math.max(best, cur); prev = k;
  }
  return best;
}

const totalXP = () => state.log.reduce((s, e) => s + (e.xp || 0), 0);
function levelInfo(xp) {
  let lvl = 1, need = 100, left = xp;
  while (left >= need) { left -= need; lvl++; need = 100 + (lvl - 1) * 40; }
  return { lvl, into: left, need, rank: RANKS[Math.min(Math.floor((lvl - 1) / 3), RANKS.length - 1)] };
}

function categorize() {
  const today = todayKey();
  const todo = [], done = [], later = [];
  for (const t of state.tasks) {
    if (isDone(t)) {
      if (t.freq === 'once') {
        const e = entriesFor(t)[0];
        if (e && e.date === today) done.push(t); // finished one-timers leave after today
      } else done.push(t);
    } else if (isDueToday(t)) todo.push(t);
    else later.push(t);
  }
  const timeVal = (t) => (t.remind && t.time ? t.time : '99:99');
  todo.sort((a, b) => timeVal(a).localeCompare(timeVal(b)) || a.createdAt - b.createdAt);
  const lastTs = (t) => Math.max(0, ...entriesFor(t).map((e) => e.ts));
  done.sort((a, b) => lastTs(b) - lastTs(a));
  return { todo, done, later };
}

function nextDueLabel(task) {
  if (task.freq === 'daily') return 'Back tomorrow';
  if (task.freq === 'weekly') return 'Back Monday';
  if (task.freq === 'once') return 'Finished';
  const t = startOfToday();
  for (let i = 1; i <= 7; i++) {
    const d = addDays(t, i);
    if (task.days.includes(d.getDay())) return i === 1 ? 'Back tomorrow' : `Back ${DAY_LONG[d.getDay()]}`;
  }
  return '';
}
function repeatLabel(task) {
  if (task.freq === 'daily') return 'Every day';
  if (task.freq === 'weekly') {
    const left = 7 - ((new Date().getDay() + 6) % 7);
    return left === 1 ? 'Weekly, last day' : `Weekly, ${left} days left`;
  }
  if (task.freq === 'once') {
    if (!task.date) return 'One time';
    if (task.date < todayKey()) return `Due ${fmtDate(task.date)}`;
    return task.date === todayKey() ? 'Today' : `On ${fmtDate(task.date)}`;
  }
  if (task.days.length === 7) return 'Every day';
  return WEEK_ORDER.filter((d) => task.days.includes(d)).map((d) => DAY_SHORT[d]).join(' ');
}
function nextLaterLabel(task) {
  if (task.freq === 'once' && task.date) return `On ${fmtDate(task.date)}`;
  const t = startOfToday();
  for (let i = 1; i <= 7; i++) {
    const d = addDays(t, i);
    if (task.days.includes(d.getDay())) return i === 1 ? 'Tomorrow' : DAY_LONG[d.getDay()];
  }
  return '';
}
function xpPreview(task) {
  const s = streakOf(task);
  return DIFF[task.diff] + Math.min(s * 2, 30);
}

// =========================================================
// Actions
// =========================================================
function completeTask(task, originEl) {
  if (isDone(task)) return;
  const today = todayKey();
  const beforeLvl = levelInfo(totalXP()).lvl;
  const entry = { id: uid(), taskId: task.id, date: today, ts: Date.now(), xp: 0 };
  state.log.push(entry);
  const s = streakOf(task);
  const bonus = Math.min((s - 1) * 2, 30);
  entry.xp = DIFF[task.diff] + Math.max(0, bonus);
  task.best = Math.max(task.best || 0, s);

  const { todo, done } = categorize();
  let cleared = false;
  if (todo.length === 0 && done.length > 0 && !state.log.some((e) => e.type === 'perfect' && e.date === today)) {
    state.log.push({ id: uid(), type: 'perfect', taskId: null, date: today, ts: Date.now(), xp: 25 });
    cleared = true;
  }
  save();

  // ---- the satisfying part ----
  const card = originEl.closest('.task');
  const btn = card.querySelector('.check');
  const r = btn.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  card.classList.add('pressing');
  renderHero();
  hapticTap();
  chime(done.length);
  burst(cx, cy, 26);
  floatText(`+${entry.xp} XP`, cx + 60, cy - 10);
  if (s >= 3) setTimeout(() => toast(`🔥 ${s} in a row on ${task.title}`), 350);

  setTimeout(() => {
    card.classList.add('leaving');
    setTimeout(() => {
      render({ justDone: task.id });
      const afterLvl = levelInfo(totalXP()).lvl;
      if (cleared) setTimeout(dayCleared, 250);
      if (afterLvl > beforeLvl) setTimeout(() => levelUp(afterLvl), cleared ? 1400 : 450);
    }, 180);
  }, 260);
}

function uncompleteTask(task) {
  const p = periodOf(task, todayKey());
  state.log = state.log.filter((e) => !(e.taskId === task.id && periodOf(task, e.date) === p));
  // Undo today's perfect-day bonus if the day is no longer cleared
  const { todo } = categorize();
  if (todo.length > 0) state.log = state.log.filter((e) => !(e.type === 'perfect' && e.date === todayKey()));
  hapticLight();
  save();
  render();
}

// =========================================================
// Rendering
// =========================================================
const checkSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
let showLater = false;
let activeTab = 'today';

function render(opts = {}) {
  renderHero();
  renderLists(opts);
  if (activeTab === 'stats') renderStats();
}

function renderHero() {
  const xp = totalXP();
  const L = levelInfo(xp);
  const { todo, done } = categorize();
  const total = todo.length + done.length;
  const run = dayRun();
  const pips = total > 0 && total <= 16
    ? `<div class="pips">${Array.from({ length: total }, (_, i) => `<span class="pip ${i < done.length ? 'on' : ''}"></span>`).join('')}</div>`
    : `<div class="pips"><span class="pip on" style="flex:${done.length || 0.0001}"></span><span class="pip" style="flex:${todo.length || 0.0001}"></span></div>`;

  $('#hero').innerHTML = `
    <div class="lvl">
      <span class="lvl-num">${L.lvl}</span>
      <div class="lvl-meta">
        <div class="lvl-label">Level</div>
        <div class="rank">${L.rank}</div>
      </div>
      ${run > 0 ? `<div class="day-run" title="Days in a row with at least one habit done">🔥 ${run} ${run === 1 ? 'day' : 'days'}</div>` : ''}
    </div>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}" aria-label="XP to next level">
      <div class="xpfill" style="width:${Math.max(3, (L.into / L.need) * 100)}%"></div>
    </div>
    <div class="xp-text"><span><b>${L.into}</b> / ${L.need} XP</span><span>${L.need - L.into} to level ${L.lvl + 1}</span></div>
    ${total > 0 ? `
    <div class="today-bar">
      <div class="today-head"><span>Today</span><span><strong>${done.length}</strong> of ${total} done</span></div>
      ${pips}
    </div>` : ''}
  `;
}

function taskHTML(t, kind, justDone) {
  const s = streakOf(t);
  const meta = [];
  if (kind === 'done') {
    meta.push(`<span class="back">${nextDueLabel(t)}</span>`);
  } else if (kind === 'later') {
    meta.push(`<span>${nextLaterLabel(t)}</span>`);
  } else {
    const late = t.freq === 'once' && t.date && t.date < todayKey();
    meta.push(`<span class="${late ? 'late' : ''}">${repeatLabel(t)}</span>`);
  }
  if (t.remind && t.time) meta.push(`<span>⏰ ${t.time}</span>`);
  if (s >= 2) meta.push(`<span class="streak">🔥 ${s}</span>`);

  const doneEntry = kind === 'done' ? entriesFor(t).filter((e) => periodOf(t, e.date) === periodOf(t, todayKey())).pop() : null;
  const tag = kind === 'done' ? `+${doneEntry ? doneEntry.xp : ''}` : kind === 'todo' ? `+${xpPreview(t)}` : '';

  return `
    <li class="task ${kind === 'todo' ? '' : kind} ${justDone === t.id ? 'just-done' : ''}" data-id="${t.id}">
      <button class="check" data-act="${kind === 'done' ? 'undo' : 'done'}" aria-label="${kind === 'done' ? 'Mark not done' : 'Mark done'}: ${esc(t.title)}">${checkSvg}</button>
      <button class="task-body" data-act="edit" aria-label="Edit ${esc(t.title)}">
        <div class="task-title"><span class="emo">${t.emoji}</span>${esc(t.title)}</div>
        <div class="task-meta">${meta.join('')}</div>
      </button>
      ${tag ? `<span class="xp-tag">${tag}</span>` : ''}
    </li>`;
}

function renderLists({ justDone } = {}) {
  const { todo, done, later } = categorize();
  const el = $('#lists');

  if (state.tasks.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <h3>Build your loop</h3>
        <p>Add the things you want to do every day or every week. Check them off to earn XP and grow your streaks.</p>
        <button class="btn primary" data-act="add">Add a habit</button>
        <button class="btn" data-act="examples">Try examples</button>
      </div>`;
    return;
  }

  let html = '';
  html += `<div class="group"><div class="group-head"><h3>To do</h3><span class="count">${todo.length}</span></div>`;
  if (todo.length) html += `<ul class="tasks">${todo.map((t) => taskHTML(t, 'todo')).join('')}</ul>`;
  else if (done.length) html += `<div class="cleared"><big>Day cleared</big>Everything's done. Your habits come back when they're due.</div>`;
  else html += `<div class="cleared"><big>Nothing due today</big>Enjoy the break.</div>`;
  html += `</div>`;

  if (done.length) {
    html += `<div class="group"><div class="group-head"><h3>Done</h3><span class="count">${done.length}</span></div>
      <ul class="tasks">${done.map((t) => taskHTML(t, 'done', justDone)).join('')}</ul></div>`;
  }
  if (later.length) {
    html += `<div class="group"><div class="group-head"><h3>Not today</h3><span class="count">${later.length}</span>
      <button class="toggle-later" data-act="toggle-later">${showLater ? 'Hide' : 'Show'}</button></div>
      ${showLater ? `<ul class="tasks">${later.map((t) => taskHTML(t, 'later')).join('')}</ul>` : ''}</div>`;
  }
  el.innerHTML = html;
}

function renderStats() {
  const completions = state.log.filter((e) => e.taskId);
  const counts = {};
  for (const e of completions) counts[e.date] = (counts[e.date] || 0) + 1;

  // 16-week heatmap, Monday rows first
  const WEEKS = 16;
  const start = addDays(parseKey(weekStartKey(todayKey())), -7 * (WEEKS - 1));
  const today = todayKey();
  let cells = '';
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const k = keyOf(addDays(start, w * 7 + d));
      const c = counts[k] || 0;
      const lvl = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 5 ? 3 : 4;
      const cls = k === today ? 'today' : k > today ? 'future' : '';
      cells += `<i class="${cls}" data-l="${lvl}" title="${fmtDate(k)}: ${c}"></i>`;
    }
  }

  const habits = state.tasks.filter((t) => t.freq !== 'once').map((t) => {
    const s = streakOf(t);
    return { t, s, best: Math.max(t.best || 0, s), total: entriesFor(t).length };
  }).sort((a, b) => b.s - a.s || b.total - a.total);

  $('#stats').innerHTML = `
    <h2>Your progress</h2>
    <div class="stat-row">
      <div class="stat"><b>${completions.length}</b><span>Check-offs</span></div>
      <div class="stat"><b>${dayRun()}</b><span>Day run</span></div>
      <div class="stat"><b>${bestDayRun()}</b><span>Best run</span></div>
    </div>

    <h3>Last 16 weeks</h3>
    <div class="heat-wrap"><div class="heat">${cells}</div></div>
    <div class="heat-legend">Less <i style="background:var(--line)"></i><i data-l="1" style="background:color-mix(in srgb,var(--cobalt) 35%,var(--line))"></i><i style="background:color-mix(in srgb,var(--cobalt) 60%,var(--line))"></i><i style="background:var(--cobalt)"></i><i style="background:var(--sun)"></i> More</div>

    ${habits.length ? `
    <h3>Streaks</h3>
    <ul class="habit-list">
      ${habits.map(({ t, s, best, total }) => `
        <li><span class="emo">${t.emoji}</span><span class="name">${esc(t.title)}</span>
        <span class="nums"><b>🔥 ${s}</b><br>best ${best}, total ${total}</span></li>`).join('')}
    </ul>` : ''}

    <h3>Settings</h3>
    <div class="settings">
      <label class="row"><span>Sounds<small>Chime when you check something off</small></span>
        <span class="switch"><input type="checkbox" id="set-sound" ${state.settings.sound ? 'checked' : ''}><span class="switch-ui"></span></span></label>
      <button class="row" data-act="test-notif"><span>Send a test reminder<small>Arrives in 5 seconds</small></span>⏰</button>
      <button class="row" data-act="backup"><span>Backup and restore<small>Keep a copy of your habits and history</small></span>💾</button>
    </div>
  `;
  $('#set-sound').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); });
}

// =========================================================
// Feedback: sound, haptics, confetti, toasts, level up
// =========================================================
let actx = null;
function tone(freq, t0, dur, type = 'triangle', vol = 0.22) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function audio() {
  if (!state.settings.sound) return null;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch { return null; }
}
// Pitch climbs with each completion today — the combo feeling.
function chime(step) {
  if (!audio()) return;
  const base = 523.25 * Math.pow(2, (Math.min(step, 10) * 2) / 12);
  const t = actx.currentTime;
  tone(base, t, 0.28);
  tone(base * 1.5, t + 0.07, 0.35);
}
function fanfare() {
  if (!audio()) return;
  const t = actx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.1, 0.4, 'square', 0.1));
  tone(1046.5, t + 0.42, 0.8, 'triangle', 0.2);
}

function hapticTap() {
  if (Haptics) Haptics.impact({ style: 'MEDIUM' }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(20);
}
function hapticLight() {
  if (Haptics) Haptics.impact({ style: 'LIGHT' }).catch(() => {});
}
function hapticWin() {
  if (Haptics) Haptics.notification({ type: 'SUCCESS' }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
}

// Tiny particle system
const fx = $('#fx');
const fctx = fx.getContext('2d');
let parts = [];
let fxRunning = false;
const FX_COLORS = ['#ffc83a', '#19c79a', '#3346f0', '#ff5a36', '#ffffff'];
function sizeFx() {
  const dpr = window.devicePixelRatio || 1;
  fx.width = innerWidth * dpr; fx.height = innerHeight * dpr;
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeFx();
addEventListener('resize', sizeFx);

function burst(x, y, count = 24, power = 1) {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (3 + Math.random() * 6) * power;
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * power,
      life: 0, max: 50 + Math.random() * 30,
      s: 5 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: FX_COLORS[(Math.random() * FX_COLORS.length) | 0], shape: Math.random() < 0.5 ? 0 : 1,
    });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(tick); }
}
function tick() {
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life < p.max);
  for (const p of parts) {
    p.life++; p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    fctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
    fctx.fillStyle = p.c;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
    if (p.shape) fctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    else { fctx.beginPath(); fctx.arc(0, 0, p.s / 2.4, 0, Math.PI * 2); fctx.fill(); }
    fctx.restore();
  }
  fctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(tick);
  else { fxRunning = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
}

function floatText(text, x, y) {
  const el = document.createElement('div');
  el.className = 'float-xp';
  el.textContent = text;
  el.style.left = `${Math.min(x, innerWidth - 60)}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
  const hero = $('#hero');
  hero.classList.remove('bump'); void hero.offsetWidth; hero.classList.add('bump');
}

let toastTimer;
function toast(msg, win = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('win', win);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function dayCleared() {
  hapticWin();
  fanfare();
  const w = innerWidth;
  burst(w * 0.2, innerHeight * 0.35, 30, 1.2);
  burst(w * 0.8, innerHeight * 0.35, 30, 1.2);
  toast('Day cleared! +25 XP bonus', true);
}

function levelUp(lvl) {
  const L = levelInfo(totalXP());
  $('#levelup-num').textContent = lvl;
  $('#levelup-rank').textContent = L.rank;
  $('#levelup').hidden = false;
  hapticWin();
  fanfare();
  burst(innerWidth / 2, innerHeight / 2, 60, 1.6);
  setTimeout(() => burst(innerWidth / 2, innerHeight / 2, 40, 1.3), 250);
}

// =========================================================
// Add / edit sheet
// =========================================================
let editing = null;
const form = {
  title: $('#f-title'), emoji: $('#f-emoji'), freq: $('#f-freq'), days: $('#f-days'),
  date: $('#f-date'), remind: $('#f-remind'), time: $('#f-time'), remindDay: $('#f-remindday'), diff: $('#f-diff'),
};
let draft = null;

form.emoji.innerHTML = EMOJIS.map((e) => `<button type="button" role="radio" data-v="${e}" aria-label="${e}">${e}</button>`).join('');
form.days.innerHTML = WEEK_ORDER.map((d) => `<button type="button" role="checkbox" data-v="${d}" aria-label="${DAY_LONG[d]}">${DAY_SHORT[d][0]}</button>`).join('');
form.remindDay.innerHTML = WEEK_ORDER.map((d) => `<option value="${d}">${DAY_LONG[d]}</option>`).join('');

const FREQ_HINTS = {
  daily: 'Comes back every morning.',
  days: 'Only shows up on the days you pick.',
  weekly: 'Do it once any day of the week. Resets every Monday.',
  once: 'A regular to-do. Leaves the list after you finish it.',
};

function openSheet(task = null) {
  editing = task;
  draft = task ? { ...task, days: [...task.days] } : {
    title: '', emoji: '✅', freq: 'daily', days: [1, 3, 5], date: todayKey(),
    remind: false, time: '09:00', remindDay: 1, diff: 2,
  };
  $('#sheet-title').textContent = task ? 'Edit habit' : 'New habit';
  $('#btn-delete').hidden = !task;
  form.title.value = draft.title;
  form.date.value = draft.date || todayKey();
  form.remind.checked = !!draft.remind;
  form.time.value = draft.time || '09:00';
  form.remindDay.value = String(draft.remindDay ?? 1);
  syncSheet();
  $('#sheet').hidden = false;
  if (!task) setTimeout(() => form.title.focus(), 250);
}
function closeSheets() {
  $('#sheet').hidden = true;
  $('#backup').hidden = true;
  editing = null;
}
function syncSheet() {
  $$('button', form.emoji).forEach((b) => b.setAttribute('aria-checked', b.dataset.v === draft.emoji));
  $$('button', form.freq).forEach((b) => b.setAttribute('aria-checked', b.dataset.v === draft.freq));
  $$('button', form.days).forEach((b) => b.setAttribute('aria-checked', draft.days.includes(+b.dataset.v)));
  $$('button', form.diff).forEach((b) => b.setAttribute('aria-checked', +b.dataset.v === draft.diff));
  $('#row-days').hidden = draft.freq !== 'days';
  $('#row-date').hidden = draft.freq !== 'once';
  $('#row-time').hidden = !form.remind.checked;
  $('#row-remindday').hidden = draft.freq !== 'weekly';
  $('#freq-hint').textContent = FREQ_HINTS[draft.freq];
}

form.emoji.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { draft.emoji = b.dataset.v; syncSheet(); } });
form.freq.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { draft.freq = b.dataset.v; syncSheet(); } });
form.diff.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { draft.diff = +b.dataset.v; syncSheet(); } });
form.days.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = +b.dataset.v;
  draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
  syncSheet();
});
form.remind.addEventListener('change', syncSheet);

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = form.title.value.trim();
  if (!title) { form.title.focus(); toast('Give it a name first'); return; }
  if (draft.freq === 'days' && draft.days.length === 0) { toast('Pick at least one day'); return; }

  const data = {
    title, emoji: draft.emoji, freq: draft.freq, days: draft.days.sort(),
    date: draft.freq === 'once' ? (form.date.value || todayKey()) : null,
    remind: form.remind.checked, time: form.time.value || '09:00',
    remindDay: +form.remindDay.value, diff: draft.diff,
  };
  const wasEditing = !!editing;
  if (editing) Object.assign(editing, data);
  else state.tasks.push({ id: uid(), createdAt: Date.now(), best: 0, ...data });

  closeSheets();
  save();
  render();
  toast(wasEditing ? 'Habit saved' : 'Habit added');
  if (data.remind) await ensureNotifPermission();
});

$('#btn-delete').addEventListener('click', () => {
  if (!editing) return;
  if (!confirm(`Delete "${editing.title}"? Its history and XP will be removed too.`)) return;
  const id = editing.id;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  state.log = state.log.filter((e) => e.taskId !== id);
  closeSheets();
  save();
  render();
  toast('Habit deleted');
});

// =========================================================
// Backup
// =========================================================
function openBackup() {
  $('#backup-text').value = JSON.stringify(state);
  $('#backup').hidden = false;
}
$('#btn-copy').addEventListener('click', async () => {
  const ta = $('#backup-text');
  try { await navigator.clipboard.writeText(ta.value); toast('Backup copied'); }
  catch { ta.select(); document.execCommand('copy'); toast('Backup copied'); }
});
$('#btn-restore').addEventListener('click', () => {
  try {
    const data = JSON.parse($('#backup-text').value);
    if (!Array.isArray(data.tasks) || !Array.isArray(data.log)) throw new Error('shape');
    if (!confirm('Replace everything in the app with this backup?')) return;
    state = { settings: { sound: true }, ...data };
    closeSheets(); save(); render();
    toast('Backup restored', true);
  } catch { toast("That text isn't a valid backup"); }
});

// =========================================================
// Notifications (local, scheduled on the phone)
// =========================================================
async function ensureNotifPermission() {
  if (!LN) return false;
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { toast('Reminders are off. Turn on notifications for Loop in Android settings.'); return false; }
    try {
      const ex = await LN.checkExactNotificationSetting();
      if (ex && ex.exact_alarm && ex.exact_alarm !== 'granted') await LN.changeExactNotificationSetting();
    } catch { /* older Android: nothing to do */ }
    scheduleNotifSync();
    return true;
  } catch (e) { console.warn(e); return false; }
}

function remindsOn(task, date) {
  if (task.freq === 'daily') return true;
  if (task.freq === 'days') return task.days.includes(date.getDay());
  if (task.freq === 'weekly') return date.getDay() === task.remindDay;
  if (task.freq === 'once') return (task.date || '') === keyOf(date);
  return false;
}
const NUDGES = ['A quick win is waiting.', 'Check it off and grab your XP.', 'Tiny step, big streak.', 'You said you would. Let\u2019s go.'];
function reminderBody(task) {
  const s = streakOf(task);
  if (s >= 2) return `🔥 ${s} in a row. Keep it alive.`;
  return NUDGES[(Math.random() * NUDGES.length) | 0];
}

let notifTimer;
function scheduleNotifSync() {
  if (!LN) return;
  clearTimeout(notifTimer);
  notifTimer = setTimeout(syncNotifications, 600);
}
// Rebuilds the next 14 days of reminders. Done-for-today habits don't ping you.
async function syncNotifications() {
  try {
    const perm = await LN.checkPermissions();
    const pending = await LN.getPending();
    const old = (pending.notifications || []).filter((n) => n.id !== TEST_NOTIF_ID).map((n) => ({ id: n.id }));
    if (old.length) await LN.cancel({ notifications: old });
    if (perm.display !== 'granted') return;

    const now = new Date();
    const list = [];
    for (let i = 0; i < NOTIF_HORIZON_DAYS; i++) {
      const day = addDays(startOfToday(), i);
      const dk = keyOf(day);
      for (const t of state.tasks) {
        if (!t.remind || !t.time || !remindsOn(t, day) || isDone(t, dk)) continue;
        const [h, m] = t.time.split(':').map(Number);
        const at = new Date(day); at.setHours(h, m, 0, 0);
        if (at <= now) continue;
        list.push({ at, t });
      }
    }
    list.sort((a, b) => a.at - b.at);
    const notifications = list.slice(0, NOTIF_MAX).map(({ at, t }, i) => ({
      id: i + 1,
      title: `${t.emoji} ${t.title}`,
      body: reminderBody(t),
      channelId: 'reminders',
      schedule: { at, allowWhileIdle: true },
      extra: { taskId: t.id },
    }));
    if (notifications.length) await LN.schedule({ notifications });
  } catch (e) { console.warn('notification sync failed', e); }
}

async function testNotification() {
  if (!LN) { toast('Reminders work in the Android app, not the browser'); return; }
  if (!(await ensureNotifPermission())) return;
  await LN.schedule({ notifications: [{
    id: TEST_NOTIF_ID, title: '✅ Loop', body: 'Reminders are working. Nice.',
    channelId: 'reminders', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
  }] });
  toast('Test reminder in 5 seconds. You can lock your phone.');
}

// =========================================================
// Examples
// =========================================================
function addExamples() {
  const base = { best: 0, date: null, remindDay: 0 };
  const now = Date.now();
  state.tasks.push(
    { ...base, id: uid(), createdAt: now, title: 'Drink 3L of water', emoji: '💧', freq: 'daily', days: [], remind: true, time: '10:00', diff: 1 },
    { ...base, id: uid(), createdAt: now + 1, title: 'Workout', emoji: '💪', freq: 'days', days: [1, 3, 5], remind: true, time: '18:00', diff: 3 },
    { ...base, id: uid(), createdAt: now + 2, title: 'Read 10 pages', emoji: '📚', freq: 'daily', days: [], remind: true, time: '22:00', diff: 1 },
    { ...base, id: uid(), createdAt: now + 3, title: 'Weekly review', emoji: '📈', freq: 'weekly', days: [], remind: true, time: '19:00', remindDay: 0, diff: 2 },
  );
  save();
  render();
  ensureNotifPermission();
}

// =========================================================
// Events & navigation
// =========================================================
function setTab(tab) {
  activeTab = tab;
  $$('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  $('#view-today').classList.toggle('is-active', tab === 'today');
  $('#view-stats').classList.toggle('is-active', tab === 'stats');
  if (tab === 'stats') renderStats();
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act], [data-tab], [data-close], #fab, #levelup-ok');
  if (!el) return;
  if (el.id === 'fab') return openSheet();
  if (el.id === 'levelup-ok') { $('#levelup').hidden = true; return; }
  if (el.dataset.close !== undefined) return closeSheets();
  if (el.dataset.tab) return setTab(el.dataset.tab);

  const act = el.dataset.act;
  const li = el.closest('.task');
  const task = li && state.tasks.find((t) => t.id === li.dataset.id);
  switch (act) {
    case 'done': if (task) completeTask(task, el); break;
    case 'undo': if (task) uncompleteTask(task); break;
    case 'edit': if (task) openSheet(task); break;
    case 'add': openSheet(); break;
    case 'examples': addExamples(); break;
    case 'toggle-later': showLater = !showLater; renderLists(); break;
    case 'test-notif': testNotification(); break;
    case 'backup': openBackup(); break;
  }
});

// Android back button: close things before leaving the app
if (AppPlugin) {
  AppPlugin.addListener('backButton', () => {
    if (!$('#levelup').hidden) { $('#levelup').hidden = true; return; }
    if (!$('#sheet').hidden || !$('#backup').hidden) { closeSheets(); return; }
    if (activeTab !== 'today') { setTab('today'); return; }
    AppPlugin.exitApp();
  });
}

// New day while the app is open, or coming back from background
let lastDay = todayKey();
function checkDayRollover() {
  if (todayKey() !== lastDay) { lastDay = todayKey(); render(); scheduleNotifSync(); }
}
setInterval(checkDayRollover, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { checkDayRollover(); render(); scheduleNotifSync(); }
});

// =========================================================
// Boot
// =========================================================
(async function init() {
  await loadState();
  if (LN) {
    try {
      await LN.createChannel({
        id: 'reminders', name: 'Habit reminders', description: 'Reminders for your habits',
        importance: 4, visibility: 1, vibration: true,
      });
    } catch (e) { console.warn(e); }
    if (state.tasks.some((t) => t.remind)) ensureNotifPermission();
    else scheduleNotifSync();
  }
  render();
})();
