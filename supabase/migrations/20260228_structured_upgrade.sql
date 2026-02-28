-- SmartAppointment structured upgrade migration
-- Run in Supabase SQL Editor (safe to re-run)

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum (
      'booked',
      'approved',
      'declined',
      'in_progress',
      'paid',
      'completed'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pending',
      'requires_payment_method',
      'requires_confirmation',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'refunded'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pricing_type') then
    create type public.pricing_type as enum ('hourly', 'fixed');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- SHARED HELPERS
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    'client'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_provider()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'provider';
$$;

-- -----------------------------------------------------------------------------
-- PROFILE / USERS EXTENSION TABLE
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone_number text,
  role text not null default 'client' check (role in ('admin', 'provider', 'client')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Auto-create profile when auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone_number, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'email',
    new.raw_user_meta_data ->> 'firstName',
    new.raw_user_meta_data ->> 'phoneNumber',
    coalesce(new.raw_user_meta_data ->> 'role', new.raw_app_meta_data ->> 'role', 'client')
  )
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill profiles for existing users
insert into public.profiles (id, email, first_name, last_name, phone_number, role)
select
  u.id,
  u.email,
  u.raw_user_meta_data ->> 'firstName',
  u.raw_user_meta_data ->> 'lastName',
  u.raw_user_meta_data ->> 'phoneNumber',
  coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', 'client')
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- DYNAMIC MASTER DATA (ALL REUSABLE DROPDOWNS)
-- -----------------------------------------------------------------------------
create table if not exists public.master_data_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_data_items (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.master_data_types(id) on delete cascade,
  label text not null,
  value text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(type_id, value)
);

create index if not exists idx_master_data_items_type on public.master_data_items(type_id, sort_order, label);

create trigger trg_master_data_types_updated_at
before update on public.master_data_types
for each row
execute function public.set_updated_at();

create trigger trg_master_data_items_updated_at
before update on public.master_data_items
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- SERVICE CATEGORIES / SUB-SERVICES (NORMALIZED)
-- -----------------------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_categories
  add column if not exists sub_services jsonb not null default '[]'::jsonb;

create table if not exists public.service_sub_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, name)
);

create index if not exists idx_sub_services_category on public.service_sub_services(category_id, name);

create trigger trg_service_categories_updated_at
before update on public.service_categories
for each row
execute function public.set_updated_at();

create trigger trg_service_sub_services_updated_at
before update on public.service_sub_services
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- PROVIDER SERVICE PRICING
-- -----------------------------------------------------------------------------
create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  sub_service_id uuid references public.service_sub_services(id) on delete set null,
  pricing_type public.pricing_type not null,
  rate numeric(12,2) not null check (rate >= 0),
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_services_provider on public.provider_services(provider_id);
create index if not exists idx_provider_services_category on public.provider_services(category_id, sub_service_id);

create trigger trg_provider_services_updated_at
before update on public.provider_services
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- APPOINTMENTS (EXTENDED)
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_number text unique,
  client_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete restrict,
  category_id uuid references public.service_categories(id) on delete set null,
  sub_service_id uuid references public.service_sub_services(id) on delete set null,
  service_category text,
  service_subtype text,
  title text not null,
  notes text,
  status public.appointment_status not null default 'booked',
  appointment_date timestamptz not null,
  end_time timestamptz,
  expected_hours numeric(8,2) check (expected_hours is null or expected_hours >= 0),
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_status public.payment_status not null default 'pending',
  provider_initiated_payment_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or end_time > appointment_date),
  check (amount_due >= 0 and amount_paid >= 0)
);

alter table public.appointments
  add column if not exists appointment_number text,
  add column if not exists category_id uuid,
  add column if not exists sub_service_id uuid,
  add column if not exists expected_hours numeric(8,2),
  add column if not exists amount_due numeric(12,2) not null default 0,
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists provider_initiated_payment_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- add foreign keys only if absent
alter table public.appointments
  drop constraint if exists appointments_category_id_fkey,
  add constraint appointments_category_id_fkey
  foreign key (category_id) references public.service_categories(id) on delete set null;

