// Efectos de sonido sintetizados (sin ficheros de audio).
import * as store from './store.js';

let ctx = null;

function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

export function play(name) {
  if (!store.get().settings.sound) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (name === 'ok') { tone(784, 0, 0.12, 'triangle'); tone(1175, 0.09, 0.22, 'triangle'); }
    else if (name === 'bad') { tone(220, 0, 0.18, 'square', 0.06); tone(180, 0.12, 0.25, 'square', 0.06); }
    else if (name === 'finish') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle')); }
    else if (name === 'tap') tone(660, 0, 0.05, 'sine', 0.05);
  } catch { /* sin audio */ }
  if (navigator.vibrate) {
    if (name === 'bad') navigator.vibrate(60);
    if (name === 'ok') navigator.vibrate(15);
  }
}
