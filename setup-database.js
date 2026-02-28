require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔧 Setting up SmartAppointment database on Supabase...');

    // Enable necessary extensions
    console.log('Enabling required extensions...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Create service_categories table
    console.log('Creating service_categories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.service_categories (
        id uuid primary key default uuid_generate_v4(),
        name text not null unique,
        description text,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
    `);

    // Create appointments table
    console.log('Creating appointments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.appointments (
        id uuid primary key default uuid_generate_v4(),
        appointment_number text not null unique,
        client_id uuid not null,
        provider_id uuid not null,
        service_category text not null,
        appointment_date timestamp with time zone not null,
        duration_minutes integer not null default 60,
        status text not null default 'pending',
        notes text,
        price decimal(10,2),
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
    `);

    // Create appointment_chat_messages table
    console.log('Creating appointment_chat_messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.appointment_chat_messages (
        id uuid primary key default uuid_generate_v4(),
        appointment_id uuid not null references public.appointments(id) on delete cascade,
        sender_id uuid not null,
        sender_role text not null,
        sender_name text,
        message_text text not null,
        attachments jsonb default '[]'::jsonb,
        created_at timestamp with time zone default now(),
        edited_at timestamp with time zone,
        deleted_at timestamp with time zone
      );
    `);

    // Create appointment_chat_attachments table
    console.log('Creating appointment_chat_attachments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.appointment_chat_attachments (
        id uuid primary key default uuid_generate_v4(),
        message_id uuid not null references public.appointment_chat_messages(id) on delete cascade,
        filename text not null,
        original_name text not null,
        mime_type text not null,
        file_size integer not null,
        file_path text not null,
        created_at timestamp with time zone default now()
      );
    `);

    // Create provider_services table
    console.log('Creating provider_services table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.provider_services (
        id uuid primary key default uuid_generate_v4(),
        provider_id uuid not null,
        service_category text not null,
        description text,
        price decimal(10,2),
        duration_minutes integer not null default 60,
        is_active boolean default true,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
    `);

    // Create payment_customers table
    console.log('Creating payment_customers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payment_customers (
        id text primary key,
        email text,
        name text,
        created_at timestamp with time zone default now()
      );
    `);

    // Create payment_methods table
    console.log('Creating payment_methods table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payment_methods (
        id text primary key,
        customer_id text references public.payment_customers(id) on delete cascade,
        type text not null,
        last4 text,
        brand text,
        expiry_month integer,
        expiry_year integer,
        is_default boolean default false,
        created_at timestamp with time zone default now()
      );
    `);

    // Create payment_transactions table
    console.log('Creating payment_transactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.payment_transactions (
        id text primary key,
        appointment_id uuid references public.appointments(id) on delete set null,
        customer_id text references public.payment_customers(id) on delete set null,
        payment_method_id text references public.payment_methods(id) on delete set null,
        amount decimal(10,2) not null,
        currency text not null default 'ZAR',
        status text not null,
        description text,
        stripe_payment_intent_id text,
        created_at timestamp with time zone default now()
      );
    `);

    // Create master_data_types table
    console.log('Creating master_data_types table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.master_data_types (
        id uuid primary key default uuid_generate_v4(),
        name text not null unique,
        description text,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
    `);

    // Create master_data_items table
    console.log('Creating master_data_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.master_data_items (
        id uuid primary key default uuid_generate_v4(),
        type_id uuid not null references public.master_data_types(id) on delete cascade,
        key text not null,
        value text not null,
        description text,
        is_active boolean default true,
        sort_order integer default 0,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now(),
        unique(type_id, key)
      );
    `);

    // Create feedback_question_sets table
    console.log('Creating feedback_question_sets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feedback_question_sets (
        id uuid primary key default uuid_generate_v4(),
        name text not null,
        description text,
        is_active boolean default true,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
    `);

    // Create feedback_questions table
    console.log('Creating feedback_questions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feedback_questions (
        id uuid primary key default uuid_generate_v4(),
        question_set_id uuid not null references public.feedback_question_sets(id) on delete cascade,
        question_text text not null,
        question_type text not null,
        options jsonb,
        is_required boolean default true,
        sort_order integer default 0,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
    `);

    // Create feedback_responses table
    console.log('Creating feedback_responses table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feedback_responses (
        id uuid primary key default uuid_generate_v4(),
        appointment_id uuid not null references public.appointments(id) on delete cascade,
        question_set_id uuid not null references public.feedback_question_sets(id) on delete cascade,
        submitted_at timestamp with time zone default now()
      );
    `);

    // Create feedback_response_items table
    console.log('Creating feedback_response_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feedback_response_items (
        id uuid primary key default uuid_generate_v4(),
        response_id uuid not null references public.feedback_responses(id) on delete cascade,
        question_id uuid not null references public.feedback_questions(id) on delete cascade,
        answer_text text,
        answer_value jsonb,
        created_at timestamp with time zone default now()
      );
    `);

    // Create indexes for better performance
    console.log('Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_provider_id ON public.appointments(provider_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_appointment_id ON public.appointment_chat_messages(appointment_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.appointment_chat_messages(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_appointment_id ON public.payment_transactions(appointment_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);`);

    console.log('✅ Database setup completed successfully!');
    console.log('All tables and indexes have been created for Supabase.');

  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase().catch(console.error);