# Putting the system online: GitHub, then Vercel

You will do three things, in this order:

1. **GitHub** stores your code online (and Vercel reads it from there).
2. **Neon** gives you a free online PostgreSQL database. (Vercel does not host databases, and your computer's database is not reachable from the internet.)
3. **Vercel** runs the website and gives it a public address like `https://hospital-system.vercel.app`.

Allow about 45 minutes the first time.

> **Why the code needed small changes for Vercel.** Vercel does not keep a server running all day. It starts your app for a moment each time someone visits ("serverless"). So `server.js` now exports the app instead of always listening on a port, `api/index.js` hands every request to it, `vercel.json` tells Vercel to include the `views` and `public` folders, and the database pool is kept small. `npm start` on your own computer still works exactly as before.

---

## Part 1: Put the code on GitHub

### 1.1 Install Git (once)
Download from https://git-scm.com/download/win and install with the default options. Close and reopen VS Code afterwards. Check in the terminal: `git --version`.

### 1.2 Create a GitHub account and an empty repository
1. Sign up at https://github.com (free).
2. Click **+ → New repository**.
3. Name it `hospital-system`. Choose **Private** (recommended for a school project). **Do not** tick "Add a README" or ".gitignore" (your project already has them). Click **Create repository**.
4. Keep the page open. It shows your repository address, like `https://github.com/YOUR-USERNAME/hospital-system.git`.

### 1.3 Tell Git who you are (once)
In the VS Code terminal (inside the project folder):
```
git config --global user.name "Your Name"
git config --global user.email "the-email-you-used-on-github@example.com"
```

### 1.4 Check that secrets will NOT be uploaded
Your `.env` file contains your database password and secret key. The `.gitignore` file already excludes it, but always check:
```
git init
git add .
git status
```
Read the list. You should **not** see `.env` or `node_modules`. (You should see `.env.example`, which is safe.) If `.env` appears, stop and tell me.

### 1.5 Save and upload
```
git commit -m "Hospital management system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/hospital-system.git
git push -u origin main
```
A browser window opens asking you to sign in to GitHub. Approve it. Refresh the GitHub page and your files appear.

**Later changes:** `git add .`, then `git commit -m "what you changed"`, then `git push`.

---

## Part 2: Create the online database (Neon)

1. Go to https://neon.com and sign up (the "Continue with GitHub" button is easiest).
2. **Create project.** Name: `hospital`. Region: **AWS Europe (Frankfurt)**. (`vercel.json` runs your site in Frankfurt too, so the two are close together and fast.)
3. On the project page click **Connect**. **Turn OFF the "Connection pooling" switch**, then copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:xxxxxxxx@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Keep it private. It is your database password.
4. **Create the tables in the online database** from your own computer. In the VS Code terminal (PowerShell), run these one at a time, pasting your own string inside the quotes:
   ```
   $env:DATABASE_URL="postgresql://neondb_owner:xxxx@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require"
   npm run db:init
   ```
   You should see `Database schema is ready.` This setting lasts only for this terminal window, so your normal `.env` is untouched.
5. **Create your owner account** (same terminal window):
   ```
   npm run create-admin -- "Your Name" you@example.com "A-long-strong-password"
   ```
   Use your real e-mail and a strong password (10+ characters). This is how you sign in to the Owner portal online.
6. Close the terminal window (or run `Remove-Item Env:DATABASE_URL`) so the setting disappears.

### Demo data on the online site? (read this)
`npm run db:seed` would fill the online database with the demo doctors and patients. Their passwords (`Doctor@123`, `Patient@123`) are written in the code and the README, so **anyone could sign in to them on a public website**. Only do this for a short demonstration. If you do, afterwards either run `npm run db:reset` in the same terminal window to wipe it, or reset each demo password with `npm run create-admin -- "x" doctor1@hospital.test "new-long-password"`. For a normal online site, skip the seed: create your owner account, then add doctors from the Owner portal's Staff tab, and let patients register themselves.

---

## Part 3: Deploy on Vercel

1. Go to https://vercel.com and sign up with **Continue with GitHub**.
2. Click **Add New → Project**. Find `hospital-system` in the list and click **Import**. (If it is not listed, click "Adjust GitHub App Permissions" and allow that repository.)
3. On the configuration page:
   - **Framework Preset:** `Other`
   - **Root Directory:** leave as `./`
   - **Build Command / Output Directory:** leave empty
4. Open **Environment Variables** and add these (name, then value, then Add):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Part 2 |
   | `SESSION_SECRET` | a long random string. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `TIMEZONE` | `Africa/Nairobi` |
   | `NODE_ENV` | `production` |
   | `HOSPITAL_PHONE`, `HOSPITAL_ADDRESS`, `HOSPITAL_HOURS` | optional, shown by the assistant bot |

5. Click **Deploy** and wait about a minute. When it says **Congratulations**, click the preview image or **Visit** to open your live site.
6. Test: open the front page, choose **Owner portal**, and sign in with the account from Part 2, step 5. Then register a test patient on the patient page and book an appointment.

Every time you `git push` to GitHub, Vercel automatically redeploys.

**Custom address:** in Vercel, **Settings → Domains** lets you attach your own domain (it costs money to register one). The free `.vercel.app` address is fine for a school demonstration.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| Vercel page shows "500" or "Application error" | Vercel project, **Logs** tab. Most often `DATABASE_URL` or `SESSION_SECRET` is missing or mistyped. Fix it under **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**. |
| Log says "Missing DATABASE_URL or SESSION_SECRET" | Same fix as above. Variables are added after the first deploy only take effect after a redeploy. |
| `unsupported startup parameter: options` | You copied the **pooled** connection string. Either copy the direct one (pooling switch off), or set `DB_POOLED` to `true` in Vercel and run this once in Neon's SQL Editor: `ALTER DATABASE neondb SET timezone TO 'Africa/Nairobi';` |
| `password authentication failed` or `ENOTFOUND` | The connection string was copied wrongly. Copy it again from Neon (use the copy button). |
| `relation "users" does not exist` | You skipped Part 2, step 4 (`npm run db:init`) or ran it against the wrong database. |
| Login works then logs you out straight away | Make sure `NODE_ENV` is `production` and you are using the `https://` address. |
| Page looks unstyled or charts are blank | Your computer is offline (Bootstrap and Chart.js load from a CDN), or press Ctrl+F5. |
| `git push` is rejected or asks for a password | Sign in through the browser window Git opens. GitHub no longer accepts account passwords for pushing. |
| First visit after a quiet period is slow | Normal on free plans (the app and database "wake up"). The next requests are fast. |

## Honest notes before you rely on it

* **Vercel's free (Hobby) plan is for personal, non-commercial use.** It is fine for a school project and demonstration. A real hospital running a business on it should use a paid plan or another host, and would also need a legal review for patient data (in Kenya, the Data Protection Act 2019).
* **The login-attempt limiter keeps its count in memory**, and serverless runs several copies, so the limit is looser online than on your computer. It still helps, but it is not a strong guard against a determined attacker.
* **Use only simulated patient data** on a free, public demo.
* **Neon's free database sleeps** when idle and has storage limits. This is plenty for a project.
