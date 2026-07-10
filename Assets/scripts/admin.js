import { ref, get, set, remove, update } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js";

export const adminState = { isAdmin: false };

export async function checkAdminStatus(uid) {
    try {
        const snap = await get(ref(db, `reviewers/${uid}/role`));
        adminState.isAdmin = snap.exists() && snap.val() === 'admin';
    } catch {
        adminState.isAdmin = false;
    }
    return adminState.isAdmin;
}

export async function deleteReview(mediaId, reviewId) {
    await remove(ref(db, `reviews/${mediaId}/${reviewId}`));
}

export async function editReview(mediaId, reviewId, plainText, rating) {
    await update(ref(db, `reviews/${mediaId}/${reviewId}`), {
        reviewText: plainText.replace(/\n/g, '<br>'),
        text: plainText,
        rating: parseFloat(rating),
        editedAt: new Date().toISOString()
    });
}

export async function getMediaOverride(mediaId) {
    try {
        const snap = await get(ref(db, `mediaOverrides/${mediaId}`));
        return snap.exists() ? snap.val() : null;
    } catch { return null; }
}

export async function getAllMediaOverrides() {
    try {
        const snap = await get(ref(db, 'mediaOverrides'));
        const result = snap.exists() ? snap.val() : {};
        console.log('[Overrides] getAllMediaOverrides loaded', Object.keys(result).length, 'overrides');
        return result;
    } catch (e) {
        console.error('[Overrides] getAllMediaOverrides FAILED:', e.code, e.message);
        return {};
    }
}

export async function updateMediaOverride(mediaId, fields) {
    await update(ref(db, `mediaOverrides/${mediaId}`), fields);
}

export async function hideMediaEntry(mediaId, tmdbId = null) {
    await update(ref(db, 'hiddenMedia'), { [mediaId]: true });
    if (tmdbId) {
        await remove(ref(db, `tmdb_movies/tmdb_${tmdbId}`));
    }
}

export async function getHiddenMedia() {
    try {
        const snap = await get(ref(db, 'hiddenMedia'));
        return snap.exists() ? snap.val() : {};
    } catch { return {}; }
}

export async function saveCustomMedia(id, data) {
    await set(ref(db, `customMedia/${id}`), data);
}

export async function getCustomMedia() {
    try {
        const snap = await get(ref(db, 'customMedia'));
        if (!snap.exists()) return {};
        return snap.val();
    } catch { return {}; }
}

export async function deleteCustomMedia(id) {
    await remove(ref(db, `customMedia/${id}`));
}

export async function deleteUserAccount(uid) {
    const reviewsSnap = await get(ref(db, 'reviews'));
    if (reviewsSnap.exists()) {
        const updates = {};
        Object.entries(reviewsSnap.val()).forEach(([mediaId, mediaReviews]) => {
            Object.entries(mediaReviews).forEach(([reviewId, review]) => {
                if (review.userId === uid) {
                    updates[`reviews/${mediaId}/${reviewId}`] = null;
                }
            });
        });
        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
        }
    }
    await Promise.all([
        remove(ref(db, `reviewers/${uid}`)),
        remove(ref(db, `favorites/${uid}`)),
        remove(ref(db, `watchlist/${uid}`)),
        remove(ref(db, `followers/${uid}`))
    ]);
}
