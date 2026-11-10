# Role-Based Private Hospital Management and Real-Time Analytics System

A complete web application with three role-based portals:

| Role | What they can do |
|------|------------------|
| **Owner / Admin** | Revenue charts (daily/weekly/monthly), pharmacy stock with low-stock and expiry alerts, department volume, staff activity, **Doctor of the Period award chart**, add doctors/departments |
| **Doctor** | Daily queue, patient history (EMR), diagnosis + prescriptions, working hours, off-days, patient feedback |
| **Patient** | Doctor directory, book from open time slots, live queue position, history and prescriptions, **rate a doctor after a visit** |

**Stack:** HTML/CSS/JavaScript + Bootstrap 5 + Chart.js (front end) · Node.js + Express 5 (back end) · PostgreSQL (database). All free and open source.

---

## How the pieces fit together (read this first)

```
 Browser (Bootstrap + Chart.js)          Server (Node + Express)             Database (PostgreSQL)
 ┌──────────────────────────┐   JSON    ┌───────────────────────────┐  SQL  ┌──────────────────┐
 │ views/*.html             │ ───────►  │ server.js  (security,     │ ────► │ users, doctors,  │
 │ public/js/*.js           │ ◄───────  │            sessions)      │ ◄──── │ appointments,    │
 │ draws pages and charts   │           │ src/routes/*.js (the API) │       │ payments, ...    │
 └──────────────────────────┘           └───────────────────────────┘       └──────────────────┘
```

1. The **browser** shows pages and charts. It never touches the database.
2. The **server** receives requests such as "give me this week's revenue", checks *who is asking* (login session) and *what role they have*, runs a SQL query, and replies with JSON.
3. The **database** stores everything permanently and enforces rules (for example, two patients can never hold the same time slot).

The golden rule of this design: **the server checks permissions on every request.** Hiding a button in the browser is only cosmetic; the real lock is on the server.

---

## Stage 1: Install the tools (one time)

1. **Node.js (LTS version 20 or newer)** from https://nodejs.org. It runs JavaScript on your computer as the server. Check with `node -v` in a terminal.
2. **PostgreSQL 15 or newer** from https://www.postgresql.org/download. The installer also offers **pgAdmin** (a visual database tool); keep it ticked. Remember the password you set for the `postgres` user.
3. **VS Code** (optional) from https://code.visualstudio.com to read and edit the code.

## Stage 2: Create the database and its user

The app should not use the all-powerful `postgres` account. We create a dedicated user and database.

**Using pgAdmin:**
1. Open pgAdmin, connect to your server (enter the `postgres` password).
2. Right-click **Login/Group Roles → Create → Login/Group Role**. Name: `hospital_user`. On the *Definition* tab set a password (e.g. `hospital_pass`). On the *Privileges* tab switch **Can login?** on. Save.
3. Right-click **Databases → Create → Database**. Name: `hospital_db`. Owner: `hospital_user`. Save.

**Or using a terminal (psql):**
```sql
CREATE USER hospital_user WITH PASSWORD 'hospital_pass';
CREATE DATABASE hospital_db OWNER hospital_user;
```
Use a strong password for anything beyond practice.

## Stage 3: Install the project's libraries

Unzip the project, open a terminal inside the folder, and run:

```bash
npm install
```

This reads `package.json` and downloads the libraries into `node_modules/`:

| Library | Why we need it |
|---------|----------------|
| `express` | The web server and routing (which URL runs which code) |
| `pg` | Lets Node talk to PostgreSQL |
| `express-session` + `connect-pg-simple` | Remembers who is logged in; sessions are stored in PostgreSQL so a server restart does not log everyone out |
| `bcryptjs` | Stores passwords as one-way hashes, never as readable text |
| `helmet` | Adds protective HTTP security headers (including a Content Security Policy) |
| `express-rate-limit` | Blocks password-guessing (max 10 login attempts per 15 minutes) |
| `dotenv` | Reads secrets from the `.env` file |

