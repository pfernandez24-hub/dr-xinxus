// Componente de terminal estilo MobaXterm sobre la Shell simulada.
import { h, esc } from './dom.js';
import { completions } from './shell.js';
import { openEditor } from './editor.js';

const ANSI = { '01;34': 'ansi-blue', '01;32': 'ansi-green', '0': '' };

function ansiToHtml(text) {
  let out = '';
  let open = false;
  const parts = text.split(/\x1b\[([0-9;]*)m/);
  parts.forEach((part, i) => {
    if (i % 2 === 0) { out += esc(part); return; }
    if (open) { out += '</span>'; open = false; }
    const cls = ANSI[part];
    if (cls) { out += `<span class="${cls}">`; open = true; }
  });
  if (open) out += '</span>';
  return out;
}

export function promptHtml(sh) {
  return `<span class="p-user">${esc(sh.user)}@${esc(sh.host)}</span>:<span class="p-path">${esc(sh.shortPath())}</span>$ `;
}

export function createTerminal({ shell, onCommand, banner = true, autofocus = false }) {
  const screen = h('div', { class: 'term-screen', role: 'log', 'aria-label': 'Salida de la terminal' });
  const promptEl = h('span', { class: 'term-prompt' });
  const input = h('input', {
    class: 'term-input', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'send', 'aria-label': 'Escribe una orden',
  });
  const inputLine = h('div', { class: 'term-line term-input-line' }, promptEl, input);
  const title = h('span', { class: 'term-title' });
  const el = h('div', { class: 'term' },
    h('div', { class: 'term-bar' },
      h('span', { class: 'term-tab' }, h('span', { class: 'term-tab-icon', 'aria-hidden': 'true' }, '🖥'), title)),
    screen,
  );
  screen.append(inputLine);

  let histIdx = null;
  let draft = '';
  let busy = false;

  function updatePrompt() {
    promptEl.innerHTML = promptHtml(shell);
    title.textContent = `31.70.148.22 (${shell.user})`;
  }

  function print(html, cls = '') {
    const line = h('div', { class: 'term-out ' + cls, html });
    screen.insertBefore(line, inputLine);
    return line;
  }

  function scroll() {
    screen.scrollTop = screen.scrollHeight;
  }

  function showBanner() {
    print(`<span class="banner">┌─────────────────────────────────────┐
│  • SSH session to <b>${esc(shell.user)}@31.70.148.22</b>
│  • X11-forwarding  : ✔
│  Simulación de Dr.Xinxus, no es el servidor real
└─────────────────────────────────────┘</span>
Bienvenidos al servidor Linux ionos
`, 'banner-line');
  }

  function insert(textToAdd) {
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, s) + textToAdd + input.value.slice(e);
    const pos = s + textToAdd.length;
    input.setSelectionRange(pos, pos);
  }

  function complete() {
    const before = input.value.slice(0, input.selectionStart);
    const m = before.match(/(\S*)$/);
    const partial = m[1];
    const isFirst = before.trim() === partial;
    const opts = completions(shell, partial, isFirst);
    if (!opts.length) return;
    if (opts.length === 1) {
      insert(opts[0].slice(partial.length) + (opts[0].endsWith('/') ? '' : ' '));
      return;
    }
    let common = opts[0];
    for (const o of opts) while (!o.startsWith(common)) common = common.slice(0, -1);
    if (common.length > partial.length) { insert(common.slice(partial.length)); return; }
    print(esc(promptHtml(shell).replace(/<[^>]+>/g, '') + input.value), 'echo');
    print(esc(opts.map(o => o.split('/').filter(Boolean).pop() + (o.endsWith('/') ? '/' : '')).join('  ')));
    scroll();
  }

  function processEvents(done) {
    const ev = shell.events.shift();
    if (!ev) { done(); return; }
    if (ev.type === 'clear') {
      [...screen.querySelectorAll('.term-out')].forEach(n => n.remove());
      processEvents(done);
    } else if (ev.type === 'exit') {
      print('Connection to 31.70.148.22 closed.', 'info');
      print('Sesión cerrada. Dr.Xinxus te vuelve a conectar…', 'info');
      showBanner();
      processEvents(done);
    } else if (ev.type === 'editor') {
      const content = ev.path ? shell.readFile(ev.path) : '';
      openEditor({
        editor: ev.editor, display: ev.display || '', content: content ?? '', isNew: ev.isNew,
        onSave: value => (ev.path ? shell.saveFile(ev.path, value) : 'sin nombre de fichero'),
        onClose: () => { processEvents(done); },
      });
    } else processEvents(done);
  }

  function run(line) {
    if (busy) return;
    print(promptHtml(shell) + esc(line), 'echo');
    const chunks = shell.run(line);
    const textAll = chunks.map(c => c.text).join('');
    const grouped = [];
    for (const c of chunks) {
      const last = grouped[grouped.length - 1];
      if (last && last.kind === c.kind) last.text += c.text;
      else grouped.push({ ...c });
    }
    for (const g of grouped) {
      const t = g.text.endsWith('\n') ? g.text.slice(0, -1) : g.text;
      if (t || g.text) print(ansiToHtml(t), g.kind === 'err' ? 'err' : g.kind === 'info' ? 'info' : '');
    }
    const status = shell.lastStatus;
    busy = true;
    processEvents(() => {
      busy = false;
      updatePrompt();
      scroll();
      onCommand?.({ line, text: textAll.replace(/\x1b\[[0-9;]*m/g, ''), status });
      if (!document.querySelector('.editor-overlay')) input.focus({ preventScroll: true });
    });
    updatePrompt();
    scroll();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = input.value;
      input.value = '';
      histIdx = null;
      run(line);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      historyNav(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyNav(1);
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      print(promptHtml(shell) + esc(input.value) + '^C', 'echo');
      input.value = '';
      scroll();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      [...screen.querySelectorAll('.term-out')].forEach(n => n.remove());
    }
  });

  function historyNav(dir) {
    const hist = shell.history;
    if (!hist.length) return;
    if (histIdx === null) { draft = input.value; histIdx = hist.length; }
    histIdx = Math.max(0, Math.min(hist.length, histIdx + dir));
    input.value = histIdx === hist.length ? draft : hist[histIdx];
    const end = input.value.length;
    requestAnimationFrame(() => input.setSelectionRange(end, end));
  }

  // Teclas que faltan en el teclado del móvil.
  const keyDefs = [
    ['Tab', () => complete()], ['↑', () => historyNav(-1)], ['↓', () => historyNav(1)],
    ['~', '~'], ['/', '/'], ['-', '-'], ['|', '|'], ['>', '>'], ['$', '$'], ['"', '"'], ["'", "'"],
    ['*', '*'], ['.', '.'], ['^', '^'], [';', ';'],
    ['Ctrl+C', () => { print(promptHtml(shell) + esc(input.value) + '^C', 'echo'); input.value = ''; scroll(); }],
  ];
  const keys = h('div', { class: 'term-keys', role: 'toolbar', 'aria-label': 'Teclas especiales' },
    keyDefs.map(([label, action]) => h('button', {
      type: 'button', class: 'term-key',
      onpointerdown: e => e.preventDefault(),
      onclick: () => { if (typeof action === 'string') insert(action); else action(); input.focus({ preventScroll: true }); },
    }, label)));
  el.append(keys);

  screen.addEventListener('click', () => {
    if (!window.getSelection().toString()) input.focus({ preventScroll: true });
  });

  if (banner) showBanner();
  updatePrompt();
  if (autofocus) setTimeout(() => input.focus({ preventScroll: true }), 50);

  return {
    el,
    focus: () => input.focus({ preventScroll: true }),
    setInput: v => { input.value = v; input.focus({ preventScroll: true }); },
    print: (t, cls) => { print(esc(t), cls); scroll(); },
    run,
  };
}
