-- Schéma de la base de données — à coller dans Supabase > SQL Editor > Run

create extension if not exists btree_gist;

-- Prestations proposées (nom, durée, prix)
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_min int not null check (duration_min between 10 and 480),
  price_cents int not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Plages de disponibilité saisies par le masseur
create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists availability_range_idx on availability (start_at, end_at);

-- Réservations des clients
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- période bloquée, temps de trajet inclus pour le domicile / les clubs
  block_start timestamptz not null,
  block_end timestamptz not null,
  location_type text not null check (location_type in ('cabinet', 'domicile', 'club')),
  address text,
  client_name text not null,
  client_email text not null,
  client_phone text not null,
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  -- Garantie absolue : deux réservations confirmées ne peuvent pas se chevaucher
  constraint bookings_no_overlap exclude using gist (
    tstzrange(block_start, block_end) with &&
  ) where (status = 'confirmed')
);
create index if not exists bookings_start_idx on bookings (start_at);

-- Réglages (une seule ligne)
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  practitioner_name text default 'Votre masseur',
  practitioner_email text,
  cabinet_address text,
  slot_step_min int not null default 15 check (slot_step_min between 5 and 120),
  min_notice_hours int not null default 12 check (min_notice_hours >= 0),
  travel_buffer_min int not null default 30 check (travel_buffer_min >= 0),
  cancel_notice_hours int not null default 24 check (cancel_notice_hours >= 0)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Sécurité : aucun accès direct depuis le navigateur.
-- Tout passe par le serveur Next.js avec la clé service_role.
alter table services enable row level security;
alter table availability enable row level security;
alter table bookings enable row level security;
alter table settings enable row level security;

-- Prestations d'exemple (modifiables ensuite dans /admin)
insert into services (name, description, duration_min, price_cents, sort)
select * from (values
  ('Massage Tuina', 'Massage traditionnel chinois qui dénoue les tensions et rééquilibre l''énergie du corps.', 60, 7000, 1),
  ('Acupuncture', 'Stimulation de points précis par de fines aiguilles pour soulager douleurs et blocages.', 60, 7500, 2),
  ('Ventouses', 'Les ventouses activent la circulation et relâchent les muscles contractés.', 30, 4000, 3),
  ('Massage sportif profond', 'Travail en profondeur sur les tensions et contractures musculaires.', 45, 5000, 4)
) as v(name, description, duration_min, price_cents, sort)
where not exists (select 1 from services);
