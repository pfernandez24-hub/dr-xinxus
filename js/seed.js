// Mundo inicial del servidor simulado: imita el servidor "ubuntu" de clase.
import { mkDir, mkFile } from './vfs.js';
import { REPO_FILES } from './data/repo.js';

export const REPO_URL = 'https://github.com/hperez-ucam/bioinformatica_26-27.git';
export const REPO_NAME = 'bioinformatica_26-27';

// Programas "compilados" que aparecen en /usr/bin (solo para ls, file, type...).
export const BINARIES = [
  'bash', 'cat', 'chmod', 'chown', 'cp', 'curl', 'date', 'echo', 'file', 'find', 'git', 'grep',
  'head', 'hostname', 'id', 'less', 'ls', 'man', 'mkdir', 'more', 'mv', 'nano', 'ps', 'pwd',
  'python3', 'realpath', 'rm', 'rmdir', 'sed', 'seq', 'sort', 'sudo', 'tail', 'touch', 'uname',
  'uniq', 'vi', 'vim', 'wc', 'who', 'whoami', 'basename', 'dirname', 'cut', 'ssh', 'passwd', 'true', 'false',
];

// 1HVR.pdb sintético: mismas cifras que el real (1826 ATOM, 64 HETATM),
// coordenadas inventadas. Se genera una vez y se reutiliza.
let hvrCache = null;
export function make1HVR() {
  if (hvrCache) return hvrCache;
  const res = ['PRO', 'GLN', 'ILE', 'THR', 'LEU', 'TRP', 'GLN', 'ARG', 'PRO', 'LEU', 'VAL', 'THR', 'ILE', 'LYS', 'ILE', 'GLY', 'GLY', 'GLN', 'LEU', 'LYS'];
  const names = ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'CE', 'NZ'];
  const lines = [
    'HEADER    HYDROLASE/HYDROLASE INHIBITOR           28-OCT-93   1HVR',
    'TITLE     RATIONAL DESIGN OF POTENT, BIOAVAILABLE, NONPEPTIDE CYCLIC UREAS AS',
    'TITLE    2 HIV PROTEASE INHIBITORS',
    'COMPND    MOL_ID: 1;',
    'COMPND   2 MOLECULE: HIV-1 PROTEASE;',
    'REMARK   1 ESTE FICHERO ES UNA COPIA SINTETICA PARA DR.XINXUS:',
    'REMARK   1 MISMO NUMERO DE LINEAS ATOM (1826) Y HETATM (64) QUE EL ORIGINAL.',
  ];
  const fmt = (rec, serial, name, resName, chain, resSeq, el) => {
    const x = (Math.sin(serial) * 20).toFixed(3).padStart(8);
    const y = (Math.cos(serial * 1.3) * 20).toFixed(3).padStart(8);
    const z = (Math.sin(serial * 0.7) * 20).toFixed(3).padStart(8);
    const nm = name.length < 4 ? ' ' + name.padEnd(3) : name;
    return `${rec.padEnd(6)}${String(serial).padStart(5)} ${nm} ${resName} ${chain}${String(resSeq).padStart(4)}    ${x}${y}${z}  1.00 20.00           ${el}`;
  };
  let serial = 1;
  for (let i = 0; i < 1826; i++) {
    const resSeq = Math.floor(i / 9.2) + 1;
    const chain = resSeq <= 99 ? 'A' : 'B';
    const name = names[i % names.length];
    lines.push(fmt('ATOM', serial++, name, res[resSeq % res.length], chain, ((resSeq - 1) % 99) + 1, name[0]));
  }
  lines.push('TER    1827      PHE B  99');
  serial = 1828;
  for (let i = 0; i < 64; i++) {
    const het = i < 46 ? 'XK2' : 'HOH';
    lines.push(fmt('HETATM', serial++, i < 46 ? 'C' + (i % 9 + 1) : 'O', het, 'A', i < 46 ? 100 : 200 + i, i < 46 ? 'C' : 'O'));
  }
  lines.push('END');
  hvrCache = lines.join('\n') + '\n';
  return hvrCache;
}

