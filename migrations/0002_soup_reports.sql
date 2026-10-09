create table if not exists soup_reports (
  id text primary key,
  brand text not null,
  shop_name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  qty text not null,
  reported_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint soup_reports_qty_chk check (qty in ('好多', '少量'))
);

create index if not exists soup_reports_reported_at_idx
  on soup_reports (reported_at desc);

create index if not exists soup_reports_place_idx
  on soup_reports (brand, shop_name, address, reported_at desc);
