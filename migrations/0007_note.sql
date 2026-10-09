-- Optional shopper note. Existing rows stay, with an empty note.
alter table soup_reports add column if not exists note text not null default '';
