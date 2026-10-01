create table environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 32),
  color text not null default 'gray'
    check (color in ('gray', 'blue', 'green', 'teal', 'amber', 'orange', 'rose', 'violet')),
  position integer not null default 0,
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);
