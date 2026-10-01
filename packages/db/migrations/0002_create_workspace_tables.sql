create table organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  logo text,
  metadata text,
  created_at timestamptz not null default now()
);

create table members (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index members_user_id_idx on members (user_id);

create table invitations (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  inviter_id text not null references users (id) on delete cascade,
  email text not null,
  role text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index invitations_organization_id_idx on invitations (organization_id);
create index invitations_email_idx on invitations (email);

alter table sessions
  add column active_organization_id text references organizations (id) on delete set null;

create table rate_limits (
  id text primary key,
  key text not null unique,
  count integer not null,
  last_request bigint not null
);