alter table public.appointments
  drop constraint if exists appointments_sub_service_id_fkey,
  add constraint appointments_sub_service_id_fkey
  foreign key (sub_service_id) references public.service_sub_services(id) on delete set null;

create unique index if not exists idx_appointments_number_unique on public.appointments(appointment_number);
create index if not exists idx_appointments_client_id on public.appointments(client_id);
create index if not exists idx_appointments_provider_id on public.appointments(provider_id);
create index if not exists idx_appointments_status on public.appointments(status);
create index if not exists idx_appointments_payment_status on public.appointments(payment_status);
create index if not exists idx_appointments_date on public.appointments(appointment_date);
create index if not exists idx_appointments_provider_status_date on public.appointments(provider_id, status, appointment_date);

create sequence if not exists public.appointment_number_seq;

create or replace function public.generate_appointment_number()
returns trigger
language plpgsql
as $$
begin
  if new.appointment_number is null or length(trim(new.appointment_number)) = 0 then
    new.appointment_number :=
      'SA-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.appointment_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_appointment_number on public.appointments;
create trigger trg_generate_appointment_number
before insert on public.appointments
for each row
execute function public.generate_appointment_number();

create trigger trg_appointments_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- STRIPE PAYMENT TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.payment_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_method_id text not null unique,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_methods_user on public.payment_methods(user_id, is_default desc, created_at desc);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete restrict,
  stripe_payment_intent_id text unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status public.payment_status not null default 'pending',
  initiated_by uuid references auth.users(id) on delete set null,
  initiated_at timestamptz,
  captured_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_transactions_appointment on public.payment_transactions(appointment_id);
create index if not exists idx_payment_transactions_provider on public.payment_transactions(provider_id, status, created_at desc);
create index if not exists idx_payment_transactions_client on public.payment_transactions(client_id, created_at desc);

create trigger trg_payment_customers_updated_at
before update on public.payment_customers
for each row
execute function public.set_updated_at();

create trigger trg_payment_methods_updated_at
before update on public.payment_methods
for each row
execute function public.set_updated_at();

create trigger trg_payment_transactions_updated_at
before update on public.payment_transactions
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- FEEDBACK SYSTEM
-- -----------------------------------------------------------------------------
create table if not exists public.feedback_question_sets (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('admin_global', 'provider_custom')),
  owner_provider_id uuid references auth.users(id) on delete cascade,
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'admin_global' and owner_provider_id is null)
    or
    (scope = 'provider_custom' and owner_provider_id is not null)
  )
);

create table if not exists public.feedback_questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.feedback_question_sets(id) on delete cascade,
  question_text text not null,
  answer_type text not null check (answer_type in ('rating_1_5', 'text', 'yes_no', 'single_choice')),
  options jsonb,
  is_required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_response_items (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.feedback_responses(id) on delete cascade,
  question_id uuid not null references public.feedback_questions(id) on delete cascade,
  answer_value jsonb not null,
  created_at timestamptz not null default now(),
  unique(response_id, question_id)
);

create index if not exists idx_feedback_questions_set on public.feedback_questions(question_set_id, sort_order);
create index if not exists idx_feedback_responses_provider on public.feedback_responses(provider_id, submitted_at desc);
create index if not exists idx_feedback_responses_client on public.feedback_responses(client_id, submitted_at desc);

create trigger trg_feedback_question_sets_updated_at
before update on public.feedback_question_sets
for each row
execute function public.set_updated_at();

create trigger trg_feedback_questions_updated_at
before update on public.feedback_questions
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.master_data_types enable row level security;
alter table public.master_data_items enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_sub_services enable row level security;
alter table public.provider_services enable row level security;
alter table public.appointments enable row level security;
alter table public.payment_customers enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.feedback_question_sets enable row level security;
alter table public.feedback_questions enable row level security;
alter table public.feedback_responses enable row level security;
alter table public.feedback_response_items enable row level security;

-- Profiles
 drop policy if exists "Profiles owner or admin" on public.profiles;
create policy "Profiles owner or admin"
on public.profiles
for all
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- Master data (admin CRUD, everyone read active)
drop policy if exists "Master data types read all auth" on public.master_data_types;
create policy "Master data types read all auth"
on public.master_data_types
for select
using (auth.role() = 'authenticated');