## Stage 4: Configure settings

Copy `.env.example` to a new file named `.env` (Windows: `copy .env.example .env`) and edit it:

```
PORT=3000
DATABASE_URL=postgres://hospital_user:hospital_pass@localhost:5432/hospital_db
SESSION_SECRET=<a long random string>
TIMEZONE=Africa/Nairobi
NODE_ENV=development
```

* `DATABASE_URL` format is `postgres://USER:PASSWORD@HOST:PORT/DATABASE`.
* Generate a `SESSION_SECRET` with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. It signs login cookies, so keep it private. **Never share or upload `.env`.**
* `TIMEZONE` makes "today" and "daily revenue" follow your hospital's clock.

## Stage 5: Create the tables

```bash
npm run db:init
```

This runs `db/schema.sql`. The tables, in plain language:

| Table | Purpose |
|-------|---------|
| `users` | Every login (admin, doctor, patient). The `role` column drives access control. Passwords are hashes. |
| `departments`, `doctors` | Departments and the extra details for doctor accounts (specialty, qualifications, fee, minutes per patient) |
| `patients` | Extra details for patient accounts (date of birth, blood group, allergies) |
| `doctor_availability`, `doctor_off_days` | Weekly working hours and one-off days off |
| `appointments` | A booking: patient + doctor + date + time + status |
| `medical_records` | The doctor's diagnosis and notes for a visit (the EMR) |
| `medicines`, `prescriptions` | Pharmacy stock and what each doctor prescribed |
| `payments` | Every income event: consultation fees and pharmacy sales. **Revenue charts are built from this table.** |
| `feedback` | A patient's 1-5 star rating of a completed visit. **The doctor award is built from this table.** |
| `session` | Login sessions |

Design decisions worth understanding:
* **Foreign keys** (`REFERENCES`) stop impossible data, such as an appointment for a doctor who does not exist.
* **`CHECK` rules** stop bad values at the source: stock can never go below 0, ratings must be 1-5.
* **The unique index `uq_live_slot`** is the double-booking guard. Even if two patients click "Confirm" at the same instant, the database lets only one through.
* **`UNIQUE (appointment_id)` on feedback** means one review per visit, so ratings cannot be stuffed.

## Stage 6: Load demo data (recommended)

```bash
npm run db:seed
```

Creates 6 departments, 6 doctors, 30 patients, 22 medicines, **60 days of visit history with payments and feedback**, and today's queue, so every chart has something to show. To start over: `npm run db:reset` then `npm run db:seed`.

| Role | E-mail | Password |
|------|--------|----------|
| Admin / Owner | `admin@hospital.test` | `Admin@123` |
| Doctor | printed by `npm run db:seed` (an address like `name@gmail.com`; every demo doctor uses the same password) | `Doctor@123` |
| Patient | `patient@hospital.test` | `Patient@123` |

**Change these passwords (or delete the demo users) before real use.**

## Stage 7: Run it

```bash
npm start
```
Open http://localhost:3000. Logging in sends you to the dashboard for your role. (`npm run dev` restarts the server automatically when you edit code.)

---

## Stage 8: Guided tour (what to try)

**As Patient** (`patient@hospital.test`)
1. *Find a doctor*: filter by department, read qualifications, hours and ratings.
2. Click **Book appointment**, pick a date, pick a green time (taken times are crossed out), confirm.
3. *My appointments*: cancel a booking; on a **completed** visit click **Rate this visit** to give stars and a comment. On the day of a visit you see "N ahead of you today".
4. *History and prescriptions*: past diagnoses, and which medicines are still active.

**As Doctor** (`doctor1@hospital.test`)
1. *Today's queue*: patients in time order. Press **Patient arrived**, then **Start consultation**.
2. In the consultation window you see allergies and previous visits. Enter a diagnosis, add medicines, then **Save and complete visit**. Behind the scenes the server, as one all-or-nothing transaction, saves the record, reduces pharmacy stock, and records the consultation fee and medicine charges as revenue.
3. *Availability*: set weekly hours (add two periods for a lunch break), minutes per patient, and off-days.
4. *Patient feedback*: your average rating and recent comments.

