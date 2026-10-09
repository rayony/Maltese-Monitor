alter table soup_reports add column if not exists hidden_at timestamptz;

create table if not exists admin_credential (
  id integer primary key check (id = 1),
  salt text not null,
  password_hash text not null,
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists admin_session (
  token_hash text primary key,
  expires_at timestamptz not null
);
