import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { app } from "./firebase.js";

const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {
    fetchReviewers();
});

async function fetchReviewers() {
    const container = document.getElementById("community-container");
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div class="flex justify-center items-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
    `;

    try {
        // Reference to the 'reviewers' node in Firebase Realtime Database
        const reviewersRef = ref(db, "reviewers");
        const snapshot = await get(reviewersRef);

        if (snapshot.exists()) {
            const reviewers = snapshot.val();
            renderReviewers(reviewers, container);
        } else {
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-slate-400 text-lg">No reviewers found. Be the first to join!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error fetching reviewers:", error);
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-400">Failed to load community. Please try again later.</p>
            </div>
        `;
    }
}

function renderReviewers(reviewers, container) {
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

    Object.entries(reviewers).forEach(([userId, data]) => {
        const card = document.createElement("div");
        card.className = "bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/10 group cursor-pointer flex flex-col";
        
        // Navigate to profile on click
        card.onclick = () => {
            window.location.href = `reviewer-profile.html?id=${userId}`;
        };

        const avatarUrl = data.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
        const joinDate = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "Unknown";

        card.innerHTML = `
            <div class="flex items-center gap-4 mb-4">
                <img src="${avatarUrl}" alt="${data.name}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600 group-hover:border-indigo-500 transition-colors">
                <div>
                    <h3 class="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">${data.name}</h3>
                    <p class="text-xs text-slate-400">Joined: ${joinDate}</p>
                </div>
            </div>
            <div class="flex-grow">
                <div class="mb-2">
                    <span class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Genres</span>
                    <p class="text-slate-300 text-sm truncate">${data.genres || "Varied"}</p>
                </div>
                ${data.bio ? `<div class="mt-3"><p class="text-slate-400 text-sm line-clamp-2 italic">"${data.bio}"</p></div>` : ""}
            </div>
            <div class="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                <span class="text-xs text-slate-500">View Profile</span>
                <i data-lucide="arrow-right" class="w-4 h-4 text-indigo-400 transform group-hover:translate-x-1 transition-transform"></i>
            </div>
        `;

        grid.appendChild(card);
    });

    container.appendChild(grid);
    
    // Re-initialize icons for the new content
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}