**As Owner** (`admin@hospital.test`)
1. *Overview*: KPI strip, revenue chart (switch Daily/Weekly/Monthly and Bars/Lines), department volume, staff activity.
2. *Doctor awards*: the winner banner and ranking chart. Change the period (30 days to all time).
3. *Pharmacy*: filter Low stock / Expiring, add medicines, edit or restock. Watch a medicine drop after a doctor prescribes it.
4. *Staff*: create doctor accounts, disable/enable logins, add departments.

---

## Stage 9: How the important parts work

### 9.1 Role-based access control (RBAC)
* Login (`src/routes/auth.js`) checks the password hash and stores `{id, role}` in the server-side session.
* `src/middleware/auth.js` provides `requireRole('admin')` etc. Each router starts with one line such as `router.use(requireRole('doctor'))`, so every route inside is protected.
* **Data-level protection:** a patient's queries always include `WHERE patient_id = req.patientId`, taken from the session, never from the browser. A doctor can open a patient's history only if that patient has booked with them.
* Pages are protected too: `/admin` redirects to the right home if you are not an admin.

### 9.2 Revenue analytics (Module A)
`/api/admin/revenue` uses a PostgreSQL aggregate query:
```sql
SELECT ... SUM(amount) ...
FROM generate_series(<start>, <now>, interval '1 day') AS b(bucket)
LEFT JOIN payments ON date_trunc('day', paid_at) = b.bucket
GROUP BY b.bucket
```
`generate_series` creates one row per day/week/month so days with no income appear as zero instead of being skipped. Chart.js draws the result. The daily, weekly and monthly choices differ only in the `unit` (`day`, `week`, `month`).

### 9.3 The "best doctor" award
Simply sorting by average rating is unfair: a doctor with two 5-star reviews would beat one with 100 reviews averaging 4.8. So the award uses a **weighted (Bayesian) average**:

```
score = (n / (n + 3)) × doctor_average  +  (3 / (n + 3)) × hospital_average
```
`n` is the doctor's number of reviews. With few reviews the score is pulled toward the hospital average; with many reviews it approaches the doctor's own average. The chart shows score and plain average side by side, with the winner highlighted in gold. You can change the `3` in `src/routes/admin.js` to make it stricter or looser.

### 9.4 Booking slots (`src/slots.js`)
Working hours per weekday are split into slots of the doctor's *minutes per patient*, then it removes off-days, times already passed today, and times already booked. The server re-checks the slot at booking time, and the database unique index is the final safety net.

### 9.5 Transactions (`withTransaction` in `src/db.js`)
Completing a visit changes five tables. If any step fails (for example, stock too low), everything is rolled back, so the system can never show "visit completed" while the stock or payment is missing. This is PostgreSQL's ACID guarantee at work.

### 9.6 Security checklist (already built in)
* Passwords hashed with bcrypt; login errors do not reveal whether an e-mail exists; rate-limited.
* Session cookie is `httpOnly` and `sameSite=lax`; session id is replaced at login.
* Every SQL statement uses parameters (`$1, $2`), which prevents SQL injection.
* All text shown in pages is escaped (`esc()`), and a Content Security Policy blocks injected scripts.
* Write requests need an `X-Requested-With` header (a simple CSRF defence).
* The server never shows internal error details to users.

---

## Stage 10: Test checklist

- [ ] Log in as each role and confirm you land on a different dashboard.
- [ ] While logged in as a patient, open `http://localhost:3000/admin`. You should be redirected.
- [ ] Book a slot as a patient; log in as that doctor and see it in the queue.
- [ ] Try booking the same slot from two browsers; the second must be refused.
- [ ] Complete a consultation with a prescription; check the pharmacy stock dropped and today's revenue rose.
- [ ] Rate the completed visit as the patient; check the Doctor awards tab reflects it.
- [ ] Prescribe more than the stock; the whole visit must be refused and nothing saved.

