// Temario de Dr.Xinxus: Tema 1A (Linux y scripts de shell) de Bioinformática, UCAM 2026/27.
// Basado en las diapositivas del profesor, la chuleta, el extra de vi, el repositorio de
// clase y las tareas entregadas (tarea2, tarea1a2, trabajo-1a).
//
// Tipos de ejercicio:
//   info  — tarjeta de teoría.            { title, text, code? }
//   mc    — opción múltiple.               { q, code?, options[], answer: índice, explain }
//   fill  — rellenar el hueco ___.         { q, code, options[], answer, explain }
//   order — montar la orden con fichas.    { q, answer: 'orden completa', extra[], explain }
//   bug   — tocar la línea con el error.   { q, lines[], answer: índice, explain }
//   term  — terminal simulada.             { q, setup[], check(sh, last), hint, solution, explain? }
// En los textos, `así` se pinta como código y **así** en negrita.

const H = '/home/bio_alumno';
const T = `${H}/trabajo-1a`;

// Ayudas para comprobar ejercicios de terminal.
// Una línea puede llevar varias órdenes (a; b && c): vale si alguna coincide.
const segs = line => [line.trim(), ...line.split(/\s*(?:;|&&)\s*/).map(s => s.trim())];
const ran = re => (sh, last) => segs(last.line).some(s => re.test(s)) && last.status === 0;
const isDir = p => sh => sh.fs.get(p)?.type === 'd';
const isFile = p => sh => sh.fs.get(p)?.type === 'f';
const cwdIs = p => sh => sh.cwd === p;
const fileHas = (p, re) => sh => { const n = sh.fs.get(p); return !!n && n.type === 'f' && re.test(n.content); };
const outHas = re => (sh, last) => re.test(last.text);
const all = (...fs) => (sh, last) => fs.every(f => f(sh, last));

