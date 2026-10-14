// Dr.Xinxus: pantallas y navegación.
import { h, rich, shuffle } from './dom.js';
import { UNITS, LESSONS, SECTIONS, EXAM_POOL } from './content.js';
import * as store from './store.js';
import { mascot } from './mascot.js';
import { runLesson } from './lesson.js';
import { Shell } from './shell.js';
import { createTerminal } from './terminal-ui.js';
import { ACHIEVEMENTS, checkAchievements } from './achievements.js';
import { rankingEnabled, pushScore, fetchRanking } from './ranking.js';
import { play } from './sound.js';

const app = document.getElementById('app');
let tab = 'learn';
let sandbox = null;

// ---------- Utilidades ----------

function toast(content, cls = '') {
  const t = h('div', { class: 'toast ' + cls }, content);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

function announceAchievements() {
  for (const a of checkAchievements()) {
    toast(h('div', { class: 'toast-ach' }, h('span', { class: 'toast-icon' }, a.icon), h('div', {}, h('strong', {}, '¡Logro desbloqueado!'), h('div', {}, a.title))), 'gold');
  }
}

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function currentLessonIndex(s) {
  const i = LESSONS.findIndex(l => !s.done[l.id]);
  return i < 0 ? LESSONS.length : i;
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---------- Barra superior y navegación ----------

function topBar() {
  const s = store.get();
  return h('header', { class: 'topbar' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', html: mascot('normal', 30) }), h('span', {}, 'Dr.Xinxus')),
    h('div', { class: 'stats' },
      h('span', { class: 'stat ' + (s.streak.last === store.dayKey() ? 'stat-fire' : 'stat-off'), title: 'Racha de días' }, '🔥 ', String(s.streak.count)),
      h('span', { class: 'stat stat-xp', title: 'Experiencia total' }, '⚡ ', String(s.xp)),
      h('span', { class: 'stat stat-heart', title: 'Vidas' }, '❤️ ', String(s.hearts.n))));
}

function bottomNav() {
  const items = [['learn', '🏠', 'Aprender'], ['term', '⌨️', 'Terminal'], ['rank', '🏆', 'Ranking'], ['me', '👤', 'Perfil']];
  return h('nav', { class: 'bottomnav', 'aria-label': 'Secciones' },
    items.map(([id, icon, label]) => h('button', {
      type: 'button', class: 'nav-item' + (tab === id ? ' active' : ''), 'aria-current': tab === id ? 'page' : null,
      onclick: () => { tab = id; render(); },
    }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'nav-label' }, label))));
}

function render() {
  const s = store.get();
  if (!s.nick) { renderOnboarding(); return; }
  const content = { learn: learnView, term: terminalView, rank: rankingView, me: profileView }[tab]();
  app.replaceChildren(h('div', { class: 'shell' }, topBar(), h('main', { class: 'content', id: 'content' }, content), bottomNav()));
}

// ---------- Bienvenida ----------

function renderOnboarding(step = 0) {
  const s = store.get();
  if (step === 0) {
    app.replaceChildren(h('div', { class: 'center-screen onboarding' },
      h('div', { class: 'bounce', html: mascot('happy', 150) }),
      h('h1', {}, '¡Hola! Soy Dr.Xinxus'),
      h('p', { class: 'lead' }, 'Te voy a enseñar a moverte por el servidor de Bioinformática como un pro: rutas, ficheros, permisos, vi, git y scripts de bash.'),
      h('p', { class: 'muted' }, 'Cinco minutos al día. Con una terminal de Ubuntu de verdad… bueno, casi.'),
      h('button', { type: 'button', class: 'btn btn-main', onclick: () => renderOnboarding(1) }, 'Empezar')));
    return;
  }
  if (step === 1) {
    const nick = h('input', { class: 'field', id: 'nick', maxlength: 20, value: s.nick || '', placeholder: 'Tu apodo', autocomplete: 'nickname', required: true });
    const clase = h('input', { class: 'field mono', id: 'clase', maxlength: 16, value: s.clase || 'BIOINFO26', autocapitalize: 'characters' });
    const err = h('p', { class: 'form-err', role: 'alert' });
    const form = h('form', {
      class: 'center-screen onboarding',
      onsubmit: e => {
        e.preventDefault();
        if (!nick.value.trim()) { err.textContent = 'Escribe un apodo para el ranking.'; nick.focus(); return; }
        store.setProfile(nick.value, clase.value || 'BIOINFO26');
        renderOnboarding(2);
      },
    },
    h('div', { html: mascot('think', 110) }),
    h('h1', {}, '¿Cómo te llamo?'),
    h('label', { class: 'label', for: 'nick' }, 'Tu apodo (lo verán tus compañeros en el ranking)'),
    nick,
    h('label', { class: 'label', for: 'clase' }, 'Código de clase'),
    clase,
    h('p', { class: 'muted small' }, 'Todos los de clase tenéis que poner el mismo código para salir en el mismo ranking.'),
    err,
    h('button', { type: 'submit', class: 'btn btn-main' }, 'Continuar'));
    app.replaceChildren(form);
    setTimeout(() => nick.focus(), 100);
    return;
  }
  const goals = [[10, 'Tranqui', '1 lección al día'], [20, 'Normal', '2 lecciones'], [30, 'En serio', '3 lecciones'], [50, 'Modo examen', '4-5 lecciones']];
  app.replaceChildren(h('div', { class: 'center-screen onboarding' },
    h('div', { html: mascot('wow', 110) }),
    h('h1', {}, 'Elige tu meta diaria'),
    h('div', { class: 'goal-list' }, goals.map(([xp, name, sub]) => h('button', {
      type: 'button', class: 'goal-opt' + (s.goal === xp ? ' selected' : ''),
      onclick: () => { store.setGoal(xp); tab = 'learn'; pushScore(); render(); },
    }, h('strong', {}, name), h('span', { class: 'muted' }, `${xp} XP · ${sub}`))))));
}

// ---------- Aprender (mapa) ----------

function learnView() {
  const s = store.get();
  const cur = currentLessonIndex(s);
  const goalPct = Math.min(100, Math.round((s.daily.xp / s.goal) * 100));
  const curLesson = LESSONS[cur];
  const greet = s.daily.xp >= s.goal
    ? '¡Meta de hoy cumplida! Lo que hagas ahora es extra. 🎉'
    : curLesson ? `Hoy toca: ${curLesson.unit.title} · ${curLesson.title}${/[?!.]$/.test(curLesson.title) ? "" : "."}` : '¡Has terminado todo el Tema 1! Haz simulacros para el examen.';

  const banners = [];
  if (isIOS() && !isStandalone()) {
    banners.push(h('div', { class: 'banner-card' }, '📲 ', h('span', { html: rich('**Instálala en el iPhone:** pulsa Compartir ⬆️ y luego **Añadir a pantalla de inicio**.') })));
  }
  if (s.streak.count > 0 && s.streak.last !== store.dayKey()) {
    banners.push(h('div', { class: 'banner-card warn' }, `🔥 Haz una lección hoy para no perder tu racha de ${s.streak.count} ${s.streak.count === 1 ? 'día' : 'días'}.`));
  }

  const hello = h('section', { class: 'hello-card' },
    h('div', { class: 'hello-mascot', html: mascot(s.daily.xp >= s.goal ? 'happy' : 'normal', 72) }),
    h('div', { class: 'hello-body' },
      h('div', { class: 'bubble' }, `¡Hola, ${s.nick}! ${greet}`),
      h('div', { class: 'goal' },
        h('div', { class: 'goal-label' }, h('span', {}, 'Meta diaria'), h('span', {}, `${Math.min(s.daily.xp, s.goal)}/${s.goal} XP`)),
        h('div', { class: 'progress small' }, h('div', { class: 'progress-fill', style: { width: goalPct + '%' } })))),
    Object.keys(s.done).length ? h('button', { type: 'button', class: 'btn btn-small', onclick: () => startPractice() }, '🔁 Repaso') : null);

  const best = s.stats.examBest;
  const exam = h('section', { class: 'exam-card' },
    h('div', { class: 'exam-icon', 'aria-hidden': 'true' }, '📝'),
    h('div', { class: 'exam-body' },
      h('strong', {}, 'Simulacro de examen'),
      h('div', { class: 'muted small' }, `${EXAM_SIZE} preguntas tipo test de todo el Tema 1, con las opciones barajadas.` + (best !== undefined ? ` Mejor nota: ${best.toFixed(1)}.` : ''))),
    h('button', { type: 'button', class: 'btn btn-small btn-main', onclick: () => startExam() }, 'Empezar'));

  let idx = 0;
  let lastSection = null;
  const units = UNITS.map((u, ui) => {
    const sec = u.section !== lastSection ? SECTIONS.find(x => x.id === u.section) : null;
    lastSection = u.section;
    const nodes = u.lessons.map((l, li) => {
      const i = idx++;
      const done = !!s.done[l.id];
      const locked = i > cur;
      const isCur = i === cur;
      const offset = Math.round(Math.sin((i * Math.PI) / 2.5) * 70);
      const best = s.done[l.id]?.best;
      return h('div', { class: 'node-wrap', style: { transform: `translateX(${offset}px)` } },
        isCur ? h('div', { class: 'node-start' }, 'EMPEZAR') : null,
        h('button', {
          type: 'button',
          class: `node color-${u.color}` + (done ? ' done' : '') + (locked ? ' locked' : '') + (isCur ? ' current' : ''),
          'aria-label': `${l.title}${done ? ' (completada)' : locked ? ' (bloqueada)' : ''}`,
          disabled: locked,
          onclick: () => openLessonSheet(l, u, done),
        }, done ? (best === 0 ? '👑' : '✓') : locked ? '🔒' : u.icon),
        h('div', { class: 'node-label' }, l.title));
    });
    return h('section', { class: 'unit' },
      sec ? h('div', { class: 'section-head' }, h('span', { class: 'section-num' }, `Sección ${SECTIONS.indexOf(sec) + 1}`), h('h2', {}, sec.title), h('p', { class: 'muted small' }, sec.desc)) : null,
      h('div', { class: `unit-head color-${u.color}` },
        h('div', {}, h('div', { class: 'unit-kicker' }, `Unidad ${ui + 1}`), h('h2', {}, u.title), h('p', {}, u.desc)),
        h('span', { class: 'unit-icon', 'aria-hidden': 'true' }, u.icon)),
      h('div', { class: 'path' }, nodes));
  });

  return h('div', { class: 'learn' }, banners, hello, exam, units,
    h('p', { class: 'footnote muted small' }, 'Temario: Tema 1 (1A, 1B y 1C) · Bioinformática · Grado en Biotecnología, UCAM 2026/27.'));
}

function openLessonSheet(lesson, unit, done) {
  const s = store.get();
  const n = lesson.exercises.filter(e => e.type !== 'info').length;
  const terms = lesson.exercises.filter(e => e.type === 'term').length;
  const close = () => sheet.remove();
  const noHearts = !done && s.hearts.n <= 0;
  const sheet = h('div', { class: 'sheet-backdrop', onclick: e => { if (e.target === sheet) close(); } },
    h('div', { class: `sheet color-${unit.color}`, role: 'dialog', 'aria-label': lesson.title },
      h('div', { class: 'sheet-kicker' }, unit.title),
      h('h2', {}, lesson.title),
      h('p', { class: 'muted' }, `${n} ejercicios · ${terms} en la terminal`),
      noHearts ? h('p', { class: 'warn-text' }, `Sin vidas. La próxima llega en ${Math.ceil(store.msToNextHeart() / 60000)} min, o gánala con un repaso.`) : null,
      h('button', {
        type: 'button', class: 'btn btn-main', onclick: () => { close(); noHearts ? startPractice() : startLesson(lesson, { replay: done }); },
      }, noHearts ? 'Repasar' : done ? 'Repetir (+5 XP)' : `Empezar (+10 XP)`),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: close }, 'Cerrar')));
  document.body.append(sheet);
}

