// Single source of truth for the rating scale (Letterboxd-style: 0.5–5 stars in half-star steps).
// Review ratings are stored on this scale. External sources are normalised onto it for the blend.

export const MIN_RATING = 0.5;
export const MAX_RATING = 5;
export const RATING_STEP = 0.5;

export const RATING_HINT = 'Rating (0.5–5 stars, half-stars allowed):';

export function isValidRating(v) {
    return typeof v === 'number' && isFinite(v)
        && v >= MIN_RATING && v <= MAX_RATING
        && Math.abs(v / RATING_STEP - Math.round(v / RATING_STEP)) < 1e-9;
}

// Averages get two decimals like Letterboxd (e.g. 4.12)
export function formatAvg(v) {
    return Number(v).toFixed(2);
}

// 3.5 -> "★★★½"
export function starString(v) {
    const full = Math.floor(v);
    return '★'.repeat(full) + (v - full >= 0.5 ? '½' : '');
}

// External scores onto the 5-point scale
export const fromRT   = pct  => parseInt(pct) / 20;   // Rotten Tomatoes 0–100
export const fromTMDB = (v)  => parseFloat(v) / 2;    // TMDB 0–10
