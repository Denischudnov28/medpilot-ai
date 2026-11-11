-- MEDFLOW PostgreSQL schema. Auto-applied by medflow-api.js.
-- Do not store directly identifying patient data in this initial release.
CREATE TABLE IF NOT EXISTS medflow_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS medflow_patients (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES medflow_users(id) ON DELETE CASCADE,
  display_code varchar(40) NOT NULL,
  unit varchar(80) NOT NULL DEFAULT '',
  handoff_note varchar(1000) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medflow_patients_user_updated_idx ON medflow_patients(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS medflow_notes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES medflow_users(id) ON DELETE CASCADE,
  body varchar(2000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medflow_notes_user_created_idx ON medflow_notes(user_id, created_at DESC);

-- Unified chart records: every entry belongs to one patient and one authenticated account.
CREATE TABLE IF NOT EXISTS medflow_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES medflow_users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES medflow_patients(id) ON DELETE CASCADE,
  category varchar(50) NOT NULL,
  body varchar(8000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medflow_records_patient_created_idx
  ON medflow_records(user_id, patient_id, created_at DESC);

-- Subscription state is controlled by verified billing-provider events, never by the browser.
CREATE TABLE IF NOT EXISTS medflow_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES medflow_users(id) ON DELETE CASCADE,
  plan varchar(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  status varchar(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','trialing','active','past_due','canceled')),
  provider varchar(20) CHECK (provider IS NULL OR provider IN ('stripe','apple','google','manual','yookassa','sberbank')),
  external_subscription_id text UNIQUE,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO medflow_subscriptions(user_id)
SELECT id FROM medflow_users
ON CONFLICT (user_id) DO NOTHING;


ALTER TABLE medflow_subscriptions DROP CONSTRAINT IF EXISTS medflow_subscriptions_provider_check;
ALTER TABLE medflow_subscriptions ADD CONSTRAINT medflow_subscriptions_provider_check CHECK (provider IS NULL OR provider IN ('stripe','apple','google','manual','yookassa','sberbank'));

-- Payment ledger. Store references and amounts only; never store card numbers or CVV.
-- A pending order does not grant Pro. Only verified provider confirmation may do so.
CREATE TABLE IF NOT EXISTS medflow_payment_orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES medflow_users(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL CHECK (provider IN ('manual_transfer','yookassa','sberbank')),
  provider_payment_id text,
  idempotency_key text NOT NULL UNIQUE,
  amount_kopecks bigint NOT NULL CHECK (amount_kopecks > 0),
  currency char(3) NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  period_days integer NOT NULL DEFAULT 30 CHECK (period_days BETWEEN 1 AND 366),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','canceled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS medflow_payment_orders_user_created_idx
  ON medflow_payment_orders(user_id, created_at DESC);
