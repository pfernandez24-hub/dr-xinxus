// Progreso del jugador, guardado en el móvil (localStorage).
// v2 (oct. 2026): temario reordenado con los temas 1B y 1C; el progreso empieza de cero.
const KEY = 'drxinxus.v2';
export const MAX_HEARTS = 5;
export const HEART_REFILL_MS = 20 * 60 * 1000; // una vida cada 20 minutos

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Semana ISO (lunes a domingo), p. ej. "2026-W41".
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function fresh() {
  return {
    v: 1,
    id: uuid(),
    nick: '',
    clase: '',
    createdAt: Date.now(),
    xp: 0,
    weekly: { week: weekKey(), xp: 0 },
    daily: { day: dayKey(), xp: 0 },
    goal: 30,
    streak: { count: 0, last: null, best: 0 },
    hearts: { n: MAX_HEARTS, ts: Date.now() },
    done: {},
    achievements: {},
    stats: { commands: 0, lessons: 0, perfect: 0, exercises: 0, correct: 0, term: 0, bugs: 0, sudo: false, night: false, early: false, practice: 0 },
    settings: { sound: true, reminder: '20:00' },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const base = fresh();
      return { ...base, ...s, stats: { ...base.stats, ...s.stats }, settings: { ...base.settings, ...s.settings } };
    }
  } catch { /* sin almacenamiento: se empieza de cero */ }
  return fresh();
}

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* modo privado */ }
  listeners.forEach(fn => fn(state));
}

export function get() {
  rollPeriods();
  refillHearts();
  return state;
}

export function reset() {
  const keepId = state.id;
  state = fresh();
  state.id = keepId;
  save();
}

// Reinicia contadores diarios y semanales y rompe la racha si se saltó un día.
function rollPeriods() {
  const today = dayKey();
  if (state.daily.day !== today) state.daily = { day: today, xp: 0 };
  const wk = weekKey();
  if (state.weekly.week !== wk) state.weekly = { week: wk, xp: 0 };
  if (state.streak.last && daysBetween(state.streak.last, today) > 1) state.streak.count = 0;
}

export function refillHearts() {
  const h = state.hearts;
  if (h.n >= MAX_HEARTS) { h.ts = Date.now(); return; }
  const gained = Math.floor((Date.now() - h.ts) / HEART_REFILL_MS);
  if (gained > 0) {
    h.n = Math.min(MAX_HEARTS, h.n + gained);
    h.ts += gained * HEART_REFILL_MS;
  }
}

export function msToNextHeart() {
  const h = state.hearts;
  if (h.n >= MAX_HEARTS) return 0;
  return Math.max(0, HEART_REFILL_MS - (Date.now() - h.ts));
}

export function loseHeart() {
  refillHearts();
  if (state.hearts.n === MAX_HEARTS) state.hearts.ts = Date.now();
  state.hearts.n = Math.max(0, state.hearts.n - 1);
  save();
  return state.hearts.n;
}

export function gainHeart(n = 1) {
  state.hearts.n = Math.min(MAX_HEARTS, state.hearts.n + n);
  save();
}

export function addXP(n) {
  rollPeriods();
  state.xp += n;
  state.weekly.xp += n;
  state.daily.xp += n;
}

// Cuenta el día para la racha. Devuelve true si la racha ha subido hoy.
export function touchStreak() {
  const today = dayKey();
  const s = state.streak;
  if (s.last === today) return false;
  s.count = s.last && daysBetween(s.last, today) === 1 ? s.count + 1 : 1;
  s.last = today;
  s.best = Math.max(s.best, s.count);
  return true;
}

export function completeLesson(lessonId, { errors, practice }) {
  const prev = state.done[lessonId];
  const perfect = errors === 0;
  const first = !prev;
  let xp = practice ? 5 : first ? 10 : 5;
  if (perfect) xp += 5;
  addXP(xp);
  state.done[lessonId] = {
    times: (prev?.times || 0) + 1,
    best: prev ? Math.min(prev.best, errors) : errors,
    at: Date.now(),
  };
  state.stats.lessons++;
  if (perfect) state.stats.perfect++;
  if (practice) state.stats.practice++;
  const h = new Date().getHours();
  if (h >= 23 || h < 5) state.stats.night = true;
  if (h >= 5 && h < 8) state.stats.early = true;
  const streakUp = touchStreak();
  save();
  return { xp, perfect, first, streakUp };
}

export function completeExam(correct, total, grade) {
  const xp = correct;
  addXP(xp);
  state.stats.exams = (state.stats.exams || 0) + 1;
  state.stats.examBest = Math.max(state.stats.examBest ?? 0, grade);
  const streakUp = touchStreak();
  save();
  return { xp, streakUp };
}

export function setProfile(nick, clase) {
  state.nick = nick.trim().slice(0, 20);
  state.clase = clase.trim().toUpperCase().slice(0, 16);
  save();
}

export function setSetting(k, v) {
  state.settings[k] = v;
  save();
}

export function setGoal(n) {
  state.goal = n;
  save();
}

export function bumpStat(k, n = 1) {
  state.stats[k] = (state.stats[k] || 0) + n;
}

export function setStat(k, v) {
  state.stats[k] = v;
}

export function unlock(id) {
  if (state.achievements[id]) return false;
  state.achievements[id] = Date.now();
  save();
  return true;
}