function startLesson(lesson, { replay } = {}) {
  runLesson(app, {
    lesson,
    exercises: lesson.exercises,
    practice: false,
    onExit: opts => { if (opts?.practice) startPractice(); else render(); },
    onFinish: r => finishScreen(lesson, r, false, replay),
  });
}

function startPractice() {
  const s = store.get();
  const doneLessons = LESSONS.filter(l => s.done[l.id]);
  const pool = (doneLessons.length ? doneLessons : LESSONS.slice(0, 1))
    .flatMap(l => l.exercises.filter(e => e.type !== 'info'));
  const picked = shuffle(pool).slice(0, 8);
  const lesson = { id: 'practice', title: 'Repaso' };
  runLesson(app, {
    lesson,
    exercises: picked,
    practice: true,
    onExit: () => render(),
    onFinish: r => finishScreen(lesson, r, true),
  });
}

// ---------- Simulacro de examen (tipo test) ----------

const EXAM_SIZE = 20;

function startExam() {
  const picked = shuffle(EXAM_POOL).slice(0, EXAM_SIZE);
  runLesson(app, {
    lesson: { id: 'simulacro', title: 'Simulacro' },
    exercises: picked,
    exam: true,
    onExit: () => render(),
    onFinish: r => examFinish(r),
  });
}

