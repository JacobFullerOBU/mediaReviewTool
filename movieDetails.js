import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./Assets/scripts/firebase.js"; // This imports the 'db' from your firebase.js

async function fetchDetails() {
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get('id');

    if (!mediaId) {
        window.location.href = '/browse.html';
        return;
    }

    const container = document.getElementById('movie-details-container');

    try {
        // We use the 'db' imported from your firebase.js
        const reviewRef = ref(db, `reviews/${mediaId}`);
        const snapshot = await get(reviewRef);

        if (snapshot.exists()) {
            const reviewsData = snapshot.val();
            
            // Get the first review entry for this media
            const reviewKeys = Object.keys(reviewsData);
            const firstReviewKey = reviewKeys[0];
            const data = reviewsData[firstReviewKey];
            
            renderDetails(data);
        } else {
            container.innerHTML = `
                <div class="text-center py-20">
                    <p class="text-slate-400">No review found for "${mediaId}"</p>
                    <a href="/browse.html" class="text-indigo-400 hover:underline mt-4 inline-block">Return to Browse</a>
                </div>`;
        }
    } catch (error) {
        console.error("Firebase Error:", error);
        container.innerHTML = `<p class='text-red-400 text-center'>Error loading data. Check console.</p>`;
    }
}

function renderDetails(data) {
    // 1. Match the keys to your Firebase Console exactly
    const title = data.mediaTitle || "Untitled Media";
    const poster = data.mediaPoster || data.image || data.poster || ''; 
    const reviewBody = data.reviewText || "No review text found.";

    const container = document.getElementById('movie-details-container');
    container.innerHTML = `
        <div class="flex flex-col md:flex-row gap-12">
            <div class="w-full md:w-1/3">
                ${poster ? 
                    `<img src="${poster}" alt="${title}" class="w-full rounded-2xl shadow-2xl border border-slate-700">` : 
                    `<div class="w-full aspect-[2/3] bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 italic text-slate-500 text-center p-4">No Poster Available</div>`
                }
            </div>
            <div class="flex-1">
                <nav class="mb-6">
                    <a href="/browse.html" class="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1">
                        ← Back to Browse
                    </a>
                </nav>
                <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">${title}</h1>
                <div class="flex items-center gap-4 mb-8">
                    <div class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <i data-lucide="star" class="w-5 h-5 fill-yellow-400 text-yellow-400"></i>
                        <span class="text-xl font-bold text-white">${data.rating}/10</span>
                    </div>
                </div>
                <div class="bg-slate-800/40 rounded-2xl p-6 md:p-8 border border-slate-700/50 backdrop-blur-sm">
                    <h3 class="text-indigo-400 font-bold uppercase text-xs tracking-widest mb-4">The Verdict</h3>
                    <div class="text-slate-200 text-lg leading-relaxed">${reviewBody}</div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

fetchDetails();