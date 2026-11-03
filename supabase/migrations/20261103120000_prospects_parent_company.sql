-- Company ownership: mark a pipeline company as owned by another
-- (e.g. Hague Quality Water International -> A.O. Smith).
-- Inherits the existing authenticated-user RLS on public.prospects; no policy changes.

alter table public.prospects
  add column if not exists parent_id uuid references public.prospects(id) on delete set null;

alter table public.prospects
  add constraint prospects_parent_not_self check (parent_id is null or parent_id <> id);

create index if not exists prospects_parent_id_idx on public.prospects(parent_id);

comment on column public.prospects.parent_id is
  'Owning/parent company (e.g. Hague Quality Water -> A.O. Smith). Null = independent.';

-- Block ownership loops (A owns B owns A), which the self-check can't catch.
create or replace function public.prevent_prospect_parent_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cursor_id uuid := new.parent_id;
  depth int := 0;
begin
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'A company cannot be owned by one of its own subsidiaries'
        using errcode = 'check_violation';
    end if;
    depth := depth + 1;
    if depth > 50 then exit; end if;
    select parent_id into cursor_id from public.prospects where id = cursor_id;
  end loop;
  return new;
end;
$$;

create or replace trigger prospects_parent_cycle
  before insert or update of parent_id on public.prospects
  for each row when (new.parent_id is not null)
  execute function public.prevent_prospect_parent_cycle();

-- Seed the ownership already known (by name, so it is safe to re-run).
update public.prospects c set parent_id = p.id
from public.prospects p
where c.company_name = 'Hague Quality Water International' and p.company_name = 'A.O. Smith'
  and c.parent_id is null;

update public.prospects c set parent_id = p.id
from public.prospects p
where c.company_name = 'Manitowoc Ice (Pentair)' and p.company_name = 'Pentair'
  and c.parent_id is null;
