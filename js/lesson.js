// Reproductor de lecciones: cola de ejercicios, comprobación, vidas y repetición de fallos.
import { h, rich, shuffle } from './dom.js';
import { Shell } from './shell.js';
import { createTerminal } from './terminal-ui.js';
import { mascot } from './mascot.js';
import * as store from './store.js';
import { play } from './sound.js';

const PRAISE = ['¡Bien hecho!', '¡Correcto!', '¡Genial!', '¡Así se hace!', '¡Perfecto!', '¡Eso es!', '¡Sudo-perfecto!'];
const pick = a => a[Math.floor(Math.random() * a.length)];

const TYPE_LABEL = {
  info: 'Nuevo concepto', mc: 'Elige la respuesta', vf: 'Verdadero o falso · Tarea 1D', fill: 'Completa la orden', order: 'Monta la orden',
  bug: 'Encuentra el error', term: 'En la terminal',
};

function codeBlock(code) {
  return h('pre', { class: 'code' }, h('code', {}, code));
}

// ---------- Ejercicios ----------

function renderInfo(ex) {
  return {
    el: h('div', { class: 'ex ex-info' },
      h('div', { class: 'info-card' },
        h('div', { class: 'info-mascot', html: mascot('happy', 64) }),
        h('h2', { class: 'info-title' }, ex.title),
        ex.text ? h('p', { class: 'info-text', html: rich(ex.text) }) : null,
        ex.code ? codeBlock(ex.code) : null)),
    info: true,
  };
}

function renderMC(ex, ctl) {
  let selected = null;
  // Las opciones se barajan cada vez, como en un examen: no vale memorizar la posición.
  const order = shuffle(ex.options.map((_, i) => i));
  const buttons = order.map((orig, i) => h('button', {
    type: 'button', class: 'option',
    onclick: () => select(i),
  }, h('span', { class: 'option-key' }, 'abcdefgh'[i]), h('span', { class: 'option-text', html: rich(ex.options[orig]) })));
  function select(i) {
    if (ctl.locked) return;
    selected = i;
    buttons.forEach((b, k) => b.classList.toggle('selected', k === i));
    play('tap');
    ctl.setReady(true);
  }
  return {
    el: h('div', { class: 'ex' },
      h('h2', { class: 'ex-q', html: rich(ex.q) }),
      ex.code ? codeBlock(ex.code) : null,
      h('div', { class: 'options' }, buttons)),
    key: k => {
      const n = /^[1-9]$/.test(k) ? Number(k) : 'abcdefgh'.indexOf(k.toLowerCase()) + 1;
      if (n >= 1 && n <= buttons.length) select(n - 1);
    },
    check: () => {
      const right = order.indexOf(ex.answer);
      const ok = selected === right;
      buttons[right].classList.add('right');
      if (!ok) buttons[selected].classList.add('wrong');
      return { ok, correct: ex.options[ex.answer] };
    },
  };
}

// Pregunta de examen: cinco afirmaciones V/F y elegir la combinación a)–e).
function renderVF(ex, ctl) {
  let selected = null;
  const letters = 'abcde';
  const buttons = ex.options.map((combo, i) => h('button', {
    type: 'button', class: 'option vf-option',
    onclick: () => {
      if (ctl.locked) return;
      selected = i;
      buttons.forEach((b, k) => b.classList.toggle('selected', k === i));
      play('tap');
      ctl.setReady(true);
    },
  }, h('span', { class: 'option-key' }, letters[i]), h('span', { class: 'option-text mono vf-combo' }, combo.split('').join(' '))));
  return {
    el: h('div', { class: 'ex' },
      h('h2', { class: 'ex-q', html: rich(ex.q) }),
      ex.code ? codeBlock(ex.code) : null,
      h('ol', { class: 'vf-list' }, ex.statements.map(s => h('li', { html: rich(s) }))),
      h('p', { class: 'muted small vf-help' }, 'Decide si cada afirmación es verdadera (V) o falsa (F) y elige la combinación.'),
      h('div', { class: 'options vf-options' }, buttons)),
    key: k => { const n = 'abcde'.indexOf(k.toLowerCase()) + 1 || Number(k); if (n >= 1 && n <= 5) buttons[n - 1].click(); },
    check: () => {
      const answer = ex.options.indexOf(ex.truth);
      const ok = selected === answer;
      buttons[answer].classList.add('right');
      if (!ok) buttons[selected].classList.add('wrong');
      return {
        ok,
        correct: `${letters[answer]}) ${ex.truth.split('').join(' ')}`,
        explainList: ex.statements.map((s, i) => `**${i + 1} ${ex.truth[i]}** · ${ex.why?.[i] || ''}`),
      };
    },
  };
}

function renderFill(ex, ctl) {
  let selected = null;
  const [before, after] = ex.code.split('___');
  const slot = h('button', { type: 'button', class: 'slot empty', 'aria-label': 'Hueco', onclick: () => clear() }, '    ');
  const chips = shuffle(ex.options).map(opt => h('button', {
    type: 'button', class: 'chip mono',
    onclick: e => choose(opt, e.currentTarget),
  }, opt));
  function choose(opt, btn) {
    if (ctl.locked) return;
    selected = opt;
    chips.forEach(c => c.classList.toggle('used', c === btn));
    slot.textContent = opt;
    slot.classList.remove('empty');
    play('tap');
    ctl.setReady(true);
  }
  function clear() {
    if (ctl.locked) return;
    selected = null;
    chips.forEach(c => c.classList.remove('used'));
    slot.textContent = '    ';
    slot.classList.add('empty');
    ctl.setReady(false);
  }
  return {
    el: h('div', { class: 'ex' },
      h('h2', { class: 'ex-q', html: rich(ex.q) }),
      h('pre', { class: 'code fill-code' }, h('code', {}, before, slot, after)),
      h('div', { class: 'chips' }, chips)),
    check: () => {
      const ok = selected === ex.answer;
      slot.classList.add(ok ? 'right' : 'wrong');
      return { ok, correct: ex.code.replace('___', ex.answer) };
    },
  };
}

function renderOrder(ex, ctl) {
  const answerTokens = ex.answer.split(/\s+/);
  const tokens = shuffle([...answerTokens, ...(ex.extra || [])]).map((t, i) => ({ t, i }));
  const built = [];
  const line = h('div', { class: 'order-line mono', 'aria-label': 'Tu orden' });
  const bank = h('div', { class: 'chips' });
  const bankBtns = new Map();
  tokens.forEach(tok => {
    const b = h('button', { type: 'button', class: 'chip mono', onclick: () => add(tok) }, tok.t);
    bankBtns.set(tok.i, b);
    bank.append(b);
  });
  function render() {
    line.replaceChildren(
      h('span', { class: 'order-prompt' }, '$'),
      ...built.map(tok => h('button', { type: 'button', class: 'chip mono in-line', onclick: () => remove(tok) }, tok.t)),
    );
    bankBtns.forEach((b, i) => b.classList.toggle('used', built.some(t => t.i === i)));
    ctl.setReady(built.length > 0);
  }
  function add(tok) {
    if (ctl.locked || built.includes(tok)) return;
    built.push(tok);
    play('tap');
    render();
  }
  function remove(tok) {
    if (ctl.locked) return;
    built.splice(built.indexOf(tok), 1);
    render();
  }
  render();
  return {
    el: h('div', { class: 'ex' }, h('h2', { class: 'ex-q', html: rich(ex.q) }), line, bank),
    check: () => {
      const ok = built.map(t => t.t).join(' ') === answerTokens.join(' ');
      line.classList.add(ok ? 'right' : 'wrong');
      return { ok, correct: ex.answer.replace(/ ; /g, '; ') };
    },
  };
}

function renderBug(ex, ctl) {
  let selected = null;
  const rows = ex.lines.map((l, i) => h('button', {
    type: 'button', class: 'bug-line',
    onclick: () => {
      if (ctl.locked) return;
      selected = i;
      rows.forEach((r, k) => r.classList.toggle('selected', k === i));
      play('tap');
      ctl.setReady(true);
    },
  }, h('span', { class: 'bug-num' }, String(i + 1)), h('code', {}, l || ' ')));
  return {
    el: h('div', { class: 'ex' },
      h('h2', { class: 'ex-q', html: rich(ex.q) }),
      h('div', { class: 'bug-code' }, rows)),
    check: () => {
      const ok = selected === ex.answer;
      rows[ex.answer].classList.add('right');
      if (!ok) rows[selected].classList.add('wrong');
      if (ok) store.bumpStat('bugs');
      return { ok, correct: `Línea ${ex.answer + 1}: ${ex.lines[ex.answer]}` };
    },
  };
}

