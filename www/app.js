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
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const EMOJIS = ['✅', '💪', '🏃', '💧', '📚', '🧘', '🥗', '💊', '🛏️', '🧹', '💼', '📦', '📈', '🎯', '✍️', '🦷', '🌱', '🧠', '🎸', '💰'];
const NOTIF_HORIZON_DAYS = 14;
const NOTIF_MAX = 400;
const TEST_NOTIF_ID = 99999;

// =========================================================
// Translations (pt-BR is the default)
// =========================================================
const I18N = {
  'pt-BR': {
    daysShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    daysLong: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
    ranks: ['Novato', 'Aprendiz', 'Constante', 'Dedicado', 'Determinado', 'Máquina', 'Implacável', 'Imparável', 'Lenda'],
    nudges: ['Uma vitória rápida te espera.', 'Marque e pegue seu XP.', 'Passo pequeno, sequência grande.', 'Você disse que ia fazer. Bora.'],
    tabToday: 'Hoje', tabStats: 'Estatísticas', addHabit: 'Adicionar hábito',
    level: 'Nível', toLevel: 'faltam {n} para o nível {l}', xpAria: 'XP para o próximo nível',
    today: 'Hoje', doneOf: '<strong>{d}</strong> de {t} feitas',
    dayRun: (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`, dayRunTitle: 'Dias seguidos com pelo menos um hábito feito',
    timeLeft: 'restantes de {t}', timeAllDone: 'Tempo de hoje concluído', timeDoneOf: '{t} feitos hoje',
    todo: 'A fazer', done: 'Feitas', later: 'Hoje não', show: 'Mostrar', hide: 'Ocultar',
    clearedTitle: 'Dia concluído', clearedText: 'Tudo feito. Seus hábitos voltam quando for a hora.',
    noneTitle: 'Nada para hoje', noneText: 'Aproveite a folga.',
    emptyTitle: 'Monte sua rotina', emptyText: 'Adicione o que você quer fazer todo dia ou de tempos em tempos. Marque como feito para ganhar XP e aumentar suas sequências.',
    examples: 'Ver exemplos',
    backTomorrow: 'Volta amanhã', backDay: 'Volta {day}', finished: 'Concluída',
    everyDay: 'Todo dia', everyN: 'A cada {n} dias', backIn: 'Volta em {n} dias',
    oneTime: 'Uma vez', dueOn: 'Prazo {d}', todayLbl: 'Hoje', onDate: 'Em {d}', tomorrow: 'Amanhã',
    markDone: 'Marcar como feita', markUndone: 'Desmarcar', edit: 'Editar',
    inARow: '🔥 {n} seguidas em {t}', dayClearedToast: 'Dia concluído! +25 XP de bônus',
    habitSaved: 'Hábito salvo', habitAdded: 'Hábito adicionado', habitDeleted: 'Hábito excluído',
    needName: 'Dê um nome primeiro', pickDay: 'Escolha pelo menos um dia',
    confirmDelete: 'Excluir "{t}"? O histórico e o XP dele também serão apagados.',
    newHabit: 'Novo hábito', editHabit: 'Editar hábito', name: 'Nome', namePh: 'ex.: Treino, Beber água, Ler',
    icon: 'Ícone', repeats: 'Repete', freqDaily: 'Diário', freqDays: 'Alguns dias', freqInterval: 'Intervalo', freqOnce: 'Uma vez',
    hintDaily: 'Volta toda manhã.', hintDays: 'Só aparece nos dias que você escolher.',
    hintInterval: 'Depois que você concluir, volta daqui a {n} dias.',
    everyLabel: 'A cada', daysWord: 'dias', nextTime: 'Próxima vez', pickInterval: 'Escolha um intervalo de pelo menos 2 dias',
    hintOnce: 'Uma tarefa comum. Sai da lista depois que você concluir.',
    onTheseDays: 'Nestes dias', date: 'Data', duration: 'Duração',
    durationHint: 'Opcional. Entra na soma do tempo do dia.',
    reminder: 'Lembrete', effort: 'Esforço',
    easy: 'Fácil <b>+10</b>', medium: 'Médio <b>+20</b>', hard: 'Difícil <b>+35</b>',
    delete: 'Excluir', saveHabit: 'Salvar hábito',
    backupTitle: 'Backup', backupHint: 'Guarde este texto em um lugar seguro. Para restaurar, cole um backup aqui e toque em Restaurar.',
    copy: 'Copiar', restore: 'Restaurar', backupCopied: 'Backup copiado',
    confirmRestore: 'Substituir tudo no app por este backup?', restored: 'Backup restaurado', badBackup: 'Esse texto não é um backup válido',
    levelUp: 'Subiu de nível', keepGoing: 'Continuar',
    progress: 'Seu progresso', checkoffs: 'Concluídas', runLbl: 'Sequência', bestRun: 'Melhor', last16: 'Últimas 16 semanas',
    less: 'Menos', more: 'Mais', streaks: 'Sequências', bestTotal: 'melhor {b}, total {t}', timeSpent: 'Tempo investido',
    settings: 'Configurações', language: 'Idioma', sounds: 'Sons', soundsSub: 'Toca um som ao marcar algo como feito',
    testReminder: 'Enviar lembrete de teste', testSub: 'Chega em 5 segundos',
    backupRow: 'Backup e restauração', backupSub: 'Guarde uma cópia dos seus hábitos e histórico',
    notifOff: 'Lembretes desligados. Ative as notificações do Loop nas configurações do Android.',
    notifBrowser: 'Lembretes funcionam no app Android, não no navegador',
    testSent: 'Lembrete de teste em 5 segundos. Pode bloquear o celular.', testBody: 'Os lembretes estão funcionando.',
    streakBody: '🔥 {n} seguidas. Não quebre a sequência.', channelName: 'Lembretes de hábitos', channelDesc: 'Lembretes dos seus hábitos',
    ex: ['Beber 3L de água', 'Treino', 'Ler 10 páginas', 'Trocar a roupa de cama'],
    defaultCats: [['Casa', '🏠'], ['Trabalho', '💼'], ['Saúde', '💪'], ['Estudos', '📚']],
    category: 'Categoria', allCats: 'Todas', noCat: 'Sem categoria', newCat: 'Nova categoria', editCat: 'Editar categoria',
    addCat: '+ Nova', catName: 'Nome', catNamePh: 'ex.: Casa, Trabalho, Piscinas', catColor: 'Cor',
    saveCat: 'Salvar categoria', catSaved: 'Categoria salva', catDeleted: 'Categoria excluída',
    catExists: 'Já existe uma categoria com esse nome',
    confirmDeleteCat: 'Excluir a categoria "{t}"? Os hábitos dela continuam, só ficam sem categoria.',
    categories: 'Categorias', catHabits: (n) => `${n} ${n === 1 ? 'hábito' : 'hábitos'}`,
    catSummary: '{d} de {t} feitas', catTimeLeft: '{m} restantes', catEmpty: 'Nenhum hábito nesta categoria ainda.',
    catEmptyAdd: 'Adicionar hábito aqui',
  },
  en: {
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    daysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ranks: ['Rookie', 'Starter', 'Regular', 'Committed', 'Grinder', 'Machine', 'Relentless', 'Unstoppable', 'Legend'],
    nudges: ['A quick win is waiting.', 'Check it off and grab your XP.', 'Tiny step, big streak.', 'You said you would. Let\u2019s go.'],
    tabToday: 'Today', tabStats: 'Stats', addHabit: 'Add a habit',
    level: 'Level', toLevel: '{n} to level {l}', xpAria: 'XP to next level',
    today: 'Today', doneOf: '<strong>{d}</strong> of {t} done',
    dayRun: (n) => `${n} ${n === 1 ? 'day' : 'days'}`, dayRunTitle: 'Days in a row with at least one habit done',
    timeLeft: 'left of {t}', timeAllDone: "Today's time is done", timeDoneOf: '{t} done today',
    todo: 'To do', done: 'Done', later: 'Not today', show: 'Show', hide: 'Hide',
    clearedTitle: 'Day cleared', clearedText: "Everything's done. Your habits come back when they're due.",
    noneTitle: 'Nothing due today', noneText: 'Enjoy the break.',
    emptyTitle: 'Build your loop', emptyText: 'Add the things you want to do every day or every so often. Check them off to earn XP and grow your streaks.',
    examples: 'Try examples',
    backTomorrow: 'Back tomorrow', backDay: 'Back {day}', finished: 'Finished',
    everyDay: 'Every day', everyN: 'Every {n} days', backIn: 'Back in {n} days',
    oneTime: 'One time', dueOn: 'Due {d}', todayLbl: 'Today', onDate: 'On {d}', tomorrow: 'Tomorrow',
    markDone: 'Mark done', markUndone: 'Mark not done', edit: 'Edit',
    inARow: '🔥 {n} in a row on {t}', dayClearedToast: 'Day cleared! +25 XP bonus',
    habitSaved: 'Habit saved', habitAdded: 'Habit added', habitDeleted: 'Habit deleted',
    needName: 'Give it a name first', pickDay: 'Pick at least one day',
    confirmDelete: 'Delete "{t}"? Its history and XP will be removed too.',
    newHabit: 'New habit', editHabit: 'Edit habit', name: 'Name', namePh: 'e.g. Workout, Drink water, Read',
    icon: 'Icon', repeats: 'Repeats', freqDaily: 'Daily', freqDays: 'Some days', freqInterval: 'Interval', freqOnce: 'Once',
    hintDaily: 'Comes back every morning.', hintDays: 'Only shows up on the days you pick.',
    hintInterval: 'After you finish it, it comes back in {n} days.',
    everyLabel: 'Every', daysWord: 'days', nextTime: 'Next time', pickInterval: 'Pick an interval of at least 2 days',
    hintOnce: 'A regular to-do. Leaves the list after you finish it.',
    onTheseDays: 'On these days', date: 'Date', duration: 'Time needed',
    durationHint: "Optional. Counts toward today's total time.",
    reminder: 'Reminder', effort: 'Effort',
    easy: 'Easy <b>+10</b>', medium: 'Medium <b>+20</b>', hard: 'Hard <b>+35</b>',
    delete: 'Delete', saveHabit: 'Save habit',
    backupTitle: 'Backup', backupHint: 'Copy this text somewhere safe. To restore, paste a backup here and tap Restore.',
    copy: 'Copy', restore: 'Restore', backupCopied: 'Backup copied',
    confirmRestore: 'Replace everything in the app with this backup?', restored: 'Backup restored', badBackup: "That text isn't a valid backup",
    levelUp: 'Level up', keepGoing: 'Keep going',
    progress: 'Your progress', checkoffs: 'Check-offs', runLbl: 'Day run', bestRun: 'Best run', last16: 'Last 16 weeks',
    less: 'Less', more: 'More', streaks: 'Streaks', bestTotal: 'best {b}, total {t}', timeSpent: 'Time invested',
    settings: 'Settings', language: 'Language', sounds: 'Sounds', soundsSub: 'Chime when you check something off',
    testReminder: 'Send a test reminder', testSub: 'Arrives in 5 seconds',
    backupRow: 'Backup and restore', backupSub: 'Keep a copy of your habits and history',
    notifOff: 'Reminders are off. Turn on notifications for Loop in Android settings.',
    notifBrowser: 'Reminders work in the Android app, not the browser',
    testSent: 'Test reminder in 5 seconds. You can lock your phone.', testBody: 'Reminders are working. Nice.',
    streakBody: '🔥 {n} in a row. Keep it alive.', channelName: 'Habit reminders', channelDesc: 'Reminders for your habits',
    ex: ['Drink 3L of water', 'Workout', 'Read 10 pages', 'Change the bed sheets'],
    defaultCats: [['Home', '🏠'], ['Work', '💼'], ['Health', '💪'], ['Study', '📚']],
    category: 'Category', allCats: 'All', noCat: 'No category', newCat: 'New category', editCat: 'Edit category',
    addCat: '+ New', catName: 'Name', catNamePh: 'e.g. Home, Work, Pools', catColor: 'Color',
    saveCat: 'Save category', catSaved: 'Category saved', catDeleted: 'Category deleted',
    catExists: 'A category with that name already exists',
    confirmDeleteCat: 'Delete the category "{t}"? Its habits stay, they just lose the category.',
    categories: 'Categories', catHabits: (n) => `${n} ${n === 1 ? 'habit' : 'habits'}`,
    catSummary: '{d} of {t} done', catTimeLeft: '{m} left', catEmpty: 'No habits in this category yet.',
    catEmptyAdd: 'Add a habit here',
  },
};
const lang = () => (state.settings && I18N[state.settings.lang] ? state.settings.lang : 'pt-BR');
const L = () => I18N[lang()];
function t(key, params = {}) {
  let s = L()[key];
  if (s === undefined) s = I18N.en[key] ?? key;
  if (typeof s === 'function') return s(params.n);
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Minutes → "1h 25min"
function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

// ---------- Date helpers (all local time) ----------
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const todayKey = () => keyOf(new Date());
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const weekStartKey = (k) => { const d = parseKey(k); return keyOf(addDays(d, -((d.getDay() + 6) % 7))); };
const fmtDate = (k) => parseKey(k).toLocaleDateString(lang(), { day: 'numeric', month: 'short' });

// ---------- Utilities ----------
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// =========================================================
// State & storage
// =========================================================
const DEFAULT_SETTINGS = { sound: true, lang: 'pt-BR', cat: 'all' };
const CAT_COLORS = ['#3346f0', '#19c79a', '#ff5a36', '#e8a800', '#a64bf4', '#ef4f9a', '#0ea5e9', '#6b7280'];
const CAT_EMOJIS = ['🏠', '💼', '💪', '📚', '🏊', '💰', '🛒', '🧹', '🚗', '🐶', '❤️', '🎯', '🧠', '🌱', '🛠️', '📦'];
let state = { tasks: [], log: [], categories: null, settings: { ...DEFAULT_SETTINGS } };

function seedCategories() {
  state.categories = L().defaultCats.map(([name, emoji], i) => ({ id: uid(), name, emoji, color: CAT_COLORS[i] }));
}
const catById = (id) => (state.categories || []).find((c) => c.id === id) || null;
function fixCategories() {
  if (!Array.isArray(state.categories)) seedCategories();
  // a filter pointing at a deleted category falls back to "all"
  const c = state.settings.cat;
  if (c !== 'all' && c !== 'none' && !catById(c)) state.settings.cat = 'all';
}

async function loadState() {
  let raw = null;
  try {
    if (Prefs) raw = (await Prefs.get({ key: STORE_KEY })).value;
    else raw = localStorage.getItem(STORE_KEY);
  } catch (e) { console.warn('load failed', e); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { tasks: [], log: [], ...parsed };
      state.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
    } catch (e) { console.warn('bad saved data', e); }
  }
  migrate();
  fixCategories();
}

// Old "weekly" habits become "every 7 days", due 7 days after the last check-off.
function migrate() {
  for (const task of state.tasks) {
    if (task.freq !== 'weekly') continue;
    const last = entriesFor(task).map((e) => e.date).sort().pop();
    task.freq = 'interval';
    task.every = 7;
    task.date = last ? keyOf(addDays(parseKey(last), 7)) : todayKey();
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
// A "period" is what one check-off covers: a day, or forever (one-time).
// Interval habits keep their next due day in task.date; it moves forward on each check-off.
function periodOf(task, dateKey) {
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
  if (task.freq === 'once' || task.freq === 'interval') return !task.date || task.date <= todayKey();
  return true;
}

function streakOf(task) {
  if (task.freq === 'once') return 0;
  const done = new Set(entriesFor(task).map((e) => periodOf(task, e.date)));
  let n = 0;
  if (task.freq === 'interval') {
    if (task.date && task.date < todayKey()) return 0; // overdue
    const dates = [...done].sort().reverse();
    for (let i = 0; i < dates.length; i++) {
      if (i > 0 && daysBetween(dates[i], dates[i - 1]) > task.every) break;
      n++;
    }
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
  const ranks = L().ranks;
  return { lvl, into: left, need, rank: ranks[Math.min(Math.floor((lvl - 1) / 3), ranks.length - 1)] };
}

function categorize() {
  const today = todayKey();
  const todo = [], done = [], later = [];
  for (const task of state.tasks) {
    if (isDone(task)) {
      if (task.freq === 'once') {
        const e = entriesFor(task)[0];
        if (e && e.date === today) done.push(task); // finished one-timers leave after today
      } else done.push(task);
    } else if (task.freq === 'interval' && task.date > today) {
      later.push(task); // done earlier in its cycle, waiting to come back
    } else if (isDueToday(task)) todo.push(task);
    else later.push(task);
  }
  const timeVal = (x) => (x.remind && x.time ? x.time : '99:99');
  todo.sort((a, b) => timeVal(a).localeCompare(timeVal(b)) || a.createdAt - b.createdAt);
  const lastTs = (x) => Math.max(0, ...entriesFor(x).map((e) => e.ts));
  done.sort((a, b) => lastTs(b) - lastTs(a));
  return { todo, done, later };
}

// Today's time budget: everything in To do + Done, minus what's done.
function timeBudget() {
  const { todo, done } = categorize();
  const dur = (x) => x.duration || 0;
  const left = todo.reduce((s, x) => s + dur(x), 0);
  const spent = done.reduce((s, x) => s + dur(x), 0);
  return { left, spent, total: left + spent };
}

function nextDueLabel(task) {
  if (task.freq === 'daily') return t('backTomorrow');
  if (task.freq === 'interval') return t('backIn', { n: daysBetween(todayKey(), task.date) });
  if (task.freq === 'once') return t('finished');
  const today = startOfToday();
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (task.days.includes(d.getDay())) return i === 1 ? t('backTomorrow') : t('backDay', { day: L().daysLong[d.getDay()] });
  }
  return '';
}
function repeatLabel(task) {
  if (task.freq === 'daily') return t('everyDay');
  if (task.freq === 'interval') {
    if (task.date < todayKey()) return `${t('everyN', { n: task.every })} · ${t('dueOn', { d: fmtDate(task.date) })}`;
    return t('everyN', { n: task.every });
  }
  if (task.freq === 'once') {
    if (!task.date) return t('oneTime');
    if (task.date < todayKey()) return t('dueOn', { d: fmtDate(task.date) });
    return task.date === todayKey() ? t('todayLbl') : t('onDate', { d: fmtDate(task.date) });
  }
  if (task.days.length === 7) return t('everyDay');
  return WEEK_ORDER.filter((d) => task.days.includes(d)).map((d) => L().daysShort[d]).join(' ');
}
function nextLaterLabel(task) {
  if (task.freq === 'once' && task.date) return t('onDate', { d: fmtDate(task.date) });
  if (task.freq === 'interval') {
    const n = daysBetween(todayKey(), task.date);
    return n === 1 ? t('tomorrow') : `${t('onDate', { d: fmtDate(task.date) })} · ${t('backIn', { n })}`;
  }
  const today = startOfToday();
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (task.days.includes(d.getDay())) return i === 1 ? t('tomorrow') : cap1(L().daysLong[d.getDay()]);
  }
  return '';
}
function xpPreview(task) {
  return DIFF[task.diff] + Math.min(streakOf(task) * 2, 30);
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
  if (task.freq === 'interval') {
    entry.prevDate = task.date;
    task.date = keyOf(addDays(startOfToday(), task.every));
  }
  const s = streakOf(task);
  entry.xp = DIFF[task.diff] + Math.max(0, Math.min((s - 1) * 2, 30));
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
  if (s >= 3) setTimeout(() => toast(t('inARow', { n: s, t: task.title })), 350);

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
  const undone = state.log.filter((e) => e.taskId === task.id && periodOf(task, e.date) === p);
  if (task.freq === 'interval' && undone.length) task.date = undone[0].prevDate || todayKey();
  state.log = state.log.filter((e) => !undone.includes(e));
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
const clockSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
let showLater = false;
let activeTab = 'today';

function render(opts = {}) {
  renderHero();
  renderLists(opts);
  if (activeTab === 'stats') renderStats();
}

// Animated countdown for the "time left" number
const tl = { shown: null, from: 0, to: 0, start: 0, raf: 0 };
function animateTimeLeft(target) {
  if (tl.shown === null || reducedMotion()) { tl.shown = target; paintTimeLeft(); return; }
  if (target === tl.to && tl.raf) return;
  if (target === tl.shown && !tl.raf) { paintTimeLeft(); return; }
  tl.from = tl.shown; tl.to = target; tl.start = performance.now();
  cancelAnimationFrame(tl.raf);
  const step = (now) => {
    const p = Math.min(1, (now - tl.start) / 800);
    const e = 1 - Math.pow(1 - p, 3);
    tl.shown = Math.round(tl.from + (tl.to - tl.from) * e);
    paintTimeLeft();
    if (p < 1) tl.raf = requestAnimationFrame(step);
    else tl.raf = 0;
  };
  tl.raf = requestAnimationFrame(step);
}
function paintTimeLeft() {
  const el = document.getElementById('tl-num');
  if (el && tl.shown !== null) el.textContent = fmtDur(tl.shown);
}

function renderHero() {
  const xp = totalXP();
  const lv = levelInfo(xp);
  const { todo, done } = categorize();
  const total = todo.length + done.length;
  const run = dayRun();
  const tb = timeBudget();

  const pips = total > 0 && total <= 16
    ? `<div class="pips">${Array.from({ length: total }, (_, i) => `<span class="pip ${i < done.length ? 'on' : ''}"></span>`).join('')}</div>`
    : `<div class="pips"><span class="pip on" style="flex:${done.length || 0.0001}"></span><span class="pip" style="flex:${todo.length || 0.0001}"></span></div>`;

  let timeBlock = '';
  if (tb.total > 0) {
    const C = 2 * Math.PI * 23;
    const frac = tb.spent / tb.total;
    const finished = tb.left === 0;
    timeBlock = `
      <div class="time-left ${finished ? 'finished' : ''}">
        <span class="tl-icon">${finished ? checkSvg : clockSvg}</span>
        <span class="tl-main">
          ${finished
            ? `<span class="tl-num">${fmtDur(tb.total)}</span><span class="tl-label">${t('timeAllDone')}</span>`
            : `<span class="tl-num" id="tl-num">${fmtDur(tl.shown ?? tb.left)}</span><span class="tl-label">${t('timeLeft', { t: fmtDur(tb.total) })}</span>`}
        </span>
        <svg class="tl-bar" viewBox="0 0 54 54" aria-hidden="true">
          <circle class="bg" cx="27" cy="27" r="23"/>
          <circle class="fg" cx="27" cy="27" r="23" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/>
        </svg>
      </div>`;
  }

  $('#hero').innerHTML = `
    <div class="lvl">
      <span class="lvl-num">${lv.lvl}</span>
      <div class="lvl-meta">
        <div class="lvl-label">${t('level')}</div>
        <div class="rank">${lv.rank}</div>
      </div>
      ${run > 0 ? `<div class="day-run" title="${t('dayRunTitle')}">🔥 ${t('dayRun', { n: run })}</div>` : ''}
    </div>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${lv.need}" aria-valuenow="${lv.into}" aria-label="${t('xpAria')}">
      <div class="xpfill" style="width:${Math.max(3, (lv.into / lv.need) * 100)}%"></div>
    </div>
    <div class="xp-text"><span><b>${lv.into}</b> / ${lv.need} XP</span><span>${t('toLevel', { n: lv.need - lv.into, l: lv.lvl + 1 })}</span></div>
    ${total > 0 ? `
    <div class="today-bar">
      <div class="today-head"><span>${t('today')}</span><span>${t('doneOf', { d: done.length, t: total })}</span></div>
      ${pips}
    </div>` : ''}
    ${timeBlock}
  `;
  if (tb.total > 0 && tb.left > 0) animateTimeLeft(tb.left);
  else { cancelAnimationFrame(tl.raf); tl.raf = 0; tl.shown = tb.total > 0 ? 0 : null; }
}

function taskHTML(task, kind, justDone) {
  const s = streakOf(task);
  const meta = [];
  if (kind === 'done') meta.push(`<span class="back">${nextDueLabel(task)}</span>`);
  else if (kind === 'later') meta.push(`<span>${nextLaterLabel(task)}</span>`);
  else {
    const late = (task.freq === 'once' || task.freq === 'interval') && task.date && task.date < todayKey();
    meta.push(`<span class="${late ? 'late' : ''}">${repeatLabel(task)}</span>`);
  }
  const tcat = activeCat() === 'all' ? catById(task.categoryId) : null;
  if (tcat) meta.unshift(`<span class="cat-tag" style="--c:${tcat.color}"><i class="cat-dot"></i>${esc(tcat.name)}</span>`);
  if (task.duration) meta.push(`<span>⏱ ${fmtDur(task.duration)}</span>`);
  if (task.remind && task.time) meta.push(`<span>⏰ ${task.time}</span>`);
  if (s >= 2) meta.push(`<span class="streak">🔥 ${s}</span>`);

  const doneEntry = kind === 'done' ? entriesFor(task).filter((e) => periodOf(task, e.date) === periodOf(task, todayKey())).pop() : null;
  const tag = kind === 'done' ? `+${doneEntry ? doneEntry.xp : ''}` : kind === 'todo' ? `+${xpPreview(task)}` : '';
  const title = esc(task.title);

  return `
    <li class="task ${kind === 'todo' ? '' : kind} ${justDone === task.id ? 'just-done' : ''}" data-id="${task.id}">
      <button class="check" data-act="${kind === 'done' ? 'undo' : 'done'}" aria-label="${kind === 'done' ? t('markUndone') : t('markDone')}: ${title}">${checkSvg}</button>
      <button class="task-body" data-act="edit" aria-label="${t('edit')}: ${title}">
        <div class="task-title"><span class="emo">${task.emoji}</span>${title}</div>
        <div class="task-meta">${meta.join('')}</div>
      </button>
      ${tag ? `<span class="xp-tag">${tag}</span>` : ''}
    </li>`;
}

// ---------- Categories ----------
const activeCat = () => state.settings.cat || 'all';
function inCat(task, cat = activeCat()) {
  if (cat === 'all') return true;
  if (cat === 'none') return !task.categoryId || !catById(task.categoryId);
  return task.categoryId === cat;
}
function catChipsHTML() {
  const cats = state.categories || [];
  if (!cats.length) return '';
  const { todo } = categorize();
  const pending = (cat) => todo.filter((x) => inCat(x, cat)).length;
  const hasUncat = state.tasks.some((x) => inCat(x, 'none'));
  const cur = activeCat();
  const chip = (id, label, color, n) => `
    <button class="cat-chip ${cur === id ? 'on' : ''}" data-act="cat" data-cat="${id}" style="--c:${color}" aria-pressed="${cur === id}">
      ${label}${n ? `<span class="cat-n">${n}</span>` : ''}
    </button>`;
  return `<div class="cat-bar" role="group" aria-label="${t('categories')}">
    ${chip('all', t('allCats'), 'var(--ink)', pending('all'))}
    ${cats.map((c) => chip(c.id, `<span aria-hidden="true">${c.emoji}</span> ${esc(c.name)}`, c.color, pending(c.id))).join('')}
    ${hasUncat ? chip('none', t('noCat'), 'var(--ink-soft)', pending('none')) : ''}
    <button class="cat-chip add" data-act="new-cat" aria-label="${t('newCat')}">+</button>
  </div>`;
}
function setCat(id) {
  state.settings.cat = id;
  save();
  renderLists();
  const on = $('.cat-bar .on');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function renderLists({ justDone } = {}) {
  const all = categorize();
  const cat = activeCat();
  const todo = all.todo.filter((x) => inCat(x));
  const done = all.done.filter((x) => inCat(x));
  const later = all.later.filter((x) => inCat(x));
  const el = $('#lists');

  if (state.tasks.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <h3>${t('emptyTitle')}</h3>
        <p>${t('emptyText')}</p>
        <button class="btn primary" data-act="add">${t('addHabit')}</button>
        <button class="btn" data-act="examples">${t('examples')}</button>
      </div>`;
    return;
  }

  const scrollX = ($('.cat-bar') || {}).scrollLeft || 0;
  let html = catChipsHTML();
  if (cat !== 'all') {
    const c = catById(cat);
    const total = todo.length + done.length;
    const mins = todo.reduce((sum, x) => sum + (x.duration || 0), 0);
    html += `<div class="cat-summary" style="--c:${c ? c.color : 'var(--ink-soft)'}">
      <strong>${c ? `${c.emoji} ${esc(c.name)}` : t('noCat')}</strong>
      <span>${total ? t('catSummary', { d: done.length, t: total }) : ''}${mins ? ` · ⏱ ${t('catTimeLeft', { m: fmtDur(mins) })}` : ''}</span>
      ${c ? `<button class="cat-edit" data-act="edit-cat" data-cat="${c.id}" aria-label="${t('editCat')}">✎</button>` : ''}
    </div>`;
  }
  if (cat !== 'all' && !todo.length && !done.length && !later.length) {
    html += `<div class="empty small-empty"><p>${t('catEmpty')}</p><button class="btn primary" data-act="add">${t('catEmptyAdd')}</button></div>`;
    el.innerHTML = html;
    return;
  }
  html += `<div class="group"><div class="group-head"><h3>${t('todo')}</h3><span class="count">${todo.length}</span></div>`;
  if (todo.length) html += `<ul class="tasks">${todo.map((x) => taskHTML(x, 'todo')).join('')}</ul>`;
  else if (done.length) html += `<div class="cleared"><big>${t('clearedTitle')}</big>${t('clearedText')}</div>`;
  else html += `<div class="cleared"><big>${t('noneTitle')}</big>${t('noneText')}</div>`;
  html += `</div>`;

  if (done.length) {
    html += `<div class="group"><div class="group-head"><h3>${t('done')}</h3><span class="count">${done.length}</span></div>
      <ul class="tasks">${done.map((x) => taskHTML(x, 'done', justDone)).join('')}</ul></div>`;
  }
  if (later.length) {
    html += `<div class="group"><div class="group-head"><h3>${t('later')}</h3><span class="count">${later.length}</span>
      <button class="toggle-later" data-act="toggle-later">${showLater ? t('hide') : t('show')}</button></div>
      ${showLater ? `<ul class="tasks">${later.map((x) => taskHTML(x, 'later')).join('')}</ul>` : ''}</div>`;
  }
  el.innerHTML = html;
  const bar = $('.cat-bar');
  if (bar) bar.scrollLeft = scrollX;
}

function renderStats() {
  const completions = state.log.filter((e) => e.taskId);
  const counts = {};
  for (const e of completions) counts[e.date] = (counts[e.date] || 0) + 1;

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

  const byId = Object.fromEntries(state.tasks.map((x) => [x.id, x]));
  const minutes = completions.reduce((s, e) => s + ((byId[e.taskId] && byId[e.taskId].duration) || 0), 0);

  const habits = state.tasks.filter((x) => x.freq !== 'once').map((x) => {
    const s = streakOf(x);
    return { x, s, best: Math.max(x.best || 0, s), total: entriesFor(x).length };
  }).sort((a, b) => b.s - a.s || b.total - a.total);

  $('#stats').innerHTML = `
    <h2>${t('progress')}</h2>
    <div class="stat-row">
      <div class="stat"><b>${completions.length}</b><span>${t('checkoffs')}</span></div>
      <div class="stat"><b>${dayRun()}</b><span>${t('runLbl')}</span></div>
      <div class="stat"><b>${bestDayRun()}</b><span>${t('bestRun')}</span></div>
    </div>
    ${minutes ? `<div class="stat" style="margin-top:10px"><b>${fmtDur(minutes)}</b><span>${t('timeSpent')}</span></div>` : ''}

    <h3>${t('last16')}</h3>
    <div class="heat-wrap"><div class="heat">${cells}</div></div>
    <div class="heat-legend">${t('less')} <i style="background:var(--line)"></i><i style="background:color-mix(in srgb,var(--cobalt) 35%,var(--line))"></i><i style="background:color-mix(in srgb,var(--cobalt) 60%,var(--line))"></i><i style="background:var(--cobalt)"></i><i style="background:var(--sun)"></i> ${t('more')}</div>

    ${habits.length ? `
    <h3>${t('streaks')}</h3>
    <ul class="habit-list">
      ${habits.map(({ x, s, best, total }) => `
        <li><span class="emo">${x.emoji}</span><span class="name">${esc(x.title)}</span>
        <span class="nums"><b>🔥 ${s}</b><br>${t('bestTotal', { b: best, t: total })}</span></li>`).join('')}
    </ul>` : ''}

    <h3>${t('settings')}</h3>
    <div class="settings">
      <label class="row"><span>${t('language')}</span>
        <select id="set-lang">
          <option value="pt-BR" ${lang() === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
          <option value="en" ${lang() === 'en' ? 'selected' : ''}>English</option>
        </select></label>
      <label class="row"><span>${t('sounds')}<small>${t('soundsSub')}</small></span>
        <span class="switch"><input type="checkbox" id="set-sound" ${state.settings.sound ? 'checked' : ''}><span class="switch-ui"></span></span></label>
      <button class="row" data-act="test-notif"><span>${t('testReminder')}<small>${t('testSub')}</small></span>⏰</button>
      <button class="row" data-act="backup"><span>${t('backupRow')}<small>${t('backupSub')}</small></span>💾</button>
    </div>

    <h3>${t('categories')}</h3>
    <div class="settings">
      ${(state.categories || []).map((c) => {
        const n = state.tasks.filter((x) => x.categoryId === c.id).length;
        return `<button class="row" data-act="edit-cat" data-cat="${c.id}">
          <span class="cat-row-name"><i class="cat-dot" style="--c:${c.color}"></i>${c.emoji} ${esc(c.name)}<small>${t('catHabits', { n })}</small></span>✎</button>`;
      }).join('')}
      <button class="row add-row" data-act="new-cat"><span>${t('newCat')}</span>＋</button>
    </div>
  `;
  $('#set-sound').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); });
  $('#set-lang').addEventListener('change', (e) => setLang(e.target.value));
}

