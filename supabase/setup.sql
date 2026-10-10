-- Tabla del ranking de Dr.Xinxus. Pégalo en Supabase → SQL Editor → Run.
create table if not exists public.jugadores (
  id uuid primary key,
  apodo text not null check (char_length(apodo) between 1 and 20),
  clase text not null default 'GENERAL' check (char_length(clase) <= 16),
  xp integer not null default 0 check (xp >= 0 and xp < 1000000),
  xp_semana integer not null default 0 check (xp_semana >= 0),
  semana text not null,
  racha integer not null default 0,
  actualizado timestamptz not null default now()
);

create index if not exists jugadores_clase_xp on public.jugadores (clase, xp desc);

alter table public.jugadores enable row level security;

-- Los proyectos nuevos no dan acceso automático a la API: se concede solo lo necesario.
grant select, insert, update on public.jugadores to anon;

-- Cualquiera con la clave pública puede leer el ranking y crear/actualizar su fila.
-- Es una app entre compañeros: no hay contraseñas, así que no protege frente a trampas.
drop policy if exists "leer ranking" on public.jugadores;
create policy "leer ranking" on public.jugadores for select using (true);

drop policy if exists "crear jugador" on public.jugadores;
create policy "crear jugador" on public.jugadores for insert with check (true);

drop policy if exists "actualizar jugador" on public.jugadores;
create policy "actualizar jugador" on public.jugadores for update using (true) with check (true);
