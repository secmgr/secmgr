create table project_stars (
  user_id text not null references users (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index project_stars_project_id_idx on project_stars (project_id);
