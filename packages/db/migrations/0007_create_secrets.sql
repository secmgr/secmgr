create table secrets (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references environments (id) on delete cascade,
  key text not null check (key ~ '^[A-Z_][A-Z0-9_]*$' and length(key) <= 128),
  note text not null default '',
  sensitive boolean not null default true,
  version integer not null default 0,
  created_by text references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by text references users (id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (environment_id, key)
);
