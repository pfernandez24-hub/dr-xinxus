// Temario de Dr.Xinxus — Bioinformática, Tema 1 (1A Linux y scripts, 1B IA con criterio,
// 1C mini-aplicaciones estructurales). Grado en Biotecnología, UCAM 2026/27.
// Basado en las diapositivas del profesor, la chuleta, el extra de vi, el repositorio de clase
// y las tareas entregadas (tarea2, 1A2, 1B, 1C, 1C2 y 1D).
//
// Ordenado de lo más fácil a lo más difícil. Dentro de cada lección: teoría → reconocer
// (opción múltiple) → completar/ordenar → hacer (terminal) → encontrar errores / tipo examen.
//
// Tipos de ejercicio:
//   info  — tarjeta de teoría.            { title, text, code? }
//   mc    — opción múltiple.               { q, code?, options[], answer: índice, explain }
//   vf    — V/F de la Tarea 1D.            { q, code?, statements[5], truth: 'VVFFV', options[5], why[5] }
//   fill  — rellenar el hueco ___.         { q, code, options[], answer, explain }
//   order — montar la orden con fichas.    { q, answer: 'orden completa', extra[], explain }
//   bug   — tocar la línea con el error.   { q, lines[], answer: índice, explain }
//   term  — terminal simulada.             { q, setup[], check(sh, last), hint, solution, opts? }
// En los textos, `así` se pinta como código y **así** en negrita.

const H = '/home/bio_alumno';
const T = `${H}/trabajo-1a`;
const C = `${H}/trabajo-1c`;
const ONE_C = { trabajo1c: true };

// Una línea puede llevar varias órdenes (a; b && c): vale si alguna coincide.
const segs = line => [line.trim(), ...line.split(/\s*(?:;|&&)\s*/).map(s => s.trim())];
const ran = re => (sh, last) => segs(last.line).some(s => re.test(s)) && last.status === 0;
const ranAny = re => (sh, last) => segs(last.line).some(s => re.test(s));
const isDir = p => sh => sh.fs.get(p)?.type === 'd';
const isFile = p => sh => sh.fs.get(p)?.type === 'f';
const gone = p => sh => !sh.fs.get(p);
const cwdIs = p => sh => sh.cwd === p;
const fileHas = (p, re) => sh => { const n = sh.fs.get(p); return !!n && n.type === 'f' && re.test(n.content); };
const outHas = re => (sh, last) => re.test(last.text);
const all = (...fs) => (sh, last) => fs.every(f => f(sh, last));

// sasa-args.sh de la Tarea 1C (tal cual se entregó).
const SASA_ARGS = `#!/bin/bash
# sasa-args.sh: sasa-lote.sh con los codigos PDB como argumentos.
# Uso: ./sasa-args.sh 1crn 1hvr 1ake

if [ "$#" -eq 0 ]; then
    echo "Uso: $0 codigo1 [codigo2 ...]"
    exit 1
fi

for id in "$@"; do
    pdb_fetch "$id" > "$id.pdb"
    echo "== $id"
    pdb_wc "$id.pdb" | grep residues
    freesasa "$id.pdb" | grep -E 'Total|Apolar'
done
`;

// Combinaciones de una pregunta V/F: la correcta y cuatro parecidas, en un orden fijo.
const FLIPS = [[0], [1], [2], [3], [4], [0, 1], [1, 2], [2, 3], [3, 4], [0, 4], [1, 3], [0, 2]];
function combos(truth, seed) {
  const flip = (s, idx) => s.split('').map((c, i) => (idx.includes(i) ? (c === 'V' ? 'F' : 'V') : c)).join('');
  const out = [];
  for (let k = 0; out.length < 4; k++) {
    const c = flip(truth, FLIPS[(seed * 7 + k * 5) % FLIPS.length]);
    if (c !== truth && !out.includes(c)) out.push(c);
  }
  out.splice(seed % 5, 0, truth);
  return out;
}
let vfSeed = 0;
const vf = (q, statements, truth, why, options) => ({
  type: 'vf', q, statements, truth, why, options: options || combos(truth, ++vfSeed),
});

// ─────────────────────────── Preguntas de la Tarea 1D (enunciado real) ───────────────────────────
export const T1D = {
  filezilla: vf('Tarea 1D · Nº 1 · Sobre FileZilla', [
    'Sirve para pasar ficheros en los dos sentidos entre el servidor y el portátil.',
    'En el campo *Host* se escribe la dirección IP del servidor.',
    'Solo funciona con ficheros que se hayan clonado antes con `git clone`.',
    'Hay que indicar siempre un puerto distinto del que aparece por defecto.',
    'Para descargar un fichero, se arrastra del panel del servidor al panel del portátil.',
  ], 'VVFFV', [
    'Sube y baja ficheros (SFTP) en ambos sentidos.',
    'Host = la IP del servidor, como en MobaXterm.',
    'Transfiere cualquier fichero; Git no tiene nada que ver.',
    'Se usa el puerto por defecto de SSH/SFTP (22).',
    'Del panel remoto (derecha) al local (izquierda).',
  ], ['VVFFV', 'VVVFV', 'VFFFV', 'VVFVV', 'FVFFV']),
  git: vf('Tarea 1D · Nº 2 · Sobre el repositorio del curso y Git', [
    'Un *commit* es un conjunto de cambios subido al repositorio.',
    'Git solo permite trabajar con la versión más reciente; las anteriores se pierden.',
    '`git clone`, sin más parámetros, trae la última versión del repositorio.',
    'Si el repositorio cambia después de clonarlo, el clon del servidor se actualiza solo.',
    'Clonar un repositorio es traer una copia de él al directorio en el que se está trabajando.',
  ], 'VFVFV', [
    'Cada commit registra un conjunto de cambios.',
    'Git guarda el historial: las versiones anteriores siguen ahí.',
    'Trae la versión actual (con su historial).',
    'No: hay que hacer `git pull` para actualizarlo.',
    'Crea la carpeta del repo dentro del directorio actual.',
  ], ['VFVVV', 'VFVFV', 'VVVFV', 'VFFFV', 'FFVFV']),
  more: vf('Tarea 1D · Nº 3 · Sobre la lectura de `1hvr.pdb`', [
    '`cat 1hvr.pdb` desborda la pantalla porque el fichero tiene muchas líneas.',
    'Con `more 1hvr.pdb`, la indicación «More (1%)» significa que se está viendo el 1 % del fichero.',
    'En `more`, la tecla Enter avanza línea a línea.',
    'En `more`, la barra espaciadora avanza línea a línea.',
    '`ejemplo.pdb`, el fichero del curso, contiene una proteína real completa.',
  ], 'VVVFF', [
    'Tiene miles de líneas: cat lo suelta todo de golpe.',
    'Es el porcentaje del fichero que llevas visto.',
    'Enter = una línea más.',
    'El espacio avanza una **página**, no una línea.',
    'Es la crambina **recortada** (unas pocas líneas).',
  ], ['VVVVF', 'VVFFF', 'VVVFF', 'VFVFF', 'VVVFV']),
  while07: vf('Tarea 1D · Nº 4 · Sobre este script, ejecutado como `./07-while.sh a dos tres`', [
    'Imprime tres líneas: `Parámetro: a`, `Parámetro: dos` y `Parámetro: tres`.',
    '`shift` desplaza los argumentos: el que era `$2` pasa a ser `$1`.',
    'El bucle termina cuando ya no queda ningún argumento en `$1`.',
    'Si se comenta la línea `shift` con `#`, el bucle termina después de imprimir `Parámetro: a`.',
    'Un bucle infinito se interrumpe con Ctrl+C.',
  ], 'VVVFV', [
    'Una línea por argumento.',
    'Eso es exactamente lo que hace shift.',
    '`[ -n "$1" ]` pasa a ser falso.',
    'Sin shift, $1 nunca cambia: bucle **infinito** imprimiendo `Parámetro: a`.',
    'Ctrl+C corta el proceso.',
  ], ['VVVVV', 'VFVFV', 'VVFFV', 'VVVFV', 'FVVFV']),
  mils: vf('Tarea 1D · Nº 5 · Sobre `11-asignar-mils.sh`', [
    'Si se ejecuta solo la línea `mils="ls -l"`, no aparece nada en pantalla.',
    'La línea `mils` produce el error `command not found`.',
    'El mensaje de error indica el nombre del script y el número de línea.',
    'La línea `$mils` ejecuta `ls -l`.',
    'La línea `echo "$mils"` vuelve a ejecutar `ls -l`.',
  ], 'VVVVF', [
    'Una asignación no imprime nada.',
    'Sin $, bash busca una orden llamada mils.',
    '`11-asignar-mils.sh: line 7: mils: command not found`.',
    '$mils se sustituye por `ls -l` y se ejecuta.',
    'echo solo **imprime** el texto `ls -l`.',
  ], ['VVVVV', 'VVFVF', 'VFVVF', 'VVVFF', 'VVVVF']),
  depurar: vf('Tarea 1D · Nº 6 · Sobre la búsqueda de errores en un script', [
    'Comentar con `#` todas las líneas salvo una sirve para aislar el efecto de esa línea.',
    'Una línea que empieza por `#` se ejecuta, pero su salida no se muestra.',
    'Añadir órdenes `echo` ayuda a ver qué valor tiene cada variable en cada paso.',
    'El número de línea que da el mensaje de error ayuda a localizar el fallo.',
    'Un programador con experiencia escribe código sin errores, así que los mensajes de error son poco frecuentes.',
  ], 'VFVVF', [
    'Así ves qué hace esa línea sola.',
    'Una línea con # **no se ejecuta**: es un comentario.',
    'Es la depuración más simple (bash -x lo hace automático).',
    '`line 7:` te lleva directo.',
    'Todo el mundo comete errores: hay que leerlos.',
  ], ['VFVVF', 'VVVVF', 'VFVVV', 'FFVVF', 'VFFVF']),
  ifgrep: vf('Tarea 1D · Nº 7 · Sobre `03-if-grep.sh` (`ejemplo.pdb` contiene líneas ATOM)', [
    'Con un fichero vacío, `./03-if-grep.sh sin_atom.txt` imprime `No encontrada la palabra ATOM en sin_atom.txt`.',
    'Si se ejecuta sin argumentos, el script usa `ejemplo.pdb`.',
    'Si se ejecuta sin argumentos, imprime `No encontrada la palabra ATOM en ejemplo.pdb`.',
    'Probar el script con un fichero vacío es un contraejemplo para comprobar que funciona.',
    'El fichero vacío `sin_atom.txt` se puede crear con `touch sin_atom.txt`.',
  ], 'VVFVV', [
    'grep -q no encuentra nada → rama else.',
    'Por `fichero=${1:-ejemplo.pdb}`.',
    'ejemplo.pdb **sí** tiene ATOM: imprime «Encontrada…».',
    'Comprueba el caso en que la respuesta debe ser «no».',
    'touch crea un fichero vacío.',
  ], ['VVVVV', 'VVFVV', 'VFFVV', 'VVFVF', 'FVFVV']),
  chatIA: vf('Tarea 1D · Nº 8 · Sobre el uso de un chat de IA (Gemini) para programar', [
    'La seguridad con la que redacta la respuesta garantiza que sea correcta.',
    'Usado como chat, no tiene acceso a los ficheros del servidor: hay que copiar y pegar el código o subir el fichero.',
    'Si el código que propone parece razonable, no hace falta ejecutarlo para comprobarlo.',
    'La respuesta se genera token a token, y el coste de las consultas depende del número de tokens.',
    'La misma pregunta puede dar respuestas distintas.',
  ], 'FVFVV', [
    'La seguridad aparente es independiente de la exactitud.',
    'El usuario es el único canal entre asistente y servidor.',
    'Toda propuesta se comprueba antes de darla por buena.',
    'Genera la continuación más probable, token a token.',
    'Dos ejecuciones del mismo prompt pueden diferir.',
  ], ['VVFVV', 'FVVVV', 'FVFVV', 'FVFFV', 'FFFVV']),
  prompt: vf('Tarea 1D · Nº 9 · Sobre cómo pedir ayuda a una herramienta de IA', [
    'Un *prompt* corto y general da mejores resultados que uno con contexto.',
    'Un buen *prompt* incluye contexto, encargo, límites y condición de parada.',
    'Conviene no dar contexto para que la respuesta sea más general.',
    'Si un agente de IA trabaja dentro del servidor, no hace falta ponerle límites, porque no se equivoca.',
    'La respuesta puede salir de su memoria, que tiene una fecha de corte, o de búsquedas en la web.',
  ], 'FVFFV', [
    'Sin contexto, el modelo rellena con supuestos propios.',
    'Las cuatro piezas del prompt anclado.',
    'El contexto descarta respuestas para otro sistema.',
    'Un agente también se equivoca, y además ejecuta órdenes: hay que revisar.',
    'Depende del entrenamiento (con fecha de corte) y, en su caso, de la web.',
  ], ['VVFFV', 'FVVFV', 'FVFVV', 'FVFFV', 'FFFFV']),
  pdbtools: vf('Tarea 1D · Nº 10 · Sobre `pdb_fetch`, `pdb_wc` y FreeSASA', [
    '`pdb_fetch 1crn` necesita que el fichero de la proteína esté ya en el servidor.',
    '`pdb_fetch 1crn > 1crn.pdb` guarda la estructura en el fichero `1crn.pdb`.',
    '`pdb_wc` resume el número de modelos, cadenas, residuos, átomos y heteroátomos.',
    'La versión de FreeSASA no influye en el resultado, así que no hace falta anotarla.',
    'La SASA es la superficie de la proteína accesible al disolvente y se expresa en Å².',
  ], 'FVVFV', [
    'pdb_fetch la **descarga** del PDB.',
    'Con > la salida va al fichero.',
    'Es un wc que entiende la estructura.',
    'La versión se anota (2.1.2): forma parte de la reproducibilidad.',
    'Superficie accesible al disolvente, en Å² (la salida pone A^2).',
  ], ['VVVFV', 'FVVVV', 'FFVFV', 'FVFFV', 'FVVFV']),
};

// ─────────────────────────────────────────── TEMARIO ───────────────────────────────────────────

export const SECTIONS = [
  { id: 's1', title: 'Primeros pasos', desc: 'Tema 1A · conectarse, moverse y manejar ficheros' },
  { id: 's2', title: 'Combinar órdenes', desc: 'Tema 1A · redirección, tuberías y filtros' },
  { id: 's3', title: 'Scripts de bash', desc: 'Tema 1A · permisos, variables, condiciones y bucles' },
  { id: 's4', title: 'IA con criterio', desc: 'Tema 1B · preguntar con datos y comprobar' },
  { id: 's5', title: 'Bioinformática estructural', desc: 'Tema 1C · pdb_fetch, pdb_wc y FreeSASA' },
  { id: 's6', title: 'Repaso de examen', desc: 'Preguntas tipo test, como en el examen' },
];

