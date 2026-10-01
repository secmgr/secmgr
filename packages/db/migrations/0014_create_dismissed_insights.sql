create table dismissed_insights (
  organization_id text not null references organizations (id) on delete cascade,
  insight_id text not null,
  dismissed_by text references users (id) on delete set null,
  dismissed_at timestamptz not null default now(),
  primary key (organization_id, insight_id)
);
