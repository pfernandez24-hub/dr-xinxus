// Entradas del PDB que la terminal simulada sabe "descargar" con pdb_fetch.
// Las cifras de pdb_wc y freesasa son las reales del servidor de clase (diapositivas
// del Tema 1C y salidas de las tareas 1C y 1C2). Las coordenadas son inventadas.
//
// atoms: líneas ATOM (incluidos hidrógenos) · h: cuántas son hidrógenos
// het: composición de las líneas HETATM { resName: nº de líneas }. Es exacta en 1hvr,
//      1mbn y 1c3w (tareas); en el resto solo cuadra el total de HETATM.
//      En 1ake, el nº de átomos no aparece en las tareas: es aproximado.
// total/apolar: resultado de freesasa por defecto (solo ATOM, sin hidrógenos)

export const PDB_ENTRIES = {
  '1crn': {
    title: 'CRAMBIN', header: 'PLANT PROTEIN', chains: 1, residues: 46, atoms: 327, h: 0, het: {},
    total: 2999.32, apolar: 1969.33, polar: 1030.00, lines: 611,
    seq: 'TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN',
    ssbond: [['CYS', 'A', 3, 'CYS', 'A', 40], ['CYS', 'A', 4, 'CYS', 'A', 32], ['CYS', 'A', 16, 'CYS', 'A', 26]],
    rsaCys: { 3: [0.00, 0.0], 4: [0.00, 0.0], 16: [19.43, 14.7], 26: [0.00, 0.0], 32: [4.71, 3.6], 40: [44.63, 33.8] },
  },
  '1hvr': {
    title: 'HIV-1 PROTEASE WITH CYCLIC UREA INHIBITOR XK263', header: 'HYDROLASE/HYDROLASE INHIBITOR',
    chains: 2, residues: 196, atoms: 1826, h: 326, het: { XK2: 46, CSO: 18 },
    hetRecords: ['HET    CSO  A  67       9', 'HET    CSO  B  67       9', 'HET    XK2  A 263      46'],
    hetnam: [
      'HETNAM     CSO S-HYDROXYCYSTEINE',
      'HETNAM     XK2 [4R-(4ALPHA,5ALPHA,6BETA,7BETA)]-HEXAHYDRO-5,6-',
      'HETNAM   2 XK2  DIHYDROXY-1,3-BIS[2-NAPHTHYL-METHYL]-4,7-',
      'HETNAM   3 XK2  BIS(PHENYLMETHYL)-2H-1,3-DIAZEPIN-2-ONE',
    ],
    total: 9710.72, apolar: 5425.23,
  },
  '1ake': {
    title: 'ADENYLATE KINASE WITH INHIBITOR AP5A', header: 'TRANSFERASE', chains: 2, residues: 428, atoms: 3312, h: 0,
    het: { AP5: 114, HOH: 385 }, total: 21218.70, apolar: 11607.71,
  },
  '1ubq': { title: 'UBIQUITIN', header: 'CHROMOSOMAL PROTEIN', chains: 1, residues: 76, atoms: 602, h: 0, het: { HOH: 58 }, total: 4804.06, apolar: 2299.84 },
  '1lyz': { title: 'LYSOZYME', header: 'HYDROLASE', chains: 1, residues: 129, atoms: 1001, h: 0, het: { HOH: 101 }, total: 6587.86, apolar: 3233.91 },
  '4pti': { title: 'BOVINE PANCREATIC TRYPSIN INHIBITOR', header: 'PROTEINASE INHIBITOR', chains: 1, residues: 58, atoms: 454, h: 0, het: { HOH: 60 }, total: 3992.26, apolar: 2103.77 },
  '1mbn': {
    title: 'MYOGLOBIN', header: 'OXYGEN STORAGE', chains: 1, residues: 153, atoms: 1216, h: 0, het: { HEM: 43, ' OH': 1 },
    hetnam: ['HETNAM      OH HYDROXIDE ION', 'HETNAM     HEM PROTOPORPHYRIN IX CONTAINING FE'],
    total: 8285.01, apolar: 4951.14,
  },
  '4hhb': { title: 'HUMAN DEOXYHAEMOGLOBIN', header: 'OXYGEN TRANSPORT', chains: 4, residues: 574, atoms: 4384, h: 0, het: { HEM: 172, PO4: 2, HOH: 221 }, total: 25570.48, apolar: 16351.63 },
  '1ema': { title: 'GREEN FLUORESCENT PROTEIN', header: 'LUMINESCENT PROTEIN', chains: 1, residues: 221, atoms: 1717, h: 0, het: { HOH: 149 }, total: 10379.64, apolar: 5807.03 },
  '1tim': { title: 'TRIOSEPHOSPHATE ISOMERASE', header: 'ISOMERASE', chains: 2, residues: 494, atoms: 3740, h: 0, het: {}, total: 20263.44, apolar: 11553.64 },
  '4ins': { title: 'INSULIN', header: 'HORMONE', chains: 4, residues: 102, atoms: 830, h: 0, het: { ZN: 2, HOH: 350 }, total: 5978.51, apolar: 3287.71 },
  '1ca2': { title: 'CARBONIC ANHYDRASE II', header: 'LYASE', chains: 1, residues: 256, atoms: 2039, h: 0, het: { ZN: 1, HOH: 167 }, total: 11557.45, apolar: 6277.01 },
  '1c3w': {
    title: 'BACTERIORHODOPSIN', header: 'PROTON TRANSPORT', chains: 1, residues: 222, atoms: 1720, h: 0,
    het: { HOH: 23, LI1: 283, RET: 20, SQU: 27 },
    hetnam: [
      'HETNAM     LI1 1-[2,6,10.14-TETRAMETHYL-HEXADECAN-16-YL]-2-[2,10,14-',
      'HETNAM   2 LI1  TRIMETHYLHEXADECAN-16-YL]GLYCEROL',
      'HETNAM     SQU 2,10,23-TRIMETHYL-TETRACOSANE',
      'HETNAM     RET RETINAL',
    ],
    total: 9967.88, apolar: 7365.14,
  },
};

