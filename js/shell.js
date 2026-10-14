// Terminal Ubuntu simulada: intérprete de un subconjunto de bash sobre un
// sistema de ficheros virtual. Imita los mensajes reales del servidor de clase.
import { VFS, normalize, basename, dirname, modeString, nodeSize, cloneNode, mkDir, mkFile, now } from './vfs.js';
import { buildWorld, buildRepo, REPO_URL, REPO_NAME, make1HVR, BINARIES } from './seed.js';
import { REPO_FILES } from './data/repo.js';
import { parse, BashSyntaxError } from './bash-parser.js';
import { MAN_PAGES } from './data/man.js';
import { PDB_ENTRIES, makePdb, countPdb, sasaFor } from './data/pdb.js';

class ExitSignal { constructor(code) { this.code = code; } }
class LoopSignal { constructor(kind, n) { this.kind = kind; this.n = n; } }
class StepLimit extends Error {}

const ESC = '\x1b';
const COLOR = { dir: `${ESC}[01;34m`, exe: `${ESC}[01;32m`, reset: `${ESC}[0m` };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KEYWORDS = ['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac'];
const MAX_STEPS = 20000;

const pad2 = n => String(n).padStart(2, '0');

function lsDate(ms) {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const j = glob.indexOf(']', i + 1);
      if (j < 0) { re += '\\['; continue; }
      let cls = glob.slice(i + 1, j);
      if (cls[0] === '!') cls = '^' + cls.slice(1);
      re += '[' + cls.replace(/\\/g, '\\\\') + ']';
      i = j;
    } else re += c.replace(/[.+^${}()|\\/]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// Expresión regular básica (grep/sed sin -E) a RegExp de JavaScript.
function breToRegex(pat, extended, flags = '') {
  let src = pat;
  if (!extended) {
    src = '';
    for (let i = 0; i < pat.length; i++) {
      const c = pat[i];
      if (c === '\\' && i + 1 < pat.length) {
        const n = pat[i + 1];
        if ('(){}|+?'.includes(n)) src += n;
        else src += '\\' + n;
        i++;
      } else if ('(){}|+?'.includes(c)) src += '\\' + c;
      else src += c;
    }
  }
  try { return new RegExp(src, flags); } catch { return new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); }
}

