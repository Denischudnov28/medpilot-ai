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