## Project map

```
server.js                 starts the app, security, sessions, page routes
src/db.js                 database connection + transaction helper
src/slots.js              time-slot generator
src/middleware/auth.js    RBAC guards, CSRF header check
src/routes/auth.js        login, register, logout
src/routes/admin.js       Module A (owner)
src/routes/doctor.js      Module B (doctor)
src/routes/patient.js     Module C (patient)
src/routes/public.js      doctor directory
db/schema.sql             all tables
db/init.js  db/seed.js    create tables / load demo data
db/create-admin.js        create the owner account (or reset a password)
db/org.js                 the 34 departments and their staffing rules
db/apply-departments.js   adds missing departments and staff (npm run db:departments)
src/schedules.js          working patterns (Mon-Wed, Thu-Sun, day, night, office)
api/index.js  vercel.json  entry point and settings for Vercel
DEPLOY.md                 GitHub + Neon + Vercel guide
views/home.html           public front page
views/login.html          sign-in template (patient / doctor / owner)
views/admin|doctor|patient.html  the three dashboards
public/js/*.js            page logic and charts
public/css/style.css      colours and shared look
public/css/site.css       front page and sign-in pages
```

## Stage 11: Ideas to extend it
Receptionist role; SMS/e-mail reminders; printing prescriptions as PDF; lab results; M-Pesa payment integration; audit log of who viewed which record; password reset by e-mail; two-factor login for admin.

## Stage 11b: Assistant bot, English/Kiswahili and registration confirmation

**Assistant bot.** A round "Ask the assistant" button sits in the corner of every page. It is a free, rule-based helper (no paid AI service): it recognises keywords in English and Kiswahili and answers from the live database.
* Everyone: how to book, cancel or register; departments; doctors by department; consultation fee range; top-rated doctors; privacy; contact and hours.
* Signed-in patient: "My next appointment", "My prescriptions".
* Doctor: "My queue today". Owner: "Revenue today", "Which medicines are low?". These are checked on the server, so a patient cannot ask for the owner's numbers.
* Safety: it never gives medical advice. Symptom questions get "book a consultation", and emergency or self-harm wording gets a clear "go to the emergency room or call 999 / 112" reply.
* To teach it something new, open `src/routes/bot.js` and add an entry to the `intents` list (keywords + an English and a Kiswahili answer).
* Optional: put your hospital's phone, address and hours in `.env` (`HOSPITAL_PHONE`, `HOSPITAL_ADDRESS`, `HOSPITAL_HOURS`) so the bot can share them.
* Later upgrade: the same `/api/bot/ask` endpoint could be connected to an AI service, but that is paid and needs careful medical-safety rules.

**English / Kiswahili.** The EN | SW switch (login page and patient portal) changes every label, message, date and the bot's language, and remembers your choice. All texts live in `public/js/i18n.js`; correct or add translations there. Messages from the server are translated in the `SERVER_MESSAGES_SW` list. The doctor and owner pages are still English-only (the bot works in both languages there).

**Confirm details before registering.** After the form, a patient sees a review screen listing every detail, must tick "I confirm that the details above are correct", and only then is the account created. The server also refuses any registration without that confirmation, so it cannot be skipped.

## Stage 11d: Departments, staffing and doctor logins

