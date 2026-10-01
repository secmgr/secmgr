create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations (id) on delete cascade,
  project_id uuid references projects (id) on delete set null,
  environment_id uuid references environments (id) on delete set null,
  actor_user_id text references users (id) on delete set null,
  actor_token_id uuid references service_tokens (id) on delete set null,
  action text not null,
  keys text[] not null default '{}',
  target text,
  change_set_id uuid references change_sets (id) on delete set null,
  detail jsonb not null default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_events_organization_id_idx on audit_events (organization_id, created_at desc);
create index audit_events_project_id_idx on audit_events (project_id, created_at desc);