function writeTree(base, relPath, node) {
  const parts = relPath.split('/');
  let dir = base;
  for (const p of parts.slice(0, -1)) {
    if (!dir.children[p]) dir.children[p] = mkDir(base.owner, 0o775);
    dir = dir.children[p];
  }
  dir.children[parts[parts.length - 1]] = node;
}

export function buildRepo(owner) {
  const repo = mkDir(owner, 0o775);
  repo.repo = { dirty: [] };
  repo.children['.git'] = mkDir(owner, 0o775);
  for (const [rel, f] of Object.entries(REPO_FILES)) {
    writeTree(repo, rel, mkFile(f.c, owner, f.x ? 0o775 : 0o664));
  }
  writeTree(repo, 'tema-1a-linux/1HVR.pdb', mkFile(make1HVR(), owner, 0o664));
  return repo;
}

// Copia de trabajo: ~/trabajo-1a con los scripts del Tema 1A.
export function buildTrabajo(owner) {
  const dir = mkDir(owner, 0o775);
  for (const [rel, f] of Object.entries(REPO_FILES)) {
    if (!rel.startsWith('tema-1a-linux/')) continue;
    dir.children[rel.slice('tema-1a-linux/'.length)] = mkFile(f.c, owner, f.x ? 0o775 : 0o664);
  }
  dir.children['1HVR.pdb'] = mkFile(make1HVR(), owner, 0o664);
  return dir;
}

export function buildWorld(fs, user, opts = {}) {
  const { repo = true, trabajo = true } = opts;
  const r = fs.root;
  for (const d of ['bin', 'usr', 'etc', 'home', 'tmp', 'var', 'root', 'opt', 'dev', 'proc', 'lib', 'boot', 'srv', 'mnt']) {
    r.children[d] = mkDir('root');
  }
  r.children.tmp.mode = 0o777;
  r.children.root.mode = 0o700;
  r.children.dev.children.null = mkFile('', 'root', 0o666);
  const usr = r.children.usr;
  usr.children.bin = mkDir('root');
  usr.children.local = mkDir('root');
  usr.children.local.children.bin = mkDir('root');
  usr.children.share = mkDir('root');
  for (const b of BINARIES) {
    const node = mkFile('', 'root', 0o755, { bin: b, size: 100000 + b.length * 7919 });
    r.children.bin.children[b] = node;
    usr.children.bin.children[b] = { ...node };
  }
  r.children.var.children.log = mkDir('root');
  const etc = r.children.etc;
  etc.children.hostname = mkFile('ubuntu\n');
  etc.children.shells = mkFile('# /etc/shells: valid login shells\n/bin/sh\n/usr/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/rbash\n/usr/bin/rbash\n/usr/bin/dash\n');
  etc.children.passwd = mkFile([
    'root:x:0:0:root:/root:/bin/bash',
    'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
    'sshd:x:110:65534::/run/sshd:/usr/sbin/nologin',
    'hperez:x:1000:1000:Horacio Perez:/home/hperez:/bin/bash',
    `${user}:x:1013:1013::/home/${user}:/bin/bash`,
  ].join('\n') + '\n');
  etc.children['os-release'] = mkFile('PRETTY_NAME="Ubuntu 24.04.3 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\n');

  const home = r.children.home;
  home.children.hperez = mkDir('hperez', 0o750);
  const me = mkDir(user, 0o750);
  home.children[user] = me;
  me.children['.bashrc'] = mkFile("# ~/.bashrc\nalias ll='ls -alF'\nalias la='ls -A'\nalias l='ls -CF'\n", user);
  me.children['.profile'] = mkFile('# ~/.profile\nif [ -n "$BASH_VERSION" ]; then\n    . "$HOME/.bashrc"\nfi\n', user);
  me.children['.bash_logout'] = mkFile('# ~/.bash_logout\n', user);
  if (repo) me.children[REPO_NAME] = buildRepo(user);
  if (trabajo) me.children['trabajo-1a'] = buildTrabajo(user);
}
