create table share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations (id) on delete cascade,
  secret_id uuid references secrets (id) on delete set null,
  created_by text references users (id) on delete set null,
  ciphertext bytea,
  nonce bytea,
  max_views integer not null default 1 check (max_views between 1 and 10),
  views integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  revoked_at timestamptz
);

create index share_links_secret_id_idx on share_links (secret_id);
