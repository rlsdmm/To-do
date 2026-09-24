// Tweaks the generated Android project after `npx cap add android`.
// Safe to run more than once.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'android', 'app');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };

// 1. Permissions for exact-time reminders
const manifestPath = 'src/main/AndroidManifest.xml';
let manifest = read(manifestPath);
const perms = [
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
];
for (const p of perms) {
  const name = p.match(/name="([^"]+)"/)[1];
  if (!manifest.includes(`"${name}"`)) manifest = manifest.replace('</manifest>', `    ${p}\n</manifest>`);
}
write(manifestPath, manifest);

// 2. Status bar / window colors to match the app header
const stylesPath = 'src/main/res/values/styles.xml';
let styles = read(stylesPath);
if (!styles.includes('android:windowBackground')) {
  styles = styles.replace(
    /(<style name="AppTheme.NoActionBar"[^>]*>)/,
    `$1
        <item name="android:windowBackground">@color/loop_cobalt</item>
        <item name="android:statusBarColor">@color/loop_cobalt</item>
        <item name="android:windowLightStatusBar">false</item>`
  );
  write(stylesPath, styles);
}
write('src/main/res/values/loop_colors.xml',
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="loop_cobalt">#3346F0</color>
</resources>
`);

// 3. Monochrome notification icon (a check mark in a loop)
write('src/main/res/drawable/ic_stat_loop.xml',
`<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#00000000" android:strokeColor="#FFFFFFFF" android:strokeWidth="2.4"
        android:strokeLineCap="round" android:strokeLineJoin="round"
        android:pathData="M20.5,12A8.5,8.5 0,1 1,16.2 4.6" />
    <path android:fillColor="#00000000" android:strokeColor="#FFFFFFFF" android:strokeWidth="2.6"
        android:strokeLineCap="round" android:strokeLineJoin="round"
        android:pathData="M8,12.3l3,3L20,6" />
</vector>
`);

// 4. Version number from the CI build number (so each build is newer)
const build = parseInt(process.env.BUILD_NUMBER || '1', 10);
let gradle = read('build.gradle');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${build}`).replace(/versionName "[^"]*"/, `versionName "1.0.${build}"`);
write('build.gradle', gradle);

console.log(`Android project patched (version 1.0.${build}).`);