const RES3 = { A: 'ALA', C: 'CYS', D: 'ASP', E: 'GLU', F: 'PHE', G: 'GLY', H: 'HIS', I: 'ILE', K: 'LYS', L: 'LEU', M: 'MET', N: 'ASN', P: 'PRO', Q: 'GLN', R: 'ARG', S: 'SER', T: 'THR', V: 'VAL', W: 'TRP', Y: 'TYR' };
const FILLER = 'PQITLWQRPLVTIKIGGQLKEALLDTGADDTVLEEMNLPGRWKPKMIGGIGGFIKVRQYDQILIEICGHKAIGTVLVGPTPVNIIGRNLLTQIGCTLNF';
const SIDE = ['CB', 'CG', 'CD', 'CE', 'NZ', 'OG', 'SD', 'CZ', 'NE'];

function coord(n, k) {
  return (Math.sin(n * k) * 20).toFixed(3).padStart(8);
}

function atomLine(rec, serial, name, resName, chain, resSeq, el) {
  const nm = name.length < 4 ? ' ' + name.padEnd(3) : name;
  return `${rec.padEnd(6)}${String(serial % 100000).padStart(5)} ${nm} ${resName.padStart(3)} ${chain}${String(resSeq).padStart(4)}    `
    + `${coord(serial, 1)}${coord(serial, 1.3)}${coord(serial, 0.7)}  1.00 20.00          ${el.padStart(2)}`;
}

function residueOf(e, idx) {
  if (e.seq) return RES3[e.seq[idx % e.seq.length]];
  return RES3[FILLER[idx % FILLER.length]];
}

const cache = {};

