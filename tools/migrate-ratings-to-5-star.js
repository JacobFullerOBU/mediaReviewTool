// One-time migration: review ratings 1–10  ->  0.5–5 stars (Letterboxd scale).
//
//   reviews/{media}/{review}.rating       10-pt -> 5-star, snapped to nearest half-star
//   mediaOverrides/{id}.trScoreOverride   10-pt -> 5-pt
//   customMedia/{id}.trScoreOverride      10-pt -> 5-pt
//
// Usage (needs the Firebase service-account JSON in FIREBASE_SERVICE_ACCOUNT, same as fetch-movies.js):
//   node tools/migrate-ratings-to-5-star.js             # dry run, prints what would change
//   node tools/migrate-ratings-to-5-star.js --apply     # writes a backup file, then migrates
//
// Safety: it is NOT idempotent by nature (running twice would halve everything again), so it records
// meta/ratingScale = 5 when finished and refuses to run again unless --force is passed.

import admin from 'firebase-admin';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

const snapTo5 = r => Math.min(5, Math.max(0.5, Math.round(r) / 2)); // r/2 snapped to 0.5 steps
const half = v => Math.round((v / 2) * 100) / 100;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: 'https://mediareviews-3cf32-default-rtdb.firebaseio.com/',
});
const db = admin.database();

async function main() {
  const marker = (await db.ref('meta/ratingScale').get()).val();
  if (marker === 5 && !FORCE) {
    console.error('meta/ratingScale is already 5 — migration has been run. Use --force only if you are sure.');
    process.exit(1);
  }

  const [reviewsSnap, overridesSnap, customSnap] = await Promise.all([
    db.ref('reviews').get(), db.ref('mediaOverrides').get(), db.ref('customMedia').get(),
  ]);
  const reviews = reviewsSnap.val() || {};
  const overrides = overridesSnap.val() || {};
  const custom = customSnap.val() || {};

  const updates = {};
  let reviewCount = 0, outOfRange = 0;

  for (const [mediaId, byId] of Object.entries(reviews)) {
    for (const [reviewId, rev] of Object.entries(byId || {})) {
      if (typeof rev?.rating !== 'number') continue;
      if (rev.rating > 10 || rev.rating < 0.5) outOfRange++;
      updates[`reviews/${mediaId}/${reviewId}/rating`] = snapTo5(rev.rating);
      reviewCount++;
    }
  }
  let overrideCount = 0;
  for (const [id, o] of Object.entries(overrides)) {
    if (typeof o?.trScoreOverride === 'number') { updates[`mediaOverrides/${id}/trScoreOverride`] = half(o.trScoreOverride); overrideCount++; }
  }
  for (const [id, o] of Object.entries(custom)) {
    if (typeof o?.trScoreOverride === 'number') { updates[`customMedia/${id}/trScoreOverride`] = half(o.trScoreOverride); overrideCount++; }
  }

  // Show a few examples
  const sample = Object.entries(updates).slice(0, 8);
  console.log(`Reviews to convert: ${reviewCount}  |  TR overrides to convert: ${overrideCount}  |  out-of-range ratings clamped: ${outOfRange}`);
  for (const [path, v] of sample) console.log(`  ${path} -> ${v}`);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write changes (a backup file is saved first).');
    await admin.app().delete();
    return;
  }

  const backupFile = `ratings-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupFile, JSON.stringify({ reviews, mediaOverrides: overrides, customMedia: custom }));
  console.log(`Backup written to ${backupFile} — keep it until you've verified the site.`);

  // Multi-path update in chunks to stay well under request-size limits
  const entries = Object.entries(updates);
  for (let i = 0; i < entries.length; i += 500) {
    await db.ref().update(Object.fromEntries(entries.slice(i, i + 500)));
    console.log(`  wrote ${Math.min(i + 500, entries.length)} / ${entries.length}`);
  }
  await db.ref('meta/ratingScale').set(5);
  console.log('Done. meta/ratingScale = 5');
  await admin.app().delete();
}

main().catch(err => { console.error(err); process.exit(1); });