export const UNITS = [
  // ───────────────────────────── 1 ─────────────────────────────
  {
    id: 'u1', title: 'Conectarse al servidor', icon: '🔌', color: 'green',
    desc: 'Terminal, shell, bash, ssh y MobaXterm.',
    lessons: [
      {
        id: 'u1l1', title: 'Terminal, shell y bash',
        exercises: [
          { type: 'info', title: '¿Quién hace qué?', text: 'La **terminal** es la ventana donde escribes (MobaXterm). El **shell** lee lo que escribes y lo ejecuta. **bash** es el shell concreto del servidor de clase. El **prompt** te dice que bash espera una orden.', code: 'bio_alumno@ubuntu:~$' },
          { type: 'mc', q: '¿Qué programa interpreta y ejecuta las órdenes que escribes?', options: ['La terminal (MobaXterm)', 'El shell (bash)', 'El portátil', 'El prompt'], answer: 1, explain: 'La terminal solo es la ventana. Quien interpreta las órdenes es el shell; en clase, bash.' },
          { type: 'mc', q: 'En este prompt, ¿qué significa la `~`?', code: 'bio_alumno@ubuntu:~$', options: ['Que hay un error', 'Tu directorio HOME', 'La raíz del sistema /', 'Que eres administrador'], answer: 1, explain: '`~` es la abreviatura de tu HOME, `/home/tu_usuario`. Antes de la `@` va el usuario y después, la máquina.' },
          { type: 'mc', q: 'Cuando trabajas en MobaXterm conectado al servidor, ¿dónde se ejecutan las órdenes?', options: ['En tu portátil', 'En el servidor Linux remoto', 'En los dos a la vez', 'En GitHub'], answer: 1, explain: 'El portátil solo abre la conexión: las órdenes se ejecutan en el servidor y los ficheros se quedan allí.' },
          { type: 'mc', q: 'En MobaXterm, ¿cómo se abre la conexión con el servidor?', options: ['Session → SSH → Remote host = la IP y Specify username', 'Tools → Games', 'Abrir el Bloc de notas', 'Session → RDP'], answer: 0, explain: 'Session → SSH, en Remote host pones la IP del servidor y marcas Specify username con tu usuario.' },
          { type: 'order', q: 'Monta la orden para conectarte desde la Terminal de macOS (usuario `usuario`, IP `192.0.2.10`).', answer: 'ssh usuario@192.0.2.10', extra: ['exit', 'cd'], explain: 'ssh usuario@IP abre la conexión. Es lo mismo que hace MobaXterm por debajo.' },
          { type: 'mc', q: 'Al escribir la contraseña no aparece nada en pantalla. ¿Qué pasa?', options: ['El teclado no funciona', 'Es normal: la contraseña no se ve al escribirla', 'El servidor está caído', 'Hay que escribirla dos veces'], answer: 1, explain: 'Por seguridad no se muestra ni un asterisco. Escríbela y pulsa Enter.' },
          { type: 'mc', q: 'Escribes `hostname` y sale el nombre de tu portátil. ¿Qué significa?', options: ['Que todo va bien', 'Que estás trabajando en local: la conexión ssh no está activa', 'Que el servidor se llama como tu portátil', 'Que te falta permiso x'], answer: 1, explain: 'Justo lo que respondiste en la tarea 2: si sale tu portátil, no estás en el servidor.' },
        ],
      },
      {
        id: 'u1l2', title: 'Primera comprobación',
        exercises: [
          { type: 'info', title: 'Las 4 órdenes del primer día', text: 'Nada más entrar, comprueba dónde estás:', code: 'hostname     # en qué máquina\nwhoami       # con qué usuario\npwd          # en qué directorio\necho $SHELL  # qué shell (debe ser /bin/bash)' },
          { type: 'term', q: 'Comprueba en qué **máquina** estás.', check: ran(/^hostname$/), hint: 'Es una sola palabra: host + name.', solution: 'hostname' },
          { type: 'term', q: 'Comprueba con qué **usuario** estás conectado.', check: ran(/^whoami$/), hint: 'En inglés: "¿quién soy?"', solution: 'whoami' },
          { type: 'term', q: 'Muestra qué **shell** tienes. Debe salir `/bin/bash`.', check: all(ran(/^echo\s+("?)\$\{?SHELL\}?\1$/), outHas(/\/bin\/bash/)), hint: 'echo escribe el valor de una variable si le pones $ delante.', solution: 'echo $SHELL' },
          { type: 'fill', q: 'Completa para ver tu directorio HOME.', code: 'echo ___', options: ['$HOME', 'HOME', '~HOME', '$home'], answer: '$HOME', explain: 'Las variables se leen con `$` y distinguen mayúsculas: `$HOME`.' },
          { type: 'mc', q: '¿Qué responde `type cd`?', options: ['cd is /usr/bin/cd', 'cd is a shell builtin', 'command not found', 'cd: missing operand'], answer: 1, explain: 'cd es una orden **interna**: forma parte del propio bash.' },
          { type: 'mc', q: '¿Y `type cut`?', options: ['cut is a shell builtin', 'cut is /usr/bin/cut', 'cut is a shell keyword', 'Nada'], answer: 1, explain: 'cut es una orden **externa**: un programa aparte que está en /usr/bin.' },
          { type: 'term', q: 'Pruébalo tú: pregunta a bash qué tipo de orden es `pwd`.', check: all(ran(/^type\s+pwd$/)), hint: 'type seguido del nombre de la orden.', solution: 'type pwd' },
          { type: 'mc', q: '¿Con qué orden se cierra la sesión ssh?', options: ['quit', 'exit', 'close', 'Ctrl+S'], answer: 1, explain: '`exit` (o `logout`) cierra la sesión.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 2 ─────────────────────────────
  {
    id: 'u2', title: 'Rutas y navegación', icon: '🧭', color: 'blue',
    desc: 'El árbol de ficheros, rutas absolutas y relativas, cd.',
    lessons: [
      {
        id: 'u2l1', title: 'El árbol de ficheros',
        exercises: [
          { type: 'info', title: 'Todo cuelga de /', text: 'Linux organiza todo en un árbol que empieza en la raíz `/`. Tu cuenta está en `/home/tu_usuario`, que se abrevia `~`.\n\nUna ruta **absoluta** empieza por `/` y vale desde cualquier sitio. Una **relativa** parte del directorio actual.', code: '/home/bio_alumno/trabajo-1a   # absoluta\ntrabajo-1a                    # relativa (desde ~)\n..                            # el directorio de arriba' },
          { type: 'mc', q: '¿Cuál de estas rutas es **absoluta**?', options: ['trabajo-1a/ejemplo.pdb', '../tarea2', '/home/bio_alumno/tarea2', 'datos/nota.txt'], answer: 2, explain: 'Las absolutas empiezan por `/`.' },
          { type: 'mc', q: 'Estas cuatro órdenes llevan a algún sitio. ¿Cuál **depende** de dónde estés?', code: 'cd ~\ncd\ncd /home/bio_alumno\ncd ../..', options: ['cd ~', 'cd', 'cd /home/bio_alumno', 'cd ../..'], answer: 3, explain: 'Como contestaste en la tarea 1a2: `..` sube desde donde estás, así que el destino cambia. Las otras tres te llevan siempre a tu HOME.' },
          { type: 'mc', q: 'En `ls -l`, ¿cómo sabes que `datos` es un directorio?', code: 'drwxrwxr-x 2 bio_alumno bio_alumno 4096 Oct  9 10:12 datos\n-rw-rw-r-- 1 bio_alumno bio_alumno    0 Oct  9 10:12 nota.txt', options: ['Porque pesa 4096', 'Porque su línea empieza por d', 'Porque no tiene extensión', 'Porque tiene permiso x'], answer: 1, explain: 'El primer carácter es el tipo: `d` directorio, `-` fichero.' },
          { type: 'term', q: '¿En qué directorio estás ahora mismo?', check: ran(/^pwd$/), hint: 'print working directory', solution: 'pwd' },
          { type: 'term', q: 'Entra en el directorio `trabajo-1a`.', check: cwdIs(T), hint: 'cd y el nombre del directorio.', solution: 'cd trabajo-1a' },
          { type: 'term', q: 'Lista con detalle (permisos, tamaño, fecha) lo que hay en `trabajo-1a`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^ls\s+(-\w*l\w*)(\s+\.)?$/)), hint: 'ls con la opción de formato largo.', solution: 'ls -l' },
          { type: 'bug', q: 'En tu historial salía este error. ¿Qué línea falla?', lines: ['cd ~', 'cd~', 'pwd'], answer: 1, explain: 'Falta el espacio: bash busca una orden llamada `cd~`, que no existe → `cd~: command not found`.' },
        ],
      },
      {
        id: 'u2l2', title: 'Moverse sin perderse',
        exercises: [
          { type: 'info', title: 'Las de todos los días', text: 'Con estas tres te mueves por todo el servidor:', code: 'cd dir     # entrar\ncd ..      # subir un nivel\ncd ~       # volver a HOME (también: cd)' },
          { type: 'fill', q: 'Completa para **subir un nivel**.', code: 'cd ___', options: ['..', '.', '~', '/'], answer: '..', explain: '`..` es el directorio padre. `.` es el actual.' },
          { type: 'term', q: 'Estás dentro de `scripts`. Sube **un** nivel.', setup: ['mkdir -p ~/tarea1a2/scripts', 'cd ~/tarea1a2/scripts'], check: cwdIs(`${H}/tarea1a2`), hint: 'Dos puntos.', solution: 'cd ..' },
          { type: 'term', q: 'Estás en `/bin`. Vuelve a tu HOME.', setup: ['cd /bin'], check: cwdIs(H), hint: 'cd sin nada, o cd ~', solution: 'cd ~' },
          { type: 'mc', q: 'Desde tu HOME escribes `cd /directorio_1` y falla, aunque `~/directorio_1` existe. ¿Por qué?', options: ['Porque falta -r', 'La / del principio la convierte en ruta absoluta: busca /directorio_1 en la raíz', 'Porque los directorios no pueden llevar números', 'Porque falta permiso x'], answer: 1, explain: 'Otro clásico de tu historial: sin la `/` (o con `~/` delante) sería relativa a tu HOME.' },
          { type: 'order', q: 'Monta la orden para ir de una vez a `scripts`, dentro de `tarea1a2`, en tu HOME.', answer: 'cd ~/tarea1a2/scripts', extra: ['/tarea1a2', '..'], explain: '`~/` funciona desde cualquier sitio porque empieza en tu HOME.' },
          { type: 'mc', q: 'Escribes `mkdir /home/bio_2487816/directorio_1` y responde *No such file or directory*. ¿Qué ha pasado?', options: ['El directorio ya existía', 'Hay una errata en el usuario: /home/bio_2487816 no existe', 'mkdir necesita -r', 'No se pueden crear directorios en HOME'], answer: 1, explain: 'Pasó en tu historial: un dígito de más en el nombre de usuario. Revisa las rutas largas o usa `~`.' },
          { type: 'term', q: 'Entra en la carpeta `tema-1a-linux` del repositorio de clase **con una sola orden** desde HOME.', check: cwdIs(`${H}/bioinformatica_26-27/tema-1a-linux`), hint: 'cd y la ruta relativa con / entre carpetas.', solution: 'cd bioinformatica_26-27/tema-1a-linux' },
        ],
      },
    ],
  },

  // ───────────────────────────── 3 ─────────────────────────────
  {
    id: 'u3', title: 'Ficheros y directorios', icon: '📁', color: 'yellow',
    desc: 'mkdir, touch, cp, mv, rm, cat, head, tail, wc.',
    lessons: [
      {
        id: 'u3l1', title: 'Crear, copiar y mover',
        exercises: [
          { type: 'info', title: 'Crear y copiar', text: 'Así se construye una carpeta de tarea:', code: 'mkdir datos            # crea un directorio\ntouch nota.txt         # crea un fichero vacío\ncp nota.txt datos/     # copia un fichero\ncp -r datos copia      # copia un directorio entero\nmv copia respaldo      # mueve o renombra' },
          { type: 'term', q: 'Crea un directorio llamado `datos`.', setup: ['mkdir ~/tarea1a2', 'cd ~/tarea1a2'], check: isDir(`${H}/tarea1a2/datos`), hint: 'make directory', solution: 'mkdir datos' },
          { type: 'term', q: 'Crea un fichero **vacío** llamado `nota.txt`.', setup: ['mkdir -p ~/tarea1a2/datos', 'cd ~/tarea1a2'], check: isFile(`${H}/tarea1a2/nota.txt`), hint: 'La orden que "toca" un fichero.', solution: 'touch nota.txt' },
          { type: 'term', q: 'Copia `nota.txt` dentro del directorio `datos`.', setup: ['mkdir -p ~/tarea1a2/datos', 'cd ~/tarea1a2', 'touch nota.txt'], check: isFile(`${H}/tarea1a2/datos/nota.txt`), hint: 'cp origen destino', solution: 'cp nota.txt datos' },
          { type: 'mc', q: '¿Qué pasa con `cp datos datos_copia` si `datos` es un directorio?', options: ['Copia todo sin problema', 'cp: -r not specified; omitting directory \'datos\'', 'Borra datos', 'Crea un fichero vacío'], answer: 1, explain: 'Sin `-r` cp solo copia ficheros, no directorios con lo que llevan dentro.' },
          { type: 'term', q: 'Ahora sí: copia el directorio `datos` entero como `datos_copia`.', setup: ['mkdir -p ~/tarea1a2/datos', 'cd ~/tarea1a2', 'touch datos/nota.txt'], check: isFile(`${H}/tarea1a2/datos_copia/nota.txt`), hint: 'cp con la opción recursiva.', solution: 'cp -r datos datos_copia' },
          { type: 'term', q: 'Cambia el nombre de `datos_copia` a `copia_seguridad`.', setup: ['mkdir -p ~/tarea1a2/datos_copia', 'cd ~/tarea1a2'], check: all(isDir(`${H}/tarea1a2/copia_seguridad`), sh => !sh.fs.get(`${H}/tarea1a2/datos_copia`)), hint: 'Renombrar en Linux es mover.', solution: 'mv datos_copia copia_seguridad' },
          { type: 'bug', q: 'Estas órdenes salen de tu historial. ¿Cuál está mal escrita?', lines: ['mkdir carpeta_1', 'mkadir carpeta_2', 'mkdir carpeta_3'], answer: 1, explain: '`mkadir` no existe → `mkadir: command not found`. Pista: usa la tecla Tab para autocompletar.' },
          { type: 'bug', q: '¿Qué línea no copia el directorio?', lines: ['cd ~', 'cd -r carpeta_1 directorio_1', 'ls -l'], answer: 1, explain: 'Para copiar es `cp -r`, no `cd -r`. bash responde `cd: -r: invalid option`.' },
        ],
      },
      {
        id: 'u3l2', title: 'Mirar y borrar',
        exercises: [
          { type: 'info', title: 'Mirar dentro', text: 'Para ver el contenido sin editarlo:', code: 'cat f        # todo el fichero\nhead -n 5 f  # las 5 primeras líneas\ntail -n 5 f  # las 5 últimas\nwc -l f      # cuántas líneas\nfile f       # qué tipo de fichero es' },
          { type: 'term', q: 'Muestra el contenido completo de `ejemplo.pdb`.', setup: ['cd ~/trabajo-1a'], check: ran(/^cat\s+ejemplo\.pdb$/), hint: 'La orden más corta para ver un fichero entero.', solution: 'cat ejemplo.pdb' },
          { type: 'fill', q: 'Completa para ver solo las **2 primeras** líneas.', code: 'head ___ 2 ejemplo.pdb', options: ['-n', '-l', '-c', '-2'], answer: '-n', explain: '`-n N` indica cuántas líneas.' },
          { type: 'term', q: '¿Cuántas líneas tiene `ejemplo.pdb`? Usa `wc`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^wc\s+-l\s+ejemplo\.pdb$|^wc\s+ejemplo\.pdb$/)), hint: 'wc con la opción de líneas.', solution: 'wc -l ejemplo.pdb' },
          { type: 'mc', q: 'Haces `rm -r copia_seguridad`. ¿Cómo la recuperas?', options: ['De la papelera', 'Con undo', 'No se puede: en la terminal no hay papelera', 'Con cd ..'], answer: 2, explain: 'rm borra para siempre. Piensa dos veces antes de un `rm -r`.' },
          { type: 'term', q: 'Borra el directorio `copia_seguridad` con todo lo que contiene.', setup: ['mkdir -p ~/tarea1a2/copia_seguridad', 'touch ~/tarea1a2/copia_seguridad/nota.txt', 'cd ~/tarea1a2'], check: sh => !sh.fs.get(`${H}/tarea1a2/copia_seguridad`), hint: 'rm necesita una opción para borrar directorios.', solution: 'rm -r copia_seguridad' },
          { type: 'mc', q: 'Escribes `mkdir datos` por segunda vez. ¿Qué responde?', options: ['Nada, lo sobrescribe', "mkdir: cannot create directory ‘datos’: File exists", 'Borra el contenido', 'Crea datos(1)'], answer: 1, explain: 'Como viste en el ejercicio 2 de la tarea: ya existe y no lo toca.' },
          { type: 'mc', q: '¿Qué dice `file 00-clear-date.sh`?', options: ['ASCII text', 'Bourne-Again shell script, ASCII text executable', 'ELF 64-bit LSB pie executable', 'directory'], answer: 1, explain: 'Es un script de bash. `/bin/ls`, en cambio, es un programa compilado (ELF).' },
          { type: 'mc', q: 'Escribes `cat` sin nada más y la terminal se queda "colgada". ¿Qué hago?', options: ['Cerrar MobaXterm', 'Ctrl+C', 'Escribir exit', 'Esperar'], answer: 1, explain: 'Sin fichero, cat lee del teclado. Ctrl+C lo corta.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 4 ─────────────────────────────
  {
    id: 'u4', title: 'Editores: vi y nano', icon: '✏️', color: 'purple',
    desc: 'Editar ficheros sin ratón dentro del servidor.',
    lessons: [
      {
        id: 'u4l1', title: 'vi y sus dos modos',
        exercises: [
          { type: 'info', title: 'vi tiene dos modos', text: 'En el servidor no hay ratón ni menú Archivo. vi tiene:\n\n**Edición** (al abrir): órdenes como `dd`, `u`, `:w`, `:q`.\n**Inserción**: escribir texto. Abajo pone `-- INSERT --`.', code: 'Esc + i    → modo inserción\nEsc Esc    → modo edición' },
          { type: 'mc', q: 'Abres un fichero con vi. ¿En qué modo estás?', options: ['Inserción', 'Edición (normal)', 'Visual', 'Ninguno'], answer: 1, explain: 'vi siempre abre en modo edición: si tecleas letras, son órdenes.' },
          { type: 'mc', q: '¿Qué tecla, desde edición, te pone a escribir texto?', options: ['w', 'i', 'q', 'd'], answer: 1, explain: '`i` de *insert*. Abajo aparece `-- INSERT --`.' },
          { type: 'mc', q: 'Estás escribiendo y quieres volver al modo edición.', options: ['Enter', 'Esc (dos veces para asegurar)', 'Ctrl+X', ':q'], answer: 1, explain: 'Escape. Si dudas en qué modo estás, Esc Esc y mira la barra de abajo.' },
          { type: 'mc', q: 'En modo edición, ¿qué borra la línea entera del cursor?', options: ['x', 'dd', 'Supr', ':d'], answer: 1, explain: '`dd`. Y `10dd` borra 10 líneas.' },
          { type: 'mc', q: 'Has borrado de más. ¿Cómo deshaces?', options: ['Ctrl+Z', 'u', ':undo!', 'Esc'], answer: 1, explain: '`u` (*undo*) en modo edición. Cada `u` deshace una acción.' },
          { type: 'mc', q: '`yy` copia la línea. ¿Qué la pega debajo?', options: ['v', 'p', 'Ctrl+V', 'y'], answer: 1, explain: '`p` de *paste*.' },
        ],
      },
      {
        id: 'u4l2', title: 'Guardar, salir y nano',
        exercises: [
          { type: 'info', title: 'Guardar y salir', text: 'Siempre desde modo edición (Esc Esc):', code: ':w     guardar\n:q     salir\n:wq    guardar y salir\n:q!    salir SIN guardar' },
          { type: 'fill', q: 'Quieres **guardar y salir** de vi.', code: ':___', options: ['wq', 'q!', 'x!', 'save'], answer: 'wq', explain: 'w (*write*) + q (*quit*).' },
          { type: 'mc', q: 'La has liado y quieres salir **sin guardar** nada.', options: [':wq', ':q', ':q!', 'Ctrl+C'], answer: 2, explain: 'El `!` fuerza la salida descartando los cambios. Solo si estás seguro.' },
          { type: 'mc', q: 'En **nano**, ¿qué combinación guarda?', options: ['Ctrl+S', 'Ctrl+O', 'Ctrl+X', ':w'], answer: 1, explain: 'En nano: Ctrl+O guarda (*write Out*) y Ctrl+X sale.' },
          { type: 'term', q: 'Crea un fichero vacío `atomos.txt` y comprueba con `ls -l` que su tamaño es 0. (Escribe las dos órdenes, una detrás de otra.)', setup: ['cd ~/trabajo-1a'], check: all(isFile(`${T}/atomos.txt`), ran(/^ls\s+-l\s+atomos\.txt$/)), hint: 'touch atomos.txt y después ls -l atomos.txt', solution: 'touch atomos.txt; ls -l atomos.txt' },
          { type: 'term', q: 'Abre `atomos.txt` con **vi**, escribe una línea `ATOM 1 N ALA A 1` y guarda con `:wq`.', setup: ['cd ~/trabajo-1a', 'touch atomos.txt'], check: fileHas(`${T}/atomos.txt`, /ATOM/), hint: 'vi atomos.txt → toca el botón i → escribe → Esc → :wq', solution: 'vi atomos.txt' },
          { type: 'mc', q: 'Has salido de vi. ¿Cómo compruebas, sin abrirlo, que se guardó el texto?', options: ['vi otra vez', 'cat atomos.txt (y ls -l para ver que ya no pesa 0)', 'rm atomos.txt', 'mkdir atomos.txt'], answer: 1, explain: '"Nunca os creáis lo que acabáis de hacer: comprobadlo".' },
        ],
      },
    ],
  },

  // ───────────────────────────── 5 ─────────────────────────────
  {
    id: 'u5', title: 'Material de clase con Git', icon: '🐙', color: 'orange',
    desc: 'git clone una vez, git pull cada clase.',
    lessons: [
      {
        id: 'u5l1', title: 'clone, pull y la copia de trabajo',
        exercises: [
          { type: 'info', title: 'El ciclo del aula', text: 'Los scripts del curso están en GitHub.\n\n**git clone** trae una copia la primera vez.\n**git pull**, dentro del repo, la pone al día cada clase.\nLa copia del repo **no se edita**: se trabaja en `~/trabajo-1a`. Así `git pull` nunca choca con tus cambios.' },
          { type: 'mc', q: '¿Qué orden usas **una sola vez**, el primer día?', options: ['git pull', 'git clone', 'git status', 'git push'], answer: 1, explain: 'clone crea la carpeta bioinformatica_26-27. Después, cada clase, pull.' },
          { type: 'term', q: 'Aún no tienes el repositorio. Clónalo en tu HOME.', setup: ['rm -rf ~/bioinformatica_26-27'], opts: { repo: false }, check: isDir(`${H}/bioinformatica_26-27/tema-1a-linux`), hint: 'git clone https://github.com/hperez-ucam/bioinformatica_26-27.git', solution: 'git clone https://github.com/hperez-ucam/bioinformatica_26-27.git' },
          { type: 'order', q: 'Monta las órdenes para actualizar el material antes de clase.', answer: 'cd ~/bioinformatica_26-27 ; git pull', extra: ['git clone', 'cd ..'], explain: 'Primero entras en el repo; pull solo funciona dentro.' },
          { type: 'term', q: 'Ponte en el repositorio y tráete los cambios del profesor.', check: all(cwdIs(`${H}/bioinformatica_26-27`), ran(/^git\s+pull$/)), hint: 'cd ~/bioinformatica_26-27 y luego git pull', solution: 'cd ~/bioinformatica_26-27 && git pull' },
          { type: 'mc', q: '¿Por qué no se editan los scripts directamente dentro de `bioinformatica_26-27`?', options: ['Porque no tienes permiso', 'Porque git pull chocaría con tus cambios', 'Porque se borran solos', 'Porque vi no funciona ahí'], answer: 1, explain: 'Te pasó en clase: tuviste que hacer `git stash` para poder hacer pull.' },
          { type: 'term', q: '`git pull` se queja de cambios locales en un script. Mira primero qué has tocado.', setup: ['cd ~/bioinformatica_26-27', 'echo "# cambio" >> tema-1a-linux/11-asignar-mils.sh'], check: ran(/^git\s+status$/), hint: 'La orden que te dice el estado del repo.', solution: 'git status' },
          { type: 'term', q: 'Aparta esos cambios y vuelve a hacer pull.', setup: ['cd ~/bioinformatica_26-27', 'echo "# cambio" >> tema-1a-linux/11-asignar-mils.sh'], check: all(sh => sh.history.some(h => /git\s+stash/.test(h)), ran(/git\s+pull$/)), hint: 'git stash y después git pull', solution: 'git stash; git pull' },
          { type: 'term', q: 'Copia `12-errores.sh` y `ejemplo.pdb` del repo a tu copia de trabajo `~/trabajo-1a`.', setup: ['rm -rf ~/trabajo-1a', 'mkdir ~/trabajo-1a', 'cd ~/bioinformatica_26-27'], check: all(isFile(`${T}/12-errores.sh`), isFile(`${T}/ejemplo.pdb`)), hint: 'cp acepta varios orígenes y el destino al final.', solution: 'cp tema-1a-linux/12-errores.sh tema-1a-linux/ejemplo.pdb ~/trabajo-1a/' },
        ],
      },
    ],
  },

  // ───────────────────────────── 6 ─────────────────────────────
  {
    id: 'u6', title: 'Redirección y tuberías', icon: '🚰', color: 'blue',
    desc: '>, >>, <, | y grep para encadenar órdenes.',
    lessons: [
      {
        id: 'u6l1', title: 'Guardar la salida: > y >>',
        exercises: [
          { type: 'info', title: 'Redirección', text: 'La salida de una orden puede ir a un fichero en vez de a la pantalla:', code: 'ls -l > ej02.txt     # crea o SOBRESCRIBE\necho hola >> log.txt # AÑADE al final\nsort < datos.txt     # lee de un fichero' },
          { type: 'mc', q: '`ls -l > lista.txt` y `lista.txt` ya tenía cosas. ¿Qué pasa?', options: ['Se añade al final', 'Se sobrescribe: lo anterior se pierde', 'Da error', 'Se crea lista(1).txt'], answer: 1, explain: '`>` sobrescribe. Para añadir, `>>`.' },
          { type: 'term', q: 'Guarda el listado detallado del directorio en `ej02.txt`.', setup: ['mkdir -p ~/tarea1a2/datos ~/tarea1a2/resultados', 'cd ~/tarea1a2'], check: fileHas(`${H}/tarea1a2/ej02.txt`, /datos/), hint: 'ls -l y redirige con >', solution: 'ls -l > ej02.txt' },
          { type: 'fill', q: 'Guarda en ej01.txt la ruta en la que estás (ejercicio 1 de la tarea 1a2).', code: 'pwd ___ ~/tarea1a2/ej01.txt', options: ['>', '|', '<', '&'], answer: '>', explain: '`>` manda la salida de pwd al fichero.' },
          { type: 'term', q: 'Guarda la información completa del sistema (`uname -a`) en `ej05.txt`.', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2'], check: fileHas(`${H}/tarea1a2/ej05.txt`, /x86_64/), hint: 'uname -a > ...', solution: 'uname -a > ej05.txt' },
          { type: 'term', q: 'Añade la fecha **al final** de `ej05.txt` sin borrar lo que había.', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2', 'uname -a > ej05.txt'], check: all(fileHas(`${H}/tarea1a2/ej05.txt`, /x86_64[\s\S]*\d{2}:\d{2}:\d{2}/)), hint: 'date con el operador que añade.', solution: 'date >> ej05.txt' },
          { type: 'bug', q: 'Esto pasó en tu historial al hacer el ejercicio 10. ¿Qué línea es el problema?', lines: ['./01-parametros.sh a b c d e > ../', 'ej10.txt', 'cat ../ej10.txt'], answer: 0, explain: 'El nombre del fichero tiene que ir pegado al `>` en la misma orden: `> ../ej10.txt`. Con `> ../` intentas escribir en un directorio.' },
        ],
      },
      {
        id: 'u6l2', title: 'Tuberías y grep',
        exercises: [
          { type: 'info', title: 'La tubería |', text: 'La salida de una orden entra directamente en la siguiente, sin ficheros temporales.\n\n**grep** filtra las líneas que contienen un patrón. `^` significa "al principio de la línea".', code: "grep ATOM ejemplo.pdb | wc -l\ngrep -c '^ATOM' 1HVR.pdb\nhead -n 2 ej06.txt | tail -n 1" },
          { type: 'term', q: 'Cuenta cuántas líneas de `ejemplo.pdb` contienen ATOM usando una **tubería** con `wc -l`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^grep\s+.*ATOM.*ejemplo\.pdb\s*\|\s*wc\s+-l$/)), hint: 'grep ATOM ejemplo.pdb | ...', solution: 'grep ATOM ejemplo.pdb | wc -l' },
          { type: 'fill', q: 'Cuenta directamente las líneas que **empiezan** por ATOM.', code: "grep ___ '^ATOM' 1HVR.pdb", options: ['-c', '-v', '-q', '-n'], answer: '-c', explain: '`-c` cuenta en vez de escribir las líneas.' },
          { type: 'term', q: '¿Cuántas líneas ATOM tiene `1HVR.pdb`? Usa grep con `-c` y el ancla `^`.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/^1826\s*$/m)), hint: "grep -c '^ATOM' 1HVR.pdb", solution: "grep -c '^ATOM' 1HVR.pdb" },
          { type: 'order', q: 'Saca **solo la segunda línea** de `ej06.txt` con una tubería (ejercicio 7).', answer: 'head -n 2 ej06.txt | tail -n 1', extra: ['>', '-c'], explain: 'Te quedas con las 2 primeras y de esas, la última.' },
          { type: 'mc', q: '¿Qué imprime `grep -q ATOM ejemplo.pdb`?', options: ['Las líneas con ATOM', 'El número de líneas', 'Nada: solo deja el código de salida (0 si encuentra)', 'Un error'], answer: 2, explain: '`-q` (quiet) se usa en los `if`: decide por el código de salida.' },
          { type: 'mc', q: '¿Qué hace `grep -v HETATM 1HVR.pdb`?', options: ['Solo las líneas HETATM', 'Todas las líneas que NO contienen HETATM', 'Cuenta las HETATM', 'Muestra la versión de grep'], answer: 1, explain: '`-v` invierte el filtro.' },
          { type: 'term', q: 'Muestra solo las **3 primeras** líneas ATOM de `1HVR.pdb`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/grep.*ATOM.*1HVR\.pdb\s*\|\s*head\s+(-n\s*)?-?3$/)), hint: "grep '^ATOM' 1HVR.pdb | head -n 3", solution: "grep '^ATOM' 1HVR.pdb | head -n 3" },
        ],
      },
    ],
  },

  // ───────────────────────────── 7 ─────────────────────────────
  {
    id: 'u7', title: 'Usuario, sistema y procesos', icon: '🖥️', color: 'green',
    desc: 'id, who, uname, ps y qué es un proceso.',
    lessons: [
      {
        id: 'u7l1', title: '¿Quién soy y qué corre?',
        exercises: [
          { type: 'info', title: 'Usuario y sistema', code: 'id        # uid, gid y grupos\nwho       # quién está conectado\nuname -a  # kernel y arquitectura\nps        # mis procesos\nps -ef    # todos los procesos', text: 'Un **proceso** es un programa en ejecución, con su número (**PID**).' },
          { type: 'term', q: 'Muestra tu número de usuario (uid) y tus grupos.', check: ran(/^id$/), hint: 'Dos letras.', solution: 'id' },
          { type: 'mc', q: 'Según `uname -a`, el servidor es `x86_64`. ¿Por qué importa?', options: ['No importa', 'Los programas se compilan para un sistema y una arquitectura: si bajas la versión que no es, no funciona', 'Solo afecta a la velocidad', 'Es el nombre del servidor'], answer: 1, explain: 'Justo tu respuesta del ejercicio 5.' },
          { type: 'term', q: 'Muestra los procesos de tu terminal.', check: ran(/^ps$/), hint: 'process status', solution: 'ps' },
          { type: 'mc', q: '`ps` muestra 3 líneas: la cabecera, `bash` y… `ps`. ¿Por qué sale ps?', code: '    PID TTY          TIME CMD\n2291423 pts/1    00:00:00 bash\n2315229 pts/1    00:00:00 ps', options: ['Es un error', 'ps también es un proceso y se está ejecutando cuando hace la foto', 'Porque lo lanzaste dos veces', 'ps siempre está en marcha'], answer: 1, explain: 'Como escribiste en el ejercicio 6.' },
          { type: 'mc', q: 'Al lanzar un script, cada orden externa (clear, date) es un…', options: ['Proceso padre', 'Proceso hijo del script', 'Fichero', 'Usuario'], answer: 1, explain: 'bash crea un proceso para el script, y este espera a cada hijo: secuencia, no paralelismo.' },
          { type: 'term', q: 'Mira **todos** los procesos del servidor, página a página con `more`.', check: ran(/^ps\s+-ef\s*\|\s*(more|less)$/), hint: 'ps -ef | more', solution: 'ps -ef | more' },
          { type: 'mc', q: '¿Qué guarda la variable especial `$$`?', options: ['El código de salida', 'El PID del shell actual', 'El número de argumentos', 'El dinero gastado'], answer: 1, explain: '`$$` es el PID. Útil para nombres de fichero únicos.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 8 ─────────────────────────────
  {
    id: 'u8', title: 'Permisos y lanzamiento', icon: '🔐', color: 'red',
    desc: 'rwx, chmod, ./ y el PATH.',
    lessons: [
      {
        id: 'u8l1', title: 'Leer rwx',
        exercises: [
          { type: 'info', title: 'Nueve letras', text: 'Tras el tipo (`-` o `d`) vienen 9 letras: **rwx** del dueño (u), del grupo (g) y del resto (o).\n\n**r** leer · **w** escribir · **x** ejecutar', code: '-rwxr-xr--\n uuugggooo' },
          { type: 'mc', q: 'En `-rwxr-xr--`, ¿qué puede hacer el **grupo**?', options: ['Todo', 'Leer y ejecutar', 'Solo leer', 'Nada'], answer: 1, explain: 'Las letras del grupo son `r-x`.' },
          { type: 'mc', q: 'En `-rwxr-xr--`, ¿qué puede hacer el **resto** (otros)?', options: ['Leer y ejecutar', 'Solo leer', 'Escribir', 'Nada'], answer: 1, explain: 'Las tres últimas: `r--`.' },
          { type: 'mc', q: 'info.sh pasó de `-rw-rw-r--` a `-rwxrw-r--`. ¿Qué orden fue?', options: ['chmod +x info.sh', 'chmod u+x info.sh', 'chmod 755 info.sh', 'chmod g+x info.sh'], answer: 1, explain: 'Solo cambió la x del dueño (u). Tu respuesta del ejercicio 8.' },
          { type: 'mc', q: '¿Qué permisos da `chmod 755`?', options: ['rwxr-xr-x', 'rw-r--r--', 'rwxrwxrwx', 'r-xr-xr-x'], answer: 0, explain: '7 = 4+2+1 = rwx; 5 = 4+1 = r-x.' },
          { type: 'mc', q: '¿Y `chmod 644`, típico de un fichero de datos?', options: ['rwxr--r--', 'rw-r--r--', 'rw-rw-rw-', 'r--r--r--'], answer: 1, explain: '6 = 4+2 = rw-; 4 = r--.' },
          { type: 'fill', q: 'Da permiso de ejecución al script.', code: 'chmod ___ hola.sh', options: ['+x', '-x', '+r', '644'], answer: '+x', explain: '`+x` añade la x.' },
        ],
      },
      {
        id: 'u8l2', title: 'Lanzar scripts',
        exercises: [
          { type: 'info', title: 'Dos formas de lanzar', text: 'Con la **x** puesta: `./script.sh`. Sin ella: `bash script.sh` (basta con r).\n\n`./` significa "en este directorio": el shell **no** busca en el directorio actual por su cuenta, solo en el **PATH**.', code: './01-parametros.sh uno dos\nbash 01-parametros.sh uno dos' },
          { type: 'mc', q: '`prueba.sh` tiene `-rw-r--r--`. ¿Qué pasa con cada orden?', code: '$ ./prueba.sh\n$ bash prueba.sh', options: ['Las dos funcionan', './ da Permission denied; bash funciona', 'Las dos fallan', './ funciona; bash falla'], answer: 1, explain: 'Sin x no se puede lanzar como programa, pero bash solo necesita leerlo.' },
          { type: 'term', q: 'Haz ejecutable `info.sh` **solo para ti** y lánzalo con `./`.', setup: ['mkdir -p ~/tarea1a2', 'cd ~/tarea1a2', 'printf \'#!/bin/bash\\n# Mi primer script\\necho " Mis procesos: "\\nps\\necho\\necho "Fecha del sistema:"\\ndate\\n\' > info.sh', 'chmod 664 info.sh'], check: all(sh => !!(sh.fs.get(`${H}/tarea1a2/info.sh`).mode & 0o100), ran(/^\.\/info\.sh$/)), hint: 'chmod u+x info.sh y luego ./info.sh', solution: 'chmod u+x info.sh; ./info.sh' },
          { type: 'mc', q: 'Escribes `00-clear-date.sh` (sin `./`) y sale *command not found*. ¿Por qué?', options: ['Falta la x', 'El directorio actual no está en el PATH', 'El script está roto', 'Falta el shebang'], answer: 1, explain: 'bash busca las órdenes solo en los directorios del PATH. Por eso hace falta `./`.' },
          { type: 'mc', q: '¿Para qué sirve la primera línea `#!/bin/bash`?', options: ['Es un comentario sin efecto', 'Es el shebang: elige el intérprete que ejecuta el script', 'Borra la pantalla', 'Da permisos'], answer: 1, explain: 'Shebang = #!. Tras él, la ruta del intérprete.' },
          { type: 'mc', q: 'En info.sh pones `#` delante de `date`. ¿Qué pasa?', options: ['Da error', 'La fecha ya no sale: la línea es un comentario', 'Sale la fecha dos veces', 'Se borra el fichero'], answer: 1, explain: 'Como contestaste en el ejercicio 8: bash ignora lo que va tras #.' },
          { type: 'bug', q: '¿Qué línea **rompe** el PATH?', lines: ['echo $PATH', 'PATH =PATH:/usr/local/bin', 'PATH="$PATH:$HOME/bin"'], answer: 1, explain: 'No puede haber espacios en la asignación, y además falta el `$` en el segundo PATH.' },
          { type: 'order', q: 'Da permisos rwxr-xr-x a `hola.sh` en modo octal.', answer: 'chmod 755 hola.sh', extra: ['644', '+r'], explain: '7 para ti, 5 para grupo y otros.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 9 ─────────────────────────────
  {
    id: 'u9', title: 'Variables y parámetros', icon: '📦', color: 'yellow',
    desc: 'var=valor, $var, export, $1, $#, shift.',
    lessons: [
      {
        id: 'u9l1', title: 'Variables',
        exercises: [
          { type: 'info', title: 'Asignar y leer', text: 'Se asigna **sin espacios** alrededor del `=`. Se lee con `$`.', code: 'fichero=ejemplo.pdb\necho "$fichero"\nexport fichero   # ahora la heredan los hijos' },
          { type: 'bug', q: '¿Qué línea está mal?', lines: ['mils = "ls -l"', 'echo "$mils"'], answer: 0, explain: 'Con espacios, bash cree que `mils` es una orden: `mils: command not found`.' },
          { type: 'term', q: 'Guarda `ejemplo.pdb` en una variable llamada `fichero` y muestra su valor con echo.', check: all(sh => sh.top.vars.fichero === 'ejemplo.pdb', ran(/echo\s+"?\$\{?fichero\}?"?$/)), hint: 'fichero=ejemplo.pdb; echo "$fichero"', solution: 'fichero=ejemplo.pdb; echo "$fichero"' },
          { type: 'mc', q: '11-asignar-mils.sh tiene estas líneas. ¿Qué hace la **segunda**?', code: 'mils="ls -l"\nmils\n$mils\necho "$mils"', options: ['Ejecuta ls -l', 'Error: mils: command not found', 'Imprime ls -l', 'Nada'], answer: 1, explain: 'Sin `$` busca una orden llamada mils. La tercera ejecuta `ls -l` y la cuarta imprime el texto.' },
          { type: 'mc', q: 'Diferencia entre variable **local** y de **entorno**:', options: ['Ninguna', 'La de entorno la heredan los procesos hijos (export); la local no', 'La local es más rápida', 'La de entorno solo existe en scripts'], answer: 1, explain: 'export convierte una local en variable de entorno.' },
          { type: 'mc', q: '¿Qué vale `$?` después de una orden que ha ido bien?', options: ['1', '0', 'true', 'vacío'], answer: 1, explain: '0 = correcto; cualquier otro valor indica un problema.' },
          { type: 'term', q: 'Comprueba el código de salida de `ls` sobre un fichero que **no existe**.', setup: ['cd ~/trabajo-1a'], check: (sh, last) => segs(last.line).some(s => /^echo\s+"?\$\?"?$/.test(s)) && /^[12]\s*$/m.test(last.text), hint: 'ls no_existe.pdb y después echo $?', solution: 'ls no_existe.pdb; echo $?' },
        ],
      },
      {
        id: 'u9l2', title: 'Parámetros del script',
        exercises: [
          { type: 'info', title: '$0, $1, $#, "$@"', text: 'Lo que escribes detrás del script son **argumentos**; el script los recibe como **parámetros**.', code: '$0     nombre del script\n$1 $2  primer, segundo parámetro (${10} desde el diez)\n$#     cuántos han llegado\n"$@"   todos, uno a uno\nshift  descarta $1 y corre el resto' },
          { type: 'term', q: 'Lanza `01-parametros.sh` con los argumentos `a b c d e`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^\.\/01-parametros\.sh\s+a\s+b\s+c\s+d\s+e$/)), hint: './01-parametros.sh a b c d e', solution: './01-parametros.sh a b c d e' },
          { type: 'mc', q: '`./01-parametros.sh uno dos`. ¿Qué sale en la línea del **tercer** parámetro?', options: ['El tercer parámetro es dos', 'El tercer parámetro es (vacío)', 'Error', 'El tercer parámetro es $3'], answer: 1, explain: '$3 no existe, así que se sustituye por nada.' },
          { type: 'mc', q: 'Y la línea de `$#`, con esos dos argumentos:', options: ['Número de parámetros: 5', 'Número de parámetros: 2', 'Número de parámetros: 3', 'Número de parámetros: 0'], answer: 1, explain: '$# cuenta los argumentos recibidos.' },
          { type: 'mc', q: 'En 02-shift.sh, con `uno dos tres`, ¿qué vale `$1` tras **un** shift?', options: ['uno', 'dos', 'tres', 'vacío'], answer: 1, explain: 'shift descarta $1 y todo se corre una posición.' },
          { type: 'fill', q: 'Si no le pasan argumento, que use `ejemplo.pdb` por defecto (como en 00b-contar-atom.sh).', code: 'fichero=${1:-___}', options: ['ejemplo.pdb', '$1', '0', '"$@"'], answer: 'ejemplo.pdb', explain: '`${1:-valor}`: si $1 está vacío, usa el valor.' },
          { type: 'mc', q: '¿Qué forma es la preferible para recorrer todos los argumentos?', options: ['$*', '"$*"', '"$@"', '$#'], answer: 2, explain: '"$@" los entrega uno a uno, respetando los espacios.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 10 ─────────────────────────────
  {
    id: 'u10', title: 'Condiciones', icon: '🔀', color: 'purple',
    desc: 'if, test [ ], case.',
    lessons: [
      {
        id: 'u10l1', title: 'if y test',
        exercises: [
          { type: 'info', title: 'if', text: 'Ojo: **espacios dentro de los corchetes** y comillas en las variables.', code: 'if [ -f "$fichero" ]; then\n    echo "Existe"\nelif [ -d "$fichero" ]; then\n    echo "Es un directorio"\nelse\n    echo "No existe"\nfi' },
          { type: 'bug', q: '12-errores.sh, primer error. ¿Qué línea da `[: missing ]`?', lines: ['fichero=$1', '', 'if [ -f "$fichero"]; then', '    echo "Existe $fichero"', 'fi'], answer: 2, explain: 'Falta un espacio antes de `]`. Para bash, `"$fichero"]` es una sola palabra.' },
          { type: 'bug', q: 'Segundo error: sin argumento sale `unary operator expected`. ¿Qué línea?', lines: ['fichero=$1', 'if [ -f "$fichero" ]; then', '    echo "Existe $fichero"', 'fi', 'if [ $fichero = "ejemplo.pdb" ]; then', '    echo "Es el PDB de juguete"', 'fi'], answer: 4, explain: '`$fichero` vacío y sin comillas desaparece: queda `[ = "ejemplo.pdb" ]`. Arreglo: `"$fichero"`.' },
          { type: 'mc', q: '¿Qué operador comprueba que algo existe **y es un fichero regular**?', options: ['-e', '-f', '-d', '-s'], answer: 1, explain: '-e existe; -f fichero; -d directorio; -s no vacío.' },
          { type: 'fill', q: 'Comprueba si el número de ATOM es **igual** a 0.', code: 'if [ "$n" ___ 0 ]; then', options: ['-eq', '=', '-z', '-lt'], answer: '-eq', explain: 'Para números: -eq -ne -lt -le -gt -ge. `=` compara texto.' },
          { type: 'mc', q: '¿Qué comprueba `[ -z "$1" ]`?', options: ['Que $1 es cero', 'Que $1 está vacío', 'Que $1 es un fichero', 'Que $1 existe'], answer: 1, explain: '-z: cadena vacía. -n: no vacía.' },
          { type: 'term', q: 'Ejecuta `12-errores.sh` **sin argumento** y lee el error.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^(\.\/|bash\s+)12-errores\.sh$/), outHas(/unary operator expected/)), hint: './12-errores.sh', solution: './12-errores.sh', status: 'any' },
          { type: 'order', q: 'Monta la primera línea de un if que compruebe si existe el directorio `datos`.', answer: 'if [ -d datos ] ; then', extra: ['-f', 'fi'], explain: 'Espacios alrededor de [ y ], y `; then`.' },
        ],
      },
      {
        id: 'u10l2', title: 'case',
        exercises: [
          { type: 'info', title: 'case', text: 'Elige la rama según un **patrón** (glob: `*`, `?`), no una expresión regular. Cada rama acaba en `;;` y todo, en `esac`.', code: 'case $1 in\n    pdb) echo "Estructura 3D" ;;\n    fasta|fa) echo "Secuencia" ;;\n    *) echo "Extensión no reconocida" ;;\nesac' },
          { type: 'mc', q: '`./04-case.sh fa` imprime…', options: ['Estructura 3D', 'Secuencia', 'Extensión no reconocida', 'Nada'], answer: 1, explain: '`fasta|fa)` son dos patrones para la misma rama.' },
          { type: 'mc', q: '`./04-case.sh xyz` imprime…', options: ['Secuencia', 'Error', 'Extensión no reconocida', 'xyz'], answer: 2, explain: '`*)` recoge todo lo demás.' },
          { type: 'fill', q: 'Dos patrones para la misma rama:', code: 'fasta___fa) echo "Secuencia" ;;', options: ['|', '||', ',', 'or'], answer: '|', explain: 'En case, `|` separa patrones alternativos.' },
          { type: 'term', q: 'Pruébalo: lanza `04-case.sh` con el argumento `pdb`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^(\.\/|bash\s+)04-case\.sh\s+pdb$/), outHas(/Estructura 3D/)), hint: './04-case.sh pdb', solution: './04-case.sh pdb' },
          { type: 'mc', q: '¿Con qué palabra se cierra un case?', options: ['done', 'fi', 'esac', 'end'], answer: 2, explain: 'case al revés. Igual que if → fi.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 11 ─────────────────────────────
  {
    id: 'u11', title: 'Bucles', icon: '🔁', color: 'orange',
    desc: 'for, seq, while, until, break, continue.',
    lessons: [
      {
        id: 'u11l1', title: 'for',
        exercises: [
          { type: 'info', title: 'for recorre una lista', text: 'No es un contador: asigna a la variable cada palabra de la lista, una por vuelta.', code: 'for pdb in 1crn.pdb 1ake.pdb 1hvr.pdb; do\n    echo "Procesando $pdb"\ndone\n\nfor i in $(seq 0 5 25); do\n    echo "i = $i"\ndone' },
          { type: 'mc', q: '¿Qué valores salen?', code: 'for i in $(seq 1 3 10); do\n    echo "$i"\ndone', options: ['1 2 3', '1 4 7 10', '1 3 10', '3 6 9'], answer: 1, explain: 'seq inicio paso fin: de 1 a 10 de 3 en 3.' },
          { type: 'fill', q: 'Tu línea del ejercicio 10: de 0 a 30 de 3 en 3.', code: 'for i in $(seq 0 3 30); ___', options: ['do', 'then', 'done', 'in'], answer: 'do', explain: 'for ... ; do ... done' },
          { type: 'term', q: 'Escribe un bucle de **una línea** que imprima 0, 5, 10, 15, 20 y 25.', check: all(ran(/^for\s+\w+\s+in\s+/), outHas(/^0\n5\n10\n15\n20\n25\n?$|i = 0[\s\S]*i = 25/)), hint: 'for i in $(seq 0 5 25); do echo $i; done', solution: 'for i in $(seq 0 5 25); do echo $i; done' },
          { type: 'order', q: 'Recorre todos los .pdb del directorio.', answer: 'for f in *.pdb ; do', extra: ['$(seq', 'then'], explain: '`*.pdb` se expande a la lista de ficheros.' },
          { type: 'term', q: 'Para cada `.pdb` de `trabajo-1a`, imprime su nombre y cuántas líneas ATOM tiene (en una línea).', setup: ['cd ~/trabajo-1a'], check: all(ran(/^for\s+/), outHas(/1HVR\.pdb[\s\S]*1826|1826[\s\S]*1HVR/), outHas(/ejemplo\.pdb/)), hint: "for f in *.pdb; do echo $f $(grep -c '^ATOM' $f); done", solution: "for f in *.pdb; do echo $f $(grep -c '^ATOM' $f); done" },
        ],
      },
      {
        id: 'u11l2', title: 'while, until, break y continue',
        exercises: [
          { type: 'info', title: 'Repetir mientras…', text: '**while** repite mientras la condición sea cierta. **until**, mientras sea falsa. **break** sale del bucle; **continue** salta a la siguiente vuelta.', code: 'while [ -n "$1" ]; do\n    echo "Parámetro: $1"\n    shift\ndone' },
          { type: 'term', q: 'Lanza `07-while.sh` con `uno dos tres`.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^(\.\/|bash\s+)07-while\.sh\s+uno\s+dos\s+tres$/)), hint: './07-while.sh uno dos tres', solution: './07-while.sh uno dos tres' },
          { type: 'mc', q: '`./09-break.sh x f y` imprime…', options: ['Parámetro: x', 'Parámetro: x / Parámetro: y', 'x f y', 'Nada'], answer: 0, explain: 'Al llegar a f, break sale del bucle: la y nunca se imprime.' },
          { type: 'mc', q: '`./10-continue.sh x f y` imprime…', options: ['Parámetro: x', 'Parámetro: x / Parámetro: y', 'Parámetro: f', 'Error'], answer: 1, explain: 'continue se salta solo la vuelta de f y sigue.' },
          { type: 'bug', q: 'Este bucle no termina nunca. ¿Qué línea falta… o sobra?', lines: ['while [ -n "$1" ]; do', '    echo "Parámetro: $1"', 'done'], answer: 1, explain: 'Después del echo falta `shift`: $1 nunca cambia y la condición siempre es cierta.' },
          { type: 'mc', q: 'until repite mientras la expresión sea…', options: ['Cierta', 'Falsa', 'Vacía', 'Un número'], answer: 1, explain: '08-until.sh: `until [ -z "$1" ]` = "hasta que $1 esté vacío".' },
        ],
      },
    ],
  },

  // ───────────────────────────── 12 ─────────────────────────────
  {
    id: 'u12', title: 'Errores y depuración', icon: '🐞', color: 'red',
    desc: 'Leer los mensajes de bash, bash -x y el ^M de Windows.',
    lessons: [
      {
        id: 'u12l1', title: 'Qué dice bash',
        exercises: [
          { type: 'info', title: 'Errores típicos', code: 'Permission denied     → falta la x\ncommand not found     → mal escrita o falta ./\nNo such file or dir.  → ruta equivocada (pwd)\nbad interpreter ^M    → fin de línea de Windows\n[: missing ]          → falta espacio antes de ]\nunary operator expected → variable vacía sin comillas', text: 'Lee el mensaje: casi siempre te dice la línea y la causa.' },
          { type: 'mc', q: '`bash: ./hola.sh: Permission denied`', options: ['La ruta está mal', 'Falta el permiso x: chmod +x o lánzalo con bash', 'Falta un espacio', 'El fichero es de Windows'], answer: 1, explain: 'Sin x no se puede lanzar como programa.' },
          { type: 'mc', q: '`./13-crlf.sh: /bin/bash^M: bad interpreter`', options: ['Falta bash', 'El fichero tiene finales de línea de Windows (^M)', 'Falta el shebang', 'Falta la x'], answer: 1, explain: 'Pasa al copiar desde Windows o desde un chat de IA.' },
          { type: 'mc', q: '`bash: cd: tarea3: No such file or directory`', options: ['Falta permiso', 'Ese directorio no existe donde estás: revisa con pwd y ls', 'cd está roto', 'Falta ./'], answer: 1, explain: 'Ruta o directorio equivocado.' },
          { type: 'mc', q: '¿Qué hace `bash -n script.sh`?', options: ['Lo ejecuta mostrando cada orden', 'Revisa la sintaxis sin ejecutarlo', 'Lo ejecuta sin salida', 'Le quita los ^M'], answer: 1, explain: '-n detecta, por ejemplo, un fi o un done que falta.' },
          { type: 'mc', q: '¿Y `bash -x script.sh`?', options: ['Revisa la sintaxis', 'Ejecuta y escribe cada orden con + delante justo antes de hacerla', 'Le da permiso x', 'Lo borra'], answer: 1, explain: 'Ideal para ver qué valor tienen las variables en cada paso.' },
          { type: 'term', q: 'Ejecuta `03-if-grep.sh ejemplo.pdb` en modo **traza** para ver cada paso.', setup: ['cd ~/trabajo-1a'], check: all(ran(/^bash\s+-x\s+(\.\/)?03-if-grep\.sh\s+ejemplo\.pdb$/)), hint: 'bash -x ...', solution: 'bash -x 03-if-grep.sh ejemplo.pdb' },
        ],
      },
      {
        id: 'u12l2', title: 'Arreglar scripts',
        exercises: [
          { type: 'term', q: 'Lanza `12-errores.sh` con `ejemplo.pdb`. ¿En qué línea se queja?', setup: ['cd ~/trabajo-1a'], check: all(ran(/^(\.\/|bash\s+)12-errores\.sh\s+ejemplo\.pdb$/)), hint: './12-errores.sh ejemplo.pdb', solution: './12-errores.sh ejemplo.pdb' },
          { type: 'term', q: 'Arregla `12-errores.sh` con vi o nano: añade el espacio antes de `]` en la línea 7 y pon comillas a `$fichero` en la línea 11. Después, lánzalo sin argumento: no debe salir ningún error.', setup: ['cd ~/trabajo-1a'], check: (sh, last) => /12-errores\.sh$/.test(last.line.trim()) && !/\[:/.test(last.text) && fileHas(`${T}/12-errores.sh`, /"\$fichero" \]/)(sh), hint: 'vi 12-errores.sh → arregla → :wq → ./12-errores.sh', solution: 'vi 12-errores.sh' },
          { type: 'term', q: 'Descubre el `^M` escondido en la **primera** línea de `13-crlf.sh`.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/\^M\$/), ran(/cat\s+-A\s+13-crlf\.sh/)), hint: 'cat -A 13-crlf.sh | head -1', solution: 'cat -A 13-crlf.sh | head -1' },
          { type: 'term', q: 'Quítale los `^M` con sed y comprueba que ya funciona.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/Hola desde el servidor/)), hint: "sed -i 's/\\r$//' 13-crlf.sh y luego ./13-crlf.sh", solution: "sed -i 's/\\r$//' 13-crlf.sh; ./13-crlf.sh" },
          { type: 'mc', q: 'Al ejecutar `00b-contar-atom.sh no_existe.pdb` sale "No existe no_existe.pdb". ¿Para qué sirve probar casos así?', options: ['Para nada', 'Para comprobar que el script avisa bien en situaciones raras en vez de fallar o dar un resultado sin sentido', 'Para que vaya más rápido', 'Para crear el fichero'], answer: 1, explain: 'Tu respuesta del ejercicio 9.' },
        ],
      },
    ],
  },

  // ───────────────────────────── 13 ─────────────────────────────
  {
    id: 'u13', title: 'Reto final: lote de PDB', icon: '🧬', color: 'green',
    desc: 'Todo junto: 00c-lote-pdb.sh, HETATM y resumen.txt.',
    lessons: [
      {
        id: 'u13l1', title: 'El script complejo',
        exercises: [
          { type: 'info', title: '00c-lote-pdb.sh', text: 'Recorre los ficheros recibidos, ignora lo que no es PDB, avisa de los que faltan y cuenta las líneas ATOM.', code: 'for f in "$@"; do\n  case "$f" in\n    *.pdb|*.PDB)\n      if [ ! -f "$f" ]; then\n        echo "Falta: $f"; continue\n      fi\n      n=$(grep -c \'^ATOM\' "$f")\n      echo "$f → $n ATOM" ;;\n    *) echo "Ignorado (no PDB): $f" ;;\n  esac\ndone' },
          { type: 'mc', q: '¿Para qué sirve el `case` dentro del bucle?', options: ['Para contar líneas', 'Para separar los .pdb del resto por su patrón', 'Para descargar ficheros', 'Para dar permisos'], answer: 1, explain: '`*.pdb|*.PDB)` atrapa los PDB; `*)` el resto.' },
          { type: 'mc', q: '¿Qué guarda `n=$(grep -c \'^ATOM\' "$f")`?', options: ['El texto de las líneas ATOM', 'El número de líneas que empiezan por ATOM', 'El nombre del fichero', 'El código de salida'], answer: 1, explain: '`$( )` sustituye por la salida de la orden: el número.' },
          { type: 'term', q: 'Lánzalo con `1HVR.pdb`, `ejemplo.pdb` y `notas.txt`.', setup: ['cd ~/trabajo-1a'], check: all(outHas(/1HVR\.pdb → 1826 ATOM/), outHas(/Ignorado/)), hint: './00c-lote-pdb.sh 1HVR.pdb ejemplo.pdb notas.txt', solution: './00c-lote-pdb.sh 1HVR.pdb ejemplo.pdb notas.txt' },
          { type: 'term', q: 'Descarga 1HVR.pdb (la proteasa del VIH) desde el RCSB PDB con curl.', setup: ['mkdir -p ~/reto', 'cd ~/reto'], check: isFile(`${H}/reto/1HVR.pdb`), hint: 'curl -O https://files.rcsb.org/download/1HVR.pdb', solution: 'curl -O https://files.rcsb.org/download/1HVR.pdb' },
          { type: 'term', q: '¿Cuántas líneas **HETATM** (el inhibidor y el agua) tiene 1HVR.pdb?', setup: ['cd ~/trabajo-1a'], check: outHas(/^64\s*$/m), hint: "grep -c '^HETATM' 1HVR.pdb", solution: "grep -c '^HETATM' 1HVR.pdb" },
        ],
      },
      {
        id: 'u13l2', title: 'El reto',
        exercises: [
          { type: 'info', title: 'Reto de clase', text: '1. Copia `00c-lote-pdb.sh` como `00d-lote-hetatm.sh`.\n2. Que cuente también las líneas **HETATM**.\n3. Lánzalo con `1HVR.pdb ejemplo.pdb` y guarda la salida en `resumen.txt`.\n4. Comprueba con `cat`.\n\nPista: una segunda variable con el mismo `grep -c`.' },
          { type: 'term', q: 'Paso 1: copia el script como `00d-lote-hetatm.sh`.', setup: ['cd ~/trabajo-1a'], check: isFile(`${T}/00d-lote-hetatm.sh`), hint: 'cp origen destino', solution: 'cp 00c-lote-pdb.sh 00d-lote-hetatm.sh' },
          { type: 'fill', q: 'Paso 2: la variable nueva.', code: "h=$(grep -c '___' \"$f\")", options: ['^HETATM', '^ATOM', 'HETATM$', '-v ATOM'], answer: '^HETATM', explain: 'Las líneas que empiezan por HETATM.' },
          { type: 'term', q: 'Paso 2: edita `00d-lote-hetatm.sh` para que cuente también HETATM y lo imprima (por ejemplo `echo "$f → $n ATOM, $h HETATM"`).', setup: ['cd ~/trabajo-1a', 'cp 00c-lote-pdb.sh 00d-lote-hetatm.sh'], check: (sh, last) => { const n = sh.fs.get(`${T}/00d-lote-hetatm.sh`); return !!n && /HETATM/.test(n.content) && /grep -c ['"]?\^HETATM/.test(n.content); }, hint: 'vi 00d-lote-hetatm.sh. Debajo de n=$(...) añade h=$(grep -c \'^HETATM\' "$f") y cambia el echo.', solution: 'vi 00d-lote-hetatm.sh' },
          { type: 'term', q: 'Paso 3 y 4: lánzalo con `1HVR.pdb ejemplo.pdb`, guarda la salida en `resumen.txt` y compruébalo con cat.', setup: ['cd ~/trabajo-1a', sh => {
            const src = sh.readFile(`${T}/00c-lote-pdb.sh`);
            sh.writeFile(`${T}/00d-lote-hetatm.sh`, src.replace('echo "$f → $n ATOM"', 'h=$(grep -c \'^HETATM\' "$f")\n            echo "$f → $n ATOM, $h HETATM"'));
            sh.fs.get(`${T}/00d-lote-hetatm.sh`).mode = 0o775;
          }], check: all(fileHas(`${T}/resumen.txt`, /1HVR\.pdb.*1826/), outHas(/64 HETATM/)), hint: './00d-lote-hetatm.sh 1HVR.pdb ejemplo.pdb > resumen.txt; cat resumen.txt', solution: './00d-lote-hetatm.sh 1HVR.pdb ejemplo.pdb > resumen.txt; cat resumen.txt' },
          { type: 'mc', q: '¿Por qué en bioinformática merece la pena un script así?', options: ['Porque es más bonito', 'Aplica la misma operación a un lote de ficheros y deja el procedimiento escrito y reproducible', 'Porque no hace falta saber Linux', 'Porque va en el portátil'], answer: 1, explain: 'Veinte PDB a mano, no. Un script, sí.' },
        ],
      },
    ],
  },
];

// Índices de ayuda.
export const LESSONS = UNITS.flatMap(u => u.lessons.map(l => ({ ...l, unit: u })));
export function lessonById(id) { return LESSONS.find(l => l.id === id); }
