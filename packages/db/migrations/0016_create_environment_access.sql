create table environment_access (
  environment_id uuid not null references environments (id) on delete cascade,
  member_id text not null references members (id) on delete cascade,
  access text not null check (access in ('none', 'read', 'write')),
  updated_by text references users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (environment_id, member_id)
);

create index environment_access_member_id_idx on environment_access (member_id);