function examFinish(r) {
  const correct = r.total - r.errors;
  const grade = Math.round((correct / r.total) * 100) / 10;
  const result = store.completeExam(correct, r.total, grade);
  play('finish');
  pushScore();
  const newAch = checkAchievements();
  const verdict = grade >= 9 ? '¡Sobresaliente!' : grade >= 7 ? '¡Notable!' : grade >= 5 ? 'Aprobado' : 'Toca repasar';
  app.replaceChildren(h('div', { class: 'center-screen finish' },
    h('div', { class: 'bounce', html: mascot(grade >= 5 ? (grade >= 9 ? 'wow' : 'happy') : 'sad', 140) }),
    h('h1', {}, verdict),
    h('div', { class: 'exam-grade' }, grade.toFixed(1)),
    h('div', { class: 'result-grid' },
      h('div', { class: 'result green' }, h('div', { class: 'result-label' }, 'Aciertos'), h('div', { class: 'result-val' }, `${correct}/${r.total}`)),
      h('div', { class: 'result yellow' }, h('div', { class: 'result-label' }, 'XP'), h('div', { class: 'result-val' }, `+${result.xp}`)),
      h('div', { class: 'result blue' }, h('div', { class: 'result-label' }, 'Tiempo'), h('div', { class: 'result-val' }, fmtTime(r.ms)))),
    h('p', { class: 'muted small' }, 'Nota sobre 10, sin restar por fallo. Se ajustará al formato de la convocatoria.'),
    result.streakUp ? h('div', { class: 'streak-up' }, `🔥 ¡Racha de ${store.get().streak.count} ${store.get().streak.count === 1 ? 'día' : 'días'}!`) : null,
    newAch.length ? h('div', { class: 'ach-new' }, newAch.map(a => h('div', { class: 'ach-pill' }, `${a.icon} ${a.title}`))) : null,
    h('button', { type: 'button', class: 'btn btn-main', onclick: () => startExam() }, 'Otro simulacro'),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { tab = 'learn'; render(); } }, 'Volver')));
}

