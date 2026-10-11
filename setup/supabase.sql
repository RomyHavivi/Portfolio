-- Run in the Supabase SQL editor as the database administrator.
-- Create your admin user first; replace the ONE UUID placeholder below.
-- This transaction aborts on incompatible existing ownership/schema/policies.
-- Back up existing content first. Existing non-seed content must pass validation.
begin;

create table if not exists public.portfolio (
  id text primary key check (id = 'main'),
  owner_id uuid not null references auth.users (id),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  revision bigint not null default 0
);

-- CREATE TABLE IF NOT EXISTS alone does not migrate an older installation.
alter table public.portfolio
add column if not exists revision bigint not null default 0;

do $$
declare
  requested_owner_text constant text := 'REPLACE_WITH_ADMIN_USER_UUID';
  requested_owner uuid;
  field record;
begin
  begin
    requested_owner := requested_owner_text::uuid;
  exception when invalid_text_representation then
    raise exception 'Replace the admin UUID placeholder with Authentication > Users > your user ID';
  end;
  if not exists (select 1 from auth.users where id=requested_owner) then
    raise exception 'Requested admin UUID does not exist in Authentication > Users';
  end if;
  for field in select * from (values
    ('id','text'),('owner_id','uuid'),('content','jsonb'),
    ('updated_at','timestamp with time zone'),('revision','bigint')
  ) as expected(name, type_name) loop
    if not exists (
      select 1 from pg_attribute
      where attrelid='public.portfolio'::regclass and attname=field.name
        and not attisdropped and attnotnull
        and format_type(atttypid,atttypmod)=field.type_name
    ) then
      raise exception 'Incompatible portfolio column %. Expected NOT NULL %; migrate explicitly before rerunning', field.name, field.type_name;
    end if;
  end loop;
  if exists (select 1 from public.portfolio where id <> 'main') then
    raise exception 'Unexpected portfolio rows: only id=main is supported';
  end if;
  if exists (select 1 from public.portfolio where id='main' and owner_id<>requested_owner) then
    raise exception 'Existing portfolio owner differs from requested admin UUID. Ownership was NOT transferred; review an explicit migration';
  end if;
  if exists (
    select 1 from pg_policy where polrelid='public.portfolio'::regclass
      and polname not in ('Published portfolio is readable','Only owner can edit')
  ) then
    raise exception 'Unexpected existing portfolio RLS policies. Review/remove them explicitly before running this installer';
  end if;
  insert into public.portfolio (id,owner_id,content)
  values ('main',requested_owner,'{}'::jsonb) on conflict(id) do nothing;
end; $$;