function splitLines(text) {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function traceQuote(a) {
  return /[\s'"$*?|&;<>()[\]!]/.test(a) || a === '' ? `'${a.replace(/'/g, "'\\''")}'` : a;
}

export class Shell {
  constructor(opts = {}) {
    this.user = opts.user || 'bio_alumno';
    this.host = 'ubuntu';
    this.home = `/home/${this.user}`;
    this.fs = new VFS();
    buildWorld(this.fs, this.user, opts);
    this.cwd = this.home;
    this.oldpwd = this.home;
    this.history = [];
    this.lastStatus = 0;
    this.events = [];
    this.stats = { commands: 0, sudo: false };
    this.pid = 2291423 + Math.floor(Math.random() * 9000);
    this.nextPid = this.pid + 23000;
    this.aliases = { ll: 'ls -alF', la: 'ls -A', l: 'ls -CF' };
    this.top = {
      vars: {
        HOME: this.home, USER: this.user, LOGNAME: this.user, SHELL: '/bin/bash',
        PATH: '/usr/local/bin:/usr/bin:/bin', HOSTNAME: this.host, LANG: 'C.UTF-8', TERM: 'xterm-256color',
        PS1: '\\u@\\h:\\w\\$ ',
      },
      exported: new Set(['HOME', 'USER', 'LOGNAME', 'SHELL', 'PATH', 'LANG', 'TERM']),
      args: [], name: 'bash', interactive: true, trace: false, line: 0,
    };
    this.steps = 0;
  }

  // ---------- Utilidades de rutas y permisos ----------

  resolve(path) {
    if (path === '~' || path.startsWith('~/')) path = this.home + path.slice(1);
    if (!path.startsWith('/')) path = this.cwd + '/' + path;
    return normalize(path);
  }

  shortPath(abs = this.cwd) {
    if (abs === this.home) return '~';
    if (abs.startsWith(this.home + '/')) return '~' + abs.slice(this.home.length);
    return abs;
  }

  prompt() {
    return `${this.user}@${this.host}:${this.shortPath()}$ `;
  }

  get(path) { return this.fs.get(this.resolve(path)); }

  owns(node) { return node.owner === this.user; }

  can(node, bit) { // bit: 4 r, 2 w, 1 x
    if (this.owns(node)) return !!(node.mode & (bit << 6));
    return !!(node.mode & bit);
  }

  // Solo se puede escribir dentro del HOME y de /tmp, como en el servidor.
  canWriteAt(abs) {
    const { parent } = this.fs.parentOf(abs);
    if (!parent) return false;
    if (abs.startsWith('/tmp/')) return true;
    if (!(abs.startsWith(this.home + '/'))) return false;
    return this.can(parent, 2);
  }

  repoOf(abs) {
    let path = abs;
    while (path !== '/') {
      const node = this.fs.get(path);
      if (node && node.repo) return { node, path };
      path = dirname(path);
    }
    return null;
  }

  touchedRepo(abs) {
    const r = this.repoOf(abs);
    if (!r) return;
    const rel = abs.slice(r.path.length + 1);
    if (rel.startsWith('.git')) return;
    if (!r.node.repo.dirty.includes(rel)) r.node.repo.dirty.push(rel);
  }

  writeFile(abs, content, append = false) {
    const node = this.fs.get(abs);
    if (node && node.type === 'f') {
      node.content = append ? node.content + content : content;
      node.mtime = now();
    } else {
      this.fs.set(abs, mkFile(content, this.user, 0o664));
    }
    this.touchedRepo(abs);
  }

  // API para el editor (vi/nano) de la interfaz.
  saveFile(abs, content) {
    const node = this.fs.get(abs);
    if (node && node.type === 'd') return `"${basename(abs)}" es un directorio`;
    if (node && !this.can(node, 2)) return `"${basename(abs)}" no tiene permiso de escritura (w)`;
    if (!node && !this.canWriteAt(abs)) return `No se puede crear "${basename(abs)}" ahí`;
    this.writeFile(abs, content);
    return null;
  }

  readFile(abs) {
    const node = this.fs.get(abs);
    return node && node.type === 'f' ? node.content : null;
  }

  // ---------- Bucle principal ----------

  run(line) {
    const out = [];
    const io = {
      stdin: '', tty: true,
      out: s => out.push({ text: s, kind: 'out' }),
      err: s => out.push({ text: s, kind: 'err' }),
      info: s => out.push({ text: s, kind: 'info' }),
    };
    if (line.trim()) {
      this.history.push(line);
      this.stats.commands++;
    }
    this.steps = 0;
    let ast;
    try {
      ast = parse(line);
    } catch (e) {
      if (e instanceof BashSyntaxError) {
        io.err(`bash: ${e.message}\n`);
        this.lastStatus = 2;
        return out;
      }
      throw e;
    }
    try {
      this.lastStatus = this.execList(ast, this.top, io);
    } catch (e) {
      if (e instanceof ExitSignal) {
        io.out('logout\n');
        this.events.push({ type: 'exit' });
        this.lastStatus = e.code;
      } else if (e instanceof LoopSignal) {
        this.lastStatus = 0;
      } else if (e instanceof StepLimit) {
        io.info('⚠ Dr.Xinxus ha parado un bucle que no terminaba. En el servidor se corta con Ctrl+C.\n');
        this.lastStatus = 130;
      } else {
        console.error(e);
        io.err(`bash: error interno del simulador: ${e.message}\n`);
        this.lastStatus = 1;
      }
    }
    return out;
  }

  // Ejecuta sin dejar rastro en el historial (para preparar ejercicios).
  quiet(line) {
    const saved = this.history.length;
    const out = this.run(line);
    this.history.length = saved;
    this.stats.commands = Math.max(0, this.stats.commands - 1);
    return out;
  }

  tick() {
    if (++this.steps > MAX_STEPS) throw new StepLimit();
  }

  execList(list, p, io) {
    let status = 0;
    for (const item of list.items) {
      status = this.exec(item, p, io);
      this.lastStatus = status;
    }
    return status;
  }

  exec(node, p, io) {
    this.tick();
    switch (node.type) {
      case 'list': return this.execList(node, p, io);
      case 'andor': {
        let s = this.exec(node.left, p, io);
        this.lastStatus = s;
        if ((node.op === '&&' && s === 0) || (node.op === '||' && s !== 0)) s = this.exec(node.right, p, io);
        return s;
      }
      case 'pipeline': {
        let input = io.stdin;
        let s = 0;
        node.cmds.forEach((cmd, i) => {
          const last = i === node.cmds.length - 1;
          const buf = [];
          const sub = last ? { ...io, stdin: input } : { ...io, stdin: input, tty: false, out: t => buf.push(t) };
          s = this.exec(cmd, p, sub);
          input = buf.join('');
        });
        return node.negate ? (s === 0 ? 1 : 0) : s;
      }
      case 'simple': return this.execSimple(node, p, io);
      case 'if': return this.withRedirs(node.redirs, p, io, io2 => {
        for (const b of node.branches) {
          if (this.execList(b.cond, p, io2) === 0) return this.execList(b.body, p, io2);
        }
        return node.elseBody ? this.execList(node.elseBody, p, io2) : 0;
      });
      case 'for': return this.withRedirs(node.redirs, p, io, io2 => {
        const items = node.words === null ? [...p.args] : this.expandWords(node.words, p);
        let s = 0;
        for (const item of items) {
          this.tick();
          if (p.trace) io2.err(`+ for ${node.name} in ${node.words === null ? '"$@"' : node.words.join(' ')}
`);
          this.setVar(p, node.name, item);
          try {
            s = this.execList(node.body, p, io2);
          } catch (e) {
            if (!(e instanceof LoopSignal)) throw e;
            if (e.n > 1) { e.n--; throw e; }
            if (e.kind === 'break') break;
          }
        }
        return s;
      });
      case 'while': return this.withRedirs(node.redirs, p, io, io2 => {
        let s = 0;
        for (;;) {
          this.tick();
          const c = this.execList(node.cond, p, io2);
          if (node.until ? c === 0 : c !== 0) break;
          try {
            s = this.execList(node.body, p, io2);
          } catch (e) {
            if (!(e instanceof LoopSignal)) throw e;
            if (e.n > 1) { e.n--; throw e; }
            if (e.kind === 'break') break;
          }
        }
        return s;
      });
      case 'case': return this.withRedirs(node.redirs, p, io, io2 => {
        const word = this.expandWord(node.word, p, { split: false, glob: false }).join(' ');
        for (const item of node.items) {
          for (const pat of item.patterns) {
            const pe = this.expandWord(pat, p, { split: false, glob: false }).join(' ');
            if (globToRegex(pe).test(word)) return this.execList(item.body, p, io2);
          }
        }
        return 0;
      });
      default: return 0;
    }
  }

  errPrefix(p) {
    return p.interactive ? 'bash: ' : `${p.name}: line ${p.line}: `;
  }

  withRedirs(redirs, p, io, fn) {
    if (!redirs || !redirs.length) return fn(io);
    const io2 = { ...io };
    const writes = [];
    for (const r of redirs) {
      const target = this.expandWord(r.target, p, { split: false }).join(' ');
      if (r.op === '<') {
        const node = this.get(target);
        if (!node) { io.err(`${this.errPrefix(p)}${target}: No such file or directory\n`); return 1; }
        if (node.type === 'd') { io.err(`${this.errPrefix(p)}${target}: Is a directory\n`); return 1; }
        io2.stdin = node.content;
        continue;
      }
      const buf = [];
      if (target !== '/dev/null') {
        const abs = this.resolve(target);
        const node = this.fs.get(abs);
        const { parent } = this.fs.parentOf(abs);
        if (node && node.type === 'd') { io.err(`${this.errPrefix(p)}${target}: Is a directory\n`); return 1; }
        if (!parent || parent.type !== 'd') { io.err(`${this.errPrefix(p)}${target}: No such file or directory\n`); return 1; }
        if ((node && !this.can(node, 2)) || (!node && !this.canWriteAt(abs))) {
          io.err(`${this.errPrefix(p)}${target}: Permission denied\n`);
          return 1;
        }
        const append = r.op.endsWith('>>');
        if (!append || !node) this.writeFile(abs, '');
        writes.push({ abs, buf });
      }
      const sink = t => buf.push(t);
      if (r.op === '>' || r.op === '>>') { io2.out = sink; io2.tty = false; }
      else if (r.op === '2>' || r.op === '2>>') io2.err = sink;
      else if (r.op === '&>') { io2.out = sink; io2.err = sink; io2.tty = false; }
    }
    const status = fn(io2);
    for (const w of writes) this.writeFile(w.abs, w.buf.join(''), true);
    return status;
  }

  setVar(p, name, value) {
    p.vars[name] = value;
    if (name === 'PWD') this.cwd = value;
  }

  execSimple(node, p, io) {
    p.line = node.line;
    let argv = this.expandWords(node.words, p);
    if (p.interactive && argv.length && this.aliases[argv[0]] && !/['"\\]/.test(node.words[0])) {
      argv = [...this.aliases[argv[0]].split(' '), ...argv.slice(1)];
    }
    for (const a of node.assigns) {
      const value = this.expandWord(a.value, p, { split: false, glob: false }).join(' ');
      if (p.trace) io.err(`+ ${a.name}=${traceQuote(value)}\n`);
      this.setVar(p, a.name, value);
    }
    if (!argv.length) {
      return this.withRedirs(node.redirs, p, io, () => 0);
    }
    if (p.trace) io.err(`+ ${argv.map(traceQuote).join(' ')}\n`);
    return this.withRedirs(node.redirs, p, io, io2 => this.runCommand(argv, p, io2));
  }

  runCommand(argv, p, io) {
    const name = argv[0];
    const args = argv.slice(1);
    if (BUILTINS[name]) return BUILTINS[name].call(this, args, p, io);
    if (name.includes('/')) return this.runPath(name, args, p, io);
    const pathDirs = (p.vars.PATH || '').split(':').filter(Boolean);
    for (const dir of pathDirs) {
      const abs = normalize(dir + '/' + name);
      const node = this.fs.get(abs);
      if (node && node.type === 'f' && this.can(node, 1)) {
        if (node.bin && COMMANDS[node.bin]) return COMMANDS[node.bin].call(this, args, p, io);
        if (!node.bin) return this.runPath(abs, args, p, io, name);
      }
    }
    if (COMMANDS[name] && pathDirs.some(d => d === '/usr/bin' || d === '/bin')) {
      return COMMANDS[name].call(this, args, p, io);
    }
    io.err(`${p.interactive ? '' : `${p.name}: line ${p.line}: `}${name}: command not found\n`);
    return 127;
  }

  runPath(path, args, p, io, display = path) {
    const abs = this.resolve(path);
    const node = this.fs.get(abs);
    const bp = this.errPrefix(p);
    if (!node) { io.err(`${bp}${path}: No such file or directory\n`); return 127; }
    if (node.type === 'd') { io.err(`${bp}${path}: Is a directory\n`); return 126; }
    if (!this.can(node, 1)) { io.err(`${bp}${path}: Permission denied\n`); return 126; }
    if (node.bin) return COMMANDS[node.bin] ? COMMANDS[node.bin].call(this, args, p, io) : 0;
    const first = node.content.split('\n')[0];
    if (first.startsWith('#!')) {
      if (first.endsWith('\r')) {
        io.err(`${bp}${path}: ${first.slice(2).replace(/\r$/, '')}^M: bad interpreter: No such file or directory\n`);
        return 126;
      }
      if (/python/.test(first)) {
        io.info('ℹ Dr.Xinxus no ejecuta Python; en el servidor este script sí funcionaría.\n');
        return 0;
      }
    }
    return this.runScript(abs, display, args, p, io, {});
  }

  runScript(abs, displayName, args, parent, io, flags) {
    const node = this.fs.get(abs);
    let ast;
    try {
      ast = parse(node.content);
    } catch (e) {
      if (e instanceof BashSyntaxError) {
        io.err(`${displayName}: line ${e.line ?? 1}: ${e.message}\n`);
        return 2;
      }
      throw e;
    }
    if (flags.n) return 0;
    const vars = {};
    for (const k of parent.exported) if (k in parent.vars) vars[k] = parent.vars[k];
    const child = {
      vars, exported: new Set(parent.exported), args: [...args], name: displayName,
      interactive: false, trace: !!flags.x, line: 0,
    };
    const savedCwd = this.cwd;
    let status = 0;
    try {
      status = this.execList(ast, child, io);
    } catch (e) {
      if (e instanceof ExitSignal) status = e.code;
      else if (!(e instanceof LoopSignal)) throw e;
    } finally {
      this.cwd = savedCwd;
    }
    return status;
  }

  // ---------- Expansiones ----------

  expandWords(words, p) {
    return words.flatMap(w => this.expandWord(w, p));
  }

  getVar(name, p) {
    switch (name) {
      case '#': return String(p.args.length);
      case '?': return String(this.lastStatus);
      case '$': return String(this.pid);
      case '!': return '';
      case '@': case '*': return p.args.join(' ');
      case '0': return p.name;
      case 'PWD': return this.cwd;
      case 'OLDPWD': return this.oldpwd;
      case 'RANDOM': return String(Math.floor(Math.random() * 32768));
      default:
        if (/^\d+$/.test(name)) return p.args[Number(name) - 1] ?? '';
        return p.vars[name] ?? '';
    }
  }

  isSet(name, p) {
    if (/^\d+$/.test(name)) return name === '0' || Number(name) <= p.args.length;
    if ('#?$@*'.includes(name) || name === 'PWD') return true;
    return name in p.vars;
  }

  braceExpand(inner, p) {
    let m = inner.match(/^#([A-Za-z_]\w*|\d+)$/);
    if (m) return String(this.getVar(m[1], p).length);
    m = inner.match(/^([A-Za-z_]\w*|\d+|[@*#?$])(:?)([-=+?])(.*)$/s);
    if (m) {
      const [, name, colon, op, word] = m;
      const val = this.getVar(name, p);
      const unset = colon ? (!this.isSet(name, p) || val === '') : !this.isSet(name, p);
      const wordVal = () => this.expandWord(word, p, { split: false, glob: false }).join(' ');
      if (op === '-') return unset ? wordVal() : val;
      if (op === '=') { if (unset) { this.setVar(p, name, wordVal()); return p.vars[name]; } return val; }
      if (op === '+') return unset ? '' : wordVal();
      return val;
    }
    return this.getVar(inner, p);
  }

  commandSubst(src, p) {
    const buf = [];
    const io = { stdin: '', tty: false, out: t => buf.push(t), err: () => {}, info: () => {} };
    const sub = { ...p, vars: { ...p.vars } };
    try {
      this.execList(parse(src), sub, io);
    } catch (e) {
      if (e instanceof StepLimit) throw e;
    }
    return buf.join('').replace(/\n+$/, '');
  }

  arith(expr, p) {
    const replaced = expr.replace(/\$?\{?([A-Za-z_]\w*)\}?/g, (_, n) => String(Number(this.getVar(n, p)) || 0))
      .replace(/\$(\d+|#)/g, (_, n) => String(Number(this.getVar(n, p)) || 0));
    if (!/^[\d\s+\-*/%()<>=!&|]+$/.test(replaced)) return '0';
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${replaced.replace(/\//g, '/')})`)();
      return String(Math.trunc(Number(v)));
    } catch {
      return '0';
    }
  }

  // Lee una expansión que empieza por $ en raw[i]; devuelve { value, end }.
  dollar(raw, i, p) {
    const n = raw[i + 1];
    if (n === '(' && raw[i + 2] === '(') {
      const end = raw.indexOf('))', i + 3);
      if (end >= 0) return { value: this.arith(raw.slice(i + 3, end), p), end: end + 2 };
    }
    if (n === '(') {
      let depth = 1;
      let j = i + 2;
      while (j < raw.length && depth) {
        if (raw[j] === '(') depth++;
        else if (raw[j] === ')') depth--;
        else if (raw[j] === "'") {
          const close = raw.indexOf("'", j + 1);
          j = close < 0 ? raw.length : close;
        }
        j++;
      }
      return { value: this.commandSubst(raw.slice(i + 2, j - 1), p), end: j };
    }
    if (n === '{') {
      const j = raw.indexOf('}', i);
      return { value: this.braceExpand(raw.slice(i + 2, j), p), end: j + 1 };
    }
    if (n && /[A-Za-z_]/.test(n)) {
      let j = i + 1;
      while (j < raw.length && /\w/.test(raw[j])) j++;
      return { value: this.getVar(raw.slice(i + 1, j), p), end: j };
    }
    if (n && /[0-9#?$!@*]/.test(n)) return { value: this.getVar(n, p), end: i + 2, special: n };
    return { value: '$', end: i + 1 };
  }

  expandWord(raw, p, opts = {}) {
    const split = opts.split !== false;
    const doGlob = opts.glob !== false;
    if (raw === '"$@"') return [...p.args];
    const fields = [];
    let cur = '';
    let has = false;
    let glob = false;
    const flush = () => {
      if (has) fields.push({ text: cur, glob });
      cur = ''; has = false; glob = false;
    };
    const addQuoted = t => { cur += t; has = true; };
    const addUnquoted = t => {
      if (!split) { cur += t; if (t) has = true; return; }
      const parts = t.split(/[ \t\n]+/);
      parts.forEach((part, idx) => {
        if (idx > 0) flush();
        if (part) { cur += part; has = true; if (/[*?[]/.test(part)) glob = true; }
      });
    };
    let i = 0;
    if (raw[0] === '~' && (raw.length === 1 || raw[1] === '/')) { addQuoted(this.home); i = 1; }
    while (i < raw.length) {
      const c = raw[i];
      if (c === '\\') { addQuoted(raw[i + 1] ?? ''); i += 2; continue; }
      if (c === "'") {
        const j = raw.indexOf("'", i + 1);
        addQuoted(raw.slice(i + 1, j < 0 ? raw.length : j));
        i = j < 0 ? raw.length : j + 1;
        continue;
      }
      if (c === '"') {
        has = true;
        i++;
        while (i < raw.length && raw[i] !== '"') {
          const d = raw[i];
          if (d === '\\' && '$`"\\'.includes(raw[i + 1])) { cur += raw[i + 1]; i += 2; continue; }
          if (d === '$') {
            const r = this.dollar(raw, i, p);
            cur += r.value;
            i = r.end;
            continue;
          }
          cur += d;
          i++;
        }
        i++;
        continue;
      }
      if (c === '$') {
        const r = this.dollar(raw, i, p);
        if (r.value === '$' && r.end === i + 1) addQuoted('$');
        else addUnquoted(r.value);
        i = r.end;
        continue;
      }
      cur += c;
      has = true;
      if (c === '*' || c === '?' || c === '[') glob = true;
      i++;
    }
    flush();
    if (!doGlob) return fields.map(f => f.text);
    return fields.flatMap(f => (f.glob ? this.glob(f.text) : [f.text]));
  }

  glob(pattern) {
    const slash = pattern.lastIndexOf('/');
    const dirPart = slash >= 0 ? pattern.slice(0, slash + 1) : '';
    const filePart = slash >= 0 ? pattern.slice(slash + 1) : pattern;
    if (!/[*?[]/.test(filePart)) return [pattern];
    const dir = this.get(dirPart || '.');
    if (!dir || dir.type !== 'd') return [pattern];
    const re = globToRegex(filePart);
    const matches = Object.keys(dir.children)
      .filter(n => (n.startsWith('.') ? filePart.startsWith('.') : true) && re.test(n))
      .sort(sortNames)
      .map(n => dirPart + n);
    return matches.length ? matches : [pattern];
  }

  // ---------- test / [ ] ----------

  test(args, p, io, bracket) {
    const bp = this.errPrefix(p);
    if (bracket) {
      if (args[args.length - 1] !== ']') { io.err(`${bp}[: missing \`]'\n`); return 2; }
      args = args.slice(0, -1);
    }
    const name = bracket ? '[' : 'test';
    const unary = (op, v) => {
      const node = v === '' ? null : this.get(v);
      switch (op) {
        case '-n': return v !== '';
        case '-z': return v === '';
        case '-e': return !!node;
        case '-f': return !!node && node.type === 'f';
        case '-d': return !!node && node.type === 'd';
        case '-s': return !!node && node.type === 'f' && node.content.length > 0;
        case '-r': return !!node && this.can(node, 4);
        case '-w': return !!node && this.can(node, 2);
        case '-x': return !!node && this.can(node, 1);
        default: return undefined;
      }
    };
    const intOf = v => {
      if (!/^\s*-?\d+\s*$/.test(v)) throw new Error(`${bp}${name}: ${v}: integer expression expected`);
      return Number(v);
    };
    const binary = (a, op, b) => {
      switch (op) {
        case '=': case '==': return a === b;
        case '!=': return a !== b;
        case '-eq': return intOf(a) === intOf(b);
        case '-ne': return intOf(a) !== intOf(b);
        case '-lt': return intOf(a) < intOf(b);
        case '-le': return intOf(a) <= intOf(b);
        case '-gt': return intOf(a) > intOf(b);
        case '-ge': return intOf(a) >= intOf(b);
        default: return undefined;
      }
    };
    const evalN = a => {
      if (a.length === 0) return false;
      if (a.length === 1) return a[0] !== '';
      if (a.length === 2) {
        if (a[0] === '!') return !evalN(a.slice(1));
        const r = unary(a[0], a[1]);
        if (r === undefined) throw new Error(`${bp}${name}: ${a[0]}: unary operator expected`);
        return r;
      }
      if (a.length === 3) {
        const r = binary(a[0], a[1], a[2]);
        if (r !== undefined) return r;
        if (a[0] === '!') return !evalN(a.slice(1));
        throw new Error(`${bp}${name}: ${a[1]}: binary operator expected`);
      }
      if (a.length === 4 && a[0] === '!') return !evalN(a.slice(1));
      const ai = a.indexOf('-a');
      if (ai > 0) return evalN(a.slice(0, ai)) && evalN(a.slice(ai + 1));
      const oi = a.indexOf('-o');
      if (oi > 0) return evalN(a.slice(0, oi)) || evalN(a.slice(oi + 1));
      throw new Error(`${bp}${name}: too many arguments`);
    };
    try {
      return evalN(args) ? 0 : 1;
    } catch (e) {
      io.err(e.message + '\n');
      return 2;
    }
  }
}

function sortNames(a, b) {
  const ka = a.replace(/^\./, '').toLowerCase();
  const kb = b.replace(/^\./, '').toLowerCase();
  return ka < kb ? -1 : ka > kb ? 1 : a < b ? -1 : 1;
}

// Separa opciones cortas (-la → l, a) del resto de argumentos.
function parseOpts(args, withValue = []) {
  const flags = new Set();
  const values = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (/^-[A-Za-z]/.test(a)) {
      for (let k = 1; k < a.length; k++) {
        const f = a[k];
        if (withValue.includes(f)) {
          values[f] = a.slice(k + 1) || args[++i];
          break;
        }
        flags.add(f);
      }
    } else if (/^-\d+$/.test(a) && withValue.includes('n')) {
      values.n = a.slice(1);
    } else rest.push(a);
  }
  return { flags, values, rest };
}

// ---------- Órdenes internas (builtins) ----------

const BUILTINS = {
  cd(args, p, io) {
    const bp = this.errPrefix(p);
    if (args.length > 1) { io.err(`${bp}cd: too many arguments\n`); return 1; }
    let target = args[0];
    if (target && target.startsWith('-') && target !== '-') {
      io.err(`${bp}cd: ${target}: invalid option\ncd: usage: cd [-L|[-P [-e]] [-@]] [dir]\n`);
      return 2;
    }
    if (target === undefined || target === '') target = this.home;
    if (target === '-') { target = this.oldpwd; io.out(target + '\n'); }
    const abs = this.resolve(target);
    const node = this.fs.get(abs);
    if (!node) { io.err(`${bp}cd: ${args[0]}: No such file or directory\n`); return 1; }
    if (node.type !== 'd') { io.err(`${bp}cd: ${args[0]}: Not a directory\n`); return 1; }
    if (!this.can(node, 1)) { io.err(`${bp}cd: ${args[0]}: Permission denied\n`); return 1; }
    this.oldpwd = this.cwd;
    this.cwd = abs;
    return 0;
  },
  pwd(args, p, io) { io.out(this.cwd + '\n'); return 0; },
  echo(args, p, io) {
    let newline = true;
    let escapes = false;
    while (args.length && /^-[neE]+$/.test(args[0])) {
      if (args[0].includes('n')) newline = false;
      if (args[0].includes('e')) escapes = true;
      args = args.slice(1);
    }
    let s = args.join(' ');
    if (escapes) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
    io.out(s + (newline ? '\n' : ''));
    return 0;
  },
  printf(args, p, io) {
    if (!args.length) { io.err(`${this.errPrefix(p)}printf: usage: printf [-v var] format [arguments]\n`); return 2; }
    const fmt = args[0].replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const vals = args.slice(1);
    let k = 0;
    let out = '';
    do {
      out += fmt.replace(/%([sd%])/g, (_, t) => (t === '%' ? '%' : t === 'd' ? String(parseInt(vals[k++] || '0', 10) || 0) : (vals[k++] ?? '')));
    } while (k < vals.length && k > 0);
    io.out(out);
    return 0;
  },
  export(args, p) {
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) { this.setVar(p, a.slice(0, eq), a.slice(eq + 1)); p.exported.add(a.slice(0, eq)); }
      else if (a !== '-p') p.exported.add(a);
    }
    return 0;
  },
  unset(args, p) {
    for (const a of args) { delete p.vars[a]; p.exported.delete(a); }
    return 0;
  },
  set(args, p, io) {
    if (!args.length) {
      Object.keys(p.vars).sort().forEach(k => io.out(`${k}=${p.vars[k].includes(' ') ? `'${p.vars[k]}'` : p.vars[k]}\n`));
    } else if (args[0] === '-x') p.trace = true;
    else if (args[0] === '+x') p.trace = false;
    return 0;
  },
  env(args, p, io) {
    [...p.exported].filter(k => k in p.vars).sort().forEach(k => io.out(`${k}=${p.vars[k]}\n`));
    io.out(`PWD=${this.cwd}\n`);
    return 0;
  },
  exit(args) { throw new ExitSignal(Number(args[0] ?? this.lastStatus) || 0); },
  logout(args, p, io) {
    if (!p.interactive) { io.err(`${this.errPrefix(p)}logout: not login shell: use \`exit'\n`); return 1; }
    throw new ExitSignal(0);
  },
  shift(args, p, io) {
    const n = Number(args[0] ?? 1);
    if (n > p.args.length) return 1;
    p.args = p.args.slice(n);
    return 0;
  },
  break(args) { throw new LoopSignal('break', Number(args[0] || 1)); },
  continue(args) { throw new LoopSignal('continue', Number(args[0] || 1)); },
  true() { return 0; },
  false() { return 1; },
  ':'() { return 0; },
  test(args, p, io) { return this.test(args, p, io, false); },
  '['(args, p, io) { return this.test(args, p, io, true); },
  type(args, p, io) {
    let status = 0;
    for (const a of args) {
      if (this.aliases[a]) io.out(`${a} is aliased to \`${this.aliases[a]}'\n`);
      else if (KEYWORDS.includes(a)) io.out(`${a} is a shell keyword\n`);
      else if (BUILTINS[a]) io.out(`${a} is a shell builtin\n`);
      else if (COMMANDS[a] || BINARIES.includes(a)) io.out(`${a} is /usr/bin/${a}\n`);
      else { io.err(`${this.errPrefix(p)}type: ${a}: not found\n`); status = 1; }
    }
    return status;
  },
  history(args, p, io) {
    if (args[0] === '-c') { this.history.length = 0; return 0; }
    if (args[0] === '-a' || args[0] === '-w') return 0;
    this.history.forEach((h, i) => io.out(`${String(i + 1).padStart(5)}  ${h}\n`));
    return 0;
  },
  clear() { this.events.push({ type: 'clear' }); return 0; },
  alias(args, p, io) {
    if (!args.length) {
      Object.entries(this.aliases).forEach(([k, v]) => io.out(`alias ${k}='${v}'\n`));
      return 0;
    }
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) this.aliases[a.slice(0, eq)] = a.slice(eq + 1);
    }
    return 0;
  },
  source(args, p, io) {
    if (!args[0]) return 2;
    const abs = this.resolve(args[0]);
    const node = this.fs.get(abs);
    if (!node) { io.err(`${this.errPrefix(p)}${args[0]}: No such file or directory\n`); return 1; }
    return this.execList(parse(node.content), p, io);
  },
  bash(args, p, io) {
    const flags = {};
    let i = 0;
    for (; i < args.length && args[i].startsWith('-'); i++) {
      if (args[i] === '-c') {
        const sub = { ...p, vars: { ...p.vars }, args: args.slice(i + 2), name: args[i + 2] || 'bash', interactive: false };
        try { return this.execList(parse(args[i + 1] || ''), sub, io); } catch (e) { if (e instanceof ExitSignal) return e.code; throw e; }
      }
      if (args[i].includes('n')) flags.n = true;
      if (args[i].includes('x')) flags.x = true;
    }
    const path = args[i];
    if (!path) { io.info('ℹ Ya estás en bash. (En el servidor se abriría otro bash dentro; sal con exit.)\n'); return 0; }
    const abs = this.resolve(path);
    const node = this.fs.get(abs);
    if (!node) { io.err(`bash: ${path}: No such file or directory\n`); return 127; }
    if (node.type === 'd') { io.err(`bash: ${path}: Is a directory\n`); return 126; }
    if (node.bin) { io.err(`${path}: ${path}: cannot execute binary file\n`); return 126; }
    if (!this.can(node, 4)) { io.err(`bash: ${path}: Permission denied\n`); return 126; }
    return this.runScript(abs, path, args.slice(i + 1), p, io, flags);
  },
};
BUILTINS.sh = BUILTINS.bash;
BUILTINS['.'] = BUILTINS.source;

// ---------- Órdenes externas ----------

function readInputs(sh, name, files, io) {
  // Devuelve [{ name, text }] o null si hubo error en todos.
  if (!files.length) return { items: [{ name: '', text: io.stdin }], status: 0 };
  const items = [];
  let status = 0;
  for (const f of files) {
    if (f === '-') { items.push({ name: '-', text: io.stdin }); continue; }
    const node = sh.get(f);
    if (!node) { io.err(`${name}: ${f}: No such file or directory\n`); status = 1; continue; }
    if (node.type === 'd') { io.err(`${name}: ${f}: Is a directory\n`); status = 1; continue; }
    if (!sh.can(node, 4)) { io.err(`${name}: ${f}: Permission denied\n`); status = 1; continue; }
    items.push({ name: f, text: node.bin ? '\x7fELF\x02\x01\x01' : node.content });
  }
  return { items, status };
}

function noInputHint(sh, io, cmd) {
  if (io.tty && !io.stdin) {
    io.info(`ℹ ${cmd} sin fichero se queda esperando texto del teclado. En el servidor, sal con Ctrl+C (o Ctrl+D para terminar).\n`);
    return true;
  }
  return false;
}

const COMMANDS = {
  ls(args, p, io) {
    const { flags, rest } = parseOpts(args);
    const known = 'lartsh1dRSFCAi';
    for (const f of flags) {
      if (!known.includes(f)) {
        io.err(`ls: invalid option -- '${f}'\nTry 'ls --help' for more information.\n`);
        return 2;
      }
    }
    const long = flags.has('l');
    const all = flags.has('a');
    const almost = flags.has('A');
    const classify = flags.has('F');
    const color = io.tty;
    const targets = rest.length ? rest : ['.'];
    let status = 0;
    const fileEntries = [];
    const dirEntries = [];
    for (const t of targets) {
      const node = this.get(t);
      if (!node) { io.err(`ls: cannot access '${t}': No such file or directory\n`); status = 2; continue; }
      if (node.type === 'd' && !flags.has('d')) dirEntries.push({ t, node });
      else fileEntries.push({ name: t, node });
    }
    const decorate = (name, node) => {
      let s = name;
      const exe = node.type === 'f' && (node.mode & 0o111);
      if (color && node.type === 'd') s = COLOR.dir + name + COLOR.reset;
      else if (color && exe) s = COLOR.exe + name + COLOR.reset;
      if (classify) s += node.type === 'd' ? '/' : exe ? '*' : '';
      return s;
    };
    const sortEntries = entries => {
      let list = [...entries];
      if (flags.has('t')) list.sort((a, b) => b.node.mtime - a.node.mtime);
      else if (flags.has('S')) list.sort((a, b) => nodeSize(b.node) - nodeSize(a.node));
      else list.sort((a, b) => sortNames(a.name, b.name));
      if (flags.has('r')) list.reverse();
      return list;
    };
    const print = entries => {
      if (!entries.length) return;
      if (long) {
        const sizes = entries.map(e => String(nodeSize(e.node)));
        const links = entries.map(e => String(e.node.type === 'd' ? 2 + Object.values(e.node.children).filter(c => c.type === 'd').length : 1));
        const sw = Math.max(...sizes.map(s => s.length));
        const lw = Math.max(...links.map(s => s.length));
        const ow = Math.max(...entries.map(e => e.node.owner.length));
        entries.forEach((e, i) => {
          const blocks = flags.has('s') ? String(Math.ceil(nodeSize(e.node) / 4096) * 4).padStart(2) + ' ' : '';
          io.out(`${blocks}${modeString(e.node)} ${links[i].padStart(lw)} ${e.node.owner.padEnd(ow)} ${e.node.owner.padEnd(ow)} ${sizes[i].padStart(sw)} ${lsDate(e.node.mtime)} ${decorate(e.name, e.node)}\n`);
        });
      } else if (io.tty && !flags.has('1')) {
        io.out(entries.map(e => decorate(e.name, e.node)).join('  ') + '\n');
      } else {
        entries.forEach(e => io.out(decorate(e.name, e.node) + '\n'));
      }
    };
    print(sortEntries(fileEntries));
    dirEntries.forEach(({ t, node }, idx) => {
      if (!this.can(node, 4)) {
        io.err(`ls: cannot open directory '${t}': Permission denied\n`);
        status = 2;
        return;
      }
      if (targets.length > 1) io.out(`${fileEntries.length || idx ? '\n' : ''}${t}:\n`);
      let entries = Object.entries(node.children)
        .filter(([n]) => all || almost || !n.startsWith('.'))
        .map(([name, n]) => ({ name, node: n }));
      if (all) {
        const abs = this.resolve(t);
        entries.push({ name: '.', node }, { name: '..', node: this.fs.get(dirname(abs)) || node });
      }
      entries = sortEntries(entries);
      if (long) {
        const total = entries.reduce((s, e) => s + Math.ceil(nodeSize(e.node) / 4096) * 4, 0);
        io.out(`total ${total}\n`);
      }
      print(entries);
    });
    return status;
  },

  mkdir(args, p, io) {
    const { flags, rest } = parseOpts(args);
    if (!rest.length) { io.err("mkdir: missing operand\nTry 'mkdir --help' for more information.\n"); return 1; }
    let status = 0;
    for (const d of rest) {
      const abs = this.resolve(d);
      if (flags.has('p')) {
        if (!abs.startsWith(this.home) && !abs.startsWith('/tmp')) { io.err(`mkdir: cannot create directory ‘${d}’: Permission denied\n`); status = 1; continue; }
        const node = this.fs.mkdirp(abs, this.user);
        if (!node) { io.err(`mkdir: cannot create directory ‘${d}’: Not a directory\n`); status = 1; }
        continue;
      }
      const existing = this.fs.get(abs);
      const { parent } = this.fs.parentOf(abs);
      if (existing) { io.err(`mkdir: cannot create directory ‘${d}’: File exists\n`); status = 1; continue; }
      if (!parent || parent.type !== 'd') { io.err(`mkdir: cannot create directory ‘${d}’: No such file or directory\n`); status = 1; continue; }
      if (!this.canWriteAt(abs)) { io.err(`mkdir: cannot create directory ‘${d}’: Permission denied\n`); status = 1; continue; }
      this.fs.set(abs, mkDir(this.user, 0o775));
      this.touchedRepo(abs);
    }
    return status;
  },

  rmdir(args, p, io) {
    let status = 0;
    if (!args.length) { io.err("rmdir: missing operand\n"); return 1; }
    for (const d of args) {
      const abs = this.resolve(d);
      const node = this.fs.get(abs);
      if (!node) { io.err(`rmdir: failed to remove '${d}': No such file or directory\n`); status = 1; continue; }
      if (node.type !== 'd') { io.err(`rmdir: failed to remove '${d}': Not a directory\n`); status = 1; continue; }
      if (Object.keys(node.children).length) { io.err(`rmdir: failed to remove '${d}': Directory not empty\n`); status = 1; continue; }
      if (!this.canWriteAt(abs)) { io.err(`rmdir: failed to remove '${d}': Permission denied\n`); status = 1; continue; }
      this.fs.remove(abs);
    }
    return status;
  },

  touch(args, p, io) {
    if (!args.length) { io.err("touch: missing file operand\nTry 'touch --help' for more information.\n"); return 1; }
    let status = 0;
    for (const f of args.filter(a => !a.startsWith('-'))) {
      const abs = this.resolve(f);
      const node = this.fs.get(abs);
      if (node) { node.mtime = now(); continue; }
      const { parent } = this.fs.parentOf(abs);
      if (!parent || parent.type !== 'd') { io.err(`touch: cannot touch '${f}': No such file or directory\n`); status = 1; continue; }
      if (!this.canWriteAt(abs)) { io.err(`touch: cannot touch '${f}': Permission denied\n`); status = 1; continue; }
      this.writeFile(abs, '');
    }
    return status;
  },

  cp(args, p, io) {
    const { flags, rest } = parseOpts(args);
    const recursive = flags.has('r') || flags.has('R') || flags.has('a');
    if (rest.length < 2) {
      io.err(rest.length ? `cp: missing destination file operand after '${rest[0]}'\n` : 'cp: missing file operand\n');
      io.err("Try 'cp --help' for more information.\n");
      return 1;
    }
    const dest = rest[rest.length - 1];
    const sources = rest.slice(0, -1);
    const destAbs = this.resolve(dest);
    const destNode = this.fs.get(destAbs);
    if (sources.length > 1 && (!destNode || destNode.type !== 'd')) {
      io.err(`cp: target '${dest}' is not a directory\n`);
      return 1;
    }
    let status = 0;
    for (const s of sources) {
      const srcAbs = this.resolve(s);
      const src = this.fs.get(srcAbs);
      if (!src) { io.err(`cp: cannot stat '${s}': No such file or directory\n`); status = 1; continue; }
      if (src.type === 'd' && !recursive) { io.err(`cp: -r not specified; omitting directory '${s}'\n`); status = 1; continue; }
      const target = destNode && destNode.type === 'd' ? normalize(destAbs + '/' + basename(srcAbs)) : destAbs;
      if (target === srcAbs) { io.err(`cp: '${s}' and '${dest}' are the same file\n`); status = 1; continue; }
      if (src.type === 'd' && (target + '/').startsWith(srcAbs + '/')) { io.err(`cp: cannot copy a directory, '${s}', into itself, '${dest}'\n`); status = 1; continue; }
      const { parent } = this.fs.parentOf(target);
      if (!parent || parent.type !== 'd') { io.err(`cp: cannot create regular file '${dest}': No such file or directory\n`); status = 1; continue; }
      if (!this.canWriteAt(target)) { io.err(`cp: cannot create regular file '${dest}': Permission denied\n`); status = 1; continue; }
      const existing = this.fs.get(target);
      if (existing && existing.type === 'd' && src.type === 'f') { io.err(`cp: cannot overwrite directory '${dest}' with non-directory\n`); status = 1; continue; }
      const copy = cloneNode(src);
      const own = n => { n.owner = this.user; if (n.type === 'd') Object.values(n.children).forEach(own); };
      own(copy);
      delete copy.repo;
      if (copy.type === 'd') delete copy.children['.git'];
      this.fs.set(target, copy);
      this.touchedRepo(target);
    }
    return status;
  },

  mv(args, p, io) {
    const { rest } = parseOpts(args);
    if (rest.length < 2) { io.err(rest.length ? `mv: missing destination file operand after '${rest[0]}'\n` : 'mv: missing file operand\n'); return 1; }
    const dest = rest[rest.length - 1];
    const destAbs = this.resolve(dest);
    const destNode = this.fs.get(destAbs);
    let status = 0;
    for (const s of rest.slice(0, -1)) {
      const srcAbs = this.resolve(s);
      const src = this.fs.get(srcAbs);
      if (!src) { io.err(`mv: cannot stat '${s}': No such file or directory\n`); status = 1; continue; }
      const target = destNode && destNode.type === 'd' ? normalize(destAbs + '/' + basename(srcAbs)) : destAbs;
      if (target === srcAbs) { io.err(`mv: '${s}' and '${dest}' are the same file\n`); status = 1; continue; }
      if (!this.canWriteAt(srcAbs) || !this.canWriteAt(target)) { io.err(`mv: cannot move '${s}' to '${dest}': Permission denied\n`); status = 1; continue; }
      const { parent } = this.fs.parentOf(target);
      if (!parent) { io.err(`mv: cannot move '${s}' to '${dest}': No such file or directory\n`); status = 1; continue; }
      this.fs.remove(srcAbs);
      src.mtime = now();
      this.fs.set(target, src);
      this.touchedRepo(srcAbs);
      this.touchedRepo(target);
    }
    return status;
  },

  rm(args, p, io) {
    const { flags, rest } = parseOpts(args);
    const recursive = flags.has('r') || flags.has('R');
    const force = flags.has('f');
    if (!rest.length) {
      if (force) return 0;
      io.err("rm: missing operand\nTry 'rm --help' for more information.\n");
      return 1;
    }
    let status = 0;
    for (const f of rest) {
      const abs = this.resolve(f);
      const node = this.fs.get(abs);
      if (!node) { if (!force) { io.err(`rm: cannot remove '${f}': No such file or directory\n`); status = 1; } continue; }
      if (node.type === 'd' && !recursive) { io.err(`rm: cannot remove '${f}': Is a directory\n`); status = 1; continue; }
      if (abs === this.home || abs === '/' || !this.canWriteAt(abs)) { io.err(`rm: cannot remove '${f}': Permission denied\n`); status = 1; continue; }
      this.fs.remove(abs);
      this.touchedRepo(abs);
    }
    return status;
  },

  cat(args, p, io) {
    const { flags, rest } = parseOpts(args);
    if (!rest.length && noInputHint(this, io, 'cat')) return 0;
    const { items, status } = readInputs(this, 'cat', rest, io);
    let n = 1;
    for (const it of items) {
      let text = it.text;
      if (flags.has('A') || flags.has('e')) {
        text = text.replace(/\t/g, '^I').replace(/\r/g, '^M').replace(/\n/g, '$\n');
      }
      if (flags.has('n')) text = splitLines(text).map(l => `${String(n++).padStart(6)}\t${l}`).join('\n') + (text ? '\n' : '');
      io.out(text);
    }
    return status;
  },

  head(args, p, io) { return headTail.call(this, 'head', args, io); },
  tail(args, p, io) { return headTail.call(this, 'tail', args, io); },

  wc(args, p, io) {
    const { flags, rest } = parseOpts(args);
    if (!rest.length && noInputHint(this, io, 'wc')) return 0;
    const { items, status } = readInputs(this, 'wc', rest, io);
    const pick = flags.size ? ['l', 'w', 'c', 'm'].filter(f => flags.has(f)) : ['l', 'w', 'c'];
    const counts = it => ({
      l: (it.text.match(/\n/g) || []).length,
      w: it.text.split(/\s+/).filter(Boolean).length,
      c: new TextEncoder().encode(it.text).length,
      m: it.text.length,
    });
    const rows = items.map(it => ({ name: it.name, c: counts(it) }));
    if (rows.length > 1) {
      const t = { l: 0, w: 0, c: 0, m: 0 };
      rows.forEach(r => pick.forEach(k => { t[k] += r.c[k]; }));
      rows.push({ name: 'total', c: t });
    }
    const width = pick.length === 1 && rows.length === 1 ? 0 : Math.max(...rows.flatMap(r => pick.map(k => String(r.c[k]).length)));
    rows.forEach(r => io.out(pick.map(k => String(r.c[k]).padStart(width)).join(' ') + (r.name ? ` ${r.name}` : '') + '\n'));
    return status;
  },

  grep(args, p, io) {
    const LONG = { '--count': '-c', '--quiet': '-q', '--silent': '-q', '--invert-match': '-v', '--ignore-case': '-i', '--line-number': '-n', '--extended-regexp': '-E', '--word-regexp': '-w', '--only-matching': '-o', '--files-with-matches': '-l' };
    if (args.includes('--help')) {
      io.out(`Usage: grep [OPTION]... PATTERNS [FILE]...
Search for PATTERNS in each FILE.
Example: grep -i 'hello world' menu.h main.c

Pattern selection and interpretation:
  -E, --extended-regexp     PATTERNS are extended regular expressions
  -i, --ignore-case         ignore case distinctions in patterns and data
  -w, --word-regexp         match only whole words

Miscellaneous:
  -v, --invert-match        select non-matching lines

Output control:
  -n, --line-number         print line number with output lines
  -o, --only-matching       show only nonempty parts of lines that match
  -q, --quiet, --silent     suppress all normal output
  -l, --files-with-matches  print only names of FILEs with selected lines
  -c, --count               print only a count of selected lines per FILE
`);
      return 0;
    }
    const dd = args.indexOf('--');
    const bad = args.find((a, i) => a.startsWith('--') && a !== '--' && !LONG[a] && (dd < 0 || i < dd));
    if (bad) {
      io.err(`grep: unrecognized option '${bad}'
Usage: grep [OPTION]... PATTERNS [FILE]...
Try 'grep --help' for more information.
`);
      return 2;
    }
    args = args.map((a, i) => (LONG[a] && (dd < 0 || i < dd) ? LONG[a] : a));
    const { flags, rest, values } = parseOpts(args, ['e']);
    let pattern = values.e ?? rest.shift();
    if (pattern === undefined) { io.err("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n"); return 2; }
    if (!rest.length && noInputHint(this, io, 'grep')) return 1;
    if (flags.has('w')) pattern = `\\b${pattern}\\b`;
    const re = breToRegex(pattern, flags.has('E'), flags.has('i') ? 'i' : '');
    const { items, status } = readInputs(this, 'grep', rest, io);
    const multi = items.length > 1;
    let found = false;
    for (const it of items) {
      const lines = splitLines(it.text);
      let count = 0;
      lines.forEach((line, idx) => {
        const match = re.test(line) !== flags.has('v');
        if (!match) return;
        count++;
        found = true;
        if (flags.has('q') || flags.has('c') || flags.has('l')) return;
        const prefix = (multi ? it.name + ':' : '') + (flags.has('n') ? `${idx + 1}:` : '');
        if (flags.has('o') && !flags.has('v')) {
          const g = new RegExp(re.source, re.flags + 'g');
          (line.match(g) || []).forEach(m => io.out(prefix + m + '\n'));
        } else io.out(prefix + line + '\n');
      });
      if (flags.has('q')) continue;
      if (flags.has('c')) io.out((multi ? it.name + ':' : '') + count + '\n');
      if (flags.has('l') && count) io.out(it.name + '\n');
    }
    if (status && !found) return 2;
    return found ? 0 : 1;
  },

  file(args, p, io) {
    if (!args.length) { io.err('Usage: file [-bcdEhikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding]\n'); return 1; }
    const w = Math.max(...args.map(a => a.length)) + 1;
    for (const a of args) {
      const node = this.get(a);
      let desc;
      if (!node) desc = `cannot open \`${a}' (No such file or directory)`;
      else if (node.type === 'd') desc = 'directory';
      else if (node.bin) desc = 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=44900829b39271d878615772bb2a6ffa422f0891, for GNU/Linux 3.2.0, stripped';
      else if (!node.content) desc = 'empty';
      else {
        const utf = /[^\x00-\x7f]/.test(node.content);
        const crlf = node.content.includes('\r\n') ? ', with CRLF line terminators' : '';
        const enc = utf ? 'Unicode text, UTF-8 text' : 'ASCII text';
        const first = node.content.split('\n')[0];
        if (first.startsWith('#!') && /bash/.test(first)) desc = `Bourne-Again shell script, ${enc} executable${crlf}`;
        else if (first.startsWith('#!') && /python/.test(first)) desc = `Python script, ${enc} executable${crlf}`;
        else desc = enc + crlf;
      }
      io.out(`${(a + ':').padEnd(w)} ${desc}\n`);
    }
    return 0;
  },

  chmod(args, p, io) {
    const rest = args.filter(a => a !== '-R');
    if (rest.length < 2) { io.err(rest.length ? `chmod: missing operand after '${rest[0]}'\n` : 'chmod: missing operand\n'); io.err("Try 'chmod --help' for more information.\n"); return 1; }
    const mode = rest[0];
    let status = 0;
    for (const f of rest.slice(1)) {
      const abs = this.resolve(f);
      const node = this.fs.get(abs);
      if (!node) { io.err(`chmod: cannot access '${f}': No such file or directory\n`); status = 1; continue; }
      if (!this.owns(node)) { io.err(`chmod: changing permissions of '${f}': Operation not permitted\n`); status = 1; continue; }
      if (/^[0-7]{3,4}$/.test(mode)) { node.mode = parseInt(mode, 8) & 0o777; continue; }
      for (const clause of mode.split(',')) {
        const m = clause.match(/^([ugoa]*)([+\-=])([rwx]*)$/);
        if (!m) { io.err(`chmod: invalid mode: ‘${mode}’\nTry 'chmod --help' for more information.\n`); return 1; }
        const who = m[1] || 'a';
        let bits = 0;
        for (const ch of m[3]) bits |= ch === 'r' ? 4 : ch === 'w' ? 2 : 1;
        let mask = 0;
        let clear = 0;
        if (who.includes('u') || who.includes('a')) { mask |= bits << 6; clear |= 0o700; }
        if (who.includes('g') || who.includes('a')) { mask |= bits << 3; clear |= 0o070; }
        if (who.includes('o') || who.includes('a')) { mask |= bits; clear |= 0o007; }
        if (m[2] === '+') node.mode |= mask;
        else if (m[2] === '-') node.mode &= ~mask;
        else node.mode = (node.mode & ~clear) | mask;
      }
    }
    return status;
  },

  chown(args, p, io) {
    io.err(`chown: changing ownership of '${args[args.length - 1] || ''}': Operation not permitted\n`);
    return 1;
  },

  whoami(args, p, io) { io.out(this.user + '\n'); return 0; },
  hostname(args, p, io) { io.out(this.host + '\n'); return 0; },
  id(args, p, io) {
    io.out(`uid=1013(${this.user}) gid=1013(${this.user}) groups=1013(${this.user}),1001(bio)\n`);
    return 0;
  },
  who(args, p, io) {
    const d = new Date();
    const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    io.out(`hperez   pts/0        ${day} 09:58 (212.128.12.5)\n`);
    io.out(`${this.user} pts/1        ${day} 10:02 (83.43.120.11)\n`);
    io.out(`bio_248721 pts/2        ${day} 10:04 (83.43.120.37)\n`);
    io.out(`bio_248735 pts/3        ${day} 10:05 (88.12.4.201)\n`);
    return 0;
  },
  uname(args, p, io) {
    const { flags } = parseOpts(args);
    if (flags.has('a')) io.out('Linux ubuntu 6.8.0-139-generic #139-Ubuntu SMP PREEMPT_DYNAMIC Sat Aug  1 03:52:05 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux\n');
    else if (flags.has('m') || flags.has('p')) io.out('x86_64\n');
    else if (flags.has('r')) io.out('6.8.0-139-generic\n');
    else if (flags.has('n')) io.out('ubuntu\n');
    else io.out('Linux\n');
    return 0;
  },
  date(args, p, io) {
    const d = new Date();
    io.out(`${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} CEST ${d.getFullYear()}\n`);
    return 0;
  },
  ps(args, p, io) {
    const { flags } = parseOpts(args);
    if (flags.has('e') || flags.has('A') || args.includes('aux')) {
      const t = new Date();
      const st = `${pad2(t.getHours() - 1 < 0 ? 0 : t.getHours() - 1)}:${pad2(t.getMinutes())}`;
      const rows = [
        ['root', 1, 0, 'Sep01', '?', '00:01:12', '/sbin/init'],
        ['root', 612, 1, 'Sep01', '?', '00:00:03', '/usr/lib/systemd/systemd-journald'],
        ['root', 845, 1, 'Sep01', '?', '00:00:00', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups'],
        ['root', 901, 1, 'Sep01', '?', '00:00:02', '/usr/sbin/cron -f -P'],
        ['hperez', 2290011, 2289990, st, 'pts/0', '00:00:00', '-bash'],
        ['root', 2291401, 845, st, '?', '00:00:00', `sshd: ${this.user} [priv]`],
        [this.user, 2291422, 2291401, st, '?', '00:00:00', `sshd: ${this.user}@pts/1`],
        [this.user, this.pid, 2291422, st, 'pts/1', '00:00:00', '-bash'],
        ['bio_248721', 2292230, 2292201, st, 'pts/2', '00:00:00', '-bash'],
        ['bio_248735', 2293118, 2293100, st, 'pts/3', '00:00:00', 'vi atomos.txt'],
        [this.user, ++this.nextPid, this.pid, st, 'pts/1', '00:00:00', `ps ${args.join(' ')}`],
      ];
      io.out('UID          PID    PPID  C STIME TTY          TIME CMD\n');
      rows.forEach(r => io.out(`${r[0].padEnd(8)} ${String(r[1]).padStart(7)} ${String(r[2]).padStart(7)}  0 ${r[3]} ${r[4].padEnd(8)} ${r[5]} ${r[6]}\n`));
      return 0;
    }
    io.out('    PID TTY          TIME CMD\n');
    io.out(`${String(this.pid).padStart(7)} pts/1    00:00:00 bash\n`);
    io.out(`${String(++this.nextPid).padStart(7)} pts/1    00:00:00 ps\n`);
    return 0;
  },
  seq(args, p, io) {
    const nums = args.map(Number);
    if (!args.length || nums.some(Number.isNaN)) { io.err(args.length ? `seq: invalid floating point argument: ‘${args.find(a => Number.isNaN(Number(a)))}’\n` : 'seq: missing operand\n'); return 1; }
    let [first, inc, last] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
    if (inc === 0) { io.err("seq: invalid Zero increment value: ‘0’\n"); return 1; }
    let count = 0;
    for (let v = first; inc > 0 ? v <= last : v >= last; v += inc) {
      io.out(`${Number.isInteger(v) ? v : Number(v.toFixed(6))}\n`);
      if (++count > 5000) break;
    }
    return 0;
  },
  sort(args, p, io) {
    const { flags, rest } = parseOpts(args);
    const { items, status } = readInputs(this, 'sort', rest, io);
    let lines = items.flatMap(it => splitLines(it.text));
    if (flags.has('n')) lines.sort((a, b) => parseFloat(a) - parseFloat(b) || (a < b ? -1 : 1));
    else lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (flags.has('r')) lines.reverse();
    if (flags.has('u')) lines = lines.filter((l, i) => i === 0 || l !== lines[i - 1]);
    lines.forEach(l => io.out(l + '\n'));
    return status;
  },
  uniq(args, p, io) {
    const { flags, rest } = parseOpts(args);
    const { items, status } = readInputs(this, 'uniq', rest, io);
    const lines = items.flatMap(it => splitLines(it.text));
    const groups = [];
    for (const l of lines) {
      if (groups.length && groups[groups.length - 1].l === l) groups[groups.length - 1].n++;
      else groups.push({ l, n: 1 });
    }
    groups.forEach(g => io.out(flags.has('c') ? `${String(g.n).padStart(7)} ${g.l}\n` : g.l + '\n'));
    return status;
  },
  cut(args, p, io) {
    const { values, rest } = parseOpts(args, ['d', 'f', 'c']);
    const { items, status } = readInputs(this, 'cut', rest, io);
    const ranges = (values.f || values.c || '1').split(',').flatMap(r => {
      const [a, b] = r.split('-');
      const from = Number(a || 1);
      const to = r.includes('-') ? Number(b || 9999) : from;
      return Array.from({ length: Math.min(to, 9999) - from + 1 }, (_, i) => from + i);
    });
    for (const line of items.flatMap(it => splitLines(it.text))) {
      if (values.c) io.out(ranges.map(i => line[i - 1] ?? '').join('') + '\n');
      else {
        const d = values.d ?? '\t';
        const parts = line.split(d);
        io.out(parts.length === 1 ? line + '\n' : ranges.filter(i => i <= parts.length).map(i => parts[i - 1]).join(d) + '\n');
      }
    }
    return status;
  },
  realpath(args, p, io) {
    for (const a of args) io.out(this.resolve(a) + '\n');
    return 0;
  },
  basename(args, p, io) {
    if (!args[0]) { io.err('basename: missing operand\n'); return 1; }
    let b = basename(args[0]);
    if (args[1] && b.endsWith(args[1])) b = b.slice(0, -args[1].length);
    io.out(b + '\n');
    return 0;
  },
  dirname(args, p, io) {
    if (!args[0]) { io.err('dirname: missing operand\n'); return 1; }
    const d = args[0].includes('/') ? args[0].replace(/\/[^/]*\/?$/, '') || '/' : '.';
    io.out(d + '\n');
    return 0;
  },
  find(args, p, io) {
    let start = '.';
    let i = 0;
    if (args[0] && !args[0].startsWith('-')) { start = args[0]; i = 1; }
    let nameRe = null;
    let type = null;
    for (; i < args.length; i++) {
      if (args[i] === '-name' || args[i] === '-iname') nameRe = new RegExp(globToRegex(args[++i] || '*').source, args[i - 1] === '-iname' ? 'i' : '');
      else if (args[i] === '-type') type = args[++i];
    }
    const node = this.get(start);
    if (!node) { io.err(`find: ‘${start}’: No such file or directory\n`); return 1; }
    const walk = (n, path, name) => {
      const okName = !nameRe || nameRe.test(name);
      const okType = !type || (type === 'd' ? n.type === 'd' : n.type === 'f');
      if (okName && okType) io.out(path + '\n');
      if (n.type === 'd') {
        if (!this.can(n, 4)) { io.err(`find: ‘${path}’: Permission denied\n`); return; }
        Object.keys(n.children).sort(sortNames).forEach(k => walk(n.children[k], `${path}/${k}`, k));
      }
    };
    walk(node, start.replace(/\/$/, '') || '/', basename(this.resolve(start)));
    return 0;
  },
  sed(args, p, io) {
    const { flags, rest, values } = parseOpts(args, ['e']);
    const script = values.e ?? rest.shift();
    if (!script) { io.err('Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n'); return 1; }
    const cmds = script.split(/;\s*/).filter(Boolean);
    const apply = text => {
      const lines = splitLines(text);
      const trailing = text.endsWith('\n');
      const out = [];
      lines.forEach((line, idx) => {
        let l = line;
        let del = false;
        for (const c of cmds) {
          const s = c.match(/^s(.)(.*?)\1(.*?)\1([gip]*)$/s);
          if (s) {
            const re = breToRegex(s[2].replace(/\\r/g, '\r'), flags.has('E'), (s[4].includes('g') ? 'g' : '') + (s[4].includes('i') ? 'i' : ''));
            const rep = s[3].replace(/\\(\d)/g, '$$$1').replace(/(^|[^\\])&/g, '$1$$&');
            l = l.replace(re, rep);
            if (s[4].includes('p') && flags.has('n')) out.push(l);
            continue;
          }
          const addr = c.match(/^(\d+|\$|\/(.*)\/)?([pd])$/);
          if (addr) {
            const hit = !addr[1] || (addr[1] === '$' ? idx === lines.length - 1 : addr[2] !== undefined ? breToRegex(addr[2], flags.has('E')).test(l) : Number(addr[1]) === idx + 1);
            if (hit && addr[3] === 'd') del = true;
            if (hit && addr[3] === 'p') out.push(l);
            continue;
          }
          io.err(`sed: -e expression #1, char ${c.length}: unknown command: \`${c[0]}'\n`);
          throw new Error('sed');
        }
        if (!del && !flags.has('n')) out.push(l);
      });
      return out.join('\n') + (out.length && trailing ? '\n' : '');
    };
    try {
      if (flags.has('i')) {
        for (const f of rest) {
          const abs = this.resolve(f);
          const node = this.fs.get(abs);
          if (!node || node.type !== 'f') { io.err(`sed: can't read ${f}: No such file or directory\n`); return 2; }
          this.writeFile(abs, apply(node.content));
        }
        return 0;
      }
      const { items, status } = readInputs(this, 'sed', rest, io);
      items.forEach(it => io.out(apply(it.text)));
      return status;
    } catch {
      return 1;
    }
  },
  more(args, p, io) { return pager.call(this, 'more', args, io); },
  less(args, p, io) { return pager.call(this, 'less', args, io); },
  man(args, p, io) {
    if (!args.length) { io.out('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1; }
    const page = MAN_PAGES[args[0]];
    if (!page) { io.err(`No manual entry for ${args[0]}\n`); return 16; }
    const title = `${args[0].toUpperCase()}(1)`;
    io.out(`${title.padEnd(24)}Manual de Dr.Xinxus${title.padStart(24)}\n\n${page}\n`);
    if (io.tty) io.info('ℹ En el servidor, man abre un visor: muévete con las flechas y sal con q.\n');
    return 0;
  },
  vi(args, p, io) { return editor.call(this, 'vi', args, p, io); },
  vim(args, p, io) { return editor.call(this, 'vim', args, p, io); },
  nano(args, p, io) { return editor.call(this, 'nano', args, p, io); },
  git(args, p, io) { return git.call(this, args, p, io); },
  curl(args, p, io) {
    const { flags, values, rest } = parseOpts(args, ['o']);
    const url = rest[0];
    if (!url) { io.err("curl: try 'curl --help' or 'curl --manual' for more information\n"); return 2; }
    const m = url.match(/files\.rcsb\.org\/download\/([0-9A-Za-z]{4})\.pdb$/);
    if (!m) { io.err(`curl: (6) Could not resolve host: ${url.replace(/^https?:\/\//, '').split('/')[0]}\n`); io.info('ℹ Dr.Xinxus no tiene Internet: solo simula la descarga de 1HVR.pdb desde el RCSB PDB.\n'); return 6; }
    if (m[1].toUpperCase() !== '1HVR') { io.info(`ℹ Dr.Xinxus solo tiene guardado 1HVR.pdb. En el servidor, ${m[1]}.pdb se descargaría igual.\n`); return 0; }
    const content = make1HVR();
    const outName = values.o || (flags.has('O') ? '1HVR.pdb' : null);
    if (!outName) { io.out(content); return 0; }
    const abs = this.resolve(outName);
    if (!this.canWriteAt(abs)) { io.err(`curl: (23) Failure writing output to destination\n`); return 23; }
    io.err('  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  185k    0  185k    0     0   412k      0 --:--:-- --:--:-- --:--:--  412k\n');
    this.writeFile(abs, content);
    return 0;
  },
  sudo(args, p, io) {
    this.stats.sudo = true;
    io.out(`[sudo] password for ${this.user}: \n`);
    io.err(`${this.user} is not in the sudoers file.\n`);
    io.info('ℹ En el servidor de clase no sois administradores: nada de sudo. 😉\n');
    return 1;
  },
  ssh(args, p, io) {
    io.info(`ℹ Ya estás conectado por ssh al servidor (${this.host}). Desde el portátil sería: ssh usuario@IP\n`);
    return 0;
  },
  passwd(args, p, io) {
    io.out(`Changing password for ${this.user}.\nCurrent password: \n`);
    io.info('ℹ En Dr.Xinxus no se cambian contraseñas. En el servidor, al escribirla no se ve nada: es normal.\n');
    return 0;
  },
  python3(args, p, io) { io.info('ℹ Dr.Xinxus no ejecuta Python (todavía). En el servidor sí está instalado.\n'); return 0; },
  sleep() { return 0; },

  // ----- Tema 1C: pdb-tools y FreeSASA -----
  pdb_fetch(args, p, io) {
    const code = args.find(a => !a.startsWith('-')) ?? args[args.length - 1];
    if (!args.length) {
      io.err('Downloads a structure in PDB format from the RCSB website.\n\nAllows downloading the (first) biological structure if selected.\n\nUsage:\n    python pdb_fetch.py [-biounit] <pdb code>\n\nExample:\n    python pdb_fetch.py 1brs  # downloads unit cell, all 6 chains\n    python pdb_fetch.py -biounit 1brs  # downloads biounit, 2 chains\n\nThis program is part of the `pdb-tools` suite of utilities and should not be\ndistributed isolatedly.\n');
      return 1;
    }
    if (!/^[0-9a-zA-Z]{4}$/.test(code)) { io.err(`ERROR!! Invalid PDB code: '${code}'\n`); return 1; }
    const content = makePdb(code);
    if (!content) {
      io.err(`ERROR!! Error fetching structure: (404) Not Found\n`);
      if (!/^0/.test(code)) io.info(`ℹ Dr.Xinxus solo tiene guardadas: ${Object.keys(PDB_ENTRIES).join(' ')}. En el servidor, ${code} se descargaría.\n`);
      return 1;
    }
    io.out(content);
    return 0;
  },
  pdb_wc(args, p, io) {
    const opts = args.filter(a => /^-[a-z]$/.test(a));
    const files = args.filter(a => !a.startsWith('-'));
    if (!files.length && io.tty && !io.stdin) {
      io.err('Summarizes the contents of a PDB file, like the wc command in UNIX.\n\nUsage:\n    python pdb_wc.py [-<option>] <pdb file>\n\nExample:\n    python pdb_wc.py 1CTF.pdb\n    python pdb_wc.py -m 1CTF.pdb  # prints only number of models\n\nOptions: -m models, -c chains, -r residues, -a atoms, -h HETATM, -o multiple occupancy, -i insertions\n');
      return 1;
    }
    const { items, status } = readInputs(this, 'pdb_wc', files, io);
    if (!items.length) return status || 1;
    const c = countPdb(items[0].text);
    const per = n => `(${(c.models ? n / c.models : 0).toFixed(1).padStart(6)}/model)`;
    const rows = {
      m: `No. models:\t${c.models}`,
      c: `No. chains:\t${c.chains}\t${per(c.chains)}`,
      r: `No. residues:\t${c.residues}\t${per(c.residues)}`,
      a: `No. atoms:\t${c.atoms}\t${per(c.atoms)}`,
      h: `No. HETATM:\t${c.hetatm}`,
      o: 'Multiple Occ.:\tFalse',
      i: 'Res. Inserts:\tFalse',
    };
    const keys = opts.length ? opts.map(o => o[1]).filter(k => rows[k]) : Object.keys(rows);
    keys.forEach(k => io.out(rows[k] + '\n'));
    return 0;
  },
  freesasa(args, p, io) {
    if (args.includes('-h') || args.includes('--help')) {
      io.out('Usage: freesasa [options] pdb-file(s)\n\nOptions are:\n  -h  --help\n  -v  --version\n\nInput options:\n  -H  --hydrogen\n      --hetatm\n      --join-models\n      --separate-chains\n      --separate-models\n\nOutput options:\n  -w  --no-warnings\n  -l  --no-log\n  -f  --format=log|rsa|json|xml|pdb|res|seq\n  -o  --output=<file>\n\nParameters:\n  -L  --lee-richards\n  -S  --shrake-rupley\n  -p  --probe-radius=<value>  (default 1.4)\n');
      return 0;
    }
    if (args.includes('-v') || args.includes('--version')) { io.out('FreeSASA 2.1.2\n'); return 0; }
    const hyd = args.includes('--hydrogen') || args.includes('-H');
    const het = args.includes('--hetatm');
    const quiet = args.includes('--no-warnings') || args.includes('-w');
    let format = 'log';
    args.forEach((a, i) => {
      if (a.startsWith('--format=')) format = a.slice(9);
      if (a === '-f') format = args[i + 1];
    });
    const file = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-f')[0];
    if (!file) { io.err('freesasa: error: no input files given\n'); return 1; }
    const node = this.get(file);
    if (!node || node.type !== 'f') { io.err(`freesasa: error: could not open file '${file}'; No such file or directory\n`); return 1; }
    const s = sasaFor(node.content);
    if (!s.atoms) { io.err(`freesasa: error: input had no valid ATOM or HETATM coordinates\n`); return 1; }
    if (!quiet && hyd && s.hydrogens) {
      io.err(`freesasa: warning: guessing element for atom ' H  ', setting radius to 1.10\n`.repeat(2));
      io.info(`ℹ … y así hasta ${s.hydrogens} avisos, uno por hidrógeno (--no-warnings los quita).\n`);
    }
    if (!quiet && het && s.hetatm) {
      io.err(`freesasa: warning: atom 'C1 ' in residue '${s.code === '1hvr' ? 'XK2' : 'HET'}' unknown, guessing radius\n`.repeat(2));
      io.info('ℹ … el servidor da unos 60 avisos: radios estimados para los heteroátomos.\n');
    }
    const used = s.atoms - (hyd ? 0 : s.hydrogens) + (het ? s.hetatm : 0);
    const e = s.entry;
    const total = e ? e.total : used * 9.2;
    const apolar = e ? e.apolar : total * 0.55;
    if (format === 'rsa') {
      io.out(`REM  FreeSASA 2.1.2\nREM  Absolute and relative SASAs for ${file}\nREM  Atomic radii and reference values for relative SASA: ProtOr\nREM RES _ NUM      All-atoms   Total-Side   Main-Chain    Non-polar    All polar\nREM                ABS   REL    ABS   REL    ABS   REL    ABS   REL    ABS   REL\n`);
      const lines = node.content.split('\n').filter(l => l.startsWith('ATOM') && l.slice(12, 16).trim() === 'CA');
      lines.forEach((l, i) => {
        const res = l.slice(17, 20);
        const num = Number(l.slice(22, 26));
        const known = e?.rsaCys && res === 'CYS' ? e.rsaCys[num] : null;
        const abs = known ? known[0] : (Math.abs(Math.sin(i * 2.3)) * 120);
        const rel = known ? known[1] : Math.min(100, abs / 1.6);
        io.out(`RES ${res} ${l[21]}${String(num).padStart(4)} ${abs.toFixed(2).padStart(8)} ${rel.toFixed(1).padStart(5)}\n`);
      });
      return 0;
    }
    io.out(`## FreeSASA 2.1.2 ##\n\nPARAMETERS\nalgorithm    : Lee & Richards\nprobe-radius : 1.400\nthreads      : 2\nslices       : 20\n\nINPUT\nsource  : ${file}\nchains  : ${'ABCD'.slice(0, Math.max(1, s.chains))}\nmodel   : 1\natoms   : ${used}\n\nRESULTS (A^2)\nTotal   : ${total.toFixed(2).padStart(10)}\nApolar  : ${apolar.toFixed(2).padStart(10)}\nPolar   : ${(e?.polar ?? total - apolar).toFixed(2).padStart(10)}\n`);
    if (!e || hyd || het) io.info(`ℹ Dr.Xinxus: ${e ? 'con estas opciones solo se recalcula el nº de átomos' : 'fichero propio: áreas estimadas'}; las áreas reales salen en el servidor.\n`);
    return 0;
  },
  which(args, p, io) {
    let status = 0;
    const dirs = (p.vars.PATH || '').split(':').filter(Boolean);
    for (const a of args.filter(x => !x.startsWith('-'))) {
      const hit = dirs.map(d => normalize(d + '/' + a)).find(abs => this.fs.get(abs)?.type === 'f');
      if (hit) io.out(hit + '\n');
      else status = 1;
    }
    return status;
  },
  timeout(args, p, io) {
    if (args.length < 2) { io.err("timeout: missing operand\nTry 'timeout --help' for more information.\n"); return 125; }
    try {
      return this.runCommand(args.slice(1), p, io);
    } catch (e) {
      if (!(e instanceof StepLimit)) throw e;
      this.steps = 0;
      return 124;
    }
  },
  tr(args, p, io) {
    const del = args[0] === '-d';
    const sets = (del ? args.slice(1) : args).map(s => s
      .replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
      .replace(/(.)-(.)/g, (_, a, b) => { let r = ''; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) r += String.fromCharCode(c); return r; }));
    let out = '';
    for (const ch of io.stdin) {
      const i = sets[0]?.indexOf(ch) ?? -1;
      if (i < 0) out += ch;
      else if (!del) out += sets[1]?.[Math.min(i, sets[1].length - 1)] ?? ch;
    }
    io.out(out);
    return 0;
  },
  awk(args, p, io) { return awk.call(this, args, io); },
};
COMMANDS.python = COMMANDS.python3;
COMMANDS.true = BUILTINS.true;
COMMANDS.false = BUILTINS.false;
COMMANDS.echo = BUILTINS.echo;
COMMANDS.pwd = BUILTINS.pwd;
COMMANDS.bash = BUILTINS.bash;

function headTail(name, args, io) {
  const { values, rest } = parseOpts(args, ['n']);
  if (!rest.length && noInputHint(this, io, name)) return 0;
  const spec = values.n ?? '10';
  const { items, status } = readInputs(this, name, rest, io);
  items.forEach((it, i) => {
    if (items.length > 1) io.out(`${i ? '\n' : ''}==> ${it.name} <==\n`);
    const lines = splitLines(it.text);
    let sel;
    if (name === 'head') {
      const n = Number(spec);
      sel = n < 0 ? lines.slice(0, n) : lines.slice(0, n);
    } else if (String(spec).startsWith('+')) sel = lines.slice(Number(spec.slice(1)) - 1);
    else {
      const n = Math.abs(Number(spec));
      sel = n === 0 ? [] : lines.slice(-n);
    }
    sel.forEach(l => io.out(l + '\n'));
  });
  return status;
}

function pager(name, args, io) {
  if (!args.length && !io.stdin) { io.err(`Missing filename ("${name} --help" for help)\n`); return 1; }
  const { items, status } = readInputs(this, name, args, io);
  items.forEach(it => io.out(it.text));
  if (io.tty) io.info(`ℹ En el servidor, ${name} enseña el texto por páginas: espacio para avanzar y q para salir.\n`);
  return status;
}

function editor(name, args, p, io) {
  const file = args.find(a => !a.startsWith('-') && !a.startsWith('+'));
  if (!io.tty) { io.err(`Vim: Warning: Output is not to a terminal\n`); }
  if (!file) {
    this.events.push({ type: 'editor', editor: name, path: null, display: '' });
    return 0;
  }
  const abs = this.resolve(file);
  const node = this.fs.get(abs);
  if (node && node.type === 'd') {
    io.err(`"${file}" is a directory\n`);
    return 1;
  }
  this.events.push({ type: 'editor', editor: name, path: abs, display: file, isNew: !node });
  return 0;
}

function git(args, p, io) {
  const sub = args[0];
  const here = this.repoOf(this.cwd);
  if (sub === 'clone') {
    const url = args[1];
    if (!url) { io.err('fatal: You must specify a repository to clone.\n'); return 128; }
    const name = (args[2] || url.replace(/\.git$/, '').split('/').pop());
    const known = url.replace(/\/$/, '') === REPO_URL || url.replace(/\/$/, '') === REPO_URL.replace(/\.git$/, '');
    if (!known) {
      io.err(`Cloning into '${name}'...\nfatal: repository '${url}' not found\n`);
      io.info(`ℹ Dr.Xinxus solo simula el repositorio de clase: ${REPO_URL}\n`);
      return 128;
    }
    const abs = this.resolve(name);
    const existing = this.fs.get(abs);
    if (existing && (existing.type === 'f' || Object.keys(existing.children).length)) {
      io.err(`fatal: destination path '${name}' already exists and is not an empty directory.\n`);
      return 128;
    }
    if (!this.canWriteAt(abs)) { io.err(`fatal: could not create work tree dir '${name}': Permission denied\n`); return 128; }
    io.err(`Cloning into '${name}'...\nremote: Enumerating objects: 64, done.\nremote: Counting objects: 100% (64/64), done.\nremote: Compressing objects: 100% (45/45), done.\nremote: Total 64 (delta 18), reused 58 (delta 12), pack-reused 0 (from 0)\nReceiving objects: 100% (64/64), 98.52 KiB | 2.10 MiB/s, done.\nResolving deltas: 100% (18/18), done.\n`);
    this.fs.set(abs, buildRepo(this.user));
    return 0;
  }
  if (sub === 'version' || sub === '--version') { io.out('git version 2.43.0\n'); return 0; }
  if (!sub) { io.out('usage: git [-v | --version] [-h | --help] <command> [<args>]\n'); return 1; }
  if (!here) { io.err('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
  const dirty = here.node.repo.dirty;
  const tracked = rel => rel in REPO_FILES || rel === 'tema-1a-linux/1HVR.pdb';
  const modified = dirty.filter(tracked);
  const untracked = dirty.filter(r => !tracked(r));
  if (sub === 'pull') {
    if (modified.length) {
      io.out('Updating 22ae652..515196c\n');
      io.err(`error: Your local changes to the following files would be overwritten by merge:\n${modified.map(f => '\t' + f).join('\n')}\nPlease commit your changes or stash them before you merge.\nAborting\n`);
      return 1;
    }
    io.out('Already up to date.\n');
    return 0;
  }
  if (sub === 'status') {
    io.out("On branch main\nYour branch is up to date with 'origin/main'.\n\n");
    if (!dirty.length) { io.out('nothing to commit, working tree clean\n'); return 0; }
    if (modified.length) {
      io.out('Changes not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n');
      modified.forEach(f => io.out(`\t${this.fs.get(here.path + '/' + f) ? 'modified:  ' : 'deleted:   '} ${f}\n`));
      io.out('\n');
    }
    if (untracked.length) {
      io.out('Untracked files:\n  (use "git add <file>..." to include in what will be committed)\n');
      untracked.forEach(f => io.out(`\t${f}\n`));
      io.out('\n');
    }
    io.out(modified.length ? 'no changes added to commit (use "git add" and/or "git commit -a")\n' : 'nothing added to commit but untracked files present (use "git add" to track)\n');
    return 0;
  }
  if (sub === 'stash') {
    if (!modified.length) { io.out('No local changes to save\n'); return 0; }
    const fresh = buildRepo(this.user);
    for (const rel of modified) {
      const parts = rel.split('/');
      let src = fresh;
      for (const part of parts) src = src && src.children ? src.children[part] : null;
      if (src) this.fs.set(here.path + '/' + rel, src);
    }
    here.node.repo.dirty = untracked;
    io.out('Saved working directory and index state WIP on main: 515196c Una carpeta por bloque de clase; entra el Tema 2\n');
    return 0;
  }
  if (sub === 'log') {
    io.out('515196c (HEAD -> main, origin/main, origin/HEAD) Una carpeta por bloque de clase; entra el Tema 2\n22ae652 Añade 1HVR.pdb (proteasa del VIH con inhibidor) para el Tema 1B.\nc848064 Scripts Tema 1A: añade 12-errores y 13-crlf; ajusta 00b, 00c y 04.\nc4a3a0a Scripts Tema 1A Linux.\n');
    return 0;
  }
  if (sub === 'push' || sub === 'commit' || sub === 'add') {
    io.info('ℹ En clase no se sube nada al repositorio: solo clone, pull y status.\n');
    return 0;
  }
  io.err(`git: '${sub}' is not a git command. See 'git --help'.\n`);
  return 1;
}

// ---------- awk (subconjunto) ----------
// Admite: patrones /regex/, expresiones, BEGIN y END; acciones con print, printf,
// asignaciones, if, aritmética, $N, $NF, NR, NF; -F separador.

function awkSprintf(fmt, vals) {
  let k = 0;
  return fmt.replace(/%([-+ 0]*)(\d*)(?:\.(\d+))?([sdifc%])/g, (m, flags, width, prec, type) => {
    if (type === '%') return '%';
    const v = vals[k++];
    let s;
    if (type === 'd' || type === 'i') s = String(Math.trunc(Number(v) || 0));
    else if (type === 'f') s = (Number(v) || 0).toFixed(prec === undefined ? 6 : Number(prec));
    else if (type === 'c') s = typeof v === 'number' ? String.fromCharCode(v) : String(v ?? '')[0] || '';
    else s = prec !== undefined ? String(v ?? '').slice(0, Number(prec)) : String(v ?? '');
    const w = Number(width || 0);
    if (s.length < w) s = flags.includes('-') ? s.padEnd(w) : s.padStart(w, flags.includes('0') && type !== 's' ? '0' : ' ');
    return s;
  });
}

// Divide el programa en reglas { pattern, action }.
function awkRules(src) {
  const rules = [];
  let i = 0;
  const skipWs = () => { while (i < src.length && /[\s;]/.test(src[i])) i++; };
  while (true) {
    skipWs();
    if (i >= src.length) break;
    let pattern = '';
    while (i < src.length && src[i] !== '{') {
      if (src[i] === '/') {
        const j = src.indexOf('/', i + 1);
        pattern += src.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (src[i] === '"') {
        const j = src.indexOf('"', i + 1);
        pattern += src.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (src[i] === '\n' && pattern.trim()) break;
      pattern += src[i++];
    }
    let action = null;
    if (src[i] === '{') {
      let depth = 0;
      const start = i;
      for (; i < src.length; i++) {
        if (src[i] === '"') { i = src.indexOf('"', i + 1); continue; }
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) { i++; break; }
      }
      action = src.slice(start + 1, i - 1);
    }
    rules.push({ pattern: pattern.trim(), action });
  }
  return rules;
}

function awkExpr(code) {
  // Campos: $0, $3, $NF, $(i+1)
  return code
    .replace(/(\S+|\$\w+|"[^"]*")\s*(!?)~\s*\/((?:\\\/|[^/])*)\//g, (_, lhs, neg, re) => `${neg ? '!' : ''}/${re}/.test(${lhs})`)
    .replace(/\$\(([^)]*)\)/g, '__f($1)')
    .replace(/\$(NF|\d+|[A-Za-z_]\w*)/g, '__f($1)');
}

function awkStatement(stmt) {
  const s = stmt.trim();
  if (!s) return '';
  let m = s.match(/^printf\s*\(?\s*([\s\S]*?)\)?\s*$/);
  if (m && s.startsWith('printf')) return `__out(__sprintf(${awkExpr(m[1])}));`;
  m = s.match(/^print\b\s*([\s\S]*)$/);
  if (m) {
    const argsSrc = m[1].trim();
    if (!argsSrc) return '__out(__f(0) + "\\n");';
    const parts = splitTop(argsSrc, ',').map(a => {
      const terms = splitTop(a.trim(), ' ').filter(Boolean);
      const simple = terms.every(t => /^("[^"]*"|\$\w+|\$\([^)]*\)|[A-Za-z_]\w*|\d+(\.\d+)?|\([^)]*\))$/.test(t));
      return terms.length > 1 && simple ? `__cat(${terms.map(awkExpr).join(',')})` : awkExpr(a);
    });
    return `__out([${parts.join(',')}].join(" ") + "\\n");`;
  }
  return awkExpr(s) + ';';
}

function splitTop(src, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') { const j = src.indexOf('"', i + 1); cur += src.slice(i, j + 1); i = j; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function awkAction(action) {
  // Separa sentencias por ; o salto de línea, respetando llaves de if/for.
  const stmts = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < action.length; i++) {
    const c = action[i];
    if (c === '"') { const j = action.indexOf('"', i + 1); cur += action.slice(i, j + 1); i = j; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if ((c === ';' || c === '\n') && depth === 0) { stmts.push(cur); cur = ''; continue; }
    if ((c === '{' || c === '}') && depth === 0) { stmts.push(cur); stmts.push(c); cur = ''; continue; }
    cur += c;
  }
  stmts.push(cur);
  return stmts.map(st => {
    const t = st.trim();
    if (t === '{' || t === '}') return t;
    const ifm = t.match(/^(if|while)\s*\((.*)\)\s*(.*)$/s);
    if (ifm) return `${ifm[1]} (${awkExpr(ifm[2])}) ${ifm[3] ? '{' + awkStatement(ifm[3]) + '}' : ''}`;
    if (t === 'else') return 'else';
    return awkStatement(t);
  }).join('\n');
}

function awk(argv, io) {
  let fs = null;
  let i = 0;
  const assigns = {};
  for (; i < argv.length; i++) {
    if (argv[i] === '-F') { fs = argv[++i]; continue; }
    if (argv[i].startsWith('-F')) { fs = argv[i].slice(2); continue; }
    if (argv[i] === '-v') { const [k, v] = argv[++i].split('='); assigns[k] = v; continue; }
    break;
  }
  const prog = argv[i];
  const files = argv.slice(i + 1);
  if (prog === undefined) { io.err('usage: awk [-F fs][-v var=value][prog | -f progfile][file ...]\n'); return 2; }
  const rules = awkRules(prog);
  const vars = { ...assigns, NR: 0, NF: 0, FS: fs ?? ' ', OFS: ' ' };
  let fields = [''];
  const num = v => (typeof v === 'string' && /^\s*-?\d+(\.\d+)?([eE][-+]?\d+)?\s*$/.test(v) ? Number(v) : v);
  const out = [];
  const helpers = {
    __f: n => {
      n = Number(n);
      if (n === 0) return num(fields[0]);
      return num(fields[n] ?? '');
    },
    __out: s => out.push(String(s)),
    __sprintf: (fmt, ...vals) => awkSprintf(String(fmt), vals),
    __cat: (...parts) => parts.join(''),
    length: s => String(s ?? fields[0]).length,
    toupper: s => String(s).toUpperCase(),
    tolower: s => String(s).toLowerCase(),
    substr: (s, a, b) => String(s).substr(Number(a) - 1, b === undefined ? undefined : Number(b)),
    int: x => Math.trunc(Number(x)),
    sqrt: x => Math.sqrt(Number(x)),
  };
  const env = new Proxy(vars, {
    has: (t, k) => typeof k === 'string' && !k.startsWith('__') && !(k in helpers) && !['Math', 'String', 'Number', 'undefined', 'true', 'false'].includes(k),
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : 0),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  let compiled;
  try {
    compiled = rules.map(r => {
      const kind = r.pattern === 'BEGIN' ? 'begin' : r.pattern === 'END' ? 'end' : 'main';
      let cond = 'true';
      if (kind === 'main' && r.pattern) {
        cond = /^\/.*\/$/.test(r.pattern) ? `${r.pattern}.test(__f(0))` : awkExpr(r.pattern);
      }
      const body = r.action === null ? '__out(__f(0) + "\\n");' : awkAction(r.action);
      // eslint-disable-next-line no-new-func
      const fn = new Function('__env', '__h', `with (__h) { with (__env) { if (${cond}) { ${body} } } }`);
      return { kind, fn };
    });
  } catch (e) {
    io.err(`awk: syntax error in program\n awk: ${e.message}\n`);
    return 2;
  }
  const run = kind => compiled.filter(c => c.kind === kind).forEach(c => c.fn(env, helpers));
  try {
    run('begin');
    const { items, status } = readInputs(this, 'awk', files, io);
    for (const it of items) {
      for (const line of splitLines(it.text)) {
        this.tick();
        vars.NR++;
        const parts = vars.FS === ' ' ? line.trim().split(/\s+/).filter(Boolean) : line.split(vars.FS);
        fields = [line, ...parts];
        vars.NF = parts.length;
        helpers.NF = parts.length;
        compiled.filter(c => c.kind === 'main').forEach(c => c.fn(env, helpers));
      }
    }
    run('end');
    io.out(out.join(''));
    return status;
  } catch (e) {
    if (e instanceof StepLimit) throw e;
    io.out(out.join(''));
    io.err(`awk: ${e.message}\n`);
    return 2;
  }
}

export function completions(sh, partial, isFirst) {
  // Autocompletado con Tab: órdenes (primera palabra) o rutas.
  if (isFirst && !partial.includes('/')) {
    const names = [...new Set([...Object.keys(BUILTINS), ...Object.keys(COMMANDS)])].filter(n => /^[a-z]/.test(n));
    const local = [];
    return [...names.filter(n => n.startsWith(partial)), ...local].sort();
  }
  const slash = partial.lastIndexOf('/');
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
  const filePart = slash >= 0 ? partial.slice(slash + 1) : partial;
  const dir = sh.get(dirPart || '.');
  if (!dir || dir.type !== 'd') return [];
  return Object.keys(dir.children)
    .filter(n => n.startsWith(filePart) && (filePart.startsWith('.') || !n.startsWith('.')))
    .sort(sortNames)
    .map(n => dirPart + n + (dir.children[n].type === 'd' ? '/' : ''));
}

export { COMMANDS, BUILTINS };