export const UNITS = [
  // ═════════════════════════════════ SECCIÓN 1 · PRIMEROS PASOS ═════════════════════════════════
  {
    id: 'terminal', section: 's1', title: 'La terminal', icon: '🖥️', color: 'green',
    desc: 'Terminal, shell, bash y el prompt.',
    lessons: [{
      title: '¿Quién hace qué?',
      exercises: [
        { type: 'info', title: 'Terminal, shell y bash', text: 'La **terminal** es la ventana donde escribes (MobaXterm). El **shell** lee lo que escribes y lo ejecuta. **bash** es el shell concreto del servidor de clase. El **prompt** te dice que bash espera una orden.', code: 'bio_alumno@ubuntu:~$' },
        { type: 'mc', q: '¿Qué programa interpreta y ejecuta las órdenes que escribes?', options: ['La terminal (MobaXterm)', 'El shell (bash)', 'El portátil', 'El prompt'], answer: 1, explain: 'La terminal solo es la ventana; quien interpreta es el shell. En clase, bash.' },
        { type: 'mc', q: '¿Qué es el prompt?', options: ['Un programa para editar', 'La línea que indica que el shell espera una orden', 'Un error', 'La contraseña'], answer: 1, explain: 'Por ejemplo `usuario@servidor:~$`.' },
        { type: 'mc', q: 'En este prompt, ¿qué es `ubuntu`?', code: 'bio_alumno@ubuntu:~$', options: ['El usuario', 'La máquina (servidor)', 'El directorio', 'El shell'], answer: 1, explain: 'usuario **@** máquina **:** directorio **$**' },
        { type: 'mc', q: 'Y en el mismo prompt, ¿qué significa `~`?', code: 'bio_alumno@ubuntu:~$', options: ['Que hay un error', 'Tu directorio HOME', 'La raíz /', 'Que eres administrador'], answer: 1, explain: '`~` abrevia `/home/tu_usuario`.' },
        { type: 'mc', q: 'Hay otros shells (zsh, csh, ksh). ¿Dónde se declara qué shell usa cada cuenta?', options: ['En /etc/passwd', 'En el portátil', 'En GitHub', 'En /tmp'], answer: 0, explain: 'La lista de shells permitidos está en /etc/shells y cada cuenta declara el suyo en /etc/passwd (se cambia con chsh -s).' },
      ],
    }],
  },
  {
    id: 'conectar', section: 's1', title: 'Conectarse al servidor', icon: '🔌', color: 'blue',
    desc: 'ssh, MobaXterm y primera comprobación.',
    lessons: [
      {
        title: 'ssh y MobaXterm',
        exercises: [
          { type: 'info', title: 'Un servidor remoto', text: 'El portátil solo abre la conexión: **las órdenes se ejecutan en el servidor** y los ficheros se quedan allí.\n\n**Windows:** MobaXterm → Session → SSH → Remote host = IP, Specify username.\n**macOS:** Terminal → `ssh usuario@IP`.', code: 'ssh usuario@192.0.2.10\nusuario@192.0.2.10\'s password:\nusuario@servidor:~$ exit' },
          { type: 'mc', q: 'Trabajando en MobaXterm, ¿dónde se ejecutan las órdenes?', options: ['En tu portátil', 'En el servidor Linux remoto', 'En los dos', 'En GitHub'], answer: 1, explain: 'Y los ficheros también se quedan en el servidor.' },
          { type: 'mc', q: 'Al escribir la contraseña no aparece nada. ¿Qué pasa?', options: ['El teclado falla', 'Es normal: no se ve al escribirla', 'El servidor está caído', 'Hay que escribirla dos veces'], answer: 1, explain: 'Ni asteriscos. Escríbela y Enter.' },
          { type: 'mc', q: 'Una dirección IPv4 es…', options: ['Cuatro números de 0 a 255 separados por puntos', 'Una palabra en inglés', 'Seis letras', 'El nombre del usuario'], answer: 0, explain: 'Por ejemplo 192.0.2.10. La real del servidor se da en clase.' },
          { type: 'order', q: 'Monta la orden para conectarte desde la Terminal de macOS (usuario `usuario`, IP `192.0.2.10`).', answer: 'ssh usuario@192.0.2.10', extra: ['exit', 'cd'], explain: 'ssh usuario@IP.' },
          { type: 'mc', q: '¿Con qué orden se cierra la sesión?', options: ['quit', 'exit', 'close', 'Ctrl+S'], answer: 1, explain: '`exit` (o `logout`).' },
        ],
      },
      {
        title: 'Primera comprobación',
        exercises: [
          { type: 'info', title: 'Las 4 órdenes del primer día', text: 'Nada más entrar, comprueba dónde estás:', code: 'hostname     # en qué máquina\nwhoami       # con qué usuario\npwd          # en qué directorio (al entrar: tu HOME)\necho $SHELL  # qué shell (debe ser /bin/bash)' },
          { type: 'term', q: 'Comprueba en qué **máquina** estás.', check: ran(/^hostname$/), hint: 'host + name', solution: 'hostname' },
          { type: 'term', q: 'Comprueba con qué **usuario** estás conectado.', check: ran(/^whoami$/), hint: '«¿quién soy?» en inglés', solution: 'whoami' },
          { type: 'term', q: '¿En qué **directorio** estás?', check: ran(/^pwd$/), hint: 'print working directory', solution: 'pwd' },
          { type: 'term', q: 'Muestra qué **shell** tienes. Debe salir `/bin/bash`.', check: all(ran(/^echo\s+("?)\$\{?SHELL\}?\1$/), outHas(/\/bin\/bash/)), hint: 'echo y la variable con $ delante', solution: 'echo $SHELL' },
          { type: 'mc', q: 'Escribes `hostname` y sale el nombre de tu portátil. ¿Qué significa?', options: ['Todo va bien', 'Estás en local: la conexión ssh no está activa', 'El servidor se llama como tu portátil', 'Falta permiso x'], answer: 1, explain: 'Tu respuesta de la tarea 2.' },
          { type: 'term', q: 'Limpia la pantalla.', check: ran(/^clear$/), hint: 'Una palabra (o Ctrl+L).', solution: 'clear' },
        ],
      },
    ],
  },
  {
    id: 'mirar', section: 's1', title: 'Mirar a tu alrededor', icon: '👀', color: 'yellow',
    desc: 'ls y sus opciones; ficheros y directorios.',
    lessons: [{
      title: 'ls',
      exercises: [
        { type: 'info', title: 'Ficheros y directorios', text: 'Un **directorio** agrupa ficheros y otros directorios. Un **fichero** guarda datos, texto o un script.\n\n`ls -l` los distingue por la primera letra: **d** directorio, **-** fichero.', code: 'ls       # qué hay\nls -l    # con detalle\nls -a    # también los ocultos (.bashrc)\nls -lr   # detalle y orden inverso' },
        { type: 'term', q: 'Mira qué hay en tu HOME.', check: ran(/^ls$/), hint: 'Dos letras.', solution: 'ls' },
        { type: 'term', q: 'Ahora con **detalle** (permisos, tamaño, fecha).', check: ran(/^ls\s+-\w*l\w*$/), hint: 'ls con la opción l', solution: 'ls -l' },
        { type: 'mc', q: '¿Cómo sabes que `datos` es un directorio?', code: 'drwxrwxr-x 2 bio_alumno bio_alumno 4096 Oct  9 10:12 datos\n-rw-rw-r-- 1 bio_alumno bio_alumno    0 Oct  9 10:12 nota.txt', options: ['Porque pesa 4096', 'Porque su línea empieza por d', 'Porque no tiene extensión', 'Porque tiene x'], answer: 1, explain: 'Tu respuesta del ejercicio 2 de la tarea 1A2.' },
        { type: 'term', q: 'Muestra también los ficheros **ocultos** (los que empiezan por punto).', check: ran(/^ls\s+-\w*a\w*$/), hint: 'a de all', solution: 'ls -a' },
        { type: 'mc', q: '¿Qué hace la `-r` de `ls -l -r`?', options: ['Recursivo', 'Lista en orden inverso (de la z a la a)', 'Solo lectura', 'Borra'], answer: 1, explain: 'Tu ejercicio 4: ej04.txt salía de la z a la a.' },
        { type: 'fill', q: 'Completa para ver **todo**, ocultos incluidos, con detalle.', code: 'ls ___', options: ['-la', '-r', '-1', '-x'], answer: '-la', explain: 'Las opciones se pueden juntar: -l y -a = -la.' },
      ],
    }],
  },
  {
    id: 'rutas', section: 's1', title: 'Rutas', icon: '🧭', color: 'purple',
    desc: 'El árbol de ficheros, absolutas y relativas, cd.',
    lessons: [
      {
        title: 'El árbol de ficheros',
        exercises: [
          { type: 'info', title: 'Todo cuelga de /', text: 'Linux organiza todo en un árbol que empieza en la raíz `/`. Tu cuenta está en `/home/tu_usuario`, que se abrevia `~`.\n\nUna ruta **absoluta** empieza por `/` y vale desde cualquier sitio. Una **relativa** parte del directorio actual (**PWD**).', code: '/home/bio_alumno/trabajo-1a   # absoluta\ntrabajo-1a                    # relativa (desde ~)\n..                            # el de arriba\n.                             # el actual' },
          { type: 'mc', q: '¿Cuál es **absoluta**?', options: ['trabajo-1a/ejemplo.pdb', '../tarea2', '/home/bio_alumno/tarea2', 'datos/nota.txt'], answer: 2, explain: 'Empieza por `/`.' },
          { type: 'mc', q: '¿Qué significa `..`?', options: ['El directorio actual', 'El directorio padre (un nivel arriba)', 'La raíz', 'El HOME'], answer: 1, explain: '`.` es el actual; `..`, el de arriba.' },
          { type: 'mc', q: '¿Cuál **depende** de dónde estés?', code: 'cd ~\ncd\ncd /home/bio_alumno\ncd ../..', options: ['cd ~', 'cd', 'cd /home/bio_alumno', 'cd ../..'], answer: 3, explain: 'Tu respuesta 1 de la tarea 1A2: `..` sube desde donde estás.' },
          { type: 'term', q: 'Entra en `trabajo-1a`.', check: cwdIs(T), hint: 'cd y el nombre', solution: 'cd trabajo-1a' },
          { type: 'term', q: 'Entra en `tema-1a-linux` del repositorio de clase **con una sola orden** desde HOME.', check: cwdIs(`${H}/bioinformatica_26-27/tema-1a-linux`), hint: 'Ruta relativa con / entre carpetas.', solution: 'cd bioinformatica_26-27/tema-1a-linux' },
        ],
      },
      {
        title: 'Moverse sin perderse',
        exercises: [
          { type: 'info', title: 'cd', code: 'cd dir   # entrar\ncd ..    # subir un nivel\ncd ~     # volver a HOME\ncd       # también vuelve a HOME', text: 'Con estas te mueves por todo el servidor.' },
          { type: 'fill', q: 'Completa para **subir un nivel**.', code: 'cd ___', options: ['..', '.', '~', '/'], answer: '..', explain: '`..` es el padre.' },
          { type: 'term', q: 'Estás dentro de `scripts`. Sube **un** nivel.', setup: ['mkdir -p ~/tarea1a2/scripts', 'cd ~/tarea1a2/scripts'], check: cwdIs(`${H}/tarea1a2`), hint: 'Dos puntos.', solution: 'cd ..' },
          { type: 'term', q: 'Estás en `/bin`. Vuelve a tu HOME.', setup: ['cd /bin'], check: cwdIs(H), hint: 'cd ~', solution: 'cd ~' },
          { type: 'order', q: 'Ve de una vez a `scripts`, dentro de `tarea1a2`, en tu HOME.', answer: 'cd ~/tarea1a2/scripts', extra: ['/tarea1a2', '..'], explain: '`~/` funciona desde cualquier sitio.' },
          { type: 'bug', q: 'De tu historial. ¿Qué línea falla?', lines: ['cd ~', 'cd~', 'pwd'], answer: 1, explain: 'Falta el espacio: `cd~: command not found`.' },
          { type: 'mc', q: 'Desde HOME, `cd /directorio_1` falla aunque `~/directorio_1` existe. ¿Por qué?', options: ['Falta -r', 'La / del principio la hace absoluta: busca en la raíz', 'Los nombres no pueden llevar números', 'Falta x'], answer: 1, explain: 'Otro clásico de tu historial.' },
          { type: 'mc', q: '`mkdir /home/bio_2487816/directorio_1` → *No such file or directory*. ¿Qué pasa?', options: ['Ya existía', 'Errata: /home/bio_2487816 no existe', 'mkdir necesita -r', 'No se puede crear en HOME'], answer: 1, explain: 'Un dígito de más. Usa `~`.' },
        ],
      },
    ],
  },
  {
    id: 'crear', section: 's1', title: 'Crear y organizar', icon: '📁', color: 'orange',
    desc: 'mkdir, touch, cp, mv, rm.',
    lessons: [
      {
        title: 'Crear y copiar',
        exercises: [
          { type: 'info', title: 'Crear y copiar', code: 'mkdir datos          # crea un directorio\ntouch nota.txt       # crea un fichero vacío\ncp nota.txt datos/   # copia un fichero\ncp -r datos copia    # copia un directorio entero', text: 'Así se monta la carpeta de una tarea.' },
          { type: 'term', q: 'Crea un directorio `datos`.', setup: ['mkdir ~/tarea1a2', 'cd ~/tarea1a2'], check: isDir(`${H}/tarea1a2/datos`), hint: 'make directory', solution: 'mkdir datos' },
          { type: 'term', q: 'Crea un fichero **vacío** `nota.txt`.', setup: ['mkdir -p ~/tarea1a2/datos', 'cd ~/tarea1a2'], check: isFile(`${H}/tarea1a2/nota.txt`), hint: 'touch', solution: 'touch nota.txt' },
          { type: 'term', q: 'Copia `nota.txt` dentro de `datos`.', setup: ['mkdir -p ~/tarea1a2/datos', 'cd ~/tarea1a2', 'touch nota.txt'], check: isFile(`${H}/tarea1a2/datos/nota.txt`), hint: 'cp origen destino', solution: 'cp nota.txt datos' },
          { type: 'mc', q: '`cp datos datos_copia`, siendo `datos` un directorio:', options: ['Copia todo', "cp: -r not specified; omitting directory 'datos'", 'Borra datos', 'Crea un vacío'], answer: 1, explain: 'Tu respuesta 3: sin -r solo copia ficheros.' },
          { type: 'term', q: 'Copia el directorio `datos` entero como `datos_copia`.', setup: ['mkdir -p ~/tarea1a2/datos', 'cd ~/tarea1a2', 'touch datos/nota.txt'], check: isFile(`${H}/tarea1a2/datos_copia/nota.txt`), hint: 'cp recursivo', solution: 'cp -r datos datos_copia' },
          { type: 'bug', q: '¿Cuál está mal escrita?', lines: ['mkdir carpeta_1', 'mkadir carpeta_2', 'mkdir carpeta_3'], answer: 1, explain: '`mkadir: command not found`. Usa Tab para autocompletar.' },
          { type: 'mc', q: '`mkdir datos` por segunda vez:', options: ['Nada, lo sobrescribe', "mkdir: cannot create directory ‘datos’: File exists", 'Borra el contenido', 'Crea datos(1)'], answer: 1, explain: 'Ya existe y no lo toca.' },
        ],
      },
      {
        title: 'Mover y borrar',
        exercises: [
          { type: 'info', title: 'Mover y borrar', code: 'mv a b         # mover o renombrar\nrm fichero     # borrar fichero\nrm -r dir      # borrar directorio y contenido\nrmdir dir      # borrar directorio VACÍO', text: '**En la terminal no hay papelera.**' },
          { type: 'term', q: 'Renombra `datos_copia` a `copia_seguridad`.', setup: ['mkdir -p ~/tarea1a2/datos_copia', 'cd ~/tarea1a2'], check: all(isDir(`${H}/tarea1a2/copia_seguridad`), gone(`${H}/tarea1a2/datos_copia`)), hint: 'Renombrar = mover.', solution: 'mv datos_copia copia_seguridad' },
          { type: 'mc', q: 'Haces `rm -r copia_seguridad`. ¿Cómo la recuperas?', options: ['De la papelera', 'Con undo', 'No se puede: no hay papelera', 'Con cd ..'], answer: 2, explain: 'Tu respuesta 3.' },
          { type: 'term', q: 'Borra `copia_seguridad` con todo lo que contiene.', setup: ['mkdir -p ~/tarea1a2/copia_seguridad', 'touch ~/tarea1a2/copia_seguridad/nota.txt', 'cd ~/tarea1a2'], check: gone(`${H}/tarea1a2/copia_seguridad`), hint: 'rm con opción para directorios', solution: 'rm -r copia_seguridad' },
          { type: 'mc', q: '`rmdir datos` responde *Directory not empty*. ¿Por qué?', options: ['No existe', 'rmdir solo borra directorios vacíos', 'Falta sudo', 'Falta -f'], answer: 1, explain: 'Para uno con contenido: `rm -r`.' },
          { type: 'bug', q: '¿Qué línea no copia el directorio?', lines: ['cd ~', 'cd -r carpeta_1 directorio_1', 'ls -l'], answer: 1, explain: 'Es `cp -r`; con `cd -r` sale `cd: -r: invalid option`.' },
        ],
      },
    ],
  },
  {
    id: 'ver', section: 's1', title: 'Ver ficheros y pedir ayuda', icon: '📄', color: 'blue',
    desc: 'cat, head, tail, wc, file, more, less, man.',
    lessons: [
      {
        title: 'cat, head, tail y wc',
        exercises: [
          { type: 'info', title: 'Mirar dentro', code: 'cat f        # entero\nhead -n 5 f  # 5 primeras líneas\ntail -n 5 f  # 5 últimas\nwc -l f      # cuántas líneas\nfile f       # qué tipo de fichero es', text: 'Para ver el contenido sin editarlo.' },
          { type: 'term', q: 'Muestra `ejemplo.pdb` entero.', setup: ['cd ~/trabajo-1a'], check: ran(/^cat\s+ejemplo\.pdb$/), hint: 'La más corta.', solution: 'cat ejemplo.pdb' },
          { type: 'fill', q: 'Solo las **2 primeras** líneas.', code: 'head ___ 2 ejemplo.pdb', options: ['-n', '-l', '-c', '-2'], answer: '-n', explain: '`-n N`.' },
          { type: 'term', q: 'Muestra la **última** línea de `ejemplo.pdb`.', setup: ['cd ~/trabajo-1a'], check: all(ranAny(/^tail\s+(-n\s*1|-1)\s+ejemplo\.pdb$/), outHas(/^END\s*$/m)), hint: 'tail -n 1', solution: 'tail -n 1 ejemplo.pdb' },
          { type: 'term', q: '¿Cuántas líneas tiene `ejemplo.pdb`?', setup: ['cd ~/trabajo-1a'], check: ran(/^wc\s+(-l\s+)?ejemplo\.pdb$/), hint: 'wc -l', solution: 'wc -l ejemplo.pdb' },
          { type: 'mc', q: '`file 00-clear-date.sh /bin/ls` dice…', options: ['Los dos son texto', 'El primero es un script de bash; /bin/ls, un programa compilado (ELF)', 'Los dos son scripts', 'Error'], answer: 1, explain: 'Tu ejercicio 9.' },
          { type: 'mc', q: 'Escribes `cat` sin nada más y se queda "colgado". ¿Qué haces?', options: ['Cerrar MobaXterm', 'Ctrl+C', 'exit', 'Esperar'], answer: 1, explain: 'Sin fichero, cat lee del teclado.' },
        ],
      },
      {
        title: 'more, less y man',
        exercises: [
          { type: 'info', title: 'Ficheros largos', text: '`cat 1HVR.pdb` desborda la pantalla: tiene miles de líneas. Para leerlo **por páginas**:', code: 'more 1HVR.pdb   # Enter: una línea · Espacio: una página · q: salir\n                # abajo pone «More (1%)»: el % visto\nless 1HVR.pdb   # igual, y además deja volver atrás\nman ls          # manual de una orden (q para salir)\nls --help       # ayuda corta' },
          { type: 'mc', q: 'En `more`, ¿qué hace la barra espaciadora?', options: ['Avanza una línea', 'Avanza una página', 'Sale', 'Busca'], answer: 1, explain: 'Enter avanza una línea; espacio, una página.' },
          { type: 'mc', q: '`more 1hvr.pdb` muestra abajo «More (1%)». ¿Qué significa?', options: ['Que falta el 99 % de memoria', 'Que llevas visto el 1 % del fichero', 'Que hay un 1 % de errores', 'Que es la página 1'], answer: 1, explain: 'Pregunta 3 de la Tarea 1D.' },
          { type: 'mc', q: '¿Cómo se sale de `man` o de `less`?', options: ['Ctrl+X', 'q', 'exit', ':wq'], answer: 1, explain: 'q de quit.' },
          { type: 'term', q: 'Abre el manual de `grep`.', check: ran(/^man\s+grep$/), hint: 'man y la orden', solution: 'man grep' },
          { type: 'term', q: 'Lee `1HVR.pdb` página a página con `more`.', setup: ['cd ~/trabajo-1a'], check: ran(/^more\s+1HVR\.pdb$/), hint: 'more fichero', solution: 'more 1HVR.pdb' },
          T1D.more,
        ],
      },
    ],
  },
  {
    id: 'editar', section: 's1', title: 'Editar: vi y nano', icon: '✏️', color: 'purple',
    desc: 'Editar ficheros sin ratón.',
    lessons: [
      {
        title: 'vi y sus dos modos',
        exercises: [
          { type: 'info', title: 'vi tiene dos modos', text: 'En el servidor no hay ratón ni menú Archivo. vi tiene:\n\n**Edición** (al abrir): órdenes como `dd`, `u`, `:w`, `:q`.\n**Inserción**: escribir texto. Abajo pone `-- INSERT --`.', code: 'Esc + i    → inserción\nEsc Esc    → edición' },
          { type: 'mc', q: 'Abres un fichero con vi. ¿En qué modo estás?', options: ['Inserción', 'Edición', 'Visual', 'Ninguno'], answer: 1, explain: 'Si tecleas letras, son órdenes.' },
          { type: 'mc', q: '¿Qué tecla te pone a escribir?', options: ['w', 'i', 'q', 'd'], answer: 1, explain: 'i de insert.' },
          { type: 'mc', q: 'Para volver al modo edición:', options: ['Enter', 'Esc', 'Ctrl+X', ':q'], answer: 1, explain: 'Si dudas: Esc Esc.' },
          { type: 'mc', q: '¿Qué borra la línea del cursor?', options: ['x', 'dd', 'Supr', ':d'], answer: 1, explain: '`dd`; `10dd` borra 10.' },
          { type: 'mc', q: '¿Cómo deshaces?', options: ['Ctrl+Z', 'u', ':undo!', 'Esc'], answer: 1, explain: 'u (undo).' },
          { type: 'mc', q: '`yy` copia la línea. ¿Qué la pega debajo?', options: ['v', 'p', 'Ctrl+V', 'y'], answer: 1, explain: 'p (paste).' },
        ],
      },
      {
        title: 'Guardar, salir y nano',
        exercises: [
          { type: 'info', title: 'Guardar y salir', code: ':w     guardar\n:q     salir\n:wq    guardar y salir\n:q!    salir SIN guardar\n\nnano:  Ctrl+O guarda · Ctrl+X sale', text: 'Siempre desde modo edición (Esc Esc).' },
          { type: 'fill', q: 'Guardar y salir de vi.', code: ':___', options: ['wq', 'q!', 'x!', 'save'], answer: 'wq', explain: 'write + quit.' },
          { type: 'mc', q: 'Salir **sin guardar**:', options: [':wq', ':q', ':q!', 'Ctrl+C'], answer: 2, explain: 'El ! descarta los cambios.' },
          { type: 'mc', q: 'En **nano**, ¿qué guarda?', options: ['Ctrl+S', 'Ctrl+O', 'Ctrl+X', ':w'], answer: 1, explain: 'Ctrl+O (write Out); Ctrl+X sale.' },
          { type: 'term', q: 'Crea `atomos.txt` vacío y comprueba con `ls -l` que pesa 0.', setup: ['cd ~/trabajo-1a'], check: all(isFile(`${T}/atomos.txt`), ran(/^ls\s+-l\s+atomos\.txt$/)), hint: 'touch atomos.txt; ls -l atomos.txt', solution: 'touch atomos.txt; ls -l atomos.txt' },
          { type: 'term', q: 'Ábrelo con **vi**, escribe `ATOM 1 N ALA A 1` y guarda con `:wq`.', setup: ['cd ~/trabajo-1a', 'touch atomos.txt'], check: fileHas(`${T}/atomos.txt`, /ATOM/), hint: 'vi atomos.txt → i → escribe → Esc → :wq', solution: 'vi atomos.txt' },
          { type: 'mc', q: 'Tras salir de vi, ¿cómo compruebas que se guardó?', options: ['vi otra vez', 'cat atomos.txt (y ls -l: ya no pesa 0)', 'rm atomos.txt', 'mkdir atomos.txt'], answer: 1, explain: '«Nunca os creáis lo que acabáis de hacer: comprobadlo».' },
        ],
      },
    ],
  },
  {
    id: 'transferir', section: 's1', title: 'Pasar ficheros: FileZilla', icon: '📦', color: 'green',
    desc: 'Mover ficheros entre el portátil y el servidor.',
    lessons: [{
      title: 'FileZilla y el panel SFTP',
      exercises: [
        { type: 'info', title: 'Del servidor al portátil (y al revés)', text: '**FileZilla** pasa ficheros en los **dos sentidos** por SFTP:\n\n**Host:** la IP del servidor · **Usuario** y **contraseña:** los de ssh · **Puerto:** el de por defecto (22).\n\nA la izquierda, tu portátil; a la derecha, el servidor. Para **descargar**, arrastra del panel del servidor al del portátil.\n\nMobaXterm hace lo mismo con su panel **SSH browser (SFTP)** de la izquierda (clic derecho → Download).' },
        { type: 'mc', q: '¿Para qué sirve FileZilla?', options: ['Para escribir scripts', 'Para pasar ficheros entre el portátil y el servidor, en los dos sentidos', 'Para clonar repositorios', 'Para ejecutar bash'], answer: 1, explain: 'Sube y baja ficheros.' },
        { type: 'mc', q: '¿Qué va en el campo **Host**?', options: ['Tu nombre', 'La IP del servidor', 'La ruta del fichero', 'El puerto 8080'], answer: 1, explain: 'La misma IP que en MobaXterm.' },
        { type: 'mc', q: '¿Hace falta cambiar el puerto?', options: ['Sí, siempre', 'No: se usa el de por defecto', 'Solo los lunes', 'Solo con Git'], answer: 1, explain: 'SFTP usa el puerto de SSH (22).' },
        { type: 'mc', q: 'Para **descargar** un fichero al portátil:', options: ['Se arrastra del panel del servidor al del portátil', 'Se arrastra del portátil al servidor', 'Con git push', 'Con cat'], answer: 0, explain: 'Remoto → local.' },
        { type: 'mc', q: '¿Solo funciona con ficheros clonados con `git clone`?', options: ['Sí', 'No: cualquier fichero de tu cuenta', 'Solo .pdb', 'Solo .txt'], answer: 1, explain: 'Git y FileZilla no tienen nada que ver.' },
        { type: 'mc', q: 'Has generado `historial.txt` con `history > historial.txt`. ¿Cómo lo bajas con MobaXterm?', options: ['Con exit', 'Panel SFTP de la izquierda → refrescar → clic derecho → Download', 'Con vi', 'No se puede'], answer: 1, explain: 'Como hiciste para la entrega.' },
        T1D.filezilla,
      ],
    }],
  },
  {
    id: 'git', section: 's1', title: 'Material de clase con Git', icon: '🐙', color: 'orange',
    desc: 'git clone una vez, git pull cada clase.',
    lessons: [{
      title: 'clone, pull y la copia de trabajo',
      exercises: [
        { type: 'info', title: 'El ciclo del aula', text: 'Los scripts del curso están en un repositorio público de GitHub.\n\n**git clone** trae una copia la primera vez. **git pull**, dentro del repo, la pone al día. **git status** avisa si has tocado algo.\n\nUn **commit** es un conjunto de cambios guardado en el repositorio; Git conserva el **historial** de versiones.\n\nLa copia del repo **no se edita**: se trabaja en `~/trabajo-1a`, así pull nunca choca.' },
        { type: 'mc', q: '¿Qué orden se usa **una sola vez**, el primer día?', options: ['git pull', 'git clone', 'git status', 'git push'], answer: 1, explain: 'clone crea la carpeta bioinformatica_26-27.' },
        { type: 'mc', q: 'El profesor cambia el repositorio. ¿Tu clon del servidor se actualiza solo?', options: ['Sí', 'No: hay que hacer git pull dentro del repo', 'Solo con clone', 'Solo si reinicias'], answer: 1, explain: 'Pregunta 2 de la 1D.' },
        { type: 'mc', q: '¿Qué es un *commit*?', options: ['Un error de Git', 'Un conjunto de cambios guardado en el repositorio', 'Una copia del portátil', 'Una contraseña'], answer: 1, explain: 'Y Git guarda todos: las versiones anteriores no se pierden.' },
        { type: 'term', q: 'Aún no tienes el repositorio. Clónalo en tu HOME.', opts: { repo: false }, check: isDir(`${H}/bioinformatica_26-27/tema-1a-linux`), hint: 'git clone https://github.com/hperez-ucam/bioinformatica_26-27.git', solution: 'git clone https://github.com/hperez-ucam/bioinformatica_26-27.git' },
        { type: 'order', q: 'Actualiza el material antes de clase.', answer: 'cd ~/bioinformatica_26-27 ; git pull', extra: ['git clone', 'cd ..'], explain: 'pull solo funciona dentro del repo.' },
        { type: 'term', q: 'Ponte en el repositorio y tráete los cambios.', check: all(cwdIs(`${H}/bioinformatica_26-27`), ran(/^git\s+pull$/)), hint: 'cd ~/bioinformatica_26-27 y git pull', solution: 'cd ~/bioinformatica_26-27 && git pull' },
        { type: 'term', q: '`git pull` se queja de cambios locales. Mira qué has tocado, apártalo con stash y vuelve a hacer pull.', setup: ['cd ~/bioinformatica_26-27', 'echo "# cambio" >> tema-1a-linux/11-asignar-mils.sh'], check: all(sh => sh.history.some(h => /git\s+stash/.test(h)), ran(/git\s+pull$/)), hint: 'git status; git stash; git pull', solution: 'git status; git stash; git pull' },
        { type: 'term', q: 'Copia `12-errores.sh` y `ejemplo.pdb` del repo a `~/trabajo-1a`.', setup: ['rm -rf ~/trabajo-1a', 'mkdir ~/trabajo-1a', 'cd ~/bioinformatica_26-27'], check: all(isFile(`${T}/12-errores.sh`), isFile(`${T}/ejemplo.pdb`)), hint: 'cp acepta varios orígenes', solution: 'cp tema-1a-linux/12-errores.sh tema-1a-linux/ejemplo.pdb ~/trabajo-1a/' },
        T1D.git,
      ],
    }],
  },

  // ═════════════════════════════════ SECCIÓN 2 · COMBINAR ÓRDENES ═════════════════════════════════
  {
    id: 'redir', section: 's2', title: 'Guardar la salida', icon: '💾', color: 'blue',
    desc: '>, >> y <.',
    lessons: [{
      title: '> y >>',
      exercises: [
        { type: 'info', title: 'Redirección', code: 'ls -l > ej02.txt      # crea o SOBRESCRIBE\necho hola >> log.txt  # AÑADE al final\nsort < datos.txt      # lee de un fichero', text: 'La salida va a un fichero en vez de a la pantalla.' },
        { type: 'mc', q: '`ls -l > lista.txt` y lista.txt ya tenía cosas:', options: ['Se añade al final', 'Se sobrescribe', 'Error', 'lista(1).txt'], answer: 1, explain: 'Para añadir: >>.' },
        { type: 'fill', q: 'Guarda la ruta actual en ej01.txt.', code: 'pwd ___ ~/tarea1a2/ej01.txt', options: ['>', '|', '<', '&'], answer: '>', explain: 'Ejercicio 1 de la tarea 1A2.' },
        { type: 'term', q: 'Guarda el listado detallado en `ej02.txt`.', setup: ['mkdir -p ~/tarea1a2/datos ~/tarea1a2/resultados', 'cd ~/tarea1a2'], check: fileHas(`${H}/tarea1a2/ej02.txt`, /datos/), hint: 'ls -l > ...', solution: 'ls -l > ej02.txt' },
        { type: 'term', q: 'Guarda `uname -a` en `ej05.txt`.', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2'], check: fileHas(`${H}/tarea1a2/ej05.txt`, /x86_64/), hint: 'uname -a > ...', solution: 'uname -a > ej05.txt' },
        { type: 'term', q: 'Añade la fecha **al final** de `ej05.txt` sin borrar lo anterior.', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2', 'uname -a > ej05.txt'], check: fileHas(`${H}/tarea1a2/ej05.txt`, /x86_64[\s\S]*\d{2}:\d{2}:\d{2}/), hint: 'date >>', solution: 'date >> ej05.txt' },
        { type: 'term', q: 'Junta `respuestas.txt` y todos los `ej*.txt` en `entrega.txt` (como en la entrega de la 1A2).', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2', 'echo resp > respuestas.txt', 'echo uno > ej01.txt', 'echo dos > ej02.txt'], check: fileHas(`${H}/tarea1a2/entrega.txt`, /resp[\s\S]*uno[\s\S]*dos/), hint: 'cat respuestas.txt ej*.txt > entrega.txt', solution: 'cat respuestas.txt ej*.txt > entrega.txt' },
        { type: 'bug', q: 'Pasó en tu ejercicio 10. ¿Qué línea es el problema?', lines: ['./01-parametros.sh a b c d e > ../', 'ej10.txt', 'cat ../ej10.txt'], answer: 0, explain: 'El nombre va pegado al >: `> ../ej10.txt`.' },
      ],
    }],
  },
  {
    id: 'tuberias', section: 's2', title: 'Tuberías', icon: '🚰', color: 'yellow',
    desc: '| para encadenar órdenes.',
    lessons: [{
      title: 'La tubería |',
      exercises: [
        { type: 'info', title: 'La tubería |', text: 'La salida de una orden entra directamente en la siguiente, sin ficheros temporales.', code: 'grep ATOM ejemplo.pdb | wc -l\nhead -n 2 ej06.txt | tail -n 1\nps -ef | more' },
        { type: 'mc', q: '¿Qué ventaja tiene la tubería frente a guardar en un fichero temporal?', options: ['Ninguna', 'La salida pasa directa a la siguiente orden, sin ficheros intermedios', 'Es más segura', 'Borra los ficheros'], answer: 1, explain: 'Tu respuesta 7 de la 1A2.' },
        { type: 'term', q: 'Cuenta las líneas con ATOM de `ejemplo.pdb` con una **tubería** y `wc -l`.', setup: ['cd ~/trabajo-1a'], check: ran(/^grep\s+.*ATOM.*ejemplo\.pdb\s*\|\s*wc\s+-l$/), hint: 'grep ATOM ejemplo.pdb | wc -l', solution: 'grep ATOM ejemplo.pdb | wc -l' },
        { type: 'order', q: 'Saca **solo la segunda línea** de `ej06.txt`.', answer: 'head -n 2 ej06.txt | tail -n 1', extra: ['>', '-c'], explain: 'Las 2 primeras y, de esas, la última.' },
        { type: 'mc', q: 'Sin tubería sería: `tail -n 2 ej06.txt > temporal2.txt` y luego…', options: ['head -n 1 temporal2.txt', 'tail -n 1 temporal2.txt', 'cat temporal2.txt', 'rm temporal2.txt'], answer: 0, explain: 'Tu respuesta 7: de las dos últimas, la primera.' },
        { type: 'term', q: 'Mira **todos** los procesos página a página.', check: ran(/^ps\s+-ef\s*\|\s*(more|less)$/), hint: 'ps -ef | more', solution: 'ps -ef | more' },
        { type: 'term', q: 'Las **3 primeras** líneas ATOM de `1HVR.pdb`.', setup: ['cd ~/trabajo-1a'], check: ran(/grep.*ATOM.*1HVR\.pdb\s*\|\s*head\s+(-n\s*)?-?3$/), hint: "grep '^ATOM' 1HVR.pdb | head -n 3", solution: "grep '^ATOM' 1HVR.pdb | head -n 3" },
      ],
    }],
  },
  {
    id: 'grep', section: 's2', title: 'grep a fondo', icon: '🔎', color: 'purple',
    desc: 'Filtrar y contar líneas: -c, -v, -q, -E, ^.',
    lessons: [{
      title: 'Buscar y contar',
      exercises: [
        { type: 'info', title: 'grep', code: "grep ATOM f          # líneas que contienen ATOM\ngrep '^ATOM' f       # que EMPIEZAN por ATOM\ngrep -c '^ATOM' f    # cuántas\ngrep -v HETATM f     # las que NO\ngrep -q ATOM f       # nada: solo el código de salida (para if)\ngrep -i atom f       # sin distinguir mayúsculas\ngrep -E 'Total|Apolar' f   # una u otra", text: '`^` ancla al principio de línea; `$` al final.' },
        { type: 'fill', q: 'Cuenta las líneas que **empiezan** por ATOM.', code: "grep ___ '^ATOM' 1HVR.pdb", options: ['-c', '-v', '-q', '-n'], answer: '-c', explain: '-c cuenta.' },
        { type: 'term', q: '¿Cuántas líneas ATOM tiene `1HVR.pdb`?', setup: ['cd ~/trabajo-1a'], check: outHas(/^1826\s*$/m), hint: "grep -c '^ATOM' 1HVR.pdb", solution: "grep -c '^ATOM' 1HVR.pdb" },
        { type: 'mc', q: '¿Qué imprime `grep -q ATOM ejemplo.pdb`?', options: ['Las líneas', 'El número', 'Nada: deja el código de salida (0 si encuentra)', 'Error'], answer: 2, explain: 'Se usa en los if.' },
        { type: 'mc', q: '`grep -v HETATM 1HVR.pdb`:', options: ['Solo las HETATM', 'Las que NO contienen HETATM', 'Cuenta HETATM', 'La versión'], answer: 1, explain: '-v invierte.' },
        { type: 'term', q: 'De `1HVR.pdb`, cuántas líneas HETATM hay.', setup: ['cd ~/trabajo-1a'], check: outHas(/^64\s*$/m), hint: "grep -c '^HETATM' 1HVR.pdb", solution: "grep -c '^HETATM' 1HVR.pdb" },
        { type: 'mc', q: '¿Por qué `grep -c ATOM` y `grep -c \'^ATOM\'` pueden dar números distintos?', options: ['No pueden', 'Sin ^ también cuentan líneas que contienen ATOM en otra posición', '^ cuenta el doble', 'Por los espacios'], answer: 1, explain: 'El ancla ^ exige que empiece así.' },
        { type: 'term', q: 'Muestra solo las líneas `Total` o `Apolar` de `sasa.txt` con una sola orden.', setup: ['mkdir -p ~/trabajo-1c', 'cd ~/trabajo-1c', 'printf "== 1crn\\nTotal   :    2999.32\\nApolar  :    1969.33\\nPolar   :    1030.00\\n" > sasa.txt'], opts: ONE_C, check: all(ran(/^grep\s+-E\s+['"]?(Total\|Apolar|Apolar\|Total)['"]?\s+sasa\.txt$/), outHas(/Total[\s\S]*Apolar/)), hint: "grep -E 'Total|Apolar' sasa.txt", solution: "grep -E 'Total|Apolar' sasa.txt" },
      ],
    }],
  },
  {
    id: 'columnas', section: 's2', title: 'Columnas y recuentos', icon: '📊', color: 'orange',
    desc: 'cut, sort, uniq -c y awk.',
    lessons: [
      {
        title: 'cut, sort y uniq',
        exercises: [
          { type: 'info', title: 'Recortar y agrupar', code: "cut -c18-20 f       # caracteres 18 a 20 de cada línea\ncut -d: -f1 f       # campo 1, separado por :\nsort                # ordena\nuniq -c             # cuenta repeticiones SEGUIDAS\n\ngrep '^HETATM' 1hvr.pdb | cut -c18-20 | sort | uniq -c", text: 'En un PDB, las columnas 18-20 son el **nombre del residuo**. Por eso esta tubería cuenta qué heteroátomos hay (tu tarea 1C2).' },
          { type: 'mc', q: '¿Qué hace `cut -c18-20`?', options: ['Borra líneas 18 a 20', 'Se queda con los caracteres 18 a 20 de cada línea', 'Corta el fichero en 3', 'Cuenta caracteres'], answer: 1, explain: 'En un PDB: el nombre del residuo.' },
          { type: 'mc', q: '¿Por qué va `sort` antes de `uniq -c`?', options: ['Por estética', 'uniq solo agrupa líneas iguales que estén seguidas', 'sort cuenta', 'No hace falta'], answer: 1, explain: 'Ordenar junta las iguales.' },
          { type: 'term', q: '¿Qué heteroátomos hay en `1HVR.pdb` y cuántas líneas tiene cada uno?', setup: ['cd ~/trabajo-1a'], check: all(outHas(/18 CSO/), outHas(/46 XK2/)), hint: "grep '^HETATM' 1HVR.pdb | cut -c18-20 | sort | uniq -c", solution: "grep '^HETATM' 1HVR.pdb | cut -c18-20 | sort | uniq -c" },
          { type: 'order', q: 'Cuenta los carbonos alfa (uno por residuo) de 1crn.pdb.', answer: "grep '^ATOM' 1crn.pdb | grep -c ' CA '", extra: ['-v', 'wc'], explain: 'Cada residuo tiene un CA: así se cuentan residuos.' },
        ],
      },
      {
        title: 'awk para calcular',
        exercises: [
          { type: 'info', title: 'awk', text: 'awk lee línea a línea y separa **campos** por espacios: `$1`, `$2`, `$3`…\n\nUna regla es `patrón {acción}`. `END{…}` se ejecuta al final.', code: "awk '{print $1}' f            # primer campo\nawk '/^Total/{print $3}' f    # el 3.º campo de las líneas Total\nawk 'END{print NR}' f         # número de líneas\nawk '/^Total/{t=$3} /^Apolar/{print $3/t}' sasa.txt   # fracción apolar" },
          { type: 'mc', q: 'En la línea `Total   :    2999.32`, ¿qué es `$3`?', options: ['Total', ':', '2999.32', 'Nada'], answer: 2, explain: '$1 = Total, $2 = :, $3 = 2999.32.' },
          { type: 'mc', q: '¿Qué imprime `awk \'END{print NR}\' f`?', options: ['La última línea', 'El número de líneas', 'Nada', 'El nombre'], answer: 1, explain: 'NR = número de registro (línea).' },
          { type: 'term', q: 'Imprime solo el número (3.er campo) de las líneas que empiezan por `Total` en `sasa.txt`.', setup: ['mkdir -p ~/trabajo-1c', 'cd ~/trabajo-1c', 'printf "== 1crn\\nTotal   :    2999.32\\nApolar  :    1969.33\\n== 1hvr\\nTotal   :    9710.72\\nApolar  :    5425.23\\n" > sasa.txt'], opts: ONE_C, check: all(ranAny(/^awk\s+/), outHas(/^2999\.32\n9710\.72\n?$/)), hint: "awk '/^Total/{print $3}' sasa.txt", solution: "awk '/^Total/{print $3}' sasa.txt" },
          { type: 'term', q: 'Calcula la **fracción apolar** (Apolar / Total) de cada proteína de `sasa.txt`.', setup: ['mkdir -p ~/trabajo-1c', 'cd ~/trabajo-1c', 'printf "== 1crn\\nTotal   :    2999.32\\nApolar  :    1969.33\\n== 1hvr\\nTotal   :    9710.72\\nApolar  :    5425.23\\n" > sasa.txt'], opts: ONE_C, check: all(ranAny(/^awk\s+/), outHas(/0\.65|0\.66/), outHas(/0\.55|0\.56/)), hint: "awk '/^Total/{t=$3} /^Apolar/{print $3/t}' sasa.txt", solution: "awk '/^Total/{t=$3} /^Apolar/{print $3/t}' sasa.txt" },
        ],
      },
    ],
  },
  {
    id: 'sistema', section: 's2', title: 'Usuario, sistema y procesos', icon: '⚙️', color: 'green',
    desc: 'id, who, uname, ps, which, Ctrl+C.',
    lessons: [{
      title: '¿Quién soy y qué corre?',
      exercises: [
        { type: 'info', title: 'Usuario y sistema', code: 'id        # uid, gid y grupos\nwho       # quién está conectado\nuname -a  # kernel y arquitectura\nps        # mis procesos\nps -ef    # todos\nwhich x   # dónde está el programa x\ntype x    # interna o externa', text: 'Un **proceso** es un programa en ejecución, con su número (**PID**).' },
        { type: 'term', q: 'Muestra tu uid y tus grupos.', check: ran(/^id$/), hint: 'Dos letras.', solution: 'id' },
        { type: 'mc', q: 'El servidor es `x86_64` (uname -a). ¿Por qué importa?', options: ['No importa', 'Los programas se compilan para un sistema y arquitectura: si bajas la versión que no es, no funciona', 'Solo afecta a la velocidad', 'Es el nombre'], answer: 1, explain: 'Tu respuesta 5.' },
        { type: 'mc', q: '`ps` muestra `bash` y… `ps`. ¿Por qué?', options: ['Error', 'ps también es un proceso y se está ejecutando al hacer la foto', 'Se lanzó dos veces', 'Siempre está'], answer: 1, explain: 'Tu respuesta 6.' },
        { type: 'mc', q: '`type cd` responde *cd is a shell builtin*. ¿Y `type cut`?', options: ['cut is a shell builtin', 'cut is /usr/bin/cut', 'not found', 'keyword'], answer: 1, explain: 'cd es **interna** (parte de bash); cut, **externa** (otro programa).' },
        { type: 'term', q: '¿Dónde está instalado `freesasa`?', opts: ONE_C, check: all(ran(/^which\s+freesasa$/), outHas(/\/usr\/local\/bin\/freesasa/)), hint: 'which', solution: 'which freesasa' },
        { type: 'mc', q: '¿Qué guarda `$$`?', options: ['El código de salida', 'El PID del shell', 'Nº de argumentos', 'Nada'], answer: 1, explain: 'Útil para nombres de fichero únicos.' },
        { type: 'mc', q: 'Un proceso se ha quedado en un bucle infinito. ¿Cómo lo paras?', options: ['Ctrl+C', 'Ctrl+S', 'exit', 'Cerrar el portátil'], answer: 0, explain: 'Ctrl+C interrumpe. `timeout 1 orden` también lo corta solo.' },
      ],
    }],
  },

  // ═════════════════════════════════ SECCIÓN 3 · SCRIPTS ═════════════════════════════════
  {
    id: 'permisos', section: 's3', title: 'Permisos', icon: '🔐', color: 'red',
    desc: 'rwx, u/g/o, chmod.',
    lessons: [{
      title: 'Leer y cambiar rwx',
      exercises: [
        { type: 'info', title: 'Nueve letras', text: 'Tras el tipo (`-` o `d`) vienen 9 letras: **rwx** del dueño (u), del grupo (g) y del resto (o).\n\n**r** leer · **w** escribir (modificar o borrar) · **x** ejecutar', code: '-rwxr-xr--\n uuugggooo\n\nchmod +x s.sh     # x para todos\nchmod u+x s.sh    # x solo para el dueño\nchmod 755 s.sh    # rwxr-xr-x\nchmod 644 d.txt   # rw-r--r--' },
        { type: 'mc', q: 'En `-rwxr-xr--`, ¿qué puede hacer el **grupo**?', options: ['Todo', 'Leer y ejecutar', 'Solo leer', 'Nada'], answer: 1, explain: 'r-x.' },
        { type: 'mc', q: '¿Y el **resto**?', options: ['Leer y ejecutar', 'Solo leer', 'Escribir', 'Nada'], answer: 1, explain: 'r--.' },
        { type: 'mc', q: 'info.sh pasó de `-rw-rw-r--` a `-rwxrw-r--`. ¿Qué orden fue?', options: ['chmod +x', 'chmod u+x', 'chmod 755', 'chmod g+x'], answer: 1, explain: 'Solo la x del dueño: tu ejercicio 8.' },
        { type: 'mc', q: '`chmod 755`:', options: ['rwxr-xr-x', 'rw-r--r--', 'rwxrwxrwx', 'r-xr-xr-x'], answer: 0, explain: '7 = 4+2+1; 5 = 4+1.' },
        { type: 'mc', q: '`chmod 644` (fichero de datos):', options: ['rwxr--r--', 'rw-r--r--', 'rw-rw-rw-', 'r--r--r--'], answer: 1, explain: '6 = 4+2.' },
        { type: 'fill', q: 'Da permiso de ejecución.', code: 'chmod ___ hola.sh', options: ['+x', '-x', '+r', '644'], answer: '+x', explain: '+x añade la x.' },
        { type: 'order', q: 'rwxr-xr-x a `hola.sh` en octal.', answer: 'chmod 755 hola.sh', extra: ['644', '+r'], explain: '7 para ti, 5 grupo y otros.' },
      ],
    }],
  },
  {
    id: 'script', section: 's3', title: 'Tu primer script', icon: '📜', color: 'blue',
    desc: 'Shebang, comentarios, ./ y bash, PATH.',
    lessons: [{
      title: 'Escribir y lanzar',
      exercises: [
        { type: 'info', title: 'Un script es texto con órdenes', text: 'La primera línea, el **shebang** `#!/bin/bash`, elige el intérprete. Tras `#`, comentarios.\n\nCon la **x** puesta: `./script.sh`. Sin ella: `bash script.sh` (basta con r).\n\n`./` = «en este directorio»: el shell **no** busca en el directorio actual, solo en el **PATH**.', code: '#!/bin/bash\n# Ejemplo sencillo: limpia la pantalla y escribe la fecha.\nclear\ndate' },
        { type: 'mc', q: '¿Para qué sirve `#!/bin/bash`?', options: ['Comentario sin efecto', 'Shebang: elige el intérprete', 'Borra la pantalla', 'Da permisos'], answer: 1, explain: 'Primera línea del script.' },
        { type: 'mc', q: 'Pones `#` delante de `date` en info.sh. ¿Qué pasa?', options: ['Error', 'La fecha ya no sale: es un comentario', 'Sale dos veces', 'Se borra'], answer: 1, explain: 'Tu respuesta 8.' },
        { type: 'mc', q: '`prueba.sh` tiene `-rw-r--r--`:', code: '$ ./prueba.sh\n$ bash prueba.sh', options: ['Las dos funcionan', './ da Permission denied; bash funciona', 'Las dos fallan', './ funciona; bash falla'], answer: 1, explain: 'bash solo necesita leerlo.' },
        { type: 'mc', q: '`00-clear-date.sh` sin `./` → *command not found*. ¿Por qué?', options: ['Falta x', 'El directorio actual no está en el PATH', 'Está roto', 'Falta shebang'], answer: 1, explain: 'Por eso hace falta ./' },
        { type: 'term', q: 'Haz ejecutable `info.sh` **solo para ti** y lánzalo con `./`.', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2', 'printf \'#!/bin/bash\\n# Mi primer script\\necho " Mis procesos: "\\nps\\necho\\necho "Fecha del sistema:"\\ndate\\n\' > info.sh', 'chmod 664 info.sh'], check: all(sh => !!(sh.fs.get(`${H}/tarea1a2/info.sh`).mode & 0o100), ran(/^\.\/info\.sh$/)), hint: 'chmod u+x info.sh; ./info.sh', solution: 'chmod u+x info.sh; ./info.sh' },
        { type: 'term', q: 'Lanza `hola.sh` **sin** darle permiso de ejecución.', setup: ['cd ~/trabajo-1a', 'printf \'#!/bin/bash\\necho "Hola, $USER"\\n\' > hola.sh', 'chmod 644 hola.sh'], check: all(ran(/^bash\s+(\.\/)?hola\.sh$/), outHas(/Hola, bio_alumno/)), hint: 'bash y el nombre', solution: 'bash hola.sh' },
        { type: 'bug', q: '¿Qué línea **rompe** el PATH?', lines: ['echo $PATH', 'PATH =PATH:/usr/local/bin', 'PATH="$PATH:$HOME/bin"'], answer: 1, explain: 'Espacio en la asignación y falta el $.' },
      ],
    }],
  },
  {
    id: 'variables', section: 's3', title: 'Variables', icon: '📦', color: 'yellow',
    desc: 'var=valor, $var, comillas, export, $?.',
    lessons: [{
      title: 'Asignar y leer',
      exercises: [
        { type: 'info', title: 'Variables', text: 'Se asigna **sin espacios** en el `=`. Se lee con `$`. Sin `$`, el nombre se interpreta como una orden.', code: 'fichero=ejemplo.pdb\necho "$fichero"\nexport fichero   # la heredan los procesos hijos\n\n$?  código de salida de la última orden (0 = bien)' },
        { type: 'bug', q: '¿Qué línea está mal?', lines: ['mils = "ls -l"', 'echo "$mils"'], answer: 0, explain: 'Con espacios, `mils` se toma como orden.' },
        { type: 'fill', q: 'Muestra tu directorio HOME.', code: 'echo ___', options: ['$HOME', 'HOME', '~HOME', '$home'], answer: '$HOME', explain: 'Con $ y en mayúsculas.' },
        { type: 'term', q: 'Guarda `ejemplo.pdb` en la variable `fichero` y muéstrala.', check: all(sh => sh.top.vars.fichero === 'ejemplo.pdb', ran(/echo\s+"?\$\{?fichero\}?"?$/)), hint: 'fichero=ejemplo.pdb; echo "$fichero"', solution: 'fichero=ejemplo.pdb; echo "$fichero"' },
        { type: 'mc', q: 'En 11-asignar-mils.sh, ¿qué hace la línea `mils` (sin $)?', code: 'mils="ls -l"\nmils\n$mils\necho "$mils"', options: ['Ejecuta ls -l', 'Error: mils: command not found', 'Imprime ls -l', 'Nada'], answer: 1, explain: 'La tercera ejecuta ls -l y la cuarta imprime el texto.' },
        { type: 'mc', q: 'Local frente a de entorno:', options: ['Igual', 'La de entorno (export) la heredan los hijos; la local no', 'La local es más rápida', 'Solo en scripts'], answer: 1, explain: 'env lista las de entorno; unset borra.' },
        { type: 'term', q: 'Comprueba el código de salida de `ls` sobre un fichero que **no existe**.', setup: ['cd ~/trabajo-1a'], check: (sh, last) => segs(last.line).some(s => /^echo\s+"?\$\?"?$/.test(s)) && /^[12]\s*$/m.test(last.text), hint: 'ls no_existe.pdb; echo $?', solution: 'ls no_existe.pdb; echo $?' },
        T1D.mils,
      ],
    }],
  },
  {
    id: 'parametros', section: 's3', title: 'Parámetros', icon: '🎛️', color: 'purple',
    desc: '$0, $1, $#, "$@", shift.',
    lessons: [{
      title: 'Lo que recibe el script',
      exercises: [
        { type: 'info', title: '$0, $1, $#, "$@"', text: 'Lo que escribes detrás del script son **argumentos**; el script los recibe como **parámetros**.', code: '$0      nombre del script\n$1 $2   primero, segundo (${10} desde el diez)\n$#      cuántos han llegado\n"$@"    todos, uno a uno (la forma preferible)\nshift   descarta $1 y corre el resto\n${1:-ejemplo.pdb}  $1 o, si falta, ejemplo.pdb' },
        { type: 'mc', q: '¿Qué guarda `$#`?', options: ['El nombre', 'Cuántos argumentos han llegado', 'El PID', 'El primero'], answer: 1, explain: 'Número de parámetros.' },
        { type: 'term', q: 'Lanza `01-parametros.sh` con `a b c d e`.', setup: ['cd ~/trabajo-1a'], check: ran(/^\.\/01-parametros\.sh\s+a\s+b\s+c\s+d\s+e$/), hint: './01-parametros.sh a b c d e', solution: './01-parametros.sh a b c d e' },
        { type: 'mc', q: '`./01-parametros.sh uno dos`: ¿qué sale en la línea del **tercer** parámetro?', options: ['dos', '(vacío)', 'Error', '$3'], answer: 1, explain: 'Tu respuesta 10.' },
        { type: 'mc', q: 'En 02-shift.sh, con `uno dos tres`, ¿qué vale `$1` tras **un** shift?', options: ['uno', 'dos', 'tres', 'vacío'], answer: 1, explain: 'Todo se corre una posición.' },
        { type: 'fill', q: 'Si no hay argumento, que use ejemplo.pdb.', code: 'fichero=${1:-___}', options: ['ejemplo.pdb', '$1', '0', '"$@"'], answer: 'ejemplo.pdb', explain: 'Como 00b-contar-atom.sh y 03-if-grep.sh.' },
        { type: 'mc', q: '¿Preferible para recorrer todos los argumentos?', options: ['$*', '"$*"', '"$@"', '$#'], answer: 2, explain: '"$@" los entrega uno a uno.' },
      ],
    }],
  },
  {
    id: 'if', section: 's3', title: 'Condiciones: if', icon: '🔀', color: 'orange',
    desc: 'if, test [ ], operadores.',
    lessons: [{
      title: 'if y test',
      exercises: [
        { type: 'info', title: 'if', text: '**Espacios dentro de los corchetes** y comillas en las variables.', code: 'if [ -f "$fichero" ]; then\n    echo "Existe"\nelif [ -d "$fichero" ]; then\n    echo "Es un directorio"\nelse\n    echo "No existe"\nfi\n\ntexto:    =  !=  -n (no vacía)  -z (vacía)\nnúmeros:  -eq -ne -lt -le -gt -ge\nficheros: -e -f -d -s -r -w -x' },
        { type: 'mc', q: 'Existe **y es un fichero regular**:', options: ['-e', '-f', '-d', '-s'], answer: 1, explain: '-e existe; -d directorio; -s no vacío.' },
        { type: 'fill', q: 'Número de ATOM **igual** a 0.', code: 'if [ "$n" ___ 0 ]; then', options: ['-eq', '=', '-z', '-lt'], answer: '-eq', explain: '= compara texto.' },
        { type: 'mc', q: '`[ -z "$1" ]` comprueba que $1…', options: ['Es cero', 'Está vacío', 'Es un fichero', 'Existe'], answer: 1, explain: '-n: no vacía.' },
        { type: 'mc', q: '`if grep -q ATOM "$f"; then` — ¿con qué decide el if?', options: ['Con el texto', 'Con el código de salida de grep (0 si encuentra)', 'Con $#', 'Al azar'], answer: 1, explain: 'if decide por el valor de salida.' },
        { type: 'order', q: 'Primera línea de un if que compruebe si existe el directorio `datos`.', answer: 'if [ -d datos ] ; then', extra: ['-f', 'fi'], explain: 'Espacios alrededor de [ y ].' },
        { type: 'term', q: 'Lanza `03-if-grep.sh` con un fichero vacío `sin_atom.txt` (créalo antes).', setup: ['cd ~/trabajo-1a'], check: all(isFile(`${T}/sin_atom.txt`), outHas(/No encontrada la palabra ATOM en sin_atom\.txt/)), hint: 'touch sin_atom.txt; ./03-if-grep.sh sin_atom.txt', solution: 'touch sin_atom.txt; ./03-if-grep.sh sin_atom.txt' },
        T1D.ifgrep,
      ],
    }],
  },
  {
    id: 'case', section: 's3', title: 'Condiciones: case', icon: '🗂️', color: 'green',
    desc: 'case por patrones.',
    lessons: [{
      title: 'case',
      exercises: [
        { type: 'info', title: 'case', text: 'Elige la rama según un **patrón** glob (`*`, `?`), no una expresión regular. Cada rama acaba en `;;` y todo en `esac`.', code: 'case $1 in\n    pdb) echo "Estructura 3D" ;;\n    fasta|fa) echo "Secuencia" ;;\n    *) echo "Extensión no reconocida" ;;\nesac' },
        { type: 'mc', q: '`./04-case.sh fa` imprime…', options: ['Estructura 3D', 'Secuencia', 'Extensión no reconocida', 'Nada'], answer: 1, explain: 'fasta|fa: dos patrones, una rama.' },
        { type: 'mc', q: '`./04-case.sh xyz` imprime…', options: ['Secuencia', 'Error', 'Extensión no reconocida', 'xyz'], answer: 2, explain: '*) recoge lo demás.' },
        { type: 'fill', q: 'Dos patrones para la misma rama:', code: 'fasta___fa) echo "Secuencia" ;;', options: ['|', '||', ',', 'or'], answer: '|', explain: '| separa alternativas.' },
        { type: 'mc', q: '¿Con qué palabra se cierra un case?', options: ['done', 'fi', 'esac', 'end'], answer: 2, explain: 'case al revés.' },
        { type: 'term', q: 'Lanza `04-case.sh` con `pdb`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^(\.\/|bash\s+)04-case\.sh\s+pdb$/), outHas(/Estructura 3D/)), hint: './04-case.sh pdb', solution: './04-case.sh pdb' },
      ],
    }],
  },
  {
    id: 'for', section: 's3', title: 'Bucles: for', icon: '🔁', color: 'blue',
    desc: 'for sobre listas, seq y ficheros.',
    lessons: [{
      title: 'for',
      exercises: [
        { type: 'info', title: 'for recorre una lista', text: 'No es un contador: asigna a la variable cada palabra de la lista, una por vuelta.', code: 'for pdb in 1crn.pdb 1ake.pdb 1hvr.pdb; do\n    echo "Procesando $pdb"\ndone\n\nfor i in $(seq 0 5 25); do   # seq inicio paso fin\n    echo "i = $i"\ndone' },
        { type: 'mc', q: '¿Qué valores salen?', code: 'for i in $(seq 1 3 10); do\n    echo "$i"\ndone', options: ['1 2 3', '1 4 7 10', '1 3 10', '3 6 9'], answer: 1, explain: 'De 1 a 10 de 3 en 3.' },
        { type: 'fill', q: 'Tu línea del ejercicio 10: de 0 a 30 de 3 en 3.', code: 'for i in $(seq 0 3 30); ___', options: ['do', 'then', 'done', 'in'], answer: 'do', explain: 'for … ; do … done' },
        { type: 'term', q: 'Bucle de una línea que imprima 0, 5, 10, 15, 20, 25.', check: all(ran(/^for\s+\w+\s+in\s+/), outHas(/^0\n5\n10\n15\n20\n25\n?$|i = 0[\s\S]*i = 25/)), hint: 'for i in $(seq 0 5 25); do echo $i; done', solution: 'for i in $(seq 0 5 25); do echo $i; done' },
        { type: 'order', q: 'Recorre todos los .pdb del directorio.', answer: 'for f in *.pdb ; do', extra: ['$(seq', 'then'], explain: '*.pdb se expande a la lista.' },
        { type: 'term', q: 'Para cada `.pdb` de `trabajo-1a`, imprime su nombre y su nº de líneas ATOM.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^for\s+/), outHas(/1HVR\.pdb[\s\S]*1826|1826[\s\S]*1HVR/), outHas(/ejemplo\.pdb/)), hint: "for f in *.pdb; do echo $f $(grep -c '^ATOM' $f); done", solution: "for f in *.pdb; do echo $f $(grep -c '^ATOM' $f); done" },
      ],
    }],
  },
  {
    id: 'while', section: 's3', title: 'Bucles: while y until', icon: '🔄', color: 'purple',
    desc: 'while, until, break, continue.',
    lessons: [{
      title: 'Repetir mientras…',
      exercises: [
        { type: 'info', title: 'while y until', text: '**while** repite mientras la condición sea cierta; **until**, mientras sea falsa. **break** sale del bucle; **continue** salta a la siguiente vuelta. Un bucle infinito se corta con **Ctrl+C**.', code: 'while [ -n "$1" ]; do\n    echo "Parámetro: $1"\n    shift\ndone' },
        { type: 'mc', q: 'until repite mientras la expresión sea…', options: ['Cierta', 'Falsa', 'Vacía', 'Un número'], answer: 1, explain: '`until [ -z "$1" ]` = hasta que $1 esté vacío.' },
        { type: 'term', q: 'Lanza `07-while.sh` con `a dos tres`.', setup: ['cd ~/trabajo-1a'], check: ran(/^(\.\/|bash\s+)07-while\.sh\s+a\s+dos\s+tres$/), hint: './07-while.sh a dos tres', solution: './07-while.sh a dos tres' },
        { type: 'mc', q: '`./09-break.sh x f y` imprime…', options: ['Parámetro: x', 'x e y', 'x f y', 'Nada'], answer: 0, explain: 'Al llegar a f, break sale.' },
        { type: 'mc', q: '`./10-continue.sh x f y` imprime…', options: ['Parámetro: x', 'Parámetro: x / Parámetro: y', 'Parámetro: f', 'Error'], answer: 1, explain: 'continue se salta solo la f.' },
        { type: 'bug', q: 'Este bucle no termina nunca. ¿Tras qué línea falta algo?', lines: ['while [ -n "$1" ]; do', '    echo "Parámetro: $1"', 'done'], answer: 1, explain: 'Falta `shift`: $1 nunca cambia.' },
        { type: 'term', q: 'Comprueba el bucle infinito sin colgarte: lanza `07-sin-shift.sh a dos tres` con `timeout 1` y quédate con 5 líneas.', setup: ['cd ~/trabajo-1a', 'cp 07-while.sh 07-sin-shift.sh', "sed -i 's/    shift/    # shift/' 07-sin-shift.sh"], check: all(ranAny(/^timeout\s+1\s+(bash\s+|\.\/)07-sin-shift\.sh/), outHas(/^(Parámetro: a\n){5}$/)), hint: 'timeout 1 bash 07-sin-shift.sh a dos tres | head -5', solution: 'timeout 1 bash 07-sin-shift.sh a dos tres | head -5' },
        T1D.while07,
      ],
    }],
  },
  {
    id: 'depurar', section: 's3', title: 'Errores y depuración', icon: '🐞', color: 'red',
    desc: 'Leer los mensajes, bash -n, bash -x y el ^M.',
    lessons: [
      {
        title: 'Qué dice bash',
        exercises: [
          { type: 'info', title: 'Errores típicos', code: 'Permission denied        → falta la x: chmod +x o bash\ncommand not found        → mal escrita o falta ./\nNo such file or dir.     → ruta equivocada (pwd)\nbad interpreter ^M       → fin de línea de Windows\n[: missing ]             → falta espacio antes de ]\nunary operator expected  → variable vacía sin comillas', text: 'El mensaje dice **fichero, línea y causa**.' },
          { type: 'mc', q: '`bash: ./hola.sh: Permission denied`', options: ['Ruta mal', 'Falta x: chmod +x o bash', 'Falta espacio', 'Windows'], answer: 1, explain: 'Sin x no se lanza como programa.' },
          { type: 'mc', q: '`/bin/bash^M: bad interpreter`', options: ['Falta bash', 'Finales de línea de Windows (^M)', 'Falta shebang', 'Falta x'], answer: 1, explain: 'Al copiar desde Windows o un chat de IA.' },
          { type: 'mc', q: '¿Qué hace `bash -n script.sh`?', options: ['Ejecuta con traza', 'Revisa la sintaxis sin ejecutar', 'Ejecuta en silencio', 'Quita ^M'], answer: 1, explain: 'Detecta un fi o done que falta.' },
          { type: 'mc', q: '¿Y `bash -x script.sh`?', options: ['Revisa sintaxis', 'Ejecuta y escribe cada orden con + delante', 'Da x', 'Borra'], answer: 1, explain: 'Muestra los valores ya sustituidos.' },
          { type: 'mc', q: '¿Por qué `bash -n 12-errores.sh` no detecta nada?', options: ['Porque no hay errores', 'Porque [ es una orden y el fallo solo aparece al ejecutar', 'Porque está roto', 'Porque -n no existe'], answer: 1, explain: 'Tu tarea 1B, paso 3.' },
          { type: 'term', q: 'Ejecuta `03-if-grep.sh ejemplo.pdb` en modo **traza**.', setup: ['cd ~/trabajo-1a'], check: ran(/^bash\s+-x\s+(\.\/)?03-if-grep\.sh\s+ejemplo\.pdb$/), hint: 'bash -x …', solution: 'bash -x 03-if-grep.sh ejemplo.pdb' },
          T1D.depurar,
        ],
      },
      {
        title: 'Arreglar 12-errores.sh y 13-crlf.sh',
        exercises: [
          { type: 'bug', q: '12-errores.sh, primer error: `[: missing ]`. ¿Qué línea?', lines: ['fichero=$1', '', 'if [ -f "$fichero"]; then', '    echo "Existe $fichero"', 'fi'], answer: 2, explain: 'Falta espacio antes de ]: bash ve `ejemplo.pdb]`.' },
          { type: 'bug', q: 'Sin argumento: `unary operator expected`. ¿Qué línea?', lines: ['fichero=$1', 'if [ -f "$fichero" ]; then', '    echo "Existe $fichero"', 'fi', 'if [ $fichero = "ejemplo.pdb" ]; then', '    echo "Es el PDB de juguete"', 'fi'], answer: 4, explain: 'Vacía y sin comillas desaparece: `[ = "ejemplo.pdb" ]`.' },
          { type: 'mc', q: 'Sin argumento sale «Existe» sin nombre. ¿Por qué?', options: ['Porque existe un fichero vacío', 'Falso positivo: queda `[ -f ]`, un solo argumento no vacío, que da verdadero', 'Porque -f falla', 'Por el shebang'], answer: 1, explain: 'Tu explicación de la tarea 1B.' },
          { type: 'term', q: 'Ejecuta `12-errores.sh` con `ejemplo.pdb` en modo traza y fíjate en `\'ejemplo.pdb]\'`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^bash\s+-x\s+(\.\/)?12-errores\.sh\s+ejemplo\.pdb$/), outHas(/'ejemplo\.pdb\]'/)), hint: 'bash -x 12-errores.sh ejemplo.pdb', solution: 'bash -x 12-errores.sh ejemplo.pdb' },
          { type: 'term', q: 'Corrige una **copia**: `cp 12-errores.sh mi-12.sh`, arregla las líneas 7 y 11 con vi y lánzala sin argumento: no debe salir nada.', setup: ['cd ~/trabajo-1a'], check: (sh, last) => /mi-12\.sh$/.test(last.line.trim()) && !last.text.trim() && fileHas(`${T}/mi-12.sh`, /"\$fichero" \]/)(sh) && fileHas(`${T}/mi-12.sh`, /\[ "\$fichero" =/)(sh), hint: 'cp 12-errores.sh mi-12.sh → vi mi-12.sh → ./mi-12.sh', solution: 'cp 12-errores.sh mi-12.sh; vi mi-12.sh' },
          { type: 'term', q: 'Descubre el `^M` de la primera línea de `13-crlf.sh`.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/\^M\$/), ran(/cat\s+-A\s+13-crlf\.sh/)), hint: 'cat -A 13-crlf.sh | head -1', solution: 'cat -A 13-crlf.sh | head -1' },
          { type: 'term', q: 'Quítale los `^M` y comprueba que funciona.', setup: ['cd ~/trabajo-1a'], check: outHas(/Hola desde el servidor/), hint: "sed -i 's/\\r$//' 13-crlf.sh; ./13-crlf.sh", solution: "sed -i 's/\\r$//' 13-crlf.sh; ./13-crlf.sh" },
        ],
      },
    ],
  },
  {
    id: 'reto1a', section: 's3', title: 'Reto 1A: lote de PDB', icon: '🧬', color: 'green',
    desc: '00c-lote-pdb.sh, HETATM y resumen.txt.',
    lessons: [{
      title: 'El script complejo y el reto',
      exercises: [
        { type: 'info', title: '00c-lote-pdb.sh', text: '`$#` evita lanzarlo sin argumentos; `for f in "$@"` recorre los ficheros; `case` separa los .pdb del resto; `if [ ! -f ]` avisa de los que faltan y `continue` pasa al siguiente.', code: 'for f in "$@"; do\n  case "$f" in\n    *.pdb|*.PDB)\n      if [ ! -f "$f" ]; then\n        echo "Falta: $f"; continue\n      fi\n      n=$(grep -c \'^ATOM\' "$f")\n      echo "$f → $n ATOM" ;;\n    *) echo "Ignorado (no PDB): $f" ;;\n  esac\ndone' },
        { type: 'mc', q: '¿Para qué sirve el case?', options: ['Contar', 'Separar los .pdb del resto por su patrón', 'Descargar', 'Dar permisos'], answer: 1, explain: '*.pdb|*.PDB) frente a *).' },
        { type: 'mc', q: '`n=$(grep -c \'^ATOM\' "$f")` guarda…', options: ['El texto', 'El número de líneas ATOM', 'El nombre', 'El código de salida'], answer: 1, explain: '$( ) se sustituye por la salida.' },
        { type: 'term', q: 'Lánzalo con `1HVR.pdb ejemplo.pdb notas.txt`.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/1HVR\.pdb → 1826 ATOM/), outHas(/Ignorado/)), hint: './00c-lote-pdb.sh 1HVR.pdb ejemplo.pdb notas.txt', solution: './00c-lote-pdb.sh 1HVR.pdb ejemplo.pdb notas.txt' },
        { type: 'term', q: 'Descarga 1HVR.pdb del RCSB PDB con curl.', setup: ['mkdir -p ~/reto', 'cd ~/reto'], check: isFile(`${H}/reto/1HVR.pdb`), hint: 'curl -O https://files.rcsb.org/download/1HVR.pdb', solution: 'curl -O https://files.rcsb.org/download/1HVR.pdb' },
        { type: 'term', q: 'Reto: crea `00d-lote-hetatm.sh` (copia de 00c) que cuente también HETATM, lánzalo con `1HVR.pdb ejemplo.pdb > resumen.txt` y míralo con cat.', setup: ['cd ~/trabajo-1a', sh => {
          const src = sh.readFile(`${T}/00c-lote-pdb.sh`);
          sh.writeFile(`${T}/00d-lote-hetatm.sh`, src.replace('echo "$f → $n ATOM"', 'h=$(grep -c \'^HETATM\' "$f")\n            echo "$f → $n ATOM, $h HETATM"'));
          sh.fs.get(`${T}/00d-lote-hetatm.sh`).mode = 0o775;
        }], check: all(fileHas(`${T}/resumen.txt`, /1HVR\.pdb.*1826/), outHas(/64 HETATM/)), hint: 'Ya está copiado y editado: ./00d-lote-hetatm.sh 1HVR.pdb ejemplo.pdb > resumen.txt; cat resumen.txt', solution: './00d-lote-hetatm.sh 1HVR.pdb ejemplo.pdb > resumen.txt; cat resumen.txt' },
        { type: 'mc', q: '¿Por qué merece la pena un script así en bioinformática?', options: ['Es más bonito', 'Aplica lo mismo a un lote y deja el procedimiento escrito y reproducible', 'No hace falta Linux', 'Va en el portátil'], answer: 1, explain: 'Veinte PDB a mano, no.' },
      ],
    }],
  },

  // ═════════════════════════════════ SECCIÓN 4 · IA CON CRITERIO (1B) ═════════════════════════════════
  {
    id: 'ia-modelo', section: 's4', title: 'Cómo funciona un chat de IA', icon: '🤖', color: 'blue',
    desc: 'Tokens, alucinaciones y qué no se le cuenta.',
    lessons: [{
      title: 'Lo necesario para usarlo con criterio',
      exercises: [
        { type: 'info', title: 'Un modelo de lenguaje', text: '• Genera la continuación más probable de un texto, **token a token**.\n• Depende del entrenamiento (con **fecha de corte**), del texto que le das y, a veces, de **búsquedas web**.\n• **No tiene acceso** al servidor ni a tus ficheros: el usuario es el único canal entre ambos.\n• El mismo prompt puede dar **respuestas distintas**.\n• La **seguridad aparente** de la redacción no garantiza que sea correcta.\n\nEn clase: **Gemini** con la cuenta institucional de la UCAM.' },
        { type: 'mc', q: 'La IA responde con mucha seguridad. Eso significa que…', options: ['Es correcto', 'Nada: la seguridad aparente es independiente de la exactitud', 'Lo ha comprobado en el servidor', 'Está buscando en la web'], answer: 1, explain: 'Toda propuesta se comprueba.' },
        { type: 'mc', q: 'Le pides que revise tu script del servidor. ¿Qué tienes que hacer?', options: ['Nada, lo ve solo', 'Copiar y pegar el código (o subir el fichero)', 'Darle tu contraseña', 'Darle la IP'], answer: 1, explain: 'No tiene acceso al servidor.' },
        { type: 'mc', q: '¿Qué es una **alucinación**?', options: ['Un error de red', 'Contenido plausible pero falso: opciones, rutas o paquetes que no existen', 'Una respuesta lenta', 'Un virus'], answer: 1, explain: 'Se mide: 5,2 % de paquetes inexistentes en modelos comerciales y 21,7 % en abiertos (Spracklen et al., 2025).' },
        { type: 'mc', q: '¿Por qué alucinan los modelos, según Kalai et al. (2025)?', options: ['Por falta de memoria', 'El entrenamiento y la evaluación premian responder frente a admitir que no se sabe', 'Por los virus', 'Porque están cansados'], answer: 1, explain: 'Prefieren contestar algo plausible.' },
        { type: 'mc', q: '¿Qué **no** se mete en un chat de IA?', options: ['El enunciado de la tarea', 'Un script del repositorio de clase', 'La IP del servidor, credenciales o datos personales de compañeros', 'Un fichero público del PDB'], answer: 2, explain: 'Tampoco secuencias no publicadas de un TFG o laboratorio. Ante la duda, se pregunta al profesor.' },
        { type: 'mc', q: 'Un modelo resolvió 179 de 184 ejercicios de un curso de bioinformática (Piccolo et al., 2023). ¿Qué implica?', options: ['Que no hace falta aprender', 'Que el resultado funcione no acredita comprensión: puede pedirse explicarlo en pizarra', 'Que siempre acierta', 'Nada'], answer: 1, explain: 'Usos pertinentes: interpretar un error, primera versión, consultar sintaxis.' },
        T1D.chatIA,
      ],
    }],
  },
  {
    id: 'ia-prompt', section: 's4', title: 'El prompt anclado', icon: '🎯', color: 'yellow',
    desc: 'Contexto, encargo, límites y parada.',
    lessons: [{
      title: 'Cuatro piezas',
      exercises: [
        { type: 'info', title: 'Prompt anclado', text: '**Contexto:** fija el entorno y descarta respuestas para otro sistema.\n**Encargo:** una sola acción, verificable en el servidor.\n**Límites:** excluyen lo no admisible («no inventes opciones; si no estás seguro, dilo»).\n**Parada:** fija el formato y evita que diga que lo ha ejecutado.', code: 'Contexto: bash en un servidor Linux. Tengo un fichero PDB.\nEncargo: un script que reciba el nombre del fichero como\n  primer argumento y diga si tiene líneas ATOM.\nLímites: usa solo órdenes estándar; no inventes opciones;\n  si no estás seguro de algo, dilo.\nParada: devuelve solo el script, sin ejecutarlo.' },
        { type: 'mc', q: '«Explícame Linux y hazme el script del ejercicio». ¿Qué pasará?', options: ['Saldrá perfecto', 'Sin contexto, completa con supuestos propios: otro sistema, otro fichero, opciones inexistentes', 'Se negará', 'Lo ejecutará'], answer: 1, explain: 'Consulta sin anclar.' },
        { type: 'mc', q: '¿Qué pieza dice «devuelve solo el script, sin ejecutarlo»?', options: ['Contexto', 'Encargo', 'Límites', 'Parada'], answer: 3, explain: 'La parada fija el formato.' },
        { type: 'mc', q: '«No inventes opciones; si no estás seguro, dilo» es…', options: ['Contexto', 'Encargo', 'Límites', 'Parada'], answer: 2, explain: 'Excluye lo no admisible.' },
        { type: 'mc', q: '¿Por qué en el prompt de ejemplo **no** se mencionan `if` ni `grep`?', options: ['Por olvido', 'Porque la elección de órdenes es justo lo que se contrasta después', 'Porque no existen', 'Para que sea corto'], answer: 1, explain: 'Y no se le pasa 03-if-grep.sh: invalidaría el contraste.' },
        { type: 'mc', q: 'Para diagnosticar un error, ¿qué se pega en el prompt?', options: ['Un resumen', 'El script completo y el mensaje de error literal', 'Solo la línea 7', 'Nada'], answer: 1, explain: 'Y se pide primero la explicación; el arreglo, después.' },
        T1D.prompt,
      ],
    }],
  },
  {
    id: 'ia-verificar', section: 's4', title: 'Verificar lo que propone', icon: '🔬', color: 'purple',
    desc: 'Revisar, probar y comparar con la referencia.',
    lessons: [{
      title: 'Antes de ejecutar',
      exercises: [
        { type: 'info', title: 'Cinco comprobaciones', text: 'La propuesta se guarda en un fichero nuevo (`mi-03.sh`, con vi) **sin ejecutarla**, y se revisa:\n\n1. Primera línea `#!/bin/bash`.\n2. ¿Recibe el fichero como `$1` o lleva un nombre fijo?\n3. Opciones desconocidas → `man` o `--help`.\n4. Operaciones irreversibles: `rm`, `mv`, `>`, `sed -i`.\n5. Privilegios o instalación: no proceden en el servidor.\n\nDespués se ejecuta con `bash` y se compara con el script de referencia.' },
        { type: 'mc', q: '¿Cuál **no** es una de las cinco comprobaciones?', options: ['Primera línea #!/bin/bash', 'Que la respuesta suene segura', 'Opciones desconocidas', 'Operaciones irreversibles'], answer: 1, explain: 'La seguridad aparente no cuenta.' },
        { type: 'term', q: 'La IA propone `grep --atom-only`. Pruébalo en `ejemplo.pdb` y mira qué dice grep.', setup: ['cd ~/trabajo-1a'], check: all(ranAny(/^grep\s+--atom-only/), outHas(/unrecognized option/)), hint: 'grep --atom-only ATOM ejemplo.pdb', solution: 'grep --atom-only ATOM ejemplo.pdb' },
        { type: 'term', q: 'Busca en la ayuda la opción real que «suprime la salida normal».', check: all(ranAny(/^grep\s+--help\s*\|\s*grep/), outHas(/-q, --quiet/)), hint: "grep --help | grep -- '-q,'", solution: "grep --help | grep -- '-q,'" },
        { type: 'mc', q: '¿Cómo se lanza `mi-03.sh` para probarla?', options: ['chmod 777 y ./', 'bash mi-03.sh ejemplo.pdb, sin cambiar permisos', 'sudo', 'Copiándola encima de 03-if-grep.sh'], answer: 1, explain: 'El original del repo nunca se modifica.' },
        { type: 'mc', q: 'Las **cuatro pruebas** para comparar con 03-if-grep.sh son ejemplo.pdb, sin-atom.txt, no-existe.pdb y…', options: ['1HVR.pdb', 'sin argumento', 'con sudo', 'dos veces'], answer: 1, explain: 'Sin argumento, la referencia usa ejemplo.pdb.' },
        { type: 'term', q: 'Crea `sin-atom.txt` con `echo hola` y compara: lanza `03-if-grep.sh` con él.', setup: ['cd ~/trabajo-1a'], check: all(isFile(`${T}/sin-atom.txt`), outHas(/No encontrada la palabra ATOM en sin-atom\.txt/)), hint: 'echo hola > sin-atom.txt; ./03-if-grep.sh sin-atom.txt', solution: 'echo hola > sin-atom.txt; ./03-if-grep.sh sin-atom.txt' },
        { type: 'mc', q: 'Una corrección distinta a la del profesor…', options: ['Siempre es incorrecta', 'Es válida si supera las mismas pruebas', 'Hay que borrarla', 'Necesita sudo'], answer: 1, explain: 'Lo que cuenta es el comportamiento comprobado.' },
      ],
    }],
  },
  {
    id: 'ia-datos', section: 's4', title: 'Preguntar con datos', icon: '📋', color: 'orange',
    desc: 'Diagnóstico de errores y consultas sobre un fichero.',
    lessons: [{
      title: 'El dato manda',
      exercises: [
        { type: 'info', title: 'Consultas con datos del fichero', text: 'La consulta se hace sobre **líneas concretas** del fichero, no sobre el código de la entrada. Los límites obligan a usar solo esas líneas y a decir lo que falta. Después, **las cifras se cuentan en el fichero**.', code: "$ grep -E '^(HET |HETNAM)' 1HVR.pdb\nHET    CSO  A  67       9\nHET    CSO  B  67       9\nHET    XK2  A 263      46\nHETNAM     CSO S-HYDROXYCYSTEINE\nHETNAM     XK2 [4R-(4ALPHA,5ALPHA,6BETA,7BETA)]-HEXAHYDRO-5,6-..." },
        { type: 'mc', q: 'En `HET    XK2  A 263      46`, ¿qué indica el último número?', options: ['El residuo', 'El número de átomos (líneas HETATM) de ese grupo', 'La cadena', 'La resolución'], answer: 1, explain: 'XK2 (el inhibidor) tiene 46; cada CSO, 9.' },
        { type: 'mc', q: '¿Qué es CSO en 1HVR?', options: ['Agua', 'S-hidroxicisteína: una cisteína modificada', 'El inhibidor', 'Un ion'], answer: 1, explain: 'Lo dice HETNAM. XK2 es el inhibidor de urea cíclica.' },
        { type: 'term', q: 'Saca las líneas HET y HETNAM de `1HVR.pdb`.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/HETNAM\s+XK2/), outHas(/HET\s+CSO/)), hint: "grep -E '^(HET |HETNAM)' 1HVR.pdb", solution: "grep -E '^(HET |HETNAM)' 1HVR.pdb" },
        { type: 'term', q: 'Verifica la cifra: ¿cuántas líneas HETATM son del inhibidor XK2?', setup: ['cd ~/trabajo-1a'], check: outHas(/^46\s*$/m), hint: "grep '^HETATM' 1HVR.pdb | grep -c XK2", solution: "grep '^HETATM' 1HVR.pdb | grep -c XK2" },
        { type: 'mc', q: 'Si la explicación es correcta, las cuentas cuadran:', options: ['46 + 9 + 9 = 64', '46 + 18 = 46', '64 − 9 = 46', '1826 + 64'], answer: 0, explain: '`grep -c \'^HETATM\' 1HVR.pdb` = 64.' },
        { type: 'mc', q: 'En el diagnóstico de 12-errores.sh, ¿qué se pide **primero**?', options: ['El arreglo', 'La explicación del error y la línea', 'El script nuevo', 'Que lo ejecute'], answer: 1, explain: 'Así puedes evaluar la explicación. Tu tarea 1B.' },
      ],
    }],
  },
  {
    id: 'ia-riesgos', section: 's4', title: '¿Lo ejecutaríais?', icon: '⚠️', color: 'red',
    desc: 'Órdenes peligrosas, declaración de uso y agentes.',
    lessons: [{
      title: 'Riesgo y alternativa',
      exercises: [
        { type: 'info', title: 'Cuatro propuestas peligrosas', code: 'Propuesta               Riesgo                       Alternativa\nrm -rf ~/trabajo-1a/*   pérdida irreversible         ls y borrar selectivamente\ncurl ... | bash         ejecutar código no leído     curl -O y leer con less\nsed -i sobre el PDB     pérdida del original         sed ... > copia.pdb\nchmod 777 *.sh          escritura a terceros         chmod u+x mi-03.sh', text: 'Antes de ejecutar: ¿qué modifica? ¿es reversible? ¿qué parte es realmente necesaria?' },
        { type: 'mc', q: 'La IA propone `curl -s https://example.org/instalar.sh | bash`. Riesgo:', options: ['Ninguno', 'Ejecuta código que no has leído', 'Borra el HOME', 'Es lento'], answer: 1, explain: 'Alternativa: descargarlo con curl -O y leerlo con less.' },
        { type: 'mc', q: 'Tras un *Permission denied* propone `chmod 777 *.sh`. ¿Qué harías?', options: ['Ejecutarlo', 'chmod u+x mi-03.sh: solo lo necesario', 'sudo', 'Borrar los scripts'], answer: 1, explain: '777 da escritura a terceros.' },
        { type: 'mc', q: 'Para unificar ATOM y HETATM propone `sed -i \'s/^HETATM/ATOM  /\' 1HVR.pdb`. Mejor:', options: ['Ejecutarlo', "sed 's/^HETATM/ATOM  /' 1HVR.pdb > copia.pdb", 'rm 1HVR.pdb', 'chmod 777'], answer: 1, explain: 'sed -i destruye el original.' },
        { type: 'mc', q: 'Para «dejar vacío el directorio» propone `rm -rf ~/trabajo-1a/*`. Mejor:', options: ['Ejecutarlo', 'ls y eliminar selectivamente', 'sudo rm', 'mv a /tmp'], answer: 1, explain: 'Pérdida irreversible.' },
        { type: 'info', title: 'Declaración de uso', text: 'Tres elementos en una frase: **herramienta y fecha**, **aportación concreta** y **comprobación realizada, con la orden**.\n\n«Se utilizó Gemini para proponer un script que detecta líneas ATOM; se contrastó con 03-if-grep.sh en cuatro pruebas».\n\n**Agentes** (Gemini CLI): trabajan en la terminal, acceden a los ficheros y ejecutan órdenes. Suprimen el copiar y pegar, **no** la obligación de revisar.' },
        { type: 'mc', q: '¿Qué tres elementos lleva la declaración de uso de IA?', options: ['Nombre, DNI y firma', 'Herramienta y fecha, aportación, comprobación con la orden usada', 'Solo la herramienta', 'El prompt entero'], answer: 1, explain: 'Hay que declararla si aporta texto o código.' },
        { type: 'mc', q: 'Un agente como Gemini CLI…', options: ['No se equivoca', 'Accede a los ficheros y ejecuta órdenes, pero hay que revisar antes de aceptar', 'Solo traduce', 'No puede ejecutar nada'], answer: 1, explain: 'Es de código abierto (Google, 2025).' },
      ],
    }],
  },

  // ═════════════════════════════════ SECCIÓN 5 · ESTRUCTURAL (1C) ═════════════════════════════════
  {
    id: 'pdb-fetch', section: 's5', title: 'Descargar estructuras', icon: '⬇️', color: 'green',
    desc: 'El PDB, which, la ayuda y pdb_fetch.',
    lessons: [{
      title: 'pdb_fetch',
      exercises: [
        { type: 'info', title: 'Estructural frente a secuencias', code: '              Estructural            Secuencias\nDato          coordenadas 3D (PDB)   letras (FASTA)\nPregunta      ¿qué forma, qué        ¿qué parecido,\n              superficie?            qué origen?\nProgramas     freesasa, PyMOL,       BLAST, alineamiento\n              docking                múltiple\nEn el curso   Temas 2, 4 y 6         Tema 7', text: 'Hoy, la rama **estructural**: descargar una entrada del **Protein Data Bank**, inventariarla y medir su superficie. Tres programas, ya instalados en tu cuenta: `pdb_fetch`, `pdb_wc` (pdb-tools) y `freesasa` (FreeSASA).' },
        { type: 'mc', q: 'Un fichero del PDB contiene…', options: ['Secuencias en FASTA', 'Coordenadas 3D de los átomos', 'Imágenes', 'Alineamientos'], answer: 1, explain: 'Rama estructural.' },
        { type: 'mc', q: 'BLAST y los alineamientos son de la rama…', options: ['Estructural', 'De secuencias (Tema 7)', 'De permisos', 'De Git'], answer: 1, explain: 'Hoy solo estructural.' },
        { type: 'term', q: 'Comprueba dónde están los tres programas.', opts: ONE_C, setup: ['cd ~/trabajo-1c'], check: all(outHas(/pdb_fetch/), outHas(/pdb_wc/), outHas(/freesasa/)), hint: 'which pdb_fetch pdb_wc freesasa', solution: 'which pdb_fetch pdb_wc freesasa' },
        { type: 'mc', q: 'En `pdb_wc`, la opción `-h`…', options: ['Muestra la ayuda', 'No es la ayuda: cuenta las líneas HETATM', 'Borra', 'Da la versión'], answer: 1, explain: 'Cada programa tiene sus convenios: freesasa -h sí es la ayuda; pdb_fetch y pdb_wc sin argumentos muestran su uso.' },
        { type: 'mc', q: '¿Qué pasa con `pdb_fetch --version`?', options: ['Da la versión', 'Lo interpreta como código del PDB y da error', 'Nada', 'Descarga todo'], answer: 1, explain: 'freesasa --version sí funciona.' },
        { type: 'mc', q: '`pdb_fetch 1crn` sin `>`:', options: ['Guarda 1crn.pdb', 'Escribe la estructura por pantalla', 'Da error', 'Necesita el fichero ya descargado'], answer: 1, explain: 'Escribe por la salida estándar; con > se guarda.' },
        { type: 'term', q: 'Descarga la crambina (1CRN) en `1crn.pdb`.', opts: ONE_C, setup: ['cd ~/trabajo-1c'], check: isFile(`${C}/1crn.pdb`), hint: 'pdb_fetch 1crn > 1crn.pdb', solution: 'pdb_fetch 1crn > 1crn.pdb' },
        { type: 'term', q: '¿Cuántas líneas tiene `1crn.pdb`?', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: outHas(/611/), hint: 'wc -l', solution: 'wc -l 1crn.pdb' },
        { type: 'term', q: 'Prueba con un código inexistente: `pdb_fetch 0crn > 0crn.pdb` y luego `ls -l 0crn.pdb`.', opts: ONE_C, setup: ['cd ~/trabajo-1c'], check: all(isFile(`${C}/0crn.pdb`), ranAny(/^ls\s+-l\s+0crn\.pdb$/)), hint: 'Dos órdenes.', solution: 'pdb_fetch 0crn > 0crn.pdb; ls -l 0crn.pdb' },
        { type: 'mc', q: 'Tras `pdb_fetch 0crn > 0crn.pdb`, ¿existe 0crn.pdb?', options: ['No', 'Sí, pero vacío (0 bytes): > lo crea antes de que pdb_fetch falle', 'Sí, con la crambina', 'Sí, con el error dentro'], answer: 1, explain: 'El error va por la salida de errores, no al fichero.' },
      ],
    }],
  },
  {
    id: 'pdb-wc', section: 's5', title: 'Inventariar con pdb_wc', icon: '🧮', color: 'blue',
    desc: 'Modelos, cadenas, residuos, átomos, HETATM.',
    lessons: [{
      title: 'pdb_wc y validar con grep',
      exercises: [
        { type: 'info', title: 'Un wc que entiende la estructura', code: '$ pdb_wc 1crn.pdb\nNo. models:     1\nNo. chains:     1       (   1.0/model)\nNo. residues:   46      (  46.0/model)\nNo. atoms:      327     ( 327.0/model)\nNo. HETATM:     0\nMultiple Occ.:  False\nRes. Inserts:   False', text: 'El recuento del programa se **valida** con lo que ya sabes de 1A: `grep -c` para ATOM y HETATM, y los **residuos por su carbono alfa (CA)**, que aparece una vez en cada residuo.' },
        { type: 'term', q: 'Inventaría `1crn.pdb`.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: all(ran(/^pdb_wc\s+1crn\.pdb$/), outHas(/residues:\s+46/)), hint: 'pdb_wc 1crn.pdb', solution: 'pdb_wc 1crn.pdb' },
        { type: 'term', q: 'Valida los átomos: cuenta las líneas ATOM de `1crn.pdb` con grep.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: outHas(/^327\s*$/m), hint: "grep -c '^ATOM' 1crn.pdb", solution: "grep -c '^ATOM' 1crn.pdb" },
        { type: 'term', q: 'Valida los residuos contando los carbonos alfa.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: outHas(/^46\s*$/m), hint: "grep '^ATOM' 1crn.pdb | grep -c ' CA '", solution: "grep '^ATOM' 1crn.pdb | grep -c ' CA '" },
        { type: 'mc', q: '¿Por qué se cuentan los residuos por su CA?', options: ['Porque es el único carbono', 'Porque el carbono alfa aparece una vez en cada residuo', 'Por el color', 'Porque es el último'], answer: 1, explain: 'Un CA = un residuo.' },
        { type: 'mc', q: 'Antes de ejecutarlo: `pdb_wc ejemplo.pdb` (la crambina recortada de 1A) declarará…', code: 'ATOM      1  N   THR A   1 ...\nATOM      2  CA  THR A   1 ...\nATOM      3  C   THR A   1 ...\nHETATM  327  O   HOH A  64 ...', options: ['46 residuos, 327 átomos, 0 HETATM', '1 residuo, 3 átomos, 1 HETATM', '3 residuos, 3 átomos, 0 HETATM', '64 residuos'], answer: 1, explain: 'Los tres ATOM son del residuo 1 (THR); el agua es HETATM.' },
        { type: 'term', q: 'Compruébalo en `~/trabajo-1a`.', opts: ONE_C, setup: ['cd ~/trabajo-1a'], check: all(ran(/^pdb_wc\s+ejemplo\.pdb$/), outHas(/residues:\s+1\b/)), hint: 'pdb_wc ejemplo.pdb', solution: 'pdb_wc ejemplo.pdb' },
      ],
    }],
  },
  {
    id: 'sasa', section: 's5', title: 'Superficie accesible (SASA)', icon: '💧', color: 'purple',
    desc: 'freesasa: Total, Apolar y Polar.',
    lessons: [
      {
        title: 'Medir con freesasa',
        exercises: [
          { type: 'info', title: 'SASA, en Å²', text: 'Una **sonda** del tamaño de una molécula de agua (**1,4 Å** de radio) recorre los átomos. La superficie accesible es la trayectoria del centro de la sonda (Lee y Richards, 1971). Mayor área = más exposición al disolvente.', code: '$ freesasa 1crn.pdb\nalgorithm    : Lee & Richards\nprobe-radius : 1.400\natoms        : 327\nRESULTS (A^2)\nTotal   :    2999.32\nApolar  :    1969.33\nPolar   :    1030.00' },
          { type: 'mc', q: '¿Qué radio tiene la sonda?', options: ['1 nm', '1,4 Å (una molécula de agua)', '14 Å', '0,1 Å'], answer: 1, explain: 'probe-radius : 1.400' },
          { type: 'mc', q: '**Apolar** es la contribución de los átomos de…', options: ['Nitrógeno', 'Carbono', 'Oxígeno y azufre', 'Hidrógeno'], answer: 1, explain: 'Polar: N, O y S.' },
          { type: 'mc', q: 'Por defecto, freesasa mide…', options: ['Todo', 'Solo las líneas ATOM y sin hidrógenos: deja fuera ligandos y aguas', 'Solo HETATM', 'Solo hidrógenos'], answer: 1, explain: '`--hetatm` y `--hydrogen` los incluyen.' },
          { type: 'term', q: 'Mide la superficie de `1crn.pdb` y quédate solo con Total y Apolar.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: all(outHas(/Total\s+:\s+2999\.32/), outHas(/Apolar/), (sh, last) => !/Polar   :/.test(last.text)), hint: "freesasa 1crn.pdb | grep -E 'Total|Apolar'", solution: "freesasa 1crn.pdb | grep -E 'Total|Apolar'" },
          { type: 'mc', q: '1CRN: Apolar/Total = 0,657. 1HVR: 0,559. ¿Qué expone más fracción apolar?', options: ['1HVR', '1CRN, que su entrada describe como proteína hidrofóbica', 'Igual', 'No se puede saber'], answer: 1, explain: 'El valor absoluto solo se interpreta comparando.' },
          { type: 'term', q: 'Descarga 1hvr y mide su Total y Apolar.', opts: ONE_C, setup: ['cd ~/trabajo-1c'], check: all(outHas(/9710\.72/), outHas(/5425\.23/)), hint: "pdb_fetch 1hvr > 1hvr.pdb; freesasa 1hvr.pdb | grep -E 'Total|Apolar'", solution: "pdb_fetch 1hvr > 1hvr.pdb; freesasa 1hvr.pdb | grep -E 'Total|Apolar'" },
          { type: 'mc', q: '1CRN expone 65,2 Å² por residuo; 1HVR, 49,5. ¿Por qué 1HVR menos?', options: ['Es más pequeña', 'Parte de su superficie queda enterrada, también en la interfaz entre sus dos cadenas', 'Tiene más agua', 'Por el inhibidor'], answer: 1, explain: 'Tu interpretación de la tarea 1C.' },
        ],
      },
      {
        title: 'Residuo a residuo',
        exercises: [
          { type: 'info', title: 'freesasa --format=rsa', text: '**REL** es el % expuesto de cada residuo respecto a su valor de referencia. Las 6 cisteínas de 1CRN forman **3 puentes disulfuro** (líneas `SSBOND`).', code: '$ freesasa --format=rsa 1crn.pdb > 1crn.rsa\n$ grep CYS 1crn.rsa | cut -c1-30\nRES CYS A   3     0.00   0.0\nRES CYS A   4     0.00   0.0\nRES CYS A  16    19.43  14.7\nRES CYS A  26     0.00   0.0\nRES CYS A  32     4.71   3.6\nRES CYS A  40    44.63  33.8' },
          { type: 'term', q: 'Genera `1crn.rsa` y mira las cisteínas.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: all(isFile(`${C}/1crn.rsa`), outHas(/CYS A\s+40/)), hint: 'freesasa --format=rsa 1crn.pdb > 1crn.rsa; grep CYS 1crn.rsa', solution: 'freesasa --format=rsa 1crn.pdb > 1crn.rsa; grep CYS 1crn.rsa | cut -c1-30' },
          { type: 'term', q: 'Contrasta con el fichero: muestra las líneas SSBOND.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1crn > 1crn.pdb'], check: outHas(/SSBOND\s+3/), hint: 'grep SSBOND 1crn.pdb', solution: 'grep SSBOND 1crn.pdb | cut -c1-35' },
          { type: 'mc', q: '4 de las 6 cisteínas exponen menos del 5 %. ¿Qué indica?', options: ['Que están mal', 'Que esos puentes disulfuro quedan en el interior', 'Que son polares', 'Nada'], answer: 1, explain: 'Cys 16 y Cys 40 quedan parcialmente expuestas (14,7 % y 33,8 %).' },
          { type: 'mc', q: '¿Qué significa REL?', options: ['El área total', 'El % expuesto respecto a un valor de referencia del residuo', 'El nº de residuo', 'La relación apolar/polar'], answer: 1, explain: 'Permite comparar residuos distintos.' },
        ],
      },
    ],
  },
  {
    id: 'recuentos', section: 's5', title: 'Recuentos que no coinciden', icon: '🧩', color: 'orange',
    desc: '1826 frente a 1500 y los avisos de freesasa.',
    lessons: [{
      title: 'Cada programa cuenta otra cosa',
      exercises: [
        { type: 'info', title: '1HVR: 1826 frente a 1500', code: '$ pdb_wc 1hvr.pdb | grep atoms\nNo. atoms:      1826    (1826.0/model)\n$ freesasa 1hvr.pdb | grep atoms\natoms   : 1500', text: 'Ninguno falla: cada programa cuenta un conjunto distinto. Procedimiento de 1B: preguntar con las dos salidas pegadas y **comprobar en el servidor**.' },
        { type: 'term', q: 'Cuenta los **hidrógenos** de 1hvr.pdb (el elemento, última columna, es H).', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1hvr > 1hvr.pdb'], check: outHas(/^326\s*$/m), hint: "grep '^ATOM' 1hvr.pdb | grep -c ' H *$'", solution: "grep '^ATOM' 1hvr.pdb | grep -c ' H *$'" },
        { type: 'mc', q: '1826 − 326 = ?', options: ['1500: la diferencia exacta', '1600', '1826', '326'], answer: 0, explain: 'freesasa deja fuera los hidrógenos.' },
        { type: 'term', q: 'Incluye los hidrógenos (sin avisos) y comprueba que ahora coincide.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'pdb_fetch 1hvr > 1hvr.pdb'], check: all(ranAny(/freesasa\s+.*--hydrogen/), outHas(/atoms\s+:\s+1826/)), hint: 'freesasa --hydrogen --no-warnings 1hvr.pdb | grep atoms', solution: 'freesasa --hydrogen --no-warnings 1hvr.pdb | grep atoms' },
        { type: 'mc', q: '¿Para qué es `--no-warnings`?', options: ['Para ir más rápido', 'Suprime el aviso que freesasa da por cada hidrógeno', 'Para no guardar', 'Para incluir HETATM'], answer: 1, explain: 'Ambas opciones figuran en freesasa -h.' },
        { type: 'mc', q: '`which` no encuentra freesasa en tu cuenta y el chat propone `pip install freesasa`. ¿Qué haces?', options: ['Ejecutarlo', 'Avisar y comprobar con which: instalaría otro paquete sin autorización', 'sudo pip', 'Borrar la cuenta'], answer: 1, explain: 'En el servidor del curso no se instala software.' },
        { type: 'mc', q: 'Propone `pdb_fetch 1crn > ~/trabajo-1a/ejemplo.pdb` «para no repetir la descarga». Problema:', options: ['Ninguno', 'Sobrescribe el fichero que usan los scripts de 1A', 'Es lento', 'No descarga'], answer: 1, explain: 'En su lugar: pdb_fetch 1crn > 1crn.pdb' },
        { type: 'mc', q: '`freesasa --hetatm 1hvr.pdb` para incluir el inhibidor. La orden es válida, pero…', options: ['Borra el fichero', 'Usa radios estimados (unos 60 avisos): hay que leerlos e indicarlo al citar', 'No hace nada', 'Necesita sudo'], answer: 1, explain: 'Qué cambia en el resultado.' },
      ],
    }],
  },
  {
    id: 'lotes', section: 's5', title: 'Procesar por lotes', icon: '🏭', color: 'red',
    desc: 'sasa-lote.sh, sasa-args.sh y sasa-diez.sh.',
    lessons: [
      {
        title: 'sasa-lote y sasa-args',
        exercises: [
          { type: 'info', title: 'Caso 4: bucle for (1A)', code: 'for id in 1crn 1hvr; do\n    pdb_fetch "$id" > "$id.pdb"\n    echo "== $id"\n    pdb_wc "$id.pdb" | grep residues\n    freesasa "$id.pdb" | grep Total\ndone', text: 'El mismo tratamiento para varias entradas, sin repetir órdenes. Mismo patrón que 05-for-lista.sh.' },
          { type: 'mc', q: 'Antes de ejecutarlo: ¿cuántas líneas produce sasa-lote.sh?', options: ['2', '6: tres por proteína (== id, residues, Total)', '4', '12'], answer: 1, explain: 'Por cada id: echo, grep residues, grep Total.' },
          { type: 'mc', q: '¿Cuántos residuos declarará para 1HVR?', options: ['99', '196', '1826', '64'], answer: 1, explain: 'Dos cadenas de 98.' },
          { type: 'fill', q: 'Reto: que reciba los códigos como argumentos.', code: 'for id in ___; do', options: ['"$@"', '$1', '$#', '1crn 1hvr'], answer: '"$@"', explain: 'Así sasa-args.sh vale para cualquier lista.' },
          { type: 'term', q: 'Ejecuta `sasa-args.sh` con `1crn 1hvr 1ake`, guarda la salida en `sasa.txt` y míralo.', opts: ONE_C, setup: ['cd ~/trabajo-1c', sh => {
            sh.writeFile(`${C}/sasa-args.sh`, SASA_ARGS);
            sh.fs.get(`${C}/sasa-args.sh`).mode = 0o775;
          }], check: all(fileHas(`${C}/sasa.txt`, /== 1ake[\s\S]*21218\.70/), outHas(/1ake/)), hint: './sasa-args.sh 1crn 1hvr 1ake > sasa.txt; cat sasa.txt', solution: './sasa-args.sh 1crn 1hvr 1ake > sasa.txt; cat sasa.txt' },
          { type: 'term', q: 'Interpreta `sasa.txt` con awk: fracción apolar y área por residuo de cada proteína.', opts: ONE_C, setup: ['cd ~/trabajo-1c', 'printf "== 1crn\\nNo. residues:\\t46\\t(  46.0/model)\\nTotal   :    2999.32\\nApolar  :    1969.33\\n== 1hvr\\nNo. residues:\\t196\\t( 196.0/model)\\nTotal   :    9710.72\\nApolar  :    5425.23\\n== 1ake\\nNo. residues:\\t428\\t( 428.0/model)\\nTotal   :   21218.70\\nApolar  :   11607.71\\n" > sasa.txt'], check: all(ranAny(/^awk\s+/), outHas(/0\.657/), outHas(/49\.6/)), hint: 'awk \'/^==/{id=$2} /residues/{r=$3} /^Total/{t=$3} /^Apolar/{printf "%s %.3f %.1f\\n", id, $3/t, t/r}\' sasa.txt', solution: 'awk \'/^==/{id=$2} /residues/{r=$3} /^Total/{t=$3} /^Apolar/{printf "%s %.3f %.1f\\n", id, $3/t, t/r}\' sasa.txt' },
          { type: 'mc', q: '1HVR (49,5 Å²/residuo) y 1AKE (49,6) exponen casi lo mismo por residuo. La diferencia de Total se debe a…', options: ['La fracción apolar', 'Sobre todo al tamaño (196 frente a 428 residuos)', 'Los HETATM', 'El algoritmo'], answer: 1, explain: 'Tu interpretación de la tarea 1C.' },
        ],
      },
      {
        title: 'sasa-diez: no descargar dos veces',
        exercises: [
          { type: 'info', title: 'Tarea 1C2', code: 'for id in "$@"; do\n    if [ ! -f "$id.pdb" ]; then\n        pdb_fetch "$id" > "$id.pdb"\n    fi\n    echo "== $id"\n    pdb_wc "$id.pdb" | grep -E \'chains|residues|atoms|HETATM\'\n    freesasa "$id.pdb" | grep -E \'Total|Apolar\'\ndone', text: 'Solo descarga si el fichero **no existe ya**: no repite descargas ni sobrescribe.' },
          { type: 'mc', q: '¿Qué hace `if [ ! -f "$id.pdb" ]`?', options: ['Borra el fichero', 'Entra si el fichero NO existe', 'Entra si existe', 'Da permisos'], answer: 1, explain: '! niega la condición.' },
          { type: 'mc', q: 'En la segunda ejecución con 1ubq, la traza de `bash -x`…', options: ['Vuelve a llamar a pdb_fetch', 'No llama a pdb_fetch: el fichero ya existe', 'Da error', 'Borra 1ubq.pdb'], answer: 1, explain: 'Tu bloque 3 de la 1C2.' },
          { type: 'mc', q: 'De tus 10 proteínas, la mayor fracción apolar es 1c3w (0,739). ¿Por qué?', options: ['Es la más grande', 'Es bacteriorrodopsina, una proteína de membrana', 'Tiene más agua', 'Por el hemo'], answer: 1, explain: 'La menor fue 1ubq (ubiquitina, 0,479).' },
          { type: 'term', q: '¿Qué heteroátomos tiene la mioglobina (1mbn)? Descárgala y cuenta por residuo.', opts: ONE_C, setup: ['cd ~/trabajo-1c'], check: all(outHas(/43 HEM/), outHas(/1\s+OH/)), hint: "pdb_fetch 1mbn > 1mbn.pdb; grep '^HETATM' 1mbn.pdb | cut -c18-20 | sort | uniq -c", solution: "pdb_fetch 1mbn > 1mbn.pdb; grep '^HETATM' 1mbn.pdb | cut -c18-20 | sort | uniq -c" },
          { type: 'mc', q: 'freesasa por defecto, en 1mbn, ¿mide el grupo hemo (HEM)?', options: ['Sí', 'No: es HETATM y queda fuera', 'Solo el hierro', 'Solo si es grande'], answer: 1, explain: 'Usa 1216 átomos, solo los ATOM.' },
          T1D.pdbtools,
        ],
      },
    ],
  },

  // ═════════════════════════════════ SECCIÓN 6 · REPASO DE EXAMEN ═════════════════════════════════
  // Formato del examen: tipo test de opción múltiple, una sola respuesta correcta.
  {
    id: 'examen-1a', section: 's6', title: 'Test: Tema 1A', icon: '📝', color: 'blue',
    desc: 'Preguntas tipo test de Linux y bash.',
    lessons: [
      {
        title: 'Test 1A · órdenes',
        exercises: [
          { type: 'mc', q: '¿Cuál de estas rutas es **relativa**?', options: ['/home/bio_alumno', '/bin', '../tarea2', '/home/bio_alumno/trabajo-1a'], answer: 2, explain: 'Las absolutas empiezan por /; `..` parte del directorio actual.' },
          { type: 'mc', q: '¿Qué orden copia el directorio `datos` con todo su contenido en `copia`?', options: ['cp datos copia', 'cp -r datos copia', 'mv -r datos copia', 'cd -r datos copia'], answer: 1, explain: 'Sin -r, cp omite los directorios.' },
          { type: 'mc', q: '¿Qué hace `ls -l > lista.txt` si `lista.txt` ya existe?', options: ['Añade el listado al final', 'Sobrescribe el fichero con el listado', 'Da error', 'Crea lista.txt.1'], answer: 1, explain: 'Para añadir: >>.' },
          { type: 'mc', q: '¿Qué orden permite leer un fichero largo página a página?', options: ['cat', 'more', 'head', 'touch'], answer: 1, explain: 'También less, que además deja volver atrás.' },
          { type: 'mc', q: 'En `more`, ¿qué tecla avanza **una página**?', options: ['Enter', 'La barra espaciadora', 'q', 'Ctrl+C'], answer: 1, explain: 'Enter avanza una línea; q sale.' },
          { type: 'mc', q: '¿Qué cuenta `grep -c \'^HETATM\' 1HVR.pdb`?', options: ['Las líneas que contienen HETATM en cualquier posición', 'Las líneas que empiezan por HETATM', 'Los caracteres HETATM', 'Las líneas que no son HETATM'], answer: 1, explain: '-c cuenta; ^ ancla al principio (64 en 1HVR).' },
          { type: 'mc', q: '¿Qué orden actualiza el clon del repositorio de clase con los cambios del profesor?', options: ['git clone, otra vez', 'git pull, dentro del repositorio', 'git status', 'cp -r'], answer: 1, explain: 'El clon no se actualiza solo.' },
          { type: 'mc', q: '¿Qué orden muestra la arquitectura del servidor (x86_64)?', options: ['whoami', 'uname -a', 'id', 'pwd'], answer: 1, explain: 'uname -a: kernel, nombre y arquitectura.' },
          { type: 'mc', q: '¿Para qué sirve FileZilla en la asignatura?', options: ['Para editar scripts', 'Para transferir ficheros entre el portátil y el servidor', 'Para clonar el repositorio', 'Para medir superficies'], answer: 1, explain: 'En los dos sentidos, por SFTP.' },
          { type: 'mc', q: 'En vi, ¿qué secuencia guarda los cambios y sale?', options: ['Esc :q!', 'Esc :wq', 'Ctrl+X', 'Esc dd'], answer: 1, explain: ':q! sale sin guardar; Ctrl+X es de nano.' },
        ],
      },
      {
        title: 'Test 1A · scripts',
        exercises: [
          { type: 'mc', q: 'Un fichero tiene `-rwxr-x---`. ¿Qué afirmación es correcta?', options: ['El resto de usuarios puede leerlo', 'El grupo puede ejecutarlo pero no modificarlo', 'El dueño no puede ejecutarlo', 'En octal es 755'], answer: 1, explain: 'Grupo r-x; otros ---; octal 750.' },
          { type: 'mc', q: '¿Qué permisos deja `chmod 644 notas.txt`?', options: ['rwxr--r--', 'rw-r--r--', 'rw-rw-rw-', 'rwxr-xr-x'], answer: 1, explain: '6 = rw-, 4 = r--.' },
          { type: 'mc', q: '`hola.sh` no tiene permiso de ejecución. ¿Cómo se lanza sin cambiar permisos?', options: ['./hola.sh', 'bash hola.sh', 'hola.sh', 'exec hola.sh'], answer: 1, explain: 'bash solo necesita leerlo.' },
          { type: 'mc', q: '¿Cuál asigna correctamente el valor 5 a la variable `n`?', options: ['n = 5', 'n=5', '$n=5', 'set n 5'], answer: 1, explain: 'Sin espacios alrededor del =.' },
          { type: 'mc', q: '¿Cuánto vale `$#` en `./s.sh a "b c" d`?', options: ['2', '3', '4', '1'], answer: 1, explain: '"b c" es un solo argumento entre comillas.' },
          { type: 'mc', q: '¿Qué imprime `for i in $(seq 2 2 8); do echo $i; done`?', options: ['2 3 4 5 6 7 8', '2 4 6 8', '2 8', '2 2 8'], answer: 1, explain: 'seq inicio paso fin.' },
          { type: 'mc', q: '`[ "$n" -lt 10 ]` es cierto cuando…', options: ['n es un texto que empieza por 1', 'n es un número entero menor que 10', 'n tiene menos de 10 letras', 'n está vacío'], answer: 1, explain: '-lt: less than, para enteros.' },
          { type: 'mc', q: '¿Qué mensaje da `if [ -f "$f"]; then`?', options: ['unary operator expected', "[: missing `]'", 'command not found', 'Permission denied'], answer: 1, explain: 'Falta el espacio antes de ].' },
          { type: 'mc', q: '¿Qué orden revisa la sintaxis de un script **sin ejecutarlo**?', options: ['bash -x s.sh', 'bash -n s.sh', 'cat -A s.sh', 'chmod +x s.sh'], answer: 1, explain: 'bash -x ejecuta mostrando cada orden.' },
          { type: 'mc', q: 'Un script da `/bin/bash^M: bad interpreter`. ¿Qué lo arregla?', options: ["sed -i 's/\\r$//' script.sh", 'chmod 777 script.sh', 'bash -n script.sh', 'mv script.sh script'], answer: 0, explain: 'Quita el fin de línea de Windows.' },
          { type: 'mc', q: '¿Qué hace `continue` dentro de un bucle?', options: ['Sale del bucle', 'Salta a la siguiente vuelta', 'Repite la vuelta actual', 'Termina el script'], answer: 1, explain: 'break sale del bucle.' },
          { type: 'mc', q: 'En 07-while.sh se comenta la línea `shift`. ¿Qué ocurre?', options: ['Imprime los tres parámetros', 'Bucle infinito imprimiendo el primer parámetro', 'Error de sintaxis', 'No imprime nada'], answer: 1, explain: '$1 nunca cambia. Se corta con Ctrl+C.' },
        ],
      },
    ],
  },
  {
    id: 'examen-1bc', section: 's6', title: 'Test: Temas 1B y 1C', icon: '🎓', color: 'green',
    desc: 'Preguntas tipo test de IA y bioinformática estructural.',
    lessons: [
      {
        title: 'Test 1B · IA con criterio',
        exercises: [
          { type: 'mc', q: '¿Cuáles son las cuatro piezas de un prompt anclado?', options: ['Saludo, pregunta, ejemplo y despedida', 'Contexto, encargo, límites y parada', 'Código, error, versión y fecha', 'Entrada, salida, bucle y fin'], answer: 1, explain: 'Contexto fija el entorno; encargo, una acción; límites, lo no admisible; parada, el formato.' },
          { type: 'mc', q: '¿Qué afirmación sobre un chat de IA es correcta?', options: ['Su seguridad al responder garantiza que acierte', 'No tiene acceso a los ficheros del servidor', 'El mismo prompt da siempre la misma respuesta', 'Ejecuta las órdenes en el servidor'], answer: 1, explain: 'El usuario es el único canal.' },
          { type: 'mc', q: '¿Qué información **sí** puede introducirse en el asistente?', options: ['La dirección del servidor', 'Las calificaciones de la clase', 'Los scripts del repositorio de clase', 'Tu contraseña'], answer: 2, explain: 'También enunciados del curso y ficheros públicos del PDB.' },
          { type: 'mc', q: 'La IA propone una opción de grep que no conoces. ¿Qué haces?', options: ['Ejecutarla directamente', 'Consultarla en man grep o grep --help', 'Preguntarle si está segura', 'Usar sudo'], answer: 1, explain: 'Si la orden no la reconoce, la propuesta se descarta.' },
          { type: 'mc', q: '¿Cuál es la alternativa segura a `curl https://… | bash`?', options: ['sudo curl … | bash', 'curl -O y leer el fichero con less antes', 'chmod 777', 'Ejecutarlo dos veces'], answer: 1, explain: 'Así no ejecutas código sin leerlo.' },
          { type: 'mc', q: 'Ante un *Permission denied* en tu script, la opción adecuada es…', options: ['chmod 777 *.sh', 'chmod u+x mi-03.sh', 'sudo bash', 'rm -rf'], answer: 1, explain: '777 da escritura a terceros.' },
          { type: 'mc', q: '¿Qué contiene la declaración de uso de IA?', options: ['Solo el nombre de la herramienta', 'Herramienta y fecha, aportación concreta y comprobación realizada', 'El prompt completo', 'La contraseña de Gemini'], answer: 1, explain: 'En una frase.' },
          { type: 'mc', q: '¿Qué es una alucinación de un modelo de lenguaje?', options: ['Un error de conexión', 'Contenido plausible pero falso', 'Una respuesta lenta', 'Un aviso de seguridad'], answer: 1, explain: 'Opciones, rutas o paquetes inexistentes.' },
          { type: 'mc', q: 'Al pedir ayuda con un error, ¿qué se aporta?', options: ['Un resumen del problema', 'El script completo y el mensaje de error literal', 'Solo el número de línea', 'La IP del servidor'], answer: 1, explain: 'Y se pide primero la explicación.' },
        ],
      },
      {
        title: 'Test 1C · estructural',
        exercises: [
          { type: 'mc', q: '¿Qué programa descarga una entrada del Protein Data Bank?', options: ['pdb_wc', 'pdb_fetch', 'freesasa', 'which'], answer: 1, explain: 'Con > se guarda en un fichero.' },
          { type: 'mc', q: '¿Qué hace `pdb_wc -h 1hvr.pdb`?', options: ['Muestra la ayuda', 'Cuenta las líneas HETATM', 'Cuenta los hidrógenos', 'Da la versión'], answer: 1, explain: 'En pdb_wc, -h no es la ayuda.' },
          { type: 'mc', q: 'Por defecto, ¿qué átomos mide freesasa?', options: ['Todos', 'Solo los ATOM, sin hidrógenos', 'Solo los HETATM', 'Solo los hidrógenos'], answer: 1, explain: '--hetatm y --hydrogen los incluyen.' },
          { type: 'mc', q: 'En 1HVR, pdb_wc cuenta 1826 átomos y freesasa 1500. ¿Por qué?', options: ['freesasa tiene un error', 'freesasa deja fuera los 326 hidrógenos', 'Faltan cadenas', 'pdb_wc cuenta dos veces'], answer: 1, explain: '1826 − 326 = 1500.' },
          { type: 'mc', q: '¿Qué radio tiene la sonda con la que se calcula la SASA?', options: ['0,14 Å', '1,4 Å', '14 Å', '1,4 nm'], answer: 1, explain: 'Una molécula de agua.' },
          { type: 'mc', q: '¿Cómo se calcula la fracción apolar de una proteína?', options: ['Total / Apolar', 'Apolar / Total', 'Polar − Apolar', 'Apolar × residuos'], answer: 1, explain: '1CRN: 1969,33 / 2999,32 = 0,657.' },
          { type: 'mc', q: 'En la salida de freesasa, **Apolar** corresponde a…', options: ['Nitrógeno', 'Carbono', 'Oxígeno y azufre', 'Hidrógeno'], answer: 1, explain: 'Polar: N, O y S.' },
          { type: 'mc', q: '¿Cómo se validan los residuos de pdb_wc con grep?', options: ["grep -c '^ATOM'", "contando los carbonos alfa: grep ' CA '", 'grep -c HETATM', 'wc -l'], answer: 1, explain: 'Un CA por residuo.' },
          { type: 'mc', q: '¿Para qué sirve `if [ ! -f "$id.pdb" ]` en sasa-diez.sh?', options: ['Para borrar el fichero', 'Para descargar solo si el fichero no existe', 'Para comprobar permisos', 'Para contar átomos'], answer: 1, explain: 'No repite descargas ni sobrescribe.' },
          { type: 'mc', q: 'BLAST y el alineamiento múltiple pertenecen a la rama de…', options: ['Bioinformática estructural', 'Análisis de secuencias', 'Permisos', 'Dinámica molecular'], answer: 1, explain: 'Tema 7 del curso.' },
          { type: 'mc', q: 'En `freesasa --format=rsa`, la columna REL indica…', options: ['El área absoluta', 'El porcentaje expuesto respecto a un valor de referencia', 'El número de átomos', 'La cadena'], answer: 1, explain: 'Por ejemplo, Cys 40: 33,8 %.' },
        ],
      },
    ],
  },
];

// Índices de ayuda: cada lección recibe un id estable "unidad-n".
UNITS.forEach(u => u.lessons.forEach((l, i) => { l.id = `${u.id}-${i + 1}`; }));
export const LESSONS = UNITS.flatMap(u => u.lessons.map(l => ({ ...l, unit: u })));
export function lessonById(id) { return LESSONS.find(l => l.id === id); }

// Banco del simulacro (el examen es tipo test de opción múltiple): todas las preguntas
// de opción múltiple del temario. Las que dependen de "tu respuesta" de una tarea también valen.
export const EXAM_POOL = UNITS.flatMap(u => u.lessons.flatMap(l => l.exercises.filter(e => e.type === 'mc')));