// Genera un fichero PDB sintético con los mismos recuentos que la entrada real.
export function makePdb(code) {
  code = code.toLowerCase();
  if (cache[code]) return cache[code];
  const e = PDB_ENTRIES[code];
  if (!e) return null;
  const chainIds = 'ABCDEFGH'.slice(0, e.chains).split('');
  const perChain = Math.ceil(e.residues / e.chains);
  const lines = [
    `HEADER    ${e.header.padEnd(40)}01-JAN-00   ${code.toUpperCase()}`,
    `TITLE     ${e.title}`,
    'REMARK   1 COPIA SINTETICA PARA DR.XINXUS: MISMOS RECUENTOS QUE LA ENTRADA REAL,',
    'REMARK   1 COORDENADAS INVENTADAS.',
  ];
  (e.hetRecords || []).forEach(l => lines.push(l));
  (e.hetnam || []).forEach(l => lines.push(l));
  (e.ssbond || []).forEach((s, i) => lines.push(`SSBOND ${String(i + 1).padStart(3)} ${s[0]} ${s[1]} ${String(s[2]).padStart(4)}    ${s[3]} ${s[4]} ${String(s[5]).padStart(4)}`));

  // Reparto de átomos: un CA por residuo, el resto rellena hasta el total.
  const heavy = e.atoms - e.h;
  const perRes = new Array(e.residues).fill(1);
  let left = heavy - e.residues;
  for (let i = 0; left > 0; i = (i + 1) % e.residues, left--) perRes[i]++;
  const hPerRes = new Array(e.residues).fill(0);
  let hl = e.h;
  for (let i = 0; hl > 0; i = (i + 1) % e.residues, hl--) hPerRes[i]++;

  let serial = 1;
  const order = ['N', 'CA', 'C', 'O', ...SIDE];
  for (let r = 0; r < e.residues; r++) {
    const chain = chainIds[Math.min(chainIds.length - 1, Math.floor(r / perChain))];
    const resSeq = (r % perChain) + 1;
    const resName = residueOf(e, r % perChain);
    const names = perRes[r] === 1 ? ['CA'] : ['N', 'CA', ...order.slice(2)].slice(0, Math.min(perRes[r], order.length));
    while (names.length < perRes[r]) names.push('C' + names.length);
    names.forEach(n => lines.push(atomLine('ATOM', serial++, n, resName, chain, resSeq, n[0])));
    for (let k = 0; k < hPerRes[r]; k++) lines.push(atomLine('ATOM', serial++, k ? `H${k}` : 'H', resName, chain, resSeq, 'H'));
    if (resSeq === perChain || r === e.residues - 1) lines.push(`TER   ${String(serial++).padStart(5)}      ${resName} ${chain}${String(resSeq).padStart(4)}`);
  }
  let hetSeq = 300;
  for (const [res, n] of Object.entries(e.het)) {
    const el = res.trim() === 'HOH' || res.trim() === 'OH' ? 'O' : res.trim() === 'ZN' ? 'ZN' : 'C';
    for (let k = 0; k < n; k++) {
      const seq = res.trim() === 'HOH' ? hetSeq++ : (res === 'CSO' ? 67 : 263);
      const chain = res === 'CSO' ? (k < n / 2 ? 'A' : 'B') : 'A';
      lines.push(atomLine('HETATM', serial++, el === 'O' ? 'O' : el === 'ZN' ? 'ZN' : `C${(k % 9) + 1}`, res, chain, seq, el));
    }
  }
  lines.push('END');
  if (e.lines) {
    while (lines.length < e.lines) lines.splice(4, 0, `REMARK 999 ${'RELLENO'.padEnd(10)}${String(lines.length).padStart(5)}`);
  }
  cache[code] = lines.join('\n') + '\n';
  return cache[code];
}

// Recuento estilo pdb_wc a partir del contenido de un fichero.
export function countPdb(content) {
  const lines = content.split('\n');
  const atom = lines.filter(l => l.startsWith('ATOM'));
  const het = lines.filter(l => l.startsWith('HETATM'));
  const chains = new Set(atom.map(l => l[21]));
  const residues = new Set(atom.map(l => l[21] + l.slice(22, 27)));
  const models = lines.filter(l => l.startsWith('MODEL')).length || (atom.length || het.length ? 1 : 0);
  const hydrogens = atom.filter(l => l.trim().endsWith(' H')).length;
  return { models, chains: chains.size, residues: residues.size, atoms: atom.length, hetatm: het.length, hydrogens };
}

// Valores de freesasa para un fichero: si es una entrada conocida, los reales.
export function sasaFor(content) {
  const m = content.match(/^HEADER.*\s(\w{4})\s*$/m);
  const code = m ? m[1].toLowerCase() : null;
  const e = code && PDB_ENTRIES[code];
  const c = countPdb(content);
  if (e && c.atoms === e.atoms) return { code, entry: e, ...c };
  return { code: null, entry: null, ...c };
}
