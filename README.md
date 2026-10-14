# Dr.Xinxus 🐧

App estilo Duolingo para aprender Linux y bash con el temario de **Bioinformática, Tema 1 (1A, 1B y 1C), UCAM 2026/27**.
Es una *web app instalable*: se abre con un enlace y se añade a la pantalla de inicio del iPhone o del Android.
No pasa por la App Store y es gratis.

## Qué incluye

- **6 secciones, 36 unidades y 47 lecciones**, de lo más fácil a lo más difícil:
  1. Primeros pasos (1A): terminal, ssh, ls, rutas, ficheros, more/less/man, vi y nano, FileZilla, Git.
  2. Combinar órdenes (1A): redirección, tuberías, grep, cut/sort/uniq, awk, procesos.
  3. Scripts (1A): permisos, primer script, variables, parámetros, if, case, for, while, depuración y el reto de los PDB.
  4. IA con criterio (1B): modelos de lenguaje, prompt anclado, verificar propuestas, consultas con datos, órdenes peligrosas.
  5. Bioinformática estructural (1C): pdb_fetch, pdb_wc, freesasa, SASA residuo a residuo, recuentos y lotes.
  6. Repaso de examen: tests de opción múltiple por tema.
- **Simulacro de examen**: 20 preguntas tipo test al azar de todo el temario, con las opciones barajadas y nota sobre 10.
- **7 tipos de ejercicio**: teoría, opción múltiple, V/F de la Tarea 1D, completar el hueco, ordenar fichas,
  encontrar el error y **terminal simulada**.
- **Terminal Ubuntu simulada**: un intérprete de bash propio (if, for, while, case, tuberías, `>`, permisos,
  `git clone/pull/stash`, `curl`, `awk`, vi/nano...) con el repositorio de clase dentro, y `pdb_fetch`, `pdb_wc`
  y `freesasa` con las cifras reales de clase (1crn, 1hvr, 1ake y las 10 proteínas de la Tarea 1C2). Los scripts
  del profesor (`00b-contar-atom.sh`, `12-errores.sh`, `13-crlf.sh`...) dan los mismos mensajes que en el servidor.
- **Gamificación**: XP, meta diaria, racha, 5 vidas (una cada 20 min o con un repaso), 26 logros,
  ranking semanal y total por código de clase y recordatorio diario mediante el calendario del móvil.
- Funciona **sin conexión** una vez abierta, gracias al service worker.

## Probarla en el ordenador

```bash
python -m http.server 8765
```

Abre http://localhost:8765. `tools/shell-test.html` sirve para probar la terminal suelta.

## Publicarla gratis (GitHub Pages)

1. Crea un repositorio en GitHub, por ejemplo `dr-xinxus`, y sube esta carpeta.
2. Ve a *Settings → Pages → Branch: main / root → Save*.
3. En un minuto estará en `https://TU_USUARIO.github.io/dr-xinxus/`. Pasa ese enlace a tus compañeros.
4. En el iPhone: ábrelo en **Safari** → Compartir ⬆️ → **Añadir a pantalla de inicio**.

Cada vez que cambies algo, sube el número de `VERSION` en `sw.js` para que los móviles descarguen la versión nueva.

## Activar el ranking entre compañeros (Supabase, gratis)

1. Crea una cuenta y un proyecto en https://supabase.com.
2. En *SQL Editor*, pega `supabase/setup.sql` y pulsa *Run*.
3. En *Project Settings → API*, copia la *Project URL* y la clave *anon / publishable* en `js/config.js`.
4. Publica de nuevo. Todos los que usen el mismo **código de clase** (por defecto `BIOINFO26`) comparten ranking.

Sin esto, la app funciona igual, pero el ranking solo te muestra a ti. No hay contraseñas: es un ranking entre amigos, no un examen.

## Añadir o cambiar ejercicios

Todo el temario está en `js/content.js`. Cada ejercicio es un objeto; hay ejemplos de los 6 tipos.
Los de terminal llevan `setup` (órdenes que preparan el escenario) y `check(sh, last)`, que decide si el alumno lo ha resuelto.

Si el profesor cambia el repositorio de clase, regenera los ficheros de la terminal:

```bash
python tools/build-repo-data.py RUTA/A/bioinformatica_26-27
```

## Estructura

| Fichero | Para qué |
| --- | --- |
| `js/content.js` | Temario y ejercicios |
| `js/shell.js`, `js/bash-parser.js`, `js/vfs.js`, `js/seed.js` | Terminal simulada |
| `js/lesson.js` | Reproductor de lecciones |
| `js/main.js` | Pantallas: mapa, terminal, ranking y perfil |
| `js/editor.js` | vi y nano táctiles |
| `js/store.js`, `js/achievements.js`, `js/ranking.js` | Progreso, logros y ranking |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación como app y modo sin conexión |
