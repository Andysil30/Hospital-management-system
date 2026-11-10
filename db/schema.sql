-- =====================================================================
-- Hospital Management & Analytics System : database schema (PostgreSQL)
-- Safe to run more than once (CREATE ... IF NOT EXISTS).
-- =====================================================================

-- ---------- 1. Identity & roles ---------------------------------------
-- One table holds every login. The "role" column drives RBAC.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,          -- stored lower-case
  password_hash TEXT         NOT NULL,                 -- bcrypt hash, never plain text
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin','doctor','patient')),
  phone         VARCHAR(30),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,    -- admin can disable accounts
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description TEXT
);

-- Extra data that only doctors have. 1:1 with a users row.
CREATE TABLE IF NOT EXISTS doctors (
  id               SERIAL PRIMARY KEY,
  user_id          INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department_id    INT NOT NULL REFERENCES departments(id),
  specialty        VARCHAR(100) NOT NULL,
  qualifications   TEXT NOT NULL,
  bio              TEXT,
  consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (consultation_fee >= 0),
  slot_minutes     INT NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 120)
);

-- Extra data that only patients have. 1:1 with a users row.
CREATE TABLE IF NOT EXISTS patients (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender        VARCHAR(10),
  blood_group   VARCHAR(5),
  address       TEXT,
  allergies     TEXT
);

-- ---------- 2. Doctor availability ------------------------------------
-- weekday: 0 = Sunday ... 6 = Saturday (same as PostgreSQL's DOW).
-- A doctor may have several ranges per day (e.g. morning + afternoon).
CREATE TABLE IF NOT EXISTS doctor_availability (
  id         SERIAL PRIMARY KEY,
  doctor_id  INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday    SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS doctor_off_days (
  id        SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  off_date  DATE NOT NULL,
  reason    VARCHAR(200),
  UNIQUE (doctor_id, off_date)
);

-- ---------- 3. Appointments & clinical records -------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id               SERIAL PRIMARY KEY,
  patient_id       INT  NOT NULL REFERENCES patients(id),
  doctor_id        INT  NOT NULL REFERENCES doctors(id),
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  status           VARCHAR(12) NOT NULL DEFAULT 'booked'
                   CHECK (status IN ('booked','checked_in','completed','cancelled','no_show')),
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Double-booking protection enforced BY THE DATABASE: two live appointments
-- can never share the same doctor + date + time, even if two patients click
-- "Book" in the same millisecond.
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_slot
  ON appointments (doctor_id, appointment_date, start_time)
  WHERE status NOT IN ('cancelled','no_show');
CREATE INDEX IF NOT EXISTS ix_appt_doctor_date ON appointments (doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS ix_appt_patient     ON appointments (patient_id);

-- Electronic Medical Record: one visit note per completed appointment.
CREATE TABLE IF NOT EXISTS medical_records (
  id             SERIAL PRIMARY KEY,
  appointment_id INT NOT NULL UNIQUE REFERENCES appointments(id),
  patient_id     INT NOT NULL REFERENCES patients(id),
  doctor_id      INT NOT NULL REFERENCES doctors(id),
  diagnosis      TEXT NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_records_patient ON medical_records (patient_id);

-- ---------- 4. Pharmacy inventory --------------------------------------
CREATE TABLE IF NOT EXISTS medicines (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL UNIQUE,
  category      VARCHAR(60),
  unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  stock_qty     INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),   -- can never go negative
  reorder_level INT NOT NULL DEFAULT 20 CHECK (reorder_level >= 0),
  expiry_date   DATE
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id            SERIAL PRIMARY KEY,
  record_id     INT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id    INT NOT NULL REFERENCES patients(id),
  doctor_id     INT NOT NULL REFERENCES doctors(id),
  medicine_id   INT NOT NULL REFERENCES medicines(id),
  dosage        VARCHAR(80) NOT NULL,
  frequency     VARCHAR(80) NOT NULL,
  duration_days INT NOT NULL CHECK (duration_days > 0),
  quantity      INT NOT NULL CHECK (quantity > 0),
  instructions  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_rx_patient ON prescriptions (patient_id);

-- ---------- 5. Money ---------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id),
  patient_id     INT NOT NULL REFERENCES patients(id),
  amount         NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  type           VARCHAR(12) NOT NULL CHECK (type IN ('consultation','pharmacy')),
  method         VARCHAR(20) NOT NULL DEFAULT 'cash',
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_payments_paid_at ON payments (paid_at);

-- ---------- 6. Patient feedback (drives the "best doctor" award) --------
CREATE TABLE IF NOT EXISTS feedback (
  id             SERIAL PRIMARY KEY,
  appointment_id INT NOT NULL UNIQUE REFERENCES appointments(id),   -- one review per visit
  patient_id     INT NOT NULL REFERENCES patients(id),
  doctor_id      INT NOT NULL REFERENCES doctors(id),
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_feedback_doctor ON feedback (doctor_id, created_at);

-- ---------- 7. Login sessions (used by connect-pg-simple) ---------------
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_session_expire ON session (expire);

-- ---------- 8. Departments: groups, online booking and staffing rules ---
-- category : which group the department belongs to (used on the front page)
-- bookable : can patients book an appointment online? (false for ICU, pharmacy, HR...)
-- max_staff: upper limit of people (Human Resources = 1). NULL means no limit.
ALTER TABLE departments ADD COLUMN IF NOT EXISTS category VARCHAR(12) NOT NULL DEFAULT 'specialist'
  CHECK (category IN ('emergency','specialist','surgical','diagnostic','admin'));
ALTER TABLE departments ADD COLUMN IF NOT EXISTS bookable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS max_staff INT CHECK (max_staff > 0);

-- Which working pattern a doctor was given (NULL = they set custom hours themselves)
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS schedule VARCHAR(20);

-- Non-clinical and support personnel (reception, records, billing, HR, pharmacy...).
-- They are listed for the owner but do not have a login.
CREATE TABLE IF NOT EXISTS staff_members (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  job_title     VARCHAR(80)  NOT NULL,
  department_id INT NOT NULL REFERENCES departments(id),
  phone         VARCHAR(30),
  schedule      VARCHAR(20) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_staff_department ON staff_members (department_id);
