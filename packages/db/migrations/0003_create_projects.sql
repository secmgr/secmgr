create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 40),
  description text not null default '',
  repo text,
  created_by text references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, name)
);