// Static text in index.html
function applyStatic() {
  document.documentElement.lang = lang();
  $$('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  buildFormOptions();
}
function setLang(code) {
  state.settings.lang = code;
  save();
  applyStatic();
  render();
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
  const now = actx.currentTime;
  tone(base, now, 0.28);
  tone(base * 1.5, now + 0.07, 0.35);
}
function fanfare() {
  if (!audio()) return;
  const now = actx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, now + i * 0.1, 0.4, 'square', 0.1));
  tone(1046.5, now + 0.42, 0.8, 'triangle', 0.2);
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
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('win', win);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function dayCleared() {
  hapticWin();
  fanfare();
  burst(innerWidth * 0.2, innerHeight * 0.35, 30, 1.2);
  burst(innerWidth * 0.8, innerHeight * 0.35, 30, 1.2);
  toast(t('dayClearedToast'), true);
}

function levelUp(lvl) {
  $('#levelup-num').textContent = lvl;
  $('#levelup-rank').textContent = levelInfo(totalXP()).rank;
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
  date: $('#f-date'), remind: $('#f-remind'), time: $('#f-time'), diff: $('#f-diff'),
  every: $('#f-every'), everyQuick: $('#f-every-quick'),
  durH: $('#f-dur-h'), durM: $('#f-dur-m'), durQuick: $('#f-dur-quick'), cat: $('#f-cat'),
};
let draft = null;
let catDraft = null;
let catReturnToTask = false;

