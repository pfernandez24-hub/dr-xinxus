// Analizador de un subconjunto de bash: tuberías, &&, ||, redirecciones,
// if/elif/else, for, while, until, case. Suficiente para los scripts del Tema 1A.

export class BashSyntaxError extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

const OPS = ['&&', '||', ';;', '>>', '2>>', '2>', '&>', '|', ';', '&', '>', '<', '(', ')'];
const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', '!', '{', '}']);

// Lee hasta el ')' que cierra un $( ... ) empezando en i (justo después del '(').
function skipParen(src, i) {
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { const j = src.indexOf("'", i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '"') { i = skipDouble(src, i + 1); continue; }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    i++;
  }
  return i;
}

// i apunta justo después de la comilla doble de apertura; devuelve la posición tras la de cierre.
function skipDouble(src, i) {
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"') return i + 1;
    if (c === '$' && src[i + 1] === '(') { i = skipParen(src, i + 2); continue; }
    i++;
  }
  throw new BashSyntaxError('unexpected EOF while looking for matching `"\'', null);
}

export function lex(src) {
  const toks = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
    if (c === '\n') { toks.push({ t: 'op', v: '\n', line }); line++; i++; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op && !(op.startsWith('2') && /[^\s;|&<>()]/.test(src[i - 1] || ' '))) {
      toks.push({ t: 'op', v: op, line });
      i += op.length;
      continue;
    }
    // Palabra
    const start = i;
    const startLine = line;
    while (i < src.length) {
      const ch = src[i];
      if (/[\s;|&<>()]/.test(ch)) {
        break;
      }
      if (ch === '\\') { i += 2; continue; }
      if (ch === "'") {
        const j = src.indexOf("'", i + 1);
        if (j < 0) throw new BashSyntaxError("unexpected EOF while looking for matching `''", startLine);
        line += (src.slice(i, j).match(/\n/g) || []).length;
        i = j + 1;
        continue;
      }
      if (ch === '"') {
        const j = skipDouble(src, i + 1);
        line += (src.slice(i, j).match(/\n/g) || []).length;
        i = j;
        continue;
      }
      if (ch === '$' && src[i + 1] === '(') { i = skipParen(src, i + 2); continue; }
      if (ch === '$' && src[i + 1] === '{') { const j = src.indexOf('}', i); i = j < 0 ? src.length : j + 1; continue; }
      i++;
    }
    toks.push({ t: 'w', v: src.slice(start, i), line: startLine });
  }
  return toks;
}

export function parse(src) {
  const p = new Parser(lex(src));
  const list = p.parseList([]);
  if (p.peek()) p.unexpected();
  return list;
}

class Parser {
  constructor(toks) {
    this.t = toks;
    this.i = 0;
  }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
  isWord(v) { const k = this.peek(); return k && k.t === 'w' && k.v === v; }
  isOp(v) { const k = this.peek(); return k && k.t === 'op' && k.v === v; }
  lastLine() { const k = this.t[this.t.length - 1]; return k ? k.line : 1; }

  unexpected() {
    const k = this.peek();
    if (!k) throw new BashSyntaxError('syntax error: unexpected end of file', this.lastLine());
    const v = k.v === '\n' ? 'newline' : k.v;
    throw new BashSyntaxError(`syntax error near unexpected token \`${v}'`, k.line);
  }

  expectWord(v) {
    if (!this.isWord(v)) this.unexpected();
    return this.next();
  }

  skipNewlines() {
    while (this.isOp('\n')) this.i++;
  }

  atStop(stops) {
    const k = this.peek();
    if (!k) return true;
    if (k.t === 'w' && stops.includes(k.v)) return true;
    if (k.t === 'op' && stops.includes(k.v)) return true;
    return false;
  }

  parseList(stops) {
    const items = [];
    for (;;) {
      while (this.isOp('\n') || (items.length && this.isOp(';'))) this.i++;
      if (this.atStop(stops)) break;
      const k = this.peek();
      if (k.t === 'op' && !['(', '!'].includes(k.v)) this.unexpected();
      items.push(this.parseAndOr());
      if (this.isOp(';') || this.isOp('\n') || this.isOp('&')) {
        this.next();
        continue;
      }
      if (this.atStop(stops)) break;
      this.unexpected();
    }
    return { type: 'list', items };
  }

  parseAndOr() {
    let left = this.parsePipeline();
    while (this.isOp('&&') || this.isOp('||')) {
      const op = this.next().v;
      this.skipNewlines();
      const right = this.parsePipeline();
      left = { type: 'andor', op, left, right };
    }
    return left;
  }

  parsePipeline() {
    let negate = false;
    if (this.isWord('!')) { this.next(); negate = true; }
    const cmds = [this.parseCommand()];
    while (this.isOp('|')) {
      this.next();
      this.skipNewlines();
      cmds.push(this.parseCommand());
    }
    if (cmds.length === 1 && !negate) return cmds[0];
    return { type: 'pipeline', cmds, negate };
  }