* The hospital now has **34 departments** in five groups: emergency and critical care (ED, ICU, NICU, HDU), specialist clinics (cardiology, oncology, paediatrics, obstetrics and gynaecology, orthopaedics, neurology, dermatology, ENT, eye, dental, psychiatry, urology, gastroenterology, endocrinology, pulmonology and general medicine), surgery (general, plastic, anaesthesiology, operating theatre), diagnostics and support (radiology, laboratory, pharmacy, physiotherapy, nutrition) and administration (reception, medical records, billing, human resources, IT).
* **Every department has at least two people on different days or shifts.** Most use a split week (one works Monday to Wednesday, the other Thursday to Sunday). The 24-hour services (emergency, ICU, NICU, HDU, anaesthesia, theatre, pharmacy) use one day-shift and one night-shift person.
* **Human Resources has exactly one person.** The system refuses a second one.
* **Doctors and clinicians sign in with their e-mail and password** (a valid address such as `example@gmail.com` and at least 8 characters, enforced by the system). Support and administrative staff are listed for the owner and have no login.
* **Patients can only book clinics that take bookings.** Emergency, ICU, radiology, the laboratory, the pharmacy and the administrative departments are not bookable. HR and the other administrative departments never appear on the public pages.
* The owner's **Staff** tab shows a coverage table (which department is short of people), all doctors with their working pattern, all support personnel, and forms to add a doctor, a person or a department.
* **Existing database?** Run `npm run db:init` (adds the new columns safely) and then `npm run db:departments`. It only adds what is missing, keeps your current doctors and logins, and saves the logins of any NEW doctors in `db/staff-credentials.csv` (private; Git ignores it). To start from scratch locally instead, use `npm run db:reset` then `npm run db:seed`.
* The doctor names and `@gmail.com` addresses created by the scripts are **placeholders**. Replace them with your real staff's details before real use.

## Stage 11c: Front page and separate sign-in pages

* `http://localhost:3000/` is the public **front page**: a menu to choose Patient, Doctor or Owner, live departments and top-rated doctors from your database, and how it works.
* Each role has its **own sign-in page with its own colour**: `/login/patient` (green), `/login/doctor` (teal-blue) and `/login/owner` (midnight blue). Only the patient page offers registration.
* **The server enforces it.** If a doctor enters the correct password on the patient page, sign-in is refused with "This is a doctor account. Please use the Doctor sign-in page." (A wrong password still just says "Incorrect e-mail or password", so nobody can discover which role an e-mail has.)
* Signed-in people who open `/` or a sign-in page are sent straight to their own dashboard.
* Each dashboard has a role-coloured top bar and a personal greeting ("Good morning, Amina").
* Colours live at the top of `public/css/style.css` (`--primary`, `--accent`, `--paper` and the per-role overrides), so you can re-brand the whole system by changing a few values. The front page and sign-in layouts are in `public/css/site.css`.

## Stage 12: Putting it online for free (optional)
The full, beginner-friendly guide is in **DEPLOY.md**: push the code to GitHub, create a free online PostgreSQL database (Neon), and host the site on Vercel. Short version: GitHub stores the code, Neon stores the data, Vercel runs the website, and the environment variables `DATABASE_URL`, `SESSION_SECRET`, `TIMEZONE` and `NODE_ENV=production` connect them. Do not upload your `.env` file, and do not put the demo accounts on a public site.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Start the PostgreSQL service. |
| `password authentication failed` | The user or password in `DATABASE_URL` does not match Stage 2. |
| `database "hospital_db" does not exist` | Create it (Stage 2). |
| `permission denied for schema public` (PostgreSQL 15+) | Run in psql as `postgres`: `\c hospital_db` then `GRANT ALL ON SCHEMA public TO hospital_user;` |
| Blank charts / unstyled page | You are offline; Bootstrap and Chart.js load from a CDN. Connect to the internet. |
| Port 3000 in use | Change `PORT` in `.env`. |
| "Missing DATABASE_URL or SESSION_SECRET" | You did not create `.env` (Stage 4). |
| Seed says data already exists | `npm run db:reset` then `npm run db:seed`. |

## Known limitations
* Disabling a doctor blocks new logins but an already-open session lasts until it expires (8 hours) or they log out.
* Revenue is recorded when a visit is completed (cash/M-Pesa method is not tracked per transaction in the UI).
* Front-end pages were verified by code checks and the full API was tested end to end; do a quick visual pass in your browser when you first run it.
