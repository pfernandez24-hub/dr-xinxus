// Editores vi y nano simplificados, a pantalla completa. Pensados para el móvil:
// las teclas que el teclado del iPhone no tiene (Esc, Ctrl) van en botones.
import { h } from './dom.js';

export function openEditor({ editor, display, content, isNew, onSave, onClose }) {
  const isVi = editor !== 'nano';
  let mode = isVi ? 'normal' : 'insert';
  let saved = content ?? '';
  let pendingD = false;
  let pendingY = false;
  let yank = null;
  const undo = [];

  const text = h('textarea', {
    class: 'ed-text', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
    'aria-label': `Contenido de ${display || 'fichero nuevo'}`,
  });
  // Como vi y nano: el fichero acaba en salto de línea, pero no se ve como una línea vacía más.
  text.value = saved.replace(/\n$/, '');
  saved = text.value;
  const status = h('div', { class: 'ed-status' });
  const cmdInput = h('input', { class: 'ed-cmd-input', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Orden de vi' });
  const cmdLine = h('div', { class: 'ed-cmd hidden' }, ':', cmdInput);
  const keys = h('div', { class: 'ed-keys' });
  const help = h('div', { class: 'ed-help' });
  const overlay = h('div', { class: 'editor-overlay', role: 'dialog', 'aria-label': `${editor} ${display}` },
    h('div', { class: 'ed-head' },
      h('span', { class: 'ed-name' }, isVi ? `${editor} ${display}` : `GNU nano 7.2    ${display || 'Nuevo'}`),
    ),
    text, cmdLine, status, keys, help);

  const setStatus = (msg, cls = '') => { status.textContent = msg; status.className = 'ed-status ' + cls; };
  const lines = () => text.value.split('\n');
  const lineIndex = () => text.value.slice(0, text.selectionStart).split('\n').length - 1;
  const snapshot = () => { undo.push({ v: text.value, c: text.selectionStart }); if (undo.length > 100) undo.shift(); };
  const setCursorLine = idx => {
    const ls = lines();
    idx = Math.max(0, Math.min(idx, ls.length - 1));
    const pos = ls.slice(0, idx).reduce((s, l) => s + l.length + 1, 0);
    text.setSelectionRange(pos, pos);
  };

  function setMode(m) {
    mode = m;
    if (isVi) {
      text.readOnly = m !== 'insert';
      overlay.dataset.mode = m;
      if (m === 'insert') { setStatus('-- INSERT --', 'ins'); text.focus(); }
      else if (m === 'normal') { setStatus(''); cmdLine.classList.add('hidden'); }
    }
    renderKeys();
  }

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', globalKeys, true);
    onClose?.();
  }

  function save() {
    const body = text.value === '' || text.value.endsWith('\n') ? text.value : text.value + '\n';
    const err = onSave(body);
    if (err) { setStatus(isVi ? `E212: Can't open file for writing (${err})` : `[ ${err} ]`, 'err'); return false; }
    saved = text.value;
    const n = body === '' ? 0 : body.split('\n').length - 1;
    setStatus(isVi ? `"${display}" ${isNew ? '[New] ' : ''}${n}L, ${new TextEncoder().encode(body).length}B written` : `[ Wrote ${n} lines ]`, 'ok');
    isNew = false;
    return true;
  }

  function runCommand(cmd) {
    cmd = cmd.trim();
    cmdLine.classList.add('hidden');
    if (cmd === 'w') { save(); setMode('normal'); return; }
    if (cmd === 'wq' || cmd === 'x') { if (save()) close(); return; }
    if (cmd === 'q') {
      if (text.value !== saved) { setStatus('E37: No write since last change (add ! to override)', 'err'); setMode('normal'); return; }
      close(); return;
    }
    if (cmd === 'q!') { close(); return; }
    if (/^\d+$/.test(cmd)) { setCursorLine(Number(cmd) - 1); setMode('normal'); return; }
    setStatus(`E492: Not an editor command: ${cmd}`, 'err');
    setMode('normal');
  }

  function openCmd(prefill = '') {
    mode = 'command';
    cmdLine.classList.remove('hidden');
    cmdInput.value = prefill;
    cmdInput.focus();
  }

  function normalKey(k) {
    if (k === 'i') { snapshot(); setMode('insert'); return true; }
    if (k === 'a') { snapshot(); text.setSelectionRange(text.selectionStart + 1, text.selectionStart + 1); setMode('insert'); return true; }
    if (k === 'o') {
      snapshot();
      const ls = lines();
      const idx = lineIndex();
      ls.splice(idx + 1, 0, '');
      text.value = ls.join('\n');
      setCursorLine(idx + 1);
      setMode('insert');
      return true;
    }
    if (k === 'x') {
      snapshot();
      const p = text.selectionStart;
      if (text.value[p] && text.value[p] !== '\n') { text.value = text.value.slice(0, p) + text.value.slice(p + 1); text.setSelectionRange(p, p); }
      return true;
    }
    if (k === 'd') {
      if (!pendingD) { pendingD = true; setStatus('d'); return true; }
      pendingD = false;
      snapshot();
      const ls = lines();
      const idx = lineIndex();
      yank = ls[idx];
      ls.splice(idx, 1);
      text.value = ls.join('\n');
      setCursorLine(idx);
      setStatus('');
      return true;
    }
    if (k === 'y') {
      if (!pendingY) { pendingY = true; setStatus('y'); return true; }
      pendingY = false;
      yank = lines()[lineIndex()];
      setStatus('1 línea copiada (yy)');
      return true;
    }
    if (k === 'p') {
      if (yank === null) return true;
      snapshot();
      const ls = lines();
      const idx = lineIndex();
      ls.splice(idx + 1, 0, yank);
      text.value = ls.join('\n');
      setCursorLine(idx + 1);
      return true;
    }
    if (k === 'u') {
      const prev = undo.pop();
      if (prev) { text.value = prev.v; text.setSelectionRange(prev.c, prev.c); setStatus('1 change; before #' + (undo.length + 1)); }
      else setStatus('Already at oldest change');
      return true;
    }
    if (k === ':') { openCmd(); return true; }
    if (k === 'G') { setCursorLine(lines().length - 1); return true; }
    if (k === 'j') { setCursorLine(lineIndex() + 1); return true; }
    if (k === 'k') { setCursorLine(lineIndex() - 1); return true; }
    pendingD = false;
    pendingY = false;
    return false;
  }

  function nanoExit() {
    if (text.value === saved) { close(); return; }
    help.replaceChildren(
      h('span', {}, '¿Guardar el búfer modificado? '),
      h('button', { class: 'ed-key', onclick: () => { if (save()) close(); } }, 'S Sí'),
      h('button', { class: 'ed-key', onclick: () => close() }, 'N No'),
      h('button', { class: 'ed-key', onclick: () => renderHelp() }, '^C Cancelar'),
    );
  }

  function key(label, title, fn, cls = '') {
    return h('button', {
      class: 'ed-key ' + cls, title, type: 'button',
      onpointerdown: e => e.preventDefault(),
      onclick: fn,
    }, label);
  }

  function renderKeys() {
    if (isVi) {
      keys.replaceChildren(
        key('Esc', 'Volver al modo edición', () => setMode('normal'), mode === 'insert' ? 'hot' : ''),
        key('i', 'Modo inserción', () => { if (mode !== 'insert') normalKey('i'); }, mode !== 'insert' ? 'hot' : ''),
        key('dd', 'Borrar línea', () => { setMode('normal'); normalKey('d'); normalKey('d'); }),
        key('yy', 'Copiar línea', () => { setMode('normal'); normalKey('y'); normalKey('y'); }),
        key('p', 'Pegar debajo', () => { setMode('normal'); normalKey('p'); }),
        key('u', 'Deshacer', () => { setMode('normal'); normalKey('u'); }),
        key(':w', 'Guardar', () => { setMode('normal'); runCommand('w'); }),
        key(':wq', 'Guardar y salir', () => runCommand('wq'), 'primary'),
        key(':q', 'Salir', () => runCommand('q')),
        key(':q!', 'Salir sin guardar', () => runCommand('q!'), 'danger'),
      );
    } else {
      keys.replaceChildren(
        key('^O Guardar', 'Ctrl+O', () => save(), 'primary'),
        key('^X Salir', 'Ctrl+X', () => nanoExit()),
      );
    }
    renderHelp();
  }

  function renderHelp() {
    help.textContent = isVi
      ? (mode === 'insert'
        ? 'Escribiendo. Pulsa Esc para volver al modo edición.'
        : 'Modo edición: i para escribir · dd borra línea · u deshace · :wq guarda y sale.')
      : 'Escribe directamente. ^O guarda, ^X sale.';
  }

  function globalKeys(e) {
    if (!overlay.isConnected) return;
    if (e.target === cmdInput) {
      if (e.key === 'Enter') { e.preventDefault(); runCommand(cmdInput.value); }
      if (e.key === 'Escape') { e.preventDefault(); setMode('normal'); }
      return;
    }
    if (!isVi) {
      if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); save(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'x') { e.preventDefault(); nanoExit(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setMode('normal'); return; }
    if (mode === 'normal' && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      if (normalKey(e.key)) e.preventDefault();
    }
  }

  cmdInput.addEventListener('blur', () => { if (mode === 'command') setTimeout(() => { if (mode === 'command') setMode('normal'); }, 150); });
  document.addEventListener('keydown', globalKeys, true);
  document.body.append(overlay);
  setMode(mode);
  if (isVi) setStatus(isNew ? `"${display}" [New]` : `"${display}" ${lines().length}L`);
  if (!isVi) text.focus();
  return { close };
}
