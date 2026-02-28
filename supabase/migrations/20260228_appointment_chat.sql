create table if not exists public.appointment_chat_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null,
  sender_name text,
  message_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointment_chat_messages_appointment_id_created_at
  on public.appointment_chat_messages (appointment_id, created_at);
