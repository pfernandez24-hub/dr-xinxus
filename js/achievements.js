// Logros. Cada uno se comprueba con el estado del jugador.
import { UNITS } from './content.js';
import * as store from './store.js';

const unitDone = id => s => UNITS.find(u => u.id === id).lessons.every(l => s.done[l.id]);

export const ACHIEVEMENTS = [
  { id: 'primer_comando', icon: '⌨️', title: 'Hola, servidor', desc: 'Ejecuta tu primer comando.', test: s => s.stats.commands >= 1 },
  { id: 'primera_leccion', icon: '🎓', title: 'Primer día de clase', desc: 'Termina tu primera lección.', test: s => s.stats.lessons >= 1 },
  { id: 'perfecta', icon: '💯', title: 'Sin un fallo', desc: 'Termina una lección sin errores.', test: s => s.stats.perfect >= 1 },
  { id: 'perfectas_10', icon: '🏅', title: 'Pulso de cirujano', desc: '10 lecciones perfectas.', test: s => s.stats.perfect >= 10 },
  { id: 'racha_3', icon: '🔥', title: 'Calentando motores', desc: 'Racha de 3 días.', test: s => s.streak.best >= 3 },
  { id: 'racha_7', icon: '🔥', title: 'Una semana entera', desc: 'Racha de 7 días.', test: s => s.streak.best >= 7 },
  { id: 'racha_30', icon: '🌋', title: 'Imparable', desc: 'Racha de 30 días.', test: s => s.streak.best >= 30 },
  { id: 'xp_100', icon: '⚡', title: '100 XP', desc: 'Consigue 100 puntos de experiencia.', test: s => s.xp >= 100 },
  { id: 'xp_500', icon: '⚡', title: '500 XP', desc: 'Consigue 500 puntos de experiencia.', test: s => s.xp >= 500 },
  { id: 'comandos_100', icon: '🖥️', title: 'Teclas gastadas', desc: 'Ejecuta 100 comandos en la terminal.', test: s => s.stats.commands >= 100 },
  { id: 'comandos_500', icon: '🧙', title: 'Mago de la terminal', desc: 'Ejecuta 500 comandos.', test: s => s.stats.commands >= 500 },
  { id: 'cazabugs', icon: '🐞', title: 'Cazador de bugs', desc: 'Encuentra 10 errores en ejercicios de "encuentra el error".', test: s => s.stats.bugs >= 10 },
  { id: 'u2', icon: '🧭', title: 'Nunca me pierdo', desc: 'Completa la unidad de rutas.', test: unitDone('u2') },
  { id: 'u4', icon: '✏️', title: 'Sobreviví a vi', desc: 'Completa la unidad de editores.', test: unitDone('u4') },
  { id: 'u8', icon: '🔐', title: 'chmod +x', desc: 'Completa la unidad de permisos.', test: unitDone('u8') },
  { id: 'u11', icon: '🔁', title: 'En bucle', desc: 'Completa la unidad de bucles.', test: unitDone('u11') },
  { id: 'u12', icon: '🩺', title: 'Doctor en bash', desc: 'Completa la unidad de errores y depuración.', test: unitDone('u12') },
  { id: 'tema1a', icon: '🧬', title: 'Tema 1A superado', desc: 'Completa todas las unidades.', test: s => UNITS.every(u => unitDone(u.id)(s)) },
  { id: 'repaso', icon: '📚', title: 'Repasar es de sabios', desc: 'Haz 5 lecciones de repaso.', test: s => s.stats.practice >= 5 },
  { id: 'buho', icon: '🦉', title: 'Búho nocturno', desc: 'Termina una lección entre las 23:00 y las 5:00.', test: s => s.stats.night },
  { id: 'madrugador', icon: '🌅', title: 'Madrugador', desc: 'Termina una lección entre las 5:00 y las 8:00.', test: s => s.stats.early },
  { id: 'sudo', icon: '🚫', title: 'Buen intento', desc: 'Intenta usar sudo en el servidor.', test: s => s.stats.sudo, secret: true },
];

// Desbloquea los logros nuevos y los devuelve.
export function checkAchievements() {
  const s = store.get();
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.test(s)) {
      store.unlock(a.id);
      fresh.push(a);
    }
  }
  return fresh;
}
