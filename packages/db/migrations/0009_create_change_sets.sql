create table change_sets (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references environments (id) on delete cascade,
  actor_user_id text references users (id) on delete set null,
  actor_token_id uuid references service_tokens (id) on delete set null,
  message text not null default '',
  ops jsonb not null default '[]',
  reverts_id uuid references change_sets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index change_sets_environment_id_idx on change_sets (environment_id, created_at desc);
