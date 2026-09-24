-- ============================================================
-- WhatsApp Booking Bot Schema
-- ============================================================

-- Bot Services: each service gets its own WhatsApp number (bot ID)
CREATE TABLE IF NOT EXISTS whatsapp_bot_services (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  description             TEXT,
  phone_number            TEXT NOT NULL UNIQUE,   -- Twilio WhatsApp number e.g. whatsapp:+14155238886
  twilio_account_sid      TEXT,
  twilio_auth_token       TEXT,
  is_active               BOOLEAN DEFAULT true,
  welcome_message         TEXT DEFAULT 'Hello! 👋 Welcome to our booking service. How can I help you today?',
  booking_duration_minutes INTEGER DEFAULT 60,
  max_advance_days        INTEGER DEFAULT 30,
  timezone                TEXT DEFAULT 'Africa/Johannesburg',
  color                   TEXT DEFAULT '#25D366',
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Business Hours per Bot Service
CREATE TABLE IF NOT EXISTS business_hours (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_service_id        UUID NOT NULL REFERENCES whatsapp_bot_services(id) ON DELETE CASCADE,
  day_of_week           INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun,6=Sat
  is_open               BOOLEAN DEFAULT true,
  open_time             TIME DEFAULT '09:00',
  close_time            TIME DEFAULT '17:00',
  slot_duration_minutes INTEGER DEFAULT 60,
  UNIQUE(bot_service_id, day_of_week)
);

-- Time Slot Overrides (holiday, special extended hours, etc.)
CREATE TABLE IF NOT EXISTS time_slot_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_service_id UUID NOT NULL REFERENCES whatsapp_bot_services(id) ON DELETE CASCADE,
  override_date  DATE NOT NULL,
  is_closed      BOOLEAN DEFAULT false,
  open_time      TIME,
  close_time     TIME,
  reason         TEXT,
  UNIQUE(bot_service_id, override_date)
);

-- WhatsApp Conversations (one per customer per bot service)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_service_id  UUID NOT NULL REFERENCES whatsapp_bot_services(id) ON DELETE CASCADE,
  customer_phone  TEXT NOT NULL,
  customer_name   TEXT,
  customer_email  TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  current_step    TEXT DEFAULT 'idle',
  session_data    JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_service_id, customer_phone)
);

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text        TEXT NOT NULL,
  message_type        TEXT DEFAULT 'text',
  twilio_message_sid  TEXT,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Bookings (created through the bot)
CREATE TABLE IF NOT EXISTS whatsapp_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  bot_service_id    UUID NOT NULL REFERENCES whatsapp_bot_services(id) ON DELETE RESTRICT,
  booking_number    TEXT UNIQUE NOT NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  customer_email    TEXT,
  service_name      TEXT NOT NULL,
  booking_date      DATE NOT NULL,
  booking_time      TIME NOT NULL,
  duration_minutes  INTEGER DEFAULT 60,
  status            TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')
  ),
  notes             TEXT,
  admin_notes       TEXT,
  google_event_id   TEXT,
  email_sent        BOOLEAN DEFAULT false,
  confirmation_code TEXT UNIQUE,
  rescheduled_from  UUID REFERENCES whatsapp_bookings(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone   ON whatsapp_conversations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_service ON whatsapp_conversations(bot_service_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status  ON whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv     ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_created  ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_book_date    ON whatsapp_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_wa_book_phone   ON whatsapp_bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_wa_book_code    ON whatsapp_bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_wa_book_status  ON whatsapp_bookings(status);
CREATE INDEX IF NOT EXISTS idx_wa_book_service ON whatsapp_bookings(bot_service_id);
CREATE INDEX IF NOT EXISTS idx_biz_hours_svc   ON business_hours(bot_service_id);
CREATE INDEX IF NOT EXISTS idx_overrides_date  ON time_slot_overrides(bot_service_id, override_date);

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wa_bot_services_updated ON whatsapp_bot_services;
CREATE TRIGGER trg_wa_bot_services_updated
  BEFORE UPDATE ON whatsapp_bot_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_wa_conversations_updated ON whatsapp_conversations;
CREATE TRIGGER trg_wa_conversations_updated
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_wa_bookings_updated ON whatsapp_bookings;
CREATE TRIGGER trg_wa_bookings_updated
  BEFORE UPDATE ON whatsapp_bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Seed default business hours for any newly inserted service
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_business_hours()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO business_hours (bot_service_id, day_of_week, is_open, open_time, close_time)
  VALUES
    (NEW.id, 0, false, '09:00', '17:00'), -- Sunday  (closed)
    (NEW.id, 1, true,  '09:00', '17:00'), -- Monday
    (NEW.id, 2, true,  '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true,  '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true,  '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true,  '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '13:00'); -- Saturday (closed)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_business_hours ON whatsapp_bot_services;
CREATE TRIGGER trg_seed_business_hours
  AFTER INSERT ON whatsapp_bot_services
  FOR EACH ROW EXECUTE FUNCTION seed_default_business_hours();

-- ============================================================
-- RLS Policies (admin-only write, authenticated read)
-- ============================================================
ALTER TABLE whatsapp_bot_services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours           ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slot_overrides      ENABLE ROW LEVEL SECURITY;

-- Service role (used by Express backend) bypasses RLS automatically in Supabase.
-- The policies below apply only to direct client-side Supabase calls.

CREATE POLICY "Authenticated users can read bot services"
  ON whatsapp_bot_services FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read conversations"
  ON whatsapp_conversations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read bookings"
  ON whatsapp_bookings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read business hours"
  ON business_hours FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read overrides"
  ON time_slot_overrides FOR SELECT
  TO authenticated USING (true);
