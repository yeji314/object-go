-- Interior Project Management Platform: initial schema
create extension if not exists "pgcrypto";

-- =======================================================
-- Tables
-- =======================================================

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text not null,
  phone text,
  role text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  address text,
  total_budget bigint,
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz default now()
);

create table if not exists schedules (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  work_date date not null,
  day_of_week text,
  process_name text not null,
  detail_items text,
  duration_days integer,
  prep_schedule text,
  estimated_cost bigint,
  status text default 'pending' check (status in ('pending','in_progress','done')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists cost_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  category text not null,
  item_name text not null,
  spec text,
  unit text,
  quantity numeric,
  unit_price bigint,
  total_price bigint generated always as (coalesce(quantity,0) * coalesce(unit_price,0)) stored,
  memo text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists decisions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  category text not null,
  title text not null,
  description text,
  options jsonb default '[]'::jsonb,
  selected_option text,
  deadline date,
  status text default 'pending' check (status in ('pending','decided','confirmed')),
  client_memo text,
  created_at timestamptz default now()
);

create table if not exists switch_specs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  item_type text not null check (item_type in ('switch','outlet')),
  space text not null,
  brand_line text,
  spec_detail text,
  quantity integer,
  product_url text,
  notes text,
  status text default 'pending' check (status in ('pending','ordered','installed')),
  created_at timestamptz default now()
);

create table if not exists attachments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  ref_type text not null check (ref_type in ('cost_item','decision','schedule','general','switch_spec')),
  ref_id uuid,
  storage_path text not null,
  original_name text,
  caption text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  ref_type text check (ref_type in ('schedule','cost_item','decision','general','switch_spec')),
  ref_id uuid,
  author_id uuid references profiles(id) not null,
  body text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- helpful indexes
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_schedules_project on schedules(project_id, work_date);
create index if not exists idx_cost_items_project on cost_items(project_id, category, sort_order);
create index if not exists idx_decisions_project on decisions(project_id, status);
create index if not exists idx_switch_specs_project on switch_specs(project_id, item_type, space);
create index if not exists idx_attachments_ref on attachments(project_id, ref_type, ref_id);
create index if not exists idx_comments_ref on comments(project_id, ref_type, ref_id);

-- =======================================================
-- Helper: is_admin()
-- =======================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- =======================================================
-- Auto-create profile on new auth.users
-- =======================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =======================================================
-- Row Level Security
-- =======================================================
alter table profiles       enable row level security;
alter table projects       enable row level security;
alter table schedules      enable row level security;
alter table cost_items     enable row level security;
alter table decisions      enable row level security;
alter table switch_specs   enable row level security;
alter table attachments    enable row level security;
alter table comments       enable row level security;

-- profiles
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on profiles;
create policy profiles_insert_admin on profiles
  for insert with check (public.is_admin() or id = auth.uid());

-- projects
drop policy if exists projects_select on projects;
create policy projects_select on projects
  for select using (client_id = auth.uid() or public.is_admin());

drop policy if exists projects_insert_admin on projects;
create policy projects_insert_admin on projects
  for insert with check (public.is_admin());

drop policy if exists projects_update_admin on projects;
create policy projects_update_admin on projects
  for update using (public.is_admin());

drop policy if exists projects_delete_admin on projects;
create policy projects_delete_admin on projects
  for delete using (public.is_admin());

-- helper used inline: a project belongs to auth.uid()
-- schedules
drop policy if exists schedules_select on schedules;
create policy schedules_select on schedules
  for select using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = schedules.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists schedules_write_admin on schedules;
create policy schedules_write_admin on schedules
  for all using (public.is_admin()) with check (public.is_admin());

-- cost_items
drop policy if exists cost_items_select on cost_items;
create policy cost_items_select on cost_items
  for select using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = cost_items.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists cost_items_write_admin on cost_items;
create policy cost_items_write_admin on cost_items
  for all using (public.is_admin()) with check (public.is_admin());

-- decisions
drop policy if exists decisions_select on decisions;
create policy decisions_select on decisions
  for select using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = decisions.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists decisions_insert_admin on decisions;
create policy decisions_insert_admin on decisions
  for insert with check (public.is_admin());
drop policy if exists decisions_delete_admin on decisions;
create policy decisions_delete_admin on decisions
  for delete using (public.is_admin());
-- Clients can update selected_option / client_memo / status on their own project; admins can update all fields.
drop policy if exists decisions_update on decisions;
create policy decisions_update on decisions
  for update using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = decisions.project_id and p.client_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from projects p where p.id = decisions.project_id and p.client_id = auth.uid()
    )
  );

-- switch_specs
drop policy if exists switch_specs_select on switch_specs;
create policy switch_specs_select on switch_specs
  for select using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = switch_specs.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists switch_specs_write_admin on switch_specs;
create policy switch_specs_write_admin on switch_specs
  for all using (public.is_admin()) with check (public.is_admin());

-- attachments
drop policy if exists attachments_select on attachments;
create policy attachments_select on attachments
  for select using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = attachments.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists attachments_insert on attachments;
create policy attachments_insert on attachments
  for insert with check (
    public.is_admin() or exists (
      select 1 from projects p where p.id = attachments.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists attachments_delete on attachments;
create policy attachments_delete on attachments
  for delete using (
    public.is_admin() or uploaded_by = auth.uid()
  );

-- comments
drop policy if exists comments_select on comments;
create policy comments_select on comments
  for select using (
    public.is_admin() or exists (
      select 1 from projects p where p.id = comments.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists comments_insert on comments;
create policy comments_insert on comments
  for insert with check (
    public.is_admin() or exists (
      select 1 from projects p where p.id = comments.project_id and p.client_id = auth.uid()
    )
  );
drop policy if exists comments_update on comments;
create policy comments_update on comments
  for update using (
    public.is_admin() or author_id = auth.uid()
  );
drop policy if exists comments_delete on comments;
create policy comments_delete on comments
  for delete using (
    public.is_admin() or author_id = auth.uid()
  );

-- =======================================================
-- Realtime
-- =======================================================
alter publication supabase_realtime add table schedules;
alter publication supabase_realtime add table cost_items;
alter publication supabase_realtime add table decisions;
alter publication supabase_realtime add table switch_specs;
alter publication supabase_realtime add table attachments;
alter publication supabase_realtime add table comments;

-- =======================================================
-- Storage bucket: attachments
-- =======================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments_read" on storage.objects;
create policy "attachments_read" on storage.objects
  for select using (
    bucket_id = 'attachments' and (
      public.is_admin() or exists (
        select 1 from public.attachments a
        join public.projects p on p.id = a.project_id
        where a.storage_path = storage.objects.name
          and (p.client_id = auth.uid() or public.is_admin())
      )
    )
  );

drop policy if exists "attachments_insert" on storage.objects;
create policy "attachments_insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments' and auth.uid() is not null
  );

drop policy if exists "attachments_delete" on storage.objects;
create policy "attachments_delete" on storage.objects
  for delete using (
    bucket_id = 'attachments' and (public.is_admin() or owner = auth.uid())
  );