drop policy if exists "Master data types admin write" on public.master_data_types;
create policy "Master data types admin write"
on public.master_data_types
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Master data items read all auth" on public.master_data_items;
create policy "Master data items read all auth"
on public.master_data_items
for select
using (auth.role() = 'authenticated');

drop policy if exists "Master data items admin write" on public.master_data_items;
create policy "Master data items admin write"
on public.master_data_items
for all
using (public.is_admin())
with check (public.is_admin());

-- Service categories / sub-services
 drop policy if exists "Service categories read auth" on public.service_categories;
create policy "Service categories read auth"
on public.service_categories
for select
using (auth.role() = 'authenticated');

drop policy if exists "Service categories admin write" on public.service_categories;
create policy "Service categories admin write"
on public.service_categories
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Sub-services read auth" on public.service_sub_services;
create policy "Sub-services read auth"
on public.service_sub_services
for select
using (auth.role() = 'authenticated');

drop policy if exists "Sub-services admin write" on public.service_sub_services;
create policy "Sub-services admin write"
on public.service_sub_services
for all
using (public.is_admin())
with check (public.is_admin());

-- Provider services (provider manages own, admin global)
drop policy if exists "Provider services own or admin" on public.provider_services;
create policy "Provider services own or admin"
on public.provider_services
for all
using (auth.uid() = provider_id or public.is_admin())
with check (auth.uid() = provider_id or public.is_admin());

-- Appointments (client/provider own, admin global)
drop policy if exists "Appointments owner or admin" on public.appointments;
create policy "Appointments owner or admin"
on public.appointments
for all
using (auth.uid() = client_id or auth.uid() = provider_id or public.is_admin())
with check (auth.uid() = client_id or auth.uid() = provider_id or public.is_admin());

-- Payment customers
 drop policy if exists "Payment customers owner or admin" on public.payment_customers;
create policy "Payment customers owner or admin"
on public.payment_customers
for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

-- Payment methods
 drop policy if exists "Payment methods owner or admin" on public.payment_methods;
create policy "Payment methods owner or admin"
on public.payment_methods
for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

-- Payment transactions
 drop policy if exists "Payment transactions participants or admin" on public.payment_transactions;
create policy "Payment transactions participants or admin"
on public.payment_transactions
for all
using (auth.uid() = client_id or auth.uid() = provider_id or public.is_admin())
with check (auth.uid() = client_id or auth.uid() = provider_id or public.is_admin());

-- Feedback sets/questions
 drop policy if exists "Feedback sets read participants" on public.feedback_question_sets;
create policy "Feedback sets read participants"
on public.feedback_question_sets
for select
using (
  public.is_admin()
  or scope = 'admin_global'
  or (scope = 'provider_custom' and owner_provider_id = auth.uid())
);

drop policy if exists "Feedback sets write admin or owner provider" on public.feedback_question_sets;
create policy "Feedback sets write admin or owner provider"
on public.feedback_question_sets
for all
using (
  public.is_admin()
  or (scope = 'provider_custom' and owner_provider_id = auth.uid())
)
with check (
  public.is_admin()
  or (scope = 'provider_custom' and owner_provider_id = auth.uid())
);

drop policy if exists "Feedback questions read participants" on public.feedback_questions;
create policy "Feedback questions read participants"
on public.feedback_questions
for select
using (
  exists (
    select 1
    from public.feedback_question_sets s
    where s.id = feedback_questions.question_set_id
      and (
        public.is_admin()
        or s.scope = 'admin_global'
        or (s.scope = 'provider_custom' and s.owner_provider_id = auth.uid())
      )
  )
);

