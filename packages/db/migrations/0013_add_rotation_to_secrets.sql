alter table secrets
  add column rotate_every_days integer check (rotate_every_days between 1 and 3650),
  add column last_rotated_at timestamptz;
