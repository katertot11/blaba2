# BLABA2 Workout Tracker

A standalone iPhone web app for *Built Like a Badass 2* (12 weeks, 36 workouts). There's no sign-in, no server, and nothing to pay for. Your log is saved on your phone only.

## What's in the folder

| File | Purpose |
|---|---|
| `index.html` | The app page |
| `app.js` | Logging, storage, backup and restore |
| `parser.js` | Reads the Liftosaur program text (sets, %, AMRAP, timed work, rounds, supersets, notes) |
| `program.js` | Your `BLABA2-Liftosaur.json`, embedded unchanged |
| `styles.css` | Styling |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lets it install to the Home Screen and work offline |

## Free hosting: GitHub Pages (recommended, permanent)

1. Create a free account at github.com, or sign in to the one you have.
2. Click **+ → New repository**. Name it something like `blaba2`, set it to **Public**, and click **Create repository**.
3. On the new repo page, click **uploading an existing file**. Drag in **everything inside** the `workout-tracker` folder, including the `icons` folder, so `index.html` sits at the top level. Then click **Commit changes**.
4. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main**, and folder to **/ (root)**. Click **Save**.
5. After a minute or two, your app will be live at `https://YOUR-USERNAME.github.io/blaba2/`.

The Pages site is public, but it holds only the program. Your logged workouts never leave your phone.

**Alternative:** At app.netlify.com/drop, drag the `workout-tracker` folder onto the page. It deploys right away. Create a free account and claim the site, or it will expire.

## Install on your iPhone

1. Open the URL in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Always open the app from the Home Screen icon. iOS keeps a Home Screen app's storage more reliably than a regular Safari tab, and the app works offline at the gym.

## Using it

- **Home** shows your next workout. That's the first one you haven't finished. Tap **Open workout**.
- Go to **⚙ Settings** and enter your Bench Press and Squat (or deadlift) 1RM. Percentage sets will then show the suggested weight, rounded to 5 lb by default.
- For each set, enter **lb** and **reps**, then tap **✓**. If you tap ✓ on an empty set, it fills in the target reps and the suggested or last-used weight. AMRAP ("4+") and max sets ask you for the actual reps you did.
- **Timed work** (Timed Mile, Timed 100 Push Ups, Steady State Cardio) has a ▶ stopwatch. You can also type the time with digits: `735` means 7:35. Fixed-time sets and Tabata intervals fill in their time when you tap ✓.
- **Last time** under each exercise shows what you logged the last time you did that exercise.
- **+ Add set** lets you add extra bouts for chin-ups, Tabata rounds and similar.
- Tap **Finish workout** when you're done, and the next workout moves up.
- Everything saves automatically as you type. You'll see "Saved ✓" in the top bar.

## Backup & restore

Go to **⚙ Settings → Save backup file**. This opens the iOS share sheet. Choose **Save to Files** (iCloud Drive works well). To restore on a new phone, or after clearing Safari data, go to **Settings → Restore** and pick that file. You can also paste the backup text instead. Back up about once a week. The home screen will remind you.

> Note: Deleting the Home Screen icon, or clearing Safari's website data, erases the log on your phone. Your backup file is your safety net.
