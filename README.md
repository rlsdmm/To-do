# Loop

A habit to-do list for Android. Check things off to earn XP, level up, and build streaks. Daily and weekly habits come back on their own after you complete them.

Everything runs on the phone: no server, no account. Reminders are scheduled locally, so they work offline.

## How it works

- **Daily** habits come back every day.
- **Some days** habits only show up on the days you pick (e.g. Mon, Wed, Fri).
- **Weekly** habits can be done any day of the week and reset every Monday.
- **Once** is a normal to-do that leaves the list the day after you finish it.

Checking something off moves it to **Done** with a "Back tomorrow" / "Back Monday" label. It returns to **To do** automatically when it's due again.

XP per check-off: Easy 10, Medium 20, Hard 35, plus a streak bonus (+2 per streak step, up to +30). Finishing everything due in a day gives a +25 "Day cleared" bonus. Unchecking takes the XP back.

Reminders skip habits you've already done, so you're never nagged about something you finished.

---

## Build the APK with GitHub (no Android Studio needed)

### 1. Create a private GitHub repo and push this folder

```bash
cd loop
git init
git add .
git commit -m "Loop"
git branch -M main
git remote add origin https://github.com/YOUR_USER/loop.git
git push -u origin main
```

The first build will fail with "Missing KEYSTORE secret". That's expected: do steps 2 and 3.

### 2. Add a password secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `KEYSTORE_PASSWORD`
- Value: any password, at least 6 characters. Save it in your password manager too.

### 3. Create your signing key (one time only)

1. Repo → **Actions** → **Create signing key (run once)** → **Run workflow**.
2. When it finishes, open the run and download the **signing-key** artifact (a zip).
3. Open `KEYSTORE_BASE64.txt` from the zip and copy all of its text.
4. Add another secret: Name `KEYSTORE_BASE64`, Value: the text you copied.
5. Keep `release.keystore` from the zip somewhere safe (backup). Then delete the artifact from the run page.

**Why this matters:** Android only installs an update over an existing app if it's signed with the same key. Lose the key and you'd have to uninstall (and lose your data) to install a new version. Use the in-app Backup before doing that.

### 4. Build

Repo → **Actions** → **Build APK** → **Run workflow** (or just push any change to `main`).

Takes about 4–6 minutes. When it's green, go to the repo's **Releases** page. The newest release has `Loop.apk` attached.

### 5. Install on your phone

1. Open the repo's Releases page on your phone (logged into GitHub) and tap `Loop.apk`.
2. Android will ask to allow installing from your browser/Files app. Allow it once.
3. If Play Protect says the app is unrecognized, tap **Install anyway**.
4. Open Loop, allow notifications, and go to **Stats → Send a test reminder** to confirm reminders work.

To update later: push changes, wait for the build, install the new APK over the old one. Your data stays.

---

## Editing the app

All the app code is in `www/`:

- `index.html`: layout and the add/edit sheet
- `style.css`: all styling (colors at the top in `:root`)
- `app.js`: habit logic, XP, streaks, rewards, notifications

To preview quickly on your computer, open `www/index.html` in Chrome (use DevTools device mode for a phone-sized view), or run `npm install` then `npm run dev`. Everything works in the browser except real notifications and haptics.

## Good to know

- **Battery savers:** some phones (Xiaomi, Samsung, Motorola) kill background alarms aggressively. If reminders don't show up, set Loop's battery usage to **Unrestricted** in Android settings.
- **Reminder window:** reminders are scheduled 14 days ahead and refreshed every time you open the app. If you don't open it for two weeks, they'll pause until you do.
- **Backup:** Stats → Backup and restore gives you a text copy of everything. Paste it back to restore.

## Building locally instead (optional)

If you later install Android Studio:

```bash
npm install
npx cap add android
npx @capacitor/assets generate --android
node scripts/patch-android.js
npx cap sync android
npx cap open android
```

Then press Run in Android Studio with your phone connected (USB debugging on).
