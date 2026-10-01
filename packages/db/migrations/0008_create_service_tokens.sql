create table service_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations (id) on delete cascade,
  environment_id uuid not null references environments (id) on delete cascade,
  name text not null check (length(name) between 1 and 64),
  token_hash text not null unique,
  prefix text not null,
  suffix text not null,
  access text not null check (access in ('read', 'write')),
  created_by text references users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index service_tokens_organization_id_idx on service_tokens (organization_id);
create index service_tokens_environment_id_idx on service_tokens (environment_id);
