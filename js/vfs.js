// Sistema de ficheros virtual en memoria.
// Nodo directorio: { type: 'd', children: {}, mode, owner, mtime }
// Nodo fichero:    { type: 'f', content: '', mode, owner, mtime, bin? }

export function now() { return Date.now(); }

export function mkDir(owner = 'root', mode = 0o755) {
  return { type: 'd', children: {}, mode, owner, mtime: now() };
}

export function mkFile(content = '', owner = 'root', mode = 0o644, extra = {}) {
  return { type: 'f', content, mode, owner, mtime: now(), ...extra };
}

export function splitPath(p) {
  return p.split('/').filter(Boolean);
}

// Normaliza una ruta ya absoluta: quita '.', resuelve '..'.
export function normalize(abs) {
  const out = [];
  for (const part of splitPath(abs)) {
    if (part === '.') continue;
    if (part === '..') { out.pop(); continue; }
    out.push(part);
  }
  return '/' + out.join('/');
}

export function basename(p) {
  const parts = splitPath(p);
  return parts.length ? parts[parts.length - 1] : '/';
}

export function dirname(p) {
  const parts = splitPath(p);
  parts.pop();
  return '/' + parts.join('/');
}

export function cloneNode(node) {
  if (node.type === 'f') return { ...node, mtime: now() };
  const copy = { ...node, children: {}, mtime: now() };
  for (const [k, v] of Object.entries(node.children)) copy.children[k] = cloneNode(v);
  return copy;
}

export class VFS {
  constructor() {
    this.root = mkDir('root');
  }

  get(abs) {
    let node = this.root;
    for (const part of splitPath(abs)) {
      if (!node || node.type !== 'd') return null;
      node = node.children[part];
    }
    return node || null;
  }

  // Devuelve { parent, name } aunque el nodo final no exista.
  parentOf(abs) {
    const parts = splitPath(abs);
    const name = parts.pop();
    return { parent: this.get('/' + parts.join('/')), name };
  }

  set(abs, node) {
    const { parent, name } = this.parentOf(abs);
    if (!parent || parent.type !== 'd') return false;
    parent.children[name] = node;
    parent.mtime = now();
    return true;
  }

  remove(abs) {
    const { parent, name } = this.parentOf(abs);
    if (!parent || !parent.children[name]) return false;
    delete parent.children[name];
    parent.mtime = now();
    return true;
  }

  // mkdir -p
  mkdirp(abs, owner) {
    let node = this.root;
    for (const part of splitPath(abs)) {
      if (!node.children[part]) node.children[part] = mkDir(owner);
      node = node.children[part];
      if (node.type !== 'd') return null;
    }
    return node;
  }

  writeFile(abs, content, owner, mode) {
    const existing = this.get(abs);
    if (existing && existing.type === 'f') {
      existing.content = content;
      existing.mtime = now();
      return existing;
    }
    const node = mkFile(content, owner, mode ?? 0o664);
    return this.set(abs, node) ? node : null;
  }
}

// Permisos en formato ls -l: drwxr-xr-x
export function modeString(node) {
  const chars = 'rwxrwxrwx';
  let s = node.type === 'd' ? 'd' : '-';
  for (let i = 0; i < 9; i++) s += (node.mode & (1 << (8 - i))) ? chars[i] : '-';
  return s;
}

export function nodeSize(node) {
  if (node.type === 'd') return 4096;
  if (node.bin) return node.size || 142312;
  return new TextEncoder().encode(node.content).length;
}
