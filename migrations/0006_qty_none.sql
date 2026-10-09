-- Widen the quantity check. Existing 好多 / 好少 rows stay as they are.
alter table soup_reports drop constraint if exists soup_reports_qty_chk;

alter table soup_reports add constraint soup_reports_qty_chk check (qty in ('好多', '好少', '冇晒'));
