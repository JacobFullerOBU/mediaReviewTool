import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { db } from "./firebase.js"; 
import { fetchMovies } from './main.js'; // Import your movie list

async function fetchDetails() {
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get('id');

    if (!mediaId) {
        window.location.href = './browse.html';
        return;
    }

    const container = document.getElementById('movie-details-container');

    try {
        // 1. Fetch Review, Movie List, and ALL Reviewers
        // Fetching the whole 'reviewers' list ensures we can find the name for the specific userId
        const [reviewSnapshot, allMovies, reviewersSnapshot] = await Promise.all([
            get(ref(db, `reviews/${mediaId}`)),
            fetchMovies(),
            get(ref(db, "reviewers"))
        ]);

        if (reviewSnapshot.exists()) {
            const reviewsData = reviewSnapshot.val();
            const firstReviewKey = Object.keys(reviewsData)[0];
            const review = reviewsData[firstReviewKey];

            // 2. Find the Movie Metadata
            const movieInfo = allMovies.find(m => {
                const mId = m.title.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                return mId === mediaId || m.id == mediaId;
            });

            // 3. Get the Reviewer's Display Name and Avatar
            const allReviewers = reviewersSnapshot.exists() ? reviewersSnapshot.val() : {};
            const reviewerProfile = allReviewers[review.userId] || { name: "Anonymous Critic", avatar: "" };

            // 4. Merge them and render
            renderDetails(review, movieInfo, reviewerProfile);
        } else {
            container.innerHTML = `<div class="text-center py-20 text-slate-400">Review not found.</div>`;
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

function renderDetails(review, movie, reviewer) {
    const title = movie ? movie.title : review.mediaId.replace(/_/g, ' ');
    document.title  = `${title} - Review Details | MediaReview`;
    const poster = movie ? (movie.poster || movie.image) : '';
    const reviewerName = reviewer.name || "Anonymous Critic";
    const reviewerAvatar = reviewer.avatar || "";
    const rating = review.rating || 0;
    const cleanReviewText = review.reviewText.replace(/style="[^"]*"/gi, '');

    const container = document.getElementById('movie-details-container');
    
    // Set cinematic background theme
    if (poster) {
        document.body.style.backgroundImage = `linear-gradient(to bottom, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 1)), url('${poster}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
    }

    // This is the section where we insert the improved HTML/Design
    container.innerHTML = `
        <div class="max-w-6xl mx-auto px-4 py-8 md:py-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            <nav class="mb-8">
                <a href="./browse.html" class="group inline-flex items-center text-slate-400 hover:text-indigo-400 transition-colors">
                    <i data-lucide="chevron-left" class="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform"></i>
                    <span class="text-sm font-medium uppercase tracking-widest">Back to Library</span>
                </a>
            </nav>

            <div class="flex flex-col lg:flex-row gap-12 items-start">
                
                <div class="w-full lg:w-1/3 flex-shrink-0 group">
                    <div class="relative">
                        <img src="${poster}" alt="${title}" 
                             class="w-full rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700/50 object-cover z-10 relative">
                        <div class="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    </div>
                </div>

                <div class="flex-1 w-full">
                    <div class="flex flex-col gap-4 mb-8">
                        <h1 class="text-5xl md:text-7xl font-black text-white leading-tight tracking-tighter">
                            ${title}
                        </h1>
                        
                        <div class="flex items-center gap-6">
                            <div class="flex items-center gap-3 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/30">
                                <i data-lucide="star" class="w-6 h-6 fill-indigo-500 text-indigo-500"></i>
                                <span class="text-2xl font-black text-white">${rating}<span class="text-indigo-400/60 text-lg">/10</span></span>
                            </div>
                            
                            <div class="flex flex-col">
                                <span class="text-xs uppercase tracking-widest text-slate-500 font-bold">Review Date</span>
                                <span class="text-slate-300 font-medium">${new Date(review.timestamp).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>

                    <div class="relative">
                    <div class="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 rounded-full"></div>
                    <div class="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/5 shadow-2xl">
                        <h3 class="flex items-center gap-2 text-indigo-400 font-bold uppercase text-xs tracking-[0.2em] mb-6">
                            <i data-lucide="quote" class="w-4 h-4 opacity-50"></i>
                            Review:
                        </h3>
                        
                       <div class="review-content text-slate-200 text-lg leading-relaxed font-light">
                            ${cleanReviewText}
                        </div>
                    </div>
                </div>

                    <div class="mt-8 flex items-center gap-4 px-2">
                        ${reviewerAvatar ? 
                            `<img src="${reviewerAvatar}" class="w-12 h-12 rounded-full border-2 border-indigo-500 shadow-lg object-cover">` :
                            `<div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-lg">
                                ${reviewerName.charAt(0).toUpperCase()}
                            </div>`
                        }
                        <div>
                            <p class="text-xs uppercase tracking-widest text-slate-500 font-bold">Written By</p>
                            <p class="text-slate-200 font-medium">${reviewerName}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

fetchDetails();