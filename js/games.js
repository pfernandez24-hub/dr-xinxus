// Minijuegos para recuperar vidas: Parejas (memoria) y Contrarreloj.
import { h, shuffle } from './dom.js';
import { mascot } from './mascot.js';
import * as store from './store.js';
import { play } from './sound.js';

// Glosario de los Temas 0 y 1: término ↔ significado.
// cmd: el término es una orden (se pinta en monoespaciada).
export const GLOSSARY = [
  { t: 'pwd', d: 'Muestra el directorio actual', cmd: true },
  { t: 'ls -l', d: 'Lista con permisos, tamaño y fecha', cmd: true },
  { t: 'ls -a', d: 'Lista también los ocultos', cmd: true },
  { t: 'cd ..', d: 'Sube un nivel', cmd: true },
  { t: 'cd ~', d: 'Vuelve al HOME', cmd: true },
  { t: 'mkdir', d: 'Crea un directorio', cmd: true },
  { t: 'touch', d: 'Crea un fichero vacío', cmd: true },
  { t: 'cp -r', d: 'Copia un directorio entero', cmd: true },
  { t: 'mv', d: 'Mueve o renombra', cmd: true },
  { t: 'rm -r', d: 'Borra un directorio y su contenido', cmd: true },
  { t: 'rmdir', d: 'Borra un directorio vacío', cmd: true },
  { t: 'cat', d: 'Muestra un fichero entero', cmd: true },
  { t: 'head -n 2', d: 'Las 2 primeras líneas', cmd: true },
  { t: 'tail -n 1', d: 'La última línea', cmd: true },
  { t: 'wc -l', d: 'Cuenta líneas', cmd: true },
  { t: 'more', d: 'Lee un fichero por páginas', cmd: true },
  { t: 'file', d: 'Dice qué tipo de fichero es', cmd: true },
  { t: 'whoami', d: 'Con qué usuario estás', cmd: true },
  { t: 'hostname', d: 'En qué máquina estás', cmd: true },
  { t: 'uname -a', d: 'Kernel y arquitectura (x86_64)', cmd: true },
  { t: 'ps', d: 'Procesos de tu terminal', cmd: true },
  { t: 'which', d: 'Dónde está instalado un programa', cmd: true },
  { t: '>', d: 'Guarda la salida sobrescribiendo', cmd: true },
  { t: '>>', d: 'Añade la salida al final', cmd: true },
  { t: '|', d: 'Pasa la salida a la siguiente orden', cmd: true },
  { t: 'grep -c', d: 'Cuenta las líneas que coinciden', cmd: true },
  { t: 'grep -v', d: 'Las líneas que NO coinciden', cmd: true },
  { t: 'grep -q', d: 'Sin salida: solo el código (para if)', cmd: true },
  { t: "cut -c18-20", d: 'Nombre del residuo en un PDB', cmd: true },
  { t: 'uniq -c', d: 'Cuenta repeticiones seguidas', cmd: true },
  { t: 'chmod u+x', d: 'Ejecución solo para el dueño', cmd: true },
  { t: 'chmod 755', d: 'rwxr-xr-x', cmd: true },
  { t: 'chmod 644', d: 'rw-r--r--', cmd: true },
  { t: '#!/bin/bash', d: 'Shebang: elige el intérprete', cmd: true },
  { t: '$#', d: 'Número de argumentos', cmd: true },
  { t: '$0', d: 'Nombre del script', cmd: true },
  { t: '$?', d: 'Código de salida (0 = bien)', cmd: true },
  { t: '"$@"', d: 'Todos los argumentos, uno a uno', cmd: true },
  { t: 'shift', d: 'Descarta $1 y corre el resto', cmd: true },
  { t: '-eq', d: 'Igual (números)', cmd: true },
  { t: '-z', d: 'Cadena vacía', cmd: true },
  { t: '-f', d: 'Existe y es un fichero', cmd: true },
  { t: 'esac', d: 'Cierra un case', cmd: true },
  { t: 'break', d: 'Sale del bucle', cmd: true },
  { t: 'continue', d: 'Salta a la siguiente vuelta', cmd: true },
  { t: 'bash -n', d: 'Revisa la sintaxis sin ejecutar', cmd: true },
  { t: 'bash -x', d: 'Ejecuta mostrando cada orden', cmd: true },
  { t: 'git clone', d: 'Trae el repositorio la primera vez', cmd: true },
  { t: 'git pull', d: 'Actualiza el repositorio', cmd: true },
  { t: 'pdb_fetch', d: 'Descarga una entrada del PDB', cmd: true },
  { t: 'pdb_wc', d: 'Inventaría cadenas, residuos y átomos', cmd: true },
  { t: 'pdb_wc -h', d: 'Cuenta los HETATM (¡no es la ayuda!)', cmd: true },
  { t: 'freesasa', d: 'Superficie accesible al disolvente', cmd: true },
  { t: '--hydrogen', d: 'freesasa incluye los hidrógenos', cmd: true },
  { t: 'FileZilla', d: 'Pasa ficheros portátil ↔ servidor' },
  { t: 'Apolar', d: 'Área aportada por los carbonos' },
  { t: '1,4 Å', d: 'Radio de la sonda (una molécula de agua)' },
  { t: 'Alucinación', d: 'Contenido plausible pero falso' },
  { t: 'Prompt anclado', d: 'Contexto, encargo, límites y parada' },
  { t: 'Gasteiger', d: 'Informática para resolver problemas químicos' },
  { t: 'Varnek y Baskin', d: 'Moléculas como grafos o vectores' },
  { t: 'Quimioinformática', d: 'Razonamiento sobre todo inductivo' },
  { t: 'Química cuántica', d: 'Ecuación de Schrödinger' },
  { t: 'Campos de fuerza', d: 'Átomos y enlaces, mecánica clásica' },
  { t: '4.º paradigma', d: 'Big data y machine learning' },
  { t: '3.er paradigma', d: 'Simulaciones y dinámica molecular' },
  { t: 'Bioinformatics.org', d: 'Cualquier uso de ordenadores en biología molecular' },
  { t: 'Tema 7', d: 'Bioinformática de secuencias' },
];

const heartsLeft = () => store.get().hearts.n;
const full = () => heartsLeft() >= store.MAX_HEARTS;

function win(root, game, onExit, extra) {
  const wasFull = full();
  if (!wasFull) store.gainHeart(1);
  store.bumpStat('games');
  store.save();
  play('finish');
  root.replaceChildren(h('div', { class: 'center-screen finish' },
    h('div', { class: 'bounce', html: mascot('wow', 130) }),
    h('h1', {}, '¡Ganaste!'),
    extra ? h('p', { class: 'lead' }, extra) : null,
    h('div', { class: 'streak-up heart' }, wasFull ? '❤️ Ya tenías las vidas al máximo' : `❤️ +1 vida (${heartsLeft()}/${store.MAX_HEARTS})`),
    h('button', { type: 'button', class: 'btn btn-main', onclick: () => game() }, 'Jugar otra vez'),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => onExit() }, 'Volver')));
}

function lose(root, game, onExit, msg) {
  play('bad');
  root.replaceChildren(h('div', { class: 'center-screen' },
    h('div', { html: mascot('sad', 120) }),
    h('h1', {}, 'Casi…'),
    h('p', { class: 'lead' }, msg),
    h('button', { type: 'button', class: 'btn btn-main', onclick: () => game() }, 'Reintentar'),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => onExit() }, 'Volver')));
}

function gameHeader(title, onExit, statusEl) {
  return h('header', { class: 'lesson-head' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Salir del juego', onclick: () => onExit() }, '✕'),
    h('div', { class: 'game-title' }, title),
    statusEl);
}

// ---------- Parejas: memoria de 6 parejas en 90 segundos ----------

export function runPairs(root, onExit) {
  const PAIRS = 6;
  const TIME = 90;
  const picked = shuffle(GLOSSARY).slice(0, PAIRS);
  const cards = shuffle(picked.flatMap((g, i) => [
    { pair: i, text: g.t, mono: !!g.cmd, kind: 'term' },
    { pair: i, text: g.d, mono: false, kind: 'def' },
  ]));
  let open = [];
  let matched = 0;
  let moves = 0;
  let left = TIME;
  let busy = false;
  const timer = h('div', { class: 'game-timer' }, `⏱ ${left}s`);
  const movesEl = h('div', { class: 'muted small center' }, 'Encuentra cada orden con su significado.');
  const grid = h('div', { class: 'pairs-grid' });
  const els = cards.map((c, i) => {
    const el = h('button', {
      type: 'button', class: 'pair-card', 'aria-label': 'Carta boca abajo',
      onclick: () => flip(i),
    }, h('span', { class: 'pair-back', 'aria-hidden': 'true' }, '?'), h('span', { class: 'pair-face' + (c.mono ? ' mono' : '') }, c.text));
    grid.append(el);
    return el;
  });
  root.replaceChildren(h('div', { class: 'lesson game' },
    gameHeader('🃏 Parejas', () => { stop(); onExit(); }, timer),
    h('main', { class: 'lesson-body' }, movesEl, grid)));

  const iv = setInterval(() => {
    left--;
    timer.textContent = `⏱ ${left}s`;
    timer.classList.toggle('urgent', left <= 15);
    if (left <= 0) { stop(); lose(root, () => runPairs(root, onExit), onExit, `Se acabó el tiempo: ${matched} de ${PAIRS} parejas.`); }
  }, 1000);
  function stop() { clearInterval(iv); }

  function flip(i) {
    if (busy || open.includes(i) || els[i].classList.contains('matched')) return;
    els[i].classList.add('flipped');
    els[i].setAttribute('aria-label', cards[i].text);
    play('tap');
    open.push(i);
    if (open.length < 2) return;
    moves++;
    const [a, b] = open;
    if (cards[a].pair === cards[b].pair && cards[a].kind !== cards[b].kind) {
      els[a].classList.add('matched');
      els[b].classList.add('matched');
      open = [];
      matched++;
      play('ok');
      movesEl.textContent = `${matched}/${PAIRS} parejas · ${moves} intentos`;
      if (matched === PAIRS) {
        stop();
        setTimeout(() => win(root, () => runPairs(root, onExit), onExit, `${PAIRS} parejas en ${moves} intentos y ${TIME - left} s.`), 500);
      }
      return;
    }
    busy = true;
    movesEl.textContent = `${matched}/${PAIRS} parejas · ${moves} intentos`;
    setTimeout(() => {
      [a, b].forEach(k => { els[k].classList.remove('flipped'); els[k].setAttribute('aria-label', 'Carta boca abajo'); });
      open = [];
      busy = false;
    }, 900);
  }
}

// ---------- Contrarreloj: 10 aciertos en 60 segundos ----------

export function runRush(root, onExit) {
  const GOAL = 10;
  let left = 60;
  let score = 0;
  let streak = 0;
  let current = null;
  const timer = h('div', { class: 'game-timer' }, `⏱ ${left}s`);
  const bar = h('div', { class: 'progress-fill' });
  const scoreEl = h('div', { class: 'rush-score' }, `0/${GOAL}`);
  const qEl = h('div', { class: 'rush-q' });
  const opts = h('div', { class: 'options' });
  const flash = h('div', { class: 'rush-flash' });
  root.replaceChildren(h('div', { class: 'lesson game' },
    gameHeader('⚡ Contrarreloj', () => { stop(); onExit(); }, timer),
    h('main', { class: 'lesson-body' },
      h('div', { class: 'rush-top' }, h('div', { class: 'progress' }, bar), scoreEl),
      h('p', { class: 'muted small center' }, `Consigue ${GOAL} aciertos. Cada fallo resta 3 segundos.`),
      qEl, opts, flash)));

  const iv = setInterval(() => {
    left--;
    tick();
  }, 1000);
  function stop() { clearInterval(iv); }
  function tick() {
    timer.textContent = `⏱ ${Math.max(0, left)}s`;
    timer.classList.toggle('urgent', left <= 10);
    if (left <= 0) { stop(); lose(root, () => runRush(root, onExit), onExit, `${score} de ${GOAL} aciertos. ¡Otra!`); }
  }

  function next() {
    const ask = shuffle(GLOSSARY)[0];
    const reverse = Math.random() < 0.5; // a veces se da la orden y se pide el significado
    const distractors = shuffle(GLOSSARY.filter(g => g !== ask && g.cmd === ask.cmd)).slice(0, 3);
    const choices = shuffle([ask, ...distractors]);
    current = ask;
    qEl.replaceChildren(reverse
      ? h('div', {}, h('div', { class: 'muted small' }, '¿Qué significa?'), h('div', { class: 'rush-term' + (ask.cmd ? ' mono' : '') }, ask.t))
      : h('div', {}, h('div', { class: 'muted small' }, '¿Qué es…?'), h('div', { class: 'rush-def' }, ask.d)));
    opts.replaceChildren(...choices.map(c => h('button', {
      type: 'button', class: 'option' + (!reverse && c.cmd ? ' mono' : ''),
      onclick: e => answer(c, e.currentTarget),
    }, reverse ? c.d : c.t)));
  }

  function answer(choice, btn) {
    if (left <= 0) return;
    if (choice === current) {
      score++;
      streak++;
      play('ok');
      btn.classList.add('right');
      flash.textContent = streak >= 3 ? `🔥 ¡${streak} seguidas!` : '';
    } else {
      streak = 0;
      left -= 3;
      play('bad');
      btn.classList.add('wrong');
      flash.textContent = `−3 s · era: ${current.t} → ${current.d}`;
      tick();
      if (left <= 0) return;
    }
    scoreEl.textContent = `${score}/${GOAL}`;
    bar.style.width = `${Math.min(100, (score / GOAL) * 100)}%`;
    if (score >= GOAL) {
      stop();
      setTimeout(() => win(root, () => runRush(root, onExit), onExit, `${GOAL} aciertos con ${left} s de sobra.`), 350);
      return;
    }
    setTimeout(next, choice === current ? 250 : 900);
  }

  next();
}

// ---------- Hoja de vidas ----------

export function openHeartsSheet({ onGame, onPractice }) {
  const s = store.get();
  const n = s.hearts.n;
  const mins = Math.ceil(store.msToNextHeart() / 60000);
  const close = () => sheet.remove();
  const option = (icon, title, desc, fn) => h('button', {
    type: 'button', class: 'game-opt',
    onclick: () => { close(); fn(); },
  }, h('span', { class: 'game-opt-icon', 'aria-hidden': 'true' }, icon), h('span', {}, h('strong', {}, title), h('span', { class: 'muted small' }, desc)));
  const sheet = h('div', { class: 'sheet-backdrop', onclick: e => { if (e.target === sheet) close(); } },
    h('div', { class: 'sheet color-red', role: 'dialog', 'aria-label': 'Vidas' },
      h('div', { class: 'hearts-row', 'aria-label': `${n} de ${store.MAX_HEARTS} vidas` },
        Array.from({ length: store.MAX_HEARTS }, (_, i) => h('span', { class: i < n ? 'heart-on' : 'heart-off' }, '❤️'))),
      h('h2', {}, n >= store.MAX_HEARTS ? 'Vidas al máximo' : `Te quedan ${n} ${n === 1 ? 'vida' : 'vidas'}`),
      n < store.MAX_HEARTS ? h('p', { class: 'muted' }, `La siguiente llega sola en ${mins} min. O gánala ya:`) : h('p', { class: 'muted' }, 'Puedes jugar igualmente para repasar.'),
      option('🃏', 'Parejas', 'Une 6 órdenes con su significado en 90 s · ❤️ +1', () => onGame('pairs')),
      option('⚡', 'Contrarreloj', '10 aciertos en 60 s; cada fallo, −3 s · ❤️ +1', () => onGame('rush')),
      option('🔁', 'Repaso', '8 ejercicios de lo que ya has hecho · ❤️ +1', () => onPractice()),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: close }, 'Cerrar')));
  document.body.append(sheet);
}