form.emoji.innerHTML = EMOJIS.map((e) => `<button type="button" role="radio" data-v="${e}" aria-label="${e}">${e}</button>`).join('');
function buildFormOptions() {
  const dl = L().daysLong, ds = L().daysShort;
  form.days.innerHTML = WEEK_ORDER.map((d) => `<button type="button" role="checkbox" data-v="${d}" aria-label="${dl[d]}">${ds[d]}</button>`).join('');
  if (draft) syncSheet();
}

const FREQ_HINT_KEYS = { daily: 'hintDaily', days: 'hintDays', interval: 'hintInterval', once: 'hintOnce' };
const clampInt = (v, max) => Math.min(max, Math.max(0, parseInt(v, 10) || 0));
const formEvery = () => Math.min(365, parseInt(form.every.value, 10) || 0);
const formMinutes = () => clampInt(form.durH.value, 23) * 60 + clampInt(form.durM.value, 59);
function setFormMinutes(min) {
  form.durH.value = min >= 60 ? Math.floor(min / 60) : '';
  form.durM.value = min % 60 ? min % 60 : '';
}

function openSheet(task = null) {
  editing = task;
  draft = task ? { ...task, days: [...task.days] } : {
    title: '', emoji: '✅', freq: 'daily', days: [1, 3, 5], date: todayKey(), every: 30,
    remind: false, time: '09:00', diff: 2, duration: 0,
    categoryId: ['all', 'none'].includes(activeCat()) ? null : activeCat(),
  };
  $('#sheet-title').textContent = task ? t('editHabit') : t('newHabit');
  $('#btn-delete').hidden = !task;
  form.title.value = draft.title;
  form.date.value = draft.date || todayKey();
  form.remind.checked = !!draft.remind;
  form.time.value = draft.time || '09:00';
  form.every.value = draft.every || 30;
  setFormMinutes(draft.duration || 0);
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
  const mins = formMinutes();
  $$('button', form.durQuick).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.m === mins));
  $('#row-days').hidden = draft.freq !== 'days';
  $('#row-date').hidden = draft.freq !== 'once' && draft.freq !== 'interval';
  $('#date-label').textContent = draft.freq === 'interval' ? t('nextTime') : t('date');
  $('#row-every').hidden = draft.freq !== 'interval';
  const every = formEvery();
  $$('button', form.everyQuick).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.d === every));
  $('#row-time').hidden = !form.remind.checked;
  $('#freq-hint').textContent = t(FREQ_HINT_KEYS[draft.freq], { n: every || '…' });
  renderCatPicker();
}
function renderCatPicker() {
  const cur = catById(draft.categoryId) ? draft.categoryId : null;
  const opt = (id, label, color) =>
    `<button type="button" role="radio" class="cat-opt" data-v="${id || ''}" style="--c:${color}" aria-checked="${cur === id}">${label}</button>`;
  form.cat.innerHTML = opt(null, t('noCat'), 'var(--ink-soft)')
    + (state.categories || []).map((c) => opt(c.id, `${c.emoji} ${esc(c.name)}`, c.color)).join('')
    + `<button type="button" class="cat-opt add" data-act="new-cat-from-task">${t('addCat')}</button>`;
}
form.cat.addEventListener('click', (e) => {
  const b = e.target.closest('.cat-opt'); if (!b || b.dataset.act) return;
  draft.categoryId = b.dataset.v || null;
  renderCatPicker();
});