drop policy if exists "Feedback questions write admin or provider owner" on public.feedback_questions;
create policy "Feedback questions write admin or provider owner"
on public.feedback_questions
for all
using (
  exists (
    select 1
    from public.feedback_question_sets s
    where s.id = feedback_questions.question_set_id
      and (
        public.is_admin()
        or (s.scope = 'provider_custom' and s.owner_provider_id = auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.feedback_question_sets s
    where s.id = feedback_questions.question_set_id
      and (
        public.is_admin()
        or (s.scope = 'provider_custom' and s.owner_provider_id = auth.uid())
      )
  )
);

-- Feedback responses: client submits own, provider/admin can read
 drop policy if exists "Feedback responses read participants" on public.feedback_responses;
create policy "Feedback responses read participants"
on public.feedback_responses
for select
using (auth.uid() = client_id or auth.uid() = provider_id or public.is_admin());

drop policy if exists "Feedback responses client insert" on public.feedback_responses;
create policy "Feedback responses client insert"
on public.feedback_responses
for insert
with check (auth.uid() = client_id);

drop policy if exists "Feedback responses admin write" on public.feedback_responses;
create policy "Feedback responses admin write"
on public.feedback_responses
for update
using (public.is_admin())
with check (public.is_admin());

-- Feedback response items follow parent response access
 drop policy if exists "Feedback response items read participants" on public.feedback_response_items;
create policy "Feedback response items read participants"
on public.feedback_response_items
for select
using (
  exists (
    select 1
    from public.feedback_responses r
    where r.id = feedback_response_items.response_id
      and (auth.uid() = r.client_id or auth.uid() = r.provider_id or public.is_admin())
  )
);

drop policy if exists "Feedback response items client insert" on public.feedback_response_items;
create policy "Feedback response items client insert"
on public.feedback_response_items
for insert
with check (
  exists (
    select 1
    from public.feedback_responses r
    where r.id = feedback_response_items.response_id
      and auth.uid() = r.client_id
  )
);

-- -----------------------------------------------------------------------------
-- ANALYTICS VIEWS (DASHBOARDS)
-- -----------------------------------------------------------------------------
create or replace view public.v_provider_earnings_daily as
select
  provider_id,
  date_trunc('day', coalesce(captured_at, created_at))::date as day,
  coalesce(sum(case when status = 'succeeded' then amount else 0 end), 0)::numeric(12,2) as earnings
from public.payment_transactions
group by provider_id, date_trunc('day', coalesce(captured_at, created_at))::date;

create or replace view public.v_provider_earnings_by_category as
select
  a.provider_id,
  coalesce(sc.name, a.service_category, 'Uncategorized') as category,
  coalesce(sum(case when pt.status = 'succeeded' then pt.amount else 0 end), 0)::numeric(12,2) as earnings
from public.appointments a
left join public.payment_transactions pt on pt.appointment_id = a.id
left join public.service_categories sc on sc.id = a.category_id
group by a.provider_id, coalesce(sc.name, a.service_category, 'Uncategorized');

create or replace view public.v_client_spend_daily as
select
  client_id,
  date_trunc('day', coalesce(captured_at, created_at))::date as day,
  coalesce(sum(case when status = 'succeeded' then amount else 0 end), 0)::numeric(12,2) as spend
from public.payment_transactions
group by client_id, date_trunc('day', coalesce(captured_at, created_at))::date;

create or replace view public.v_client_spend_by_category as
select
  a.client_id,
  coalesce(sc.name, a.service_category, 'Uncategorized') as category,
  coalesce(sum(case when pt.status = 'succeeded' then pt.amount else 0 end), 0)::numeric(12,2) as spend
from public.appointments a
left join public.payment_transactions pt on pt.appointment_id = a.id
left join public.service_categories sc on sc.id = a.category_id
group by a.client_id, coalesce(sc.name, a.service_category, 'Uncategorized');

-- -----------------------------------------------------------------------------
-- BASE SEED FOR COMMON DROPDOWNS
-- -----------------------------------------------------------------------------
insert into public.master_data_types (code, name, description)
values
  ('appointment_status', 'Appointment Status', 'System booking statuses'),
  ('payment_status', 'Payment Status', 'Payment processing states'),
  ('time_slot_duration', 'Time Slot Duration', 'Selectable booking slot durations')
on conflict (code) do nothing;

-- Optional one-time admin promotion (run after replacing placeholder):
-- update auth.users
-- set
--   raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
--   raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb)  || jsonb_build_object('role', 'admin')
-- where id = 'YOUR_USER_ID_HERE'::uuid;

commit;
