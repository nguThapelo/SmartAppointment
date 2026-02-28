# SmartAppointment Database Setup for Supabase

This guide will help you set up the database for the SmartAppointment application on Supabase.

## Prerequisites

- Supabase project created
- Database connection string from Supabase dashboard
- Service role key for seeding data
- Node.js installed
- Environment variables configured in `.env` file

## Environment Variables Required

Make sure your `.env` file contains:

```env
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can find these values in your Supabase project dashboard under Settings > API.

## Database Setup Scripts

### Option 1: Complete Setup (Recommended)

Run the complete database initialization:

```bash
npm run init-db
```

This will:
1. Create all necessary database tables
2. Set up indexes for performance
3. Seed initial data (service categories, master data, feedback questions)

### Option 2: Step-by-Step Setup

If you prefer to run each step separately:

```bash
# Create database schema
npm run setup-db

# Seed with initial data
npm run seed-db
```

### Option 3: Manual Execution

You can also run the scripts directly:

```bash
# Complete setup
node init-database.js

# Or individually
node setup-database.js
node seed-database.js
```

## What Gets Created

### Tables Created

- `service_categories` - Service categories (Consultation, Therapy, etc.)
- `appointments` - Appointment bookings
- `appointment_chat_messages` - Chat messages for appointments
- `appointment_chat_attachments` - File attachments for chat
- `provider_services` - Services offered by providers
- `payment_customers` - Stripe customer data
- `payment_methods` - Payment methods
- `payment_transactions` - Payment transaction records
- `master_data_types` - Master data type definitions
- `master_data_items` - Master data values
- `feedback_question_sets` - Feedback question sets
- `feedback_questions` - Individual feedback questions
- `feedback_responses` - Feedback responses
- `feedback_response_items` - Individual question responses

### Initial Data Seeded

- **Service Categories**: Consultation, Therapy, Coaching, Training, Assessment
- **Master Data**: Appointment statuses, user roles, payment statuses
- **Feedback System**: Post-appointment feedback questions

### Indexes Created

- Appointments: client_id, provider_id, status, appointment_date
- Chat messages: appointment_id, created_at
- Payment transactions: appointment_id, status

## Troubleshooting

### Database Connection Issues

1. **Check DATABASE_URL**: Ensure it's correctly formatted
2. **SSL Settings**: The scripts use `rejectUnauthorized: false` for SSL
3. **Permissions**: Database user needs CREATE TABLE permissions

### Supabase Specific Issues

1. **Service Role Key**: For seeding, you need the service role key (not anon key)
   - Go to Supabase Dashboard → Settings → API → service_role key
2. **RLS Policies**: Supabase RLS might block operations - you may need to disable RLS temporarily or set up proper policies
3. **Connection Limits**: Free Supabase plans have connection limits - the scripts use connection pooling to minimize this
4. **Extensions**: The setup enables `uuid-ossp` and `pgcrypto` extensions which should be available on Supabase

### Common Errors

- **"supabaseUrl is required"**: Check NEXT_PUBLIC_SUPABASE_URL in .env
- **"relation already exists"**: Tables already exist, script is safe to re-run
- **Connection timeout**: Check database host/port and firewall settings

## After Setup

Once the database is set up:

1. Start the server: `npm run dev`
2. Open `http://localhost:8000`
3. Log in and test the application

The chat system, appointments, payments, and feedback should all work properly now.