// Configuración del ranking compartido (Supabase, plan gratuito).
// Valores de Supabase → Project Settings → Data API (URL) y API Keys (publishable).
// La clave "publishable" es pública por diseño; los permisos los limita supabase/setup.sql.
// Si se dejan vacíos, la app funciona igual pero el ranking solo te muestra a ti.
export const SUPABASE_URL = 'https://cjrcqlicdendjlvhnrfk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_TlNOKCgyBhOMTOqSDOGNgA_iVK6Ny0D';