-- Helpers mirror schema.js. Unknown object keys are tolerated, as in the client.
-- UTF-16 length matches JavaScript string.length, including emoji/astral characters.
create or replace function public.portfolio_text_valid (value jsonb, max_length integer, required boolean) returns boolean language sql immutable
set
  search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(value)='string'
    and length(value #>> '{}') * 2
        - length(regexp_replace(value #>> '{}', U&'[\+010000-\+10FFFF]', '', 'g')) <= max_length
    and (not required or (value #>> '{}') ~ '[^[:space:]]'), false)
$$;

create or replace function public.portfolio_media_url_valid (value text) returns boolean language plpgsql immutable
set
  search_path = pg_catalog as $$
declare authority text; host text; port text;
begin
  -- Require HTTPS, a nonempty host, and no credentials/control characters.
  -- URLs are not fetched here; this is structural validation, not an allowlist.
  -- Use canonical HTTPS URLs; normalize unusual URL spellings in the dashboard.
  if value is null or value !~ '^https://[^/?#@[:space:]]+([/?#].*)?$'
    or value ~ '[[:cntrl:]]' then return false; end if;
  authority := substring(value from '^https://([^/?#]+)');
  if left(authority,1)='[' then
    if authority !~ '^\[[0-9a-fA-F:]+\](:[0-9]{1,5})?$' then return false; end if;
    host := substring(authority from '^\[([^]]+)\]');
    begin
      if family(host::inet)<>6 then return false; end if;
    exception when invalid_text_representation then return false;
    end;
    port := substring(authority from '\]:([0-9]+)$');
  else
    if authority !~ '^[[:alnum:]_-]+(\.[[:alnum:]_-]+)*\.?(:[0-9]{1,5})?$' then return false; end if;
    port := substring(authority from ':([0-9]+)$');
  end if;
  if port is not null and port::integer>65535 then return false; end if;
  return true;
end;
$$;

create or replace function public.portfolio_video_valid (value text) returns boolean language plpgsql immutable
set
  search_path = pg_catalog as $$
declare host text; path text; video_id text;
begin
  if not public.portfolio_media_url_valid(value) then return false; end if;
  host := lower(substring(value from '^https://([^/?#:]+)'));
  path := coalesce(substring(value from '^https://[^/?#]+([^?#]*)'), '');
  if path ~* '\.(mp4|webm|ogv)$' then return true; end if;
  if host in ('youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com') then
    if host='youtu.be' then
      video_id := substring(path from '^/([^/]+)');
    else
      video_id := substring(value from '[?&]v=([^&#]*)');
      if video_id is null or video_id='' then
        video_id := substring(path from '/(?:embed|shorts|live)/([^/]+)');
      end if;
    end if;
    return coalesce(video_id ~ '^[A-Za-z0-9_-]{11}$', false);
  end if;
  if host in ('vimeo.com','www.vimeo.com','player.vimeo.com') then
    return path ~* '^/[0-9]+(/[a-f0-9]{6,})?/?$'
      or path ~ '/(?:video|videos)/[0-9]+(?:/|$)'
      or path ~ '^/channels/[^/]+/[0-9]+/?$';
  end if;
  -- The client also accepts other HTTPS iframe URLs. Their remote embed/CSP
  -- compatibility requires browser testing; SQL cannot know the site's origin.
  return true;
end; $$;

create or replace function public.portfolio_content_valid (document jsonb) returns boolean language plpgsql immutable
set
  search_path = pg_catalog as $$
declare field record; project jsonb; photo jsonb; discipline text;
begin
  if jsonb_typeof(document) is distinct from 'object' then return false; end if;
  -- {} remains the intentional placeholder seed, including for dashboard reset.
  if document='{}'::jsonb then return true; end if;
  for field in select * from (values
    ('name',100,true),('intro',1000,true),('about',10000,true),
    ('contactIntro',2000,true),('heroVideo',4000,false),
    ('heroPoster',4000,false),('aboutImage',4000,false)
  ) as limits(name,max_length,required) loop
    if not public.portfolio_text_valid(document->field.name,field.max_length,field.required) then return false; end if;
  end loop;
  foreach discipline in array array['heroPoster','aboutImage'] loop
    if document->>discipline<>'' and not public.portfolio_media_url_valid(document->>discipline) then return false; end if;
  end loop;
  if document->>'heroVideo'<>'' and (
    not public.portfolio_media_url_valid(document->>'heroVideo')
    or coalesce(substring(document->>'heroVideo' from '^https://[^/?#]+([^?#]*)'),'') !~* '\.(mp4|webm)$'
  ) then return false; end if;
  if jsonb_typeof(document->'projects') is distinct from 'array' then return false; end if;
  if jsonb_array_length(document->'projects')>10000 then return false; end if;
  for project in select value from jsonb_array_elements(document->'projects') loop
    if jsonb_typeof(project) is distinct from 'object' then return false; end if;
    for field in select * from (values
      ('id',100,true),('title',150,true),('description',2000,false),
      ('year',20,false),('image',4000,false),('video',4000,false)
    ) as limits(name,max_length,required) loop
      if not public.portfolio_text_valid(project->field.name,field.max_length,field.required) then return false; end if;
    end loop;
    discipline := project->>'discipline';
    if jsonb_typeof(project->'discipline') is distinct from 'string'
      or discipline not in ('directing','editing','photography') then return false; end if;
    if jsonb_typeof(project->'category') is distinct from 'string' then return false; end if;
    if (discipline='photography' and project->>'category' not in ('cosplay','fashion'))
      or (discipline<>'photography' and project->>'category'<>'') then return false; end if;
    if jsonb_typeof(project->'sample') is distinct from 'boolean' then return false; end if;
    if project->>'image'<>'' and not public.portfolio_media_url_valid(project->>'image') then return false; end if;
    if discipline='photography' and project->>'image'='' then return false; end if;
    if project ? 'photos' then
      if jsonb_typeof(project->'photos') is distinct from 'array'
        or jsonb_array_length(project->'photos')>100 then return false; end if;
      for photo in select value from jsonb_array_elements(project->'photos') loop
        if not public.portfolio_text_valid(photo,4000,true)
          or not public.portfolio_media_url_valid(photo #>> '{}') then return false; end if;
      end loop;
      if discipline<>'photography' and jsonb_array_length(project->'photos')>0 then return false; end if;
    end if;
    if project->>'video'<>'' and (discipline='photography' or not public.portfolio_video_valid(project->>'video')) then return false; end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(document->'projects') as items(project)
    group by items.project->>'id' having count(*)>1
  ) then return false; end if;
  return true;
end; $$;

-- Recreate only installer-owned constraints; validation of existing rows is
-- intentional. An invalid older document aborts rather than being overwritten.
alter table public.portfolio
drop constraint if exists portfolio_main_id_check;

alter table public.portfolio
add constraint portfolio_main_id_check check (id = 'main');

alter table public.portfolio
drop constraint if exists portfolio_content_valid_check;

alter table public.portfolio
add constraint portfolio_content_valid_check check (public.portfolio_content_valid (content));

alter table public.portfolio
drop constraint if exists portfolio_revision_range_check;

alter table public.portfolio
add constraint portfolio_revision_range_check check (revision between 0 and 9007199254740991);

alter table public.portfolio
alter column revision
set default 0;

create or replace function public.portfolio_before_update () returns trigger language plpgsql
set
  search_path = pg_catalog as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end; $$;

drop trigger if exists portfolio_set_revision on public.portfolio;

create trigger portfolio_set_revision before
update on public.portfolio for each row
execute function public.portfolio_before_update ();

alter table public.portfolio enable row level security;

revoke all privileges on public.portfolio
from
  PUBLIC,
  anon,
  authenticated;

-- Table-level REVOKE does not clear old independently granted column privileges.
do $$
declare field record;
begin
  for field in select attname from pg_attribute
    where attrelid='public.portfolio'::regclass and attnum>0 and not attisdropped loop
    execute format('revoke all privileges (%I) on public.portfolio from PUBLIC, anon, authenticated',field.attname);
  end loop;
end; $$;

grant
select
  on public.portfolio to anon,
  authenticated;

grant
update (content) on public.portfolio to authenticated;

-- owner_id, id, revision and updated_at are never client-writable.
drop policy if exists "Published portfolio is readable" on public.portfolio;

create policy "Published portfolio is readable" on public.portfolio for
select
  to anon,
  authenticated using (true);

drop policy if exists "Only owner can edit" on public.portfolio;

create policy "Only owner can edit" on public.portfolio
for update
  to authenticated using (auth.uid () = owner_id)
with
  check (auth.uid () = owner_id);

do $$
begin
  if exists (select 1 from storage.buckets where id='portfolio-media' and public is distinct from true) then
    raise exception 'Existing portfolio-media bucket is private. Installer will NOT publish its contents. Review/migrate the bucket explicitly';
  end if;
end; $$;

insert into
  storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
values
  (
    'portfolio-media',
    'portfolio-media',
    true,
    52428800,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'video/mp4',
      'video/webm'
    ]
  )
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- IMPORTANT for a reused Supabase project: inspect ALL existing storage.objects
-- policies (pg_policies), including policies granted to PUBLIC and policies with
-- no bucket restriction. Permissive policies combine with OR. A broad INSERT,
-- UPDATE, DELETE or ALL policy can defeat the owner-only/no-overwrite guarantees
-- for this bucket. Remove or scope such policies manually AFTER reviewing their
-- use by other buckets. This installer does not destroy unrelated policies and
-- cannot safely infer arbitrary SQL predicates' scope. Fresh-project behavior
-- assumes no other storage mutation policies apply to portfolio-media.
drop policy if exists "Portfolio owner may upload" on storage.objects;

create policy "Portfolio owner may upload" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'portfolio-media'
    and exists (
      select
        1
      from
        public.portfolio
      where
        id = 'main'
        and owner_id = auth.uid ()
    )
  );

-- Public bucket files are intentionally readable without login. Never upload
-- private material. No UPDATE/DELETE storage policies are installed; unique
-- filenames are required and abandoned uploads need administrator cleanup.
-- Empty content starts with bundled placeholders; dashboard save replaces it.
commit;
