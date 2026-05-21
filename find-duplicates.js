// Duplicate detection script for mediaReviewTool
// Run: node find-duplicates.js
// Reports: cross-category duplicates (book+movie same title) and within-category duplicates

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'Assets', 'Data');

const DATA_FILES = [
    { file: 'movieList.json', category: 'movies' },
    { file: 'tvList.json',    category: 'tv' },
    { file: 'books.json',     category: 'books' },
];

function titleSlug(title) {
    return (title || '').trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function loadFile(filePath, defaultCategory) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const items = JSON.parse(raw);
        return items
            .filter(item => item.title && item.title.trim())
            .map(item => ({
                title: item.title.trim(),
                slug: titleSlug(item.title),
                year: item.year || '',
                category: item.category || defaultCategory,
            }));
    } catch (e) {
        console.error(`Failed to load ${filePath}: ${e.message}`);
        return [];
    }
}

// Load all items
const allItems = [];
for (const { file, category } of DATA_FILES) {
    const filePath = path.join(DATA_DIR, file);
    const items = loadFile(filePath, category);
    console.log(`Loaded ${items.length} items from ${file}`);
    allItems.push(...items);
}

// Group by slug
const slugMap = new Map(); // slug -> [{title, year, category, file}]
for (const item of allItems) {
    if (!slugMap.has(item.slug)) slugMap.set(item.slug, []);
    slugMap.get(item.slug).push(item);
}

// ── Cross-category duplicates (same slug, different categories) ──────────────
const crossCategoryDups = [];
for (const [slug, items] of slugMap) {
    const categories = [...new Set(items.map(i => i.category))];
    if (categories.length > 1) {
        crossCategoryDups.push({ slug, items });
    }
}

// ── Within-category duplicates (same slug AND category) ─────────────────────
const withinCategoryDups = [];
for (const [slug, items] of slugMap) {
    // Group by category
    const byCat = {};
    for (const item of items) {
        if (!byCat[item.category]) byCat[item.category] = [];
        byCat[item.category].push(item);
    }
    for (const [cat, catItems] of Object.entries(byCat)) {
        if (catItems.length > 1) {
            withinCategoryDups.push({ slug, category: cat, items: catItems });
        }
    }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('CROSS-CATEGORY DUPLICATES (same title in multiple categories)');
console.log('These cause review collisions — a book card shows movie reviews.');
console.log('='.repeat(70));

if (crossCategoryDups.length === 0) {
    console.log('None found.');
} else {
    crossCategoryDups.forEach(({ slug, items }) => {
        console.log(`\n  Slug: "${slug}"`);
        items.forEach(i => console.log(`    [${i.category}] "${i.title}" (${i.year || 'no year'})`));
    });
}

console.log('\n' + '='.repeat(70));
console.log('WITHIN-CATEGORY DUPLICATES (same title, same category)');
console.log('These show duplicate cards in the same category view.');
console.log('='.repeat(70));

if (withinCategoryDups.length === 0) {
    console.log('None found.');
} else {
    withinCategoryDups.forEach(({ slug, category, items }) => {
        console.log(`\n  [${category}] Slug: "${slug}"`);
        items.forEach(i => console.log(`    "${i.title}" (${i.year || 'no year'})`));
    });
}

console.log('\n' + '='.repeat(70));
console.log(`SUMMARY: ${crossCategoryDups.length} cross-category conflicts, ${withinCategoryDups.length} within-category duplicates`);
console.log('='.repeat(70) + '\n');
