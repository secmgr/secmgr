alter table users add column two_factor_enabled boolean not null default false;

create table two_factors (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  secret text not null,
  backup_codes text not null,
  verified boolean not null default true,
  failed_verification_count integer not null default 0,
  locked_until timestamptz
);

create index two_factors_user_id_idx on two_factors (user_id);
create index two_factors_secret_idx on two_factors (secret);