form.emoji.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { draft.emoji = b.dataset.v; syncSheet(); } });
form.freq.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { draft.freq = b.dataset.v; syncSheet(); } });
form.diff.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { draft.diff = +b.dataset.v; syncSheet(); } });
form.days.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = +b.dataset.v;
  draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
  syncSheet();
});
form.durQuick.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const m = +b.dataset.m;
  setFormMinutes(formMinutes() === m ? 0 : m); // tap again to clear
  syncSheet();
});
form.everyQuick.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  form.every.value = b.dataset.d;
  syncSheet();
});
form.every.addEventListener('input', syncSheet);
form.durH.addEventListener('input', syncSheet);
form.durM.addEventListener('input', syncSheet);
form.remind.addEventListener('change', syncSheet);

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = form.title.value.trim();
  if (!title) { form.title.focus(); toast(t('needName')); return; }
  if (draft.freq === 'days' && draft.days.length === 0) { toast(t('pickDay')); return; }
  const every = formEvery();
  if (draft.freq === 'interval' && every < 2) { form.every.focus(); toast(t('pickInterval')); return; }

  let date = null;
  if (draft.freq === 'once' || draft.freq === 'interval') date = form.date.value || todayKey();
  // Changed the interval but not the date: count again from the last check-off.
  if (draft.freq === 'interval' && editing && editing.freq === 'interval' && every !== editing.every && date === editing.date) {
    const last = entriesFor(editing).map((e) => e.date).sort().pop();
    if (last) date = keyOf(addDays(parseKey(last), every));
  }

  const data = {
    title, emoji: draft.emoji, freq: draft.freq, days: draft.days.sort(),
    date, every: draft.freq === 'interval' ? every : null,
    remind: form.remind.checked, time: form.time.value || '09:00',
    diff: draft.diff,
    duration: formMinutes(),
    categoryId: catById(draft.categoryId) ? draft.categoryId : null,
  };
  const wasEditing = !!editing;
  if (editing) Object.assign(editing, data);
  else state.tasks.push({ id: uid(), createdAt: Date.now(), best: 0, ...data });

  closeSheets();
  save();
  render();
  toast(wasEditing ? t('habitSaved') : t('habitAdded'));
  if (data.remind) await ensureNotifPermission();
});