function finishScreen(lesson, r, practice) {
  const result = store.completeLesson(lesson.id, { errors: r.errors, practice });
  if (practice) store.gainHeart(1);
  play('finish');
  pushScore();
  const s = store.get();
  const acc = Math.max(0, Math.round(((r.total - r.errors) / r.total) * 100));
  const newAch = checkAchievements();
  app.replaceChildren(h('div', { class: 'center-screen finish' },
    h('div', { class: 'bounce', html: mascot(result.perfect ? 'wow' : 'happy', 140) }),
    h('h1', {}, practice ? '¡Repaso completado!' : result.perfect ? '¡Lección perfecta!' : '¡Lección completada!'),
    h('div', { class: 'result-grid' },
      h('div', { class: 'result yellow' }, h('div', { class: 'result-label' }, 'XP'), h('div', { class: 'result-val' }, `+${result.xp}`)),
      h('div', { class: 'result green' }, h('div', { class: 'result-label' }, 'Precisión'), h('div', { class: 'result-val' }, `${acc}%`)),
      h('div', { class: 'result blue' }, h('div', { class: 'result-label' }, 'Tiempo'), h('div', { class: 'result-val' }, fmtTime(r.ms)))),
    result.streakUp ? h('div', { class: 'streak-up' }, `🔥 ¡Racha de ${s.streak.count} ${s.streak.count === 1 ? 'día' : 'días'}!`) : null,
    practice ? h('div', { class: 'streak-up heart' }, '❤️ +1 vida') : null,
    newAch.length ? h('div', { class: 'ach-new' }, newAch.map(a => h('div', { class: 'ach-pill' }, `${a.icon} ${a.title}`))) : null,
    h('button', { type: 'button', class: 'btn btn-main', onclick: () => { tab = 'learn'; render(); } }, 'Continuar')));
}

// ---------- Terminal libre ----------