function renderTerm(ex, ctl) {
  const sh = new Shell(ex.opts || {});
  for (const s of ex.setup || []) (typeof s === 'function' ? s(sh) : sh.quiet(s));
  sh.history.length = 0;
  const hint = h('div', { class: 'hint hidden' });
  const term = createTerminal({
    shell: sh,
    banner: false,
    onCommand: last => {
      store.bumpStat('commands');
      if (sh.stats.sudo) store.setStat('sudo', true);
      store.save();
      if (ctl.locked) return;
      let ok = false;
      try { ok = ex.check(sh, last); } catch (e) { console.warn(e); }
      if (ok) ctl.autoSuccess();
    },
  });
  setTimeout(() => term.focus(), 300);
  return {
    el: h('div', { class: 'ex ex-term' },
      h('h2', { class: 'ex-q', html: rich(ex.q) }),
      hint,
      term.el),
    term: true,
    hint: () => { hint.innerHTML = '💡 ' + rich(ex.hint || 'Revisa la teoría de la lección.'); hint.classList.remove('hidden'); },
    giveUp: () => ({ ok: false, correct: ex.solution }),
    explain: ex.explain,
  };
}

const RENDER = { info: renderInfo, mc: renderMC, vf: renderVF, fill: renderFill, order: renderOrder, bug: renderBug, term: renderTerm };

// ---------- Lección ----------