$('#btn-delete').addEventListener('click', () => {
  if (!editing) return;
  if (!confirm(t('confirmDelete', { t: editing.title }))) return;
  const id = editing.id;
  state.tasks = state.tasks.filter((x) => x.id !== id);
  state.log = state.log.filter((e) => e.taskId !== id);
  closeSheets();
  save();
  render();
  toast(t('habitDeleted'));
});

// =========================================================
// Category sheet
// =========================================================
const catForm = { name: $('#c-name'), emoji: $('#c-emoji'), color: $('#c-color') };
catForm.emoji.innerHTML = CAT_EMOJIS.map((e) => `<button type="button" role="radio" data-v="${e}" aria-label="${e}">${e}</button>`).join('');
catForm.color.innerHTML = CAT_COLORS.map((c) => `<button type="button" role="radio" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('');

function openCatSheet(cat = null, fromTask = false) {
  catReturnToTask = fromTask;
  const used = (state.categories || []).map((c) => c.color);
  catDraft = cat ? { ...cat } : {
    id: null, name: '', emoji: CAT_EMOJIS[(state.categories || []).length % CAT_EMOJIS.length],
    color: CAT_COLORS.find((c) => !used.includes(c)) || CAT_COLORS[0],
  };
  $('#cat-title').textContent = cat ? t('editCat') : t('newCat');
  $('#btn-cat-delete').hidden = !cat;
  catForm.name.value = catDraft.name;
  syncCatSheet();
  $('#cat-sheet').hidden = false;
  if (!cat) setTimeout(() => catForm.name.focus(), 250);
}
function closeCatSheet() { $('#cat-sheet').hidden = true; catDraft = null; }
function syncCatSheet() {
  $$('button', catForm.emoji).forEach((b) => b.setAttribute('aria-checked', b.dataset.v === catDraft.emoji));
  $$('button', catForm.color).forEach((b) => b.setAttribute('aria-checked', b.dataset.v === catDraft.color));
  $('#cat-preview').innerHTML = `<span class="cat-chip on" style="--c:${catDraft.color}">${catDraft.emoji} ${esc(catForm.name.value.trim() || t('catName'))}</span>`;
}
catForm.emoji.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { catDraft.emoji = b.dataset.v; syncCatSheet(); } });
catForm.color.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { catDraft.color = b.dataset.v; syncCatSheet(); } });
catForm.name.addEventListener('input', syncCatSheet);

$('#cat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = catForm.name.value.trim();
  if (!name) { catForm.name.focus(); toast(t('needName')); return; }
  const clash = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== catDraft.id);
  if (clash) { toast(t('catExists')); return; }
  let id = catDraft.id;
  if (id) Object.assign(catById(id), { name, emoji: catDraft.emoji, color: catDraft.color });
  else { id = uid(); state.categories.push({ id, name, emoji: catDraft.emoji, color: catDraft.color }); }
  const returning = catReturnToTask;
  closeCatSheet();
  save();
  if (returning && draft) { draft.categoryId = id; renderCatPicker(); }
  render();
  toast(t('catSaved'));
});
$('#btn-cat-delete').addEventListener('click', () => {
  if (!catDraft || !catDraft.id) return;
  if (!confirm(t('confirmDeleteCat', { t: catDraft.name }))) return;
  const id = catDraft.id;
  state.categories = state.categories.filter((c) => c.id !== id);
  state.tasks.forEach((x) => { if (x.categoryId === id) x.categoryId = null; });
  if (state.settings.cat === id) state.settings.cat = 'all';
  closeCatSheet();
  save();
  render();
  toast(t('catDeleted'));
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
  try { await navigator.clipboard.writeText(ta.value); }
  catch { ta.select(); document.execCommand('copy'); }
  toast(t('backupCopied'));
});
$('#btn-restore').addEventListener('click', () => {
  try {
    const data = JSON.parse($('#backup-text').value);
    if (!Array.isArray(data.tasks) || !Array.isArray(data.log)) throw new Error('shape');
    if (!confirm(t('confirmRestore'))) return;
    state = { ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } };
    fixCategories();
    migrate();
    closeSheets(); save(); applyStatic(); render();
    toast(t('restored'), true);
  } catch { toast(t('badBackup')); }
});

// =========================================================
// Notifications (local, scheduled on the phone)
// =========================================================
async function ensureNotifPermission() {
  if (!LN) return false;
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { toast(t('notifOff')); return false; }
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
  if (task.freq === 'once') return (task.date || '') === keyOf(date);
  if (task.freq === 'interval') return keyOf(date) >= (task.date || ''); // due day, then daily while overdue
  return false;
}
function reminderBody(task) {
  const s = streakOf(task);
  const nudges = L().nudges;
  const base = s >= 2 ? t('streakBody', { n: s }) : nudges[(Math.random() * nudges.length) | 0];
  return task.duration ? `⏱ ${fmtDur(task.duration)}. ${base}` : base;
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
      for (const task of state.tasks) {
        if (!task.remind || !task.time || !remindsOn(task, day) || isDone(task, dk)) continue;
        const [h, m] = task.time.split(':').map(Number);
        const at = new Date(day); at.setHours(h, m, 0, 0);
        if (at <= now) continue;
        list.push({ at, task });
      }
    }
    list.sort((a, b) => a.at - b.at);
    const notifications = list.slice(0, NOTIF_MAX).map(({ at, task }, i) => ({
      id: i + 1,
      title: `${task.emoji} ${task.title}`,
      body: reminderBody(task),
      channelId: 'reminders',
      schedule: { at, allowWhileIdle: true },
      extra: { taskId: task.id },
    }));
    if (notifications.length) await LN.schedule({ notifications });
  } catch (e) { console.warn('notification sync failed', e); }
}

async function testNotification() {
  if (!LN) { toast(t('notifBrowser')); return; }
  if (!(await ensureNotifPermission())) return;
  await LN.schedule({ notifications: [{
    id: TEST_NOTIF_ID, title: '✅ Loop', body: t('testBody'),
    channelId: 'reminders', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
  }] });
  toast(t('testSent'));
}

// =========================================================
// Examples
// =========================================================
function addExamples() {
  const cats = state.categories || [];
  const cid = (i) => (cats[i] ? cats[i].id : null);
  const base = { best: 0, date: null, every: null };
  const now = Date.now();
  const ex = L().ex;
  state.tasks.push(
    { ...base, id: uid(), createdAt: now, title: ex[0], emoji: '💧', freq: 'daily', days: [], remind: true, time: '10:00', diff: 1, duration: 0, categoryId: cid(2) },
    { ...base, id: uid(), createdAt: now + 1, title: ex[1], emoji: '💪', freq: 'days', days: [1, 3, 5], remind: true, time: '18:00', diff: 3, duration: 60, categoryId: cid(2) },
    { ...base, id: uid(), createdAt: now + 2, title: ex[2], emoji: '📚', freq: 'daily', days: [], remind: true, time: '22:00', diff: 1, duration: 20, categoryId: cid(3) },
    { ...base, id: uid(), createdAt: now + 3, title: ex[3], emoji: '🛏️', freq: 'interval', every: 15, date: todayKey(), days: [], remind: true, time: '19:00', diff: 2, duration: 20, categoryId: cid(0) },
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
  const el = e.target.closest('[data-act], [data-tab], [data-close], [data-close-cat], #fab, #levelup-ok');
  if (!el) return;
  if (el.id === 'fab') return openSheet();
  if (el.id === 'levelup-ok') { $('#levelup').hidden = true; return; }
  if (el.dataset.closeCat !== undefined) return closeCatSheet();
  if (el.dataset.close !== undefined) return closeSheets();
  if (el.dataset.tab) return setTab(el.dataset.tab);

  const act = el.dataset.act;
  const li = el.closest('.task');
  const task = li && state.tasks.find((x) => x.id === li.dataset.id);
  switch (act) {
    case 'done': if (task) completeTask(task, el); break;
    case 'undo': if (task) uncompleteTask(task); break;
    case 'edit': if (task) openSheet(task); break;
    case 'add': openSheet(); break;
    case 'examples': addExamples(); break;
    case 'toggle-later': showLater = !showLater; renderLists(); break;
    case 'test-notif': testNotification(); break;
    case 'backup': openBackup(); break;
    case 'cat': setCat(el.dataset.cat); break;
    case 'new-cat': openCatSheet(); break;
    case 'new-cat-from-task': openCatSheet(null, true); break;
    case 'edit-cat': openCatSheet(catById(el.dataset.cat)); break;
  }
});

// Android back button: close things before leaving the app
if (AppPlugin) {
  AppPlugin.addListener('backButton', () => {
    if (!$('#levelup').hidden) { $('#levelup').hidden = true; return; }
    if (!$('#cat-sheet').hidden) { closeCatSheet(); return; }
    if (!$('#sheet').hidden || !$('#backup').hidden) { closeSheets(); return; }
    if (activeTab !== 'today') { setTab('today'); return; }
    AppPlugin.exitApp();
  });
}

// New day while the app is open, or coming back from background
let lastDay = todayKey();
function checkDayRollover() {
  if (todayKey() !== lastDay) { lastDay = todayKey(); tl.shown = null; render(); scheduleNotifSync(); }
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
  applyStatic();
  if (LN) {
    try {
      await LN.createChannel({
        id: 'reminders', name: t('channelName'), description: t('channelDesc'),
        importance: 4, visibility: 1, vibration: true,
      });
    } catch (e) { console.warn(e); }
    if (state.tasks.some((x) => x.remind)) ensureNotifPermission();
    else scheduleNotifSync();
  }
  render();
})();
