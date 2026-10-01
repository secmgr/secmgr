create table secret_versions (
  secret_id uuid not null references secrets (id) on delete cascade,
  version integer not null check (version > 0),
  change_set_id uuid references change_sets (id) on delete set null,
  key_version integer not null,
  ciphertext bytea not null,
  nonce bytea not null,
  fingerprint text not null,
  value_length integer not null,
  looks_live boolean not null default false,
  refs text[] not null default '{}',
  summary text not null,
  created_by text references users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (secret_id, version)
);

create index secret_versions_change_set_id_idx on secret_versions (change_set_id);
