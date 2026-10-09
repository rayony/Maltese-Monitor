-- Re-apply even if an older 0003 was recorded before the constraint
-- actually allowed 好少. 好多 and 好少 are the only quantities.
alter table soup_reports drop constraint if exists soup_reports_qty_chk;

update soup_reports set qty = '好少' where qty = '少量';

update soup_reports set qty = '好多' where qty not in ('好多', '好少');

alter table soup_reports add constraint soup_reports_qty_chk check (qty in ('好多', '好少'));
