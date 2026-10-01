create table user_preferences (
  user_id text primary key references users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  reveal_timeout_sec integer not null default 10 check (reveal_timeout_sec between 0 and 300),
  clipboard_clear_sec integer not null default 30 check (clipboard_clear_sec between 0 and 300),
  updated_at timestamptz not null default now()
);