function terminalView() {
  if (!sandbox) sandbox = { shell: new Shell() };
  const term = createTerminal({
    shell: sandbox.shell,
    banner: !sandbox.started,
    autofocus: true,
    onCommand: () => {
      store.bumpStat('commands');
      if (sandbox.shell.stats.sudo) store.setStat('sudo', true);
      store.save();
      announceAchievements();
    },
  });
  if (sandbox.started && sandbox.html) {
    const screen = term.el.querySelector('.term-screen');
    const inputLine = screen.querySelector('.term-input-line');
    inputLine.insertAdjacentHTML('beforebegin', sandbox.html);
  }
  sandbox.started = true;
  const save = () => { sandbox.html = [...term.el.querySelectorAll('.term-out')].slice(-200).map(n => n.outerHTML).join(''); };
  term.el.addEventListener('keyup', save);
  term.el.addEventListener('click', save);
  const tries = ['ls -l', 'cd trabajo-1a', './01-parametros.sh a b', "grep -c '^ATOM' 1HVR.pdb", 'man grep', 'vi notas.txt'];
  return h('div', { class: 'term-page' },
    h('div', { class: 'term-page-head' },
      h('div', {}, h('h1', {}, 'Servidor de práctica'), h('p', { class: 'muted small' }, 'Una copia simulada del servidor de clase con el repositorio y ~/trabajo-1a. Aquí no hay vidas: rompe lo que quieras.')),
      h('button', {
        type: 'button', class: 'btn btn-small btn-ghost',
        onclick: () => { if (confirm('¿Reiniciar el servidor de práctica? Se pierden los ficheros que hayas creado.')) { sandbox = null; render(); } },
      }, '↺ Reiniciar')),
    h('div', { class: 'try-chips' }, tries.map(t => h('button', { type: 'button', class: 'chip mono small', onclick: () => term.setInput(t) }, t))),
    term.el);
}

// ---------- Ranking ----------

function rankingView() {
  const s = store.get();
  const list = h('div', { class: 'rank-list' });
  let mode = 'semana';
  const seg = h('div', { class: 'segmented', role: 'tablist' });
  const row = (r, i) => h('div', { class: 'rank-row' + (r.id === s.id ? ' me' : '') },
    h('span', { class: 'rank-pos' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)),
    h('span', { class: 'avatar' }, (r.apodo || '?')[0].toUpperCase()),
    h('span', { class: 'rank-name' }, r.apodo, r.racha > 0 ? h('span', { class: 'rank-streak' }, ` 🔥${r.racha}`) : null),
    h('span', { class: 'rank-xp' }, `${mode === 'semana' ? r.xp_semana : r.xp} XP`));
  const me = { id: s.id, apodo: s.nick, xp: s.xp, xp_semana: s.weekly.xp, racha: s.streak.count };

  async function load() {
    seg.replaceChildren(...[['semana', 'Esta semana'], ['total', 'Total']].map(([id, label]) => h('button', {
      type: 'button', role: 'tab', class: mode === id ? 'active' : '', 'aria-selected': mode === id,
      onclick: () => { mode = id; load(); },
    }, label)));
    if (!rankingEnabled()) {
      list.replaceChildren(row(me, 0));
      return;
    }
    list.replaceChildren(h('p', { class: 'muted center' }, 'Cargando…'));
    try {
      await pushScore(true);
      const rows = (await fetchRanking(mode)).filter(r => r.id !== s.id);
      rows.push(me);
      rows.sort((a, b) => (mode === 'semana' ? b.xp_semana - a.xp_semana : b.xp - a.xp));
      list.replaceChildren(...rows.map(row));
    } catch {
      list.replaceChildren(h('p', { class: 'muted center' }, 'No se pudo cargar el ranking. ¿Hay conexión?'), row(me, 0));
    }
  }
  load();
  return h('div', { class: 'rank-page' },
    h('div', { class: 'rank-head' },
      h('div', { html: mascot('wow', 64) }),
      h('div', {}, h('h1', {}, 'Ranking'), h('p', { class: 'muted small' }, `Clase ${s.clase || 'GENERAL'} · la semana se reinicia el lunes`))),
    !rankingEnabled() ? h('div', { class: 'banner-card' }, h('span', { html: rich('El ranking compartido aún no está activado. Cuando se configure Supabase (ver **README**), aquí saldrán tus compañeros.') })) : null,
    seg, list);
}

// ---------- Perfil ----------

