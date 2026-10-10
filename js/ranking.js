// Ranking entre compañeros a través de la API REST de Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as store from './store.js';

export const rankingEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

let pushTimer = null;

async function sendScore() {
  const s = store.get();
  if (!s.nick) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/jugadores?on_conflict=id`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        id: s.id, apodo: s.nick, clase: s.clase || 'GENERAL', xp: s.xp,
        xp_semana: s.weekly.xp, semana: s.weekly.week, racha: s.streak.count,
      }),
    });
  } catch { /* sin conexión: se reintenta en el próximo cambio */ }
}

// Sube tu XP. Con now=false espera un poco para agrupar cambios seguidos.
export function pushScore(now = false) {
  if (!rankingEnabled()) return Promise.resolve();
  clearTimeout(pushTimer);
  if (now) return sendScore();
  pushTimer = setTimeout(sendScore, 800);
  return Promise.resolve();
}

// mode: 'semana' | 'total'
export async function fetchRanking(mode) {
  const s = store.get();
  const clase = encodeURIComponent(s.clase || 'GENERAL');
  const order = mode === 'semana' ? 'xp_semana.desc' : 'xp.desc';
  let url = `${SUPABASE_URL}/rest/v1/jugadores?select=id,apodo,xp,xp_semana,semana,racha&clase=eq.${clase}&order=${order}&limit=50`;
  if (mode === 'semana') url += `&semana=eq.${encodeURIComponent(s.weekly.week)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