export function runLesson(root, { lesson, exercises, practice, exam, onExit, onFinish }) {
  const queue = exercises.map((ex, i) => ({ ex, id: i }));
  const total = exercises.length;
  const retried = new Set();
  let solved = 0;
  let errors = 0;
  let blanks = 0;
  let pos = 0;
  const started = Date.now();
  let current = null;
  let outOfHearts = false;

  const bar = h('div', { class: 'progress-fill' });
  const heartsEl = h('div', { class: 'lesson-hearts' });
  const body = h('main', { class: 'lesson-body' });
  const footer = h('footer', { class: 'lesson-footer' });
  const screen = h('div', { class: 'lesson' },
    h('header', { class: 'lesson-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Salir de la lección', onclick: () => confirmExit() }, '✕'),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total }, bar),
      heartsEl),
    body, footer);
  root.replaceChildren(screen);

  function updateTop() {
    bar.style.width = `${Math.round((solved / total) * 100)}%`;
    const n = store.get().hearts.n;
    heartsEl.replaceChildren(exam ? h('span', { title: 'Simulacro' }, `📝 ${Math.min(pos + 1, total)}/${total}`) : practice ? h('span', { class: 'heart-inf', title: 'Repaso: sin vidas' }, '❤️ ∞') : h('span', {}, `❤️ ${n}`));
  }

  function confirmExit() {
    if (solved === 0 || confirm('¿Seguro que quieres salir? Perderás el progreso de esta lección.')) onExit();
  }

  function keyHandler(e) {
    if (document.querySelector('.editor-overlay')) return;
    if (e.target.closest && e.target.closest('.term')) return;
    if (e.key === 'Enter') {
      const btn = footer.querySelector('.btn-main:not([disabled])');
      if (btn) { e.preventDefault(); btn.click(); }
    } else if (current?.key && /^[1-9a-e]$/i.test(e.key)) current.key(e.key);
  }
  document.addEventListener('keydown', keyHandler);
  const cleanup = () => document.removeEventListener('keydown', keyHandler);

  function next() {
    if (outOfHearts) { cleanup(); showNoHearts(); return; }
    if (pos >= queue.length) {
      cleanup();
      onFinish({ errors, blanks, total, ms: Date.now() - started });
      return;
    }
    const item = queue[pos];
    const mainBtn = h('button', { type: 'button', class: 'btn btn-main', disabled: true }, 'Comprobar');
    const ctl = {
      locked: false,
      setReady: v => { mainBtn.disabled = !v; },
      autoSuccess: () => resolve({ ok: true }),
    };
    const view = RENDER[item.ex.type](item.ex, ctl);
    current = view;
    const label = item.ex.type === 'info' ? null : h('div', { class: 'ex-type' }, pos >= total ? '🔁 Otra vez: ' + TYPE_LABEL[item.ex.type] : TYPE_LABEL[item.ex.type]);
    body.replaceChildren(h('div', { class: 'ex-wrap' }, label, view.el));
    body.scrollTop = 0;

    if (view.info) {
      mainBtn.disabled = false;
      mainBtn.textContent = 'Continuar';
    }
    footer.className = 'lesson-footer';
    if (view.info) {
      mainBtn.onclick = () => { solved++; pos++; updateTop(); next(); };
      footer.replaceChildren(mainBtn);
    } else if (view.term) {
      footer.replaceChildren(
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => view.hint() }, 'Pista'),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => resolve(view.giveUp()) }, 'No lo sé'),
      );
    } else if (exam) {
      // Como en el parcial: se puede dejar en blanco (0 puntos) en vez de arriesgar (−0,25).
      mainBtn.onclick = () => resolve(view.check());
      footer.replaceChildren(
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => resolve({ blank: true }) }, 'En blanco'),
        mainBtn);
    } else {
      mainBtn.onclick = () => resolve(view.check());
      footer.replaceChildren(mainBtn);
    }

    function resolve(result) {
      if (ctl.locked) return;
      ctl.locked = true;
      if (result.blank) {
        blanks++;
        solved++;
        pos++;
        updateTop();
        next();
        return;
      }
      store.bumpStat('exercises');
      if (result.ok) {
        store.bumpStat('correct');
        if (item.ex.type === 'term') store.bumpStat('term');
        solved++;
        play('ok');
      } else {
        errors++;
        play('bad');
        if (!practice && !exam && store.loseHeart() <= 0) outOfHearts = true;
        if (!exam && !retried.has(item.id)) { retried.add(item.id); queue.push(item); }
        else { solved++; }
      }
      store.save();
      pos++;
      updateTop();
      const explain = item.ex.explain || view.explain;
      const cont = h('button', { type: 'button', class: 'btn btn-main ' + (result.ok ? '' : 'btn-red'), onclick: next }, 'Continuar');
      footer.className = 'lesson-footer feedback ' + (result.ok ? 'is-ok' : 'is-bad');
      footer.replaceChildren(
        h('div', { class: 'feedback-body' },
          h('div', { class: 'feedback-mascot', html: mascot(result.ok ? 'happy' : 'sad', 52) }),
          h('div', { class: 'feedback-text' },
            h('strong', {}, result.ok ? pick(PRAISE) : 'Respuesta correcta:'),
            !result.ok && result.correct ? h('div', { class: 'feedback-correct' + (['fill', 'order', 'term', 'bug'].includes(item.ex.type) ? ' mono' : ''), html: rich(result.correct) }) : null,
            explain ? h('p', { html: rich(explain) }) : null,
            result.explainList ? h('ul', { class: 'vf-why' }, result.explainList.map(t => h('li', { html: rich(t) }))) : null)),
        cont);
      setTimeout(() => cont.focus({ preventScroll: true }), 50);
    }
  }

  function showNoHearts() {
    root.replaceChildren(h('div', { class: 'center-screen' },
      h('div', { html: mascot('sad', 120) }),
      h('h1', {}, 'Te has quedado sin vidas'),
      h('p', { class: 'muted' }, 'Recuperas una vida cada 20 minutos. O gánala ya con un minijuego o un repaso.'),
      h('button', { type: 'button', class: 'btn btn-main', onclick: () => onExit({ games: true }) }, '🎮 Minijuegos para recuperar vidas'),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => onExit({ practice: true }) }, 'Repasar (+1 vida)'),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => onExit() }, 'Volver')));
  }

  updateTop();
  next();
  return { destroy: cleanup };
}