function icsReminder(time) {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = n => String(n).padStart(2, '0');
  const dt = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(hh)}${p(mm)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const url = location.href.split('#')[0];
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dr.Xinxus//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:drxinxus-${store.get().id}@drxinxus`, `DTSTAMP:${stamp}`, `DTSTART:${dt}`, 'DURATION:PT10M',
    'RRULE:FREQ=DAILY', 'SUMMARY:🐧 Lección con Dr.Xinxus', `DESCRIPTION:5 minutos de Linux para no perder la racha. ${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:¡Toca lección con Dr.Xinxus!', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = h('a', { href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), download: 'recordatorio-drxinxus.ics' });
  document.body.append(a);
  a.click();
  a.remove();
}

function profileView() {
  const s = store.get();
  const accuracy = s.stats.exercises ? Math.round((s.stats.correct / s.stats.exercises) * 100) : 0;
  const lessonsDone = Object.keys(s.done).filter(k => k !== 'practice').length;
  const stat = (icon, val, label) => h('div', { class: 'stat-box' }, h('div', { class: 'stat-icon' }, icon), h('div', {}, h('div', { class: 'stat-val' }, String(val)), h('div', { class: 'stat-label' }, label)));
  const time = h('input', { type: 'time', class: 'field small', value: s.settings.reminder, onchange: e => store.setSetting('reminder', e.target.value), 'aria-label': 'Hora del recordatorio' });
  const goalSel = h('select', { class: 'field small', 'aria-label': 'Meta diaria', onchange: e => store.setGoal(Number(e.target.value)) },
    [10, 20, 30, 50].map(g => h('option', { value: g, selected: s.goal === g }, `${g} XP`)));
  const soundToggle = h('input', { type: 'checkbox', class: 'switch', checked: s.settings.sound, onchange: e => store.setSetting('sound', e.target.checked), 'aria-label': 'Sonido' });

  return h('div', { class: 'profile' },
    h('section', { class: 'profile-head' },
      h('div', { class: 'avatar big' }, s.nick[0]?.toUpperCase() || '?'),
      h('div', {},
        h('h1', {}, s.nick),
        h('p', { class: 'muted small' }, `Clase ${s.clase} · desde ${new Date(s.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`)),
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => renderOnboarding(1) }, 'Editar')),
    h('h2', { class: 'section-title' }, 'Estadísticas'),
    h('div', { class: 'stat-grid' },
      stat('🔥', s.streak.count, 'Racha actual'),
      stat('🏔️', s.streak.best, 'Mejor racha'),
      stat('⚡', s.xp, 'XP total'),
      stat('🎓', `${lessonsDone}/${LESSONS.length}`, 'Lecciones'),
      stat('⌨️', s.stats.commands, 'Comandos'),
      stat('🎯', `${accuracy}%`, 'Precisión')),
    h('h2', { class: 'section-title' }, `Logros · ${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}`),
    h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map(a => {
      const got = !!s.achievements[a.id];
      return h('div', { class: 'ach' + (got ? ' got' : '') },
        h('div', { class: 'ach-icon' }, got || !a.secret ? a.icon : '❔'),
        h('div', { class: 'ach-title' }, got || !a.secret ? a.title : 'Secreto'),
        h('div', { class: 'ach-desc' }, got || !a.secret ? a.desc : '¿Qué harías en un servidor ajeno?'));
    })),
    h('h2', { class: 'section-title' }, 'Ajustes'),
    h('div', { class: 'settings' },
      h('label', { class: 'setting' }, h('span', {}, '🔊 Sonido'), soundToggle),
      h('label', { class: 'setting' }, h('span', {}, '🎯 Meta diaria'), goalSel),
      h('div', { class: 'setting col' },
        h('div', { class: 'setting-row' }, h('span', {}, '⏰ Recordatorio diario'), time),
        h('p', { class: 'muted small' }, 'Se añade como evento diario a tu calendario del móvil, que te avisará a esa hora.'),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => icsReminder(time.value) }, 'Añadir al calendario')),
      h('div', { class: 'setting col' },
        h('span', {}, '📲 Instalar en el móvil'),
        h('p', { class: 'muted small', html: rich('**iPhone (Safari):** Compartir ⬆️ → Añadir a pantalla de inicio.\n**Android (Chrome):** menú ⋮ → Instalar aplicación.') })),
      h('button', {
        type: 'button', class: 'btn btn-ghost danger-text',
        onclick: () => { if (confirm('¿Borrar todo tu progreso? No se puede deshacer.')) { store.reset(); render(); } },
      }, 'Borrar mi progreso')),
    h('p', { class: 'footnote muted small' }, 'Dr.Xinxus · hecho para la asignatura de Bioinformática (UCAM). La terminal es una simulación: el servidor de verdad está en MobaXterm.'));
}

// ---------- Arranque ----------

store.subscribe(() => {
  const bar = document.querySelector('.topbar');
  if (bar) bar.replaceWith(topBar());
});

render();
announceAchievements();

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.hostname.match(/^(localhost|127\.)/)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Las vidas se recargan con el tiempo: refresca la barra cada minuto.
setInterval(() => {
  const bar = document.querySelector('.topbar');
  if (bar) bar.replaceWith(topBar());
}, 60000);
