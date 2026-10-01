create table project_keys (
  project_id uuid not null references projects (id) on delete cascade,
  version integer not null check (version > 0),
  wrapped_key bytea not null,
  key_provider text not null,
  master_key_id text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, version)
);