  parseCommand() {
    const k = this.peek();
    if (!k) this.unexpected();
    let node;
    if (k.t === 'w' && k.v === 'if') node = this.parseIf();
    else if (k.t === 'w' && k.v === 'for') node = this.parseFor();
    else if (k.t === 'w' && (k.v === 'while' || k.v === 'until')) node = this.parseWhile();
    else if (k.t === 'w' && k.v === 'case') node = this.parseCase();
    else if (k.t === 'w' && ['then', 'elif', 'else', 'fi', 'do', 'done', 'esac'].includes(k.v)) this.unexpected();
    else return this.parseSimple();
    node.redirs = this.parseRedirs();
    return node;
  }

  parseRedirs() {
    const redirs = [];
    while (this.peek() && this.peek().t === 'op' && ['>', '>>', '<', '2>', '2>>', '&>'].includes(this.peek().v)) {
      const op = this.next().v;
      const target = this.peek();
      if (!target || target.t !== 'w') this.unexpected();
      this.next();
      redirs.push({ op, target: target.v });
    }
    return redirs;
  }

  parseSimple() {
    const first = this.peek();
    const node = { type: 'simple', assigns: [], words: [], redirs: [], line: first.line };
    for (;;) {
      const k = this.peek();
      if (!k) break;
      if (k.t === 'w') {
        if (node.words.length === 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(k.v)) {
          const eq = k.v.indexOf('=');
          node.assigns.push({ name: k.v.slice(0, eq), value: k.v.slice(eq + 1) });
        } else {
          node.words.push(k.v);
        }
        this.next();
        continue;
      }
      if (['>', '>>', '<', '2>', '2>>', '&>'].includes(k.v)) {
        node.redirs.push(...this.parseRedirs());
        continue;
      }
      break;
    }
    if (!node.words.length && !node.assigns.length && !node.redirs.length) this.unexpected();
    return node;
  }

  parseIf() {
    const line = this.next().line;
    const branches = [];
    const cond = this.parseList(['then']);
    this.expectWord('then');
    const body = this.parseList(['elif', 'else', 'fi']);
    branches.push({ cond, body });
    let elseBody = null;
    for (;;) {
      if (this.isWord('elif')) {
        this.next();
        const c = this.parseList(['then']);
        this.expectWord('then');
        const b = this.parseList(['elif', 'else', 'fi']);
        branches.push({ cond: c, body: b });
        continue;
      }
      if (this.isWord('else')) {
        this.next();
        elseBody = this.parseList(['fi']);
      }
      break;
    }
    this.expectWord('fi');
    return { type: 'if', branches, elseBody, line };
  }

  parseFor() {
    const line = this.next().line;
    const nameTok = this.next();
    if (!nameTok || nameTok.t !== 'w' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nameTok.v)) {
      throw new BashSyntaxError(`\`${nameTok ? nameTok.v : ''}': not a valid identifier`, line);
    }
    let words = null;
    this.skipNewlines();
    if (this.isWord('in')) {
      this.next();
      words = [];
      while (this.peek() && this.peek().t === 'w') words.push(this.next().v);
    }
    while (this.isOp(';') || this.isOp('\n')) this.next();
    this.expectWord('do');
    const body = this.parseList(['done']);
    this.expectWord('done');
    return { type: 'for', name: nameTok.v, words, body, line };
  }

  parseWhile() {
    const tok = this.next();
    const cond = this.parseList(['do']);
    this.expectWord('do');
    const body = this.parseList(['done']);
    this.expectWord('done');
    return { type: 'while', until: tok.v === 'until', cond, body, line: tok.line };
  }

  parseCase() {
    const line = this.next().line;
    const wordTok = this.next();
    if (!wordTok || wordTok.t !== 'w') this.unexpected();
    this.skipNewlines();
    this.expectWord('in');
    const items = [];
    for (;;) {
      this.skipNewlines();
      if (this.isWord('esac')) break;
      if (this.isOp('(')) this.next();
      const patterns = [];
      const pt = this.next();
      if (!pt || pt.t !== 'w') { this.i--; this.unexpected(); }
      patterns.push(pt.v);
      while (this.isOp('|')) {
        this.next();
        const more = this.next();
        if (!more || more.t !== 'w') { this.i--; this.unexpected(); }
        patterns.push(more.v);
      }
      if (!this.isOp(')')) this.unexpected();
      this.next();
      const body = this.parseList([';;', 'esac']);
      items.push({ patterns, body });
      if (this.isOp(';;')) this.next();
      else break;
    }
    this.skipNewlines();
    this.expectWord('esac');
    return { type: 'case', word: wordTok.v, items, line };
  }
}

export { RESERVED };
