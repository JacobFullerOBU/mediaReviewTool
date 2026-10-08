import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { ref, set, get } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';
import { auth, db } from './firebase.js';
import { requireLogin } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const communityContainer = document.getElementById('community-container');
    const becomeReviewerBtn = document.getElementById('becomeReviewerBtn');
    const registrationModal = document.getElementById('registrationModal');
    const closeModalBtn = registrationModal ? registrationModal.querySelector('.close') : null;
    const registrationForm = document.getElementById('registrationForm');

    // Modal Logic
    if (becomeReviewerBtn && registrationModal) {
        becomeReviewerBtn.onclick = () => {
            requireLogin((user) => {
                registrationModal.classList.remove('hidden');
                registrationModal.classList.add('flex');

                // If user is already logged in, hide password field and pre-fill email
                if (user) {
                    const passInput = document.getElementById('regPassword');
                    if (passInput) {
                        passInput.removeAttribute('required');
                        passInput.parentElement.style.display = 'none';
                    }
                    const emailInput = document.getElementById('regEmail');
                    if (emailInput) {
                        emailInput.value = user.email;
                        emailInput.readOnly = true;
                    }
                }
            });
        };
    }

    if (closeModalBtn && registrationModal) {
        closeModalBtn.onclick = () => {
            registrationModal.classList.add('hidden');
            registrationModal.classList.remove('flex');
        };
    }

    // Close modal on outside click
    if (registrationModal) {
        window.onclick = (event) => {
            if (event.target == registrationModal) {
                registrationModal.classList.add('hidden');
                registrationModal.classList.remove('flex');
            }
        };
    }

    // Registration Logic
    if (registrationForm) {
        registrationForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            try {
                let userId;
                if (auth.currentUser) {
                    userId = auth.currentUser.uid;
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    userId = userCredential.user.uid;
                }
                
                await set(ref(db, 'reviewers/' + userId), {
                    name,
                    email,
                    createdAt: new Date().toISOString()
                });
                
                alert('Reviewer account created!');
                registrationModal.classList.add('hidden');
                registrationModal.classList.remove('flex');
                registrationForm.reset();
                fetchAndRenderReviewers(); // Refresh the list
            } catch (err) {
                alert('Registration failed: ' + err.message);
                console.error(err);
            }
        };
    }

    // Deterministic avatar color palette â€” dark backgrounds with white text for legibility on slate cards
    const AVATAR_COLORS = [
        '#3730a3', // indigo
        '#0f766e', // teal
        '#6d28d9', // violet
        '#be185d', // rose
        '#c2410c', // orange
        '#065f46', // emerald
        '#0369a1', // sky
        '#a21caf', // fuchsia
    ];

    function makeInitialAvatar(name) {
        const initial = (name || '?').trim().charAt(0).toUpperCase();
        const bg = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
        const div = document.createElement('div');
        div.className = 'w-24 h-24 rounded-full border-4 border-slate-700 group-hover:border-indigo-500 transition-colors mb-4 flex items-center justify-center flex-shrink-0';
        div.style.cssText = `background-color:${bg};color:#fff;font-size:2rem;font-weight:700;line-height:1;`;
        div.textContent = initial;
        return div;
    }

    function makeAvatarEl(name, photoUrl) {
        if (!photoUrl) return makeInitialAvatar(name);
        const img = document.createElement('img');
        img.className = 'w-24 h-24 rounded-full object-cover border-4 border-slate-700 group-hover:border-indigo-500 transition-colors mb-4';
        img.alt = name;
        img.src = photoUrl;
        img.onerror = () => img.replaceWith(makeInitialAvatar(name));
        return img;
    }

    // Fetch and Render Logic
    async function fetchAndRenderReviewers() {
        if (!communityContainer) return;

        // Show loading state
        communityContainer.innerHTML = `
            <div class="flex justify-center items-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        `;

        try {
            const [snapshot, reviewsSnap] = await Promise.all([
                get(ref(db, 'reviewers')),
                // Stats are a nice-to-have; don't block the page if reviews can't be read
                get(ref(db, 'reviews')).catch(() => null)
            ]);

            // Tally review count and rating sum per user
            const stats = {};
            if (reviewsSnap && reviewsSnap.exists()) {
                Object.values(reviewsSnap.val()).forEach(mediaReviews => {
                    Object.values(mediaReviews || {}).forEach(review => {
                        const rating = parseFloat(review?.rating);
                        if (!review?.userId || isNaN(rating)) return;
                        const s = stats[review.userId] || (stats[review.userId] = { count: 0, sum: 0 });
                        s.count++;
                        s.sum += rating;
                    });
                });
            }

            if (snapshot.exists()) {
                const people = Object.entries(snapshot.val())
                    .filter(([, reviewer]) => reviewer && reviewer.name)
                    .map(([userId, reviewer]) => {
                        const { count = 0, sum = 0 } = stats[userId] || {};
                        return { userId, reviewer, count, avg: count ? sum / count : 0 };
                    });

                const sorters = {
                    reviews: (a, b) => b.count - a.count || b.avg - a.avg,
                    rating:  (a, b) => b.avg - a.avg || b.count - a.count,
                    newest:  (a, b) => new Date(b.reviewer.createdAt || 0) - new Date(a.reviewer.createdAt || 0),
                    name:    (a, b) => a.reviewer.name.localeCompare(b.reviewer.name)
                };

                communityContainer.innerHTML = `
                    <div class="flex flex-col sm:flex-row gap-3 mb-6">
                        <input id="community-search" type="text" placeholder="Search reviewers..."
                            class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <select id="community-sort"
                            class="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                            <option value="reviews">Most reviews</option>
                            <option value="rating">Highest avg rating</option>
                            <option value="newest">Newest members</option>
                            <option value="name">Name (Aâ€“Z)</option>
                        </select>
                    </div>
                    <div id="community-grid"></div>
                `;
                const searchEl = document.getElementById('community-search');
                const sortEl = document.getElementById('community-sort');
                const gridHost = document.getElementById('community-grid');

                const renderGrid = () => {
                    const q = searchEl.value.trim().toLowerCase();
                    const shown = people
                        .filter(p => p.reviewer.name.toLowerCase().includes(q))
                        .sort(sorters[sortEl.value]);
                    gridHost.innerHTML = '';
                    if (!shown.length) {
                        gridHost.innerHTML = '<p class="text-center text-slate-400 py-12">No reviewers match your search.</p>';
                        return;
                    }
                    const grid = document.createElement('div');
                    grid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
                    shown.forEach(p => grid.appendChild(buildCard(p)));
                    gridHost.appendChild(grid);
                };
                searchEl.addEventListener('input', renderGrid);
                sortEl.addEventListener('change', renderGrid);
                renderGrid();
            } else {
                communityContainer.innerHTML = `
                    <div class="text-center py-12">
                        <p class="text-slate-400 text-lg">No reviewers found. Be the first to join!</p>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Error fetching reviewers:', err);
            communityContainer.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-red-400">Failed to load community. Please try again later.</p>
                </div>
            `;
        }
    }

    function buildCard({ userId, reviewer, count, avg }) {
        const card = document.createElement('div');
        card.className = 'bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/20 group';

        const inner = document.createElement('div');
        inner.className = 'p-6 flex flex-col items-center text-center';

        const nameEl = document.createElement('h3');
        nameEl.className = 'text-xl font-bold text-white mb-1';
        nameEl.textContent = reviewer.name;

        const statsEl = document.createElement('p');
        statsEl.className = 'text-sm text-slate-400 mb-4';
        statsEl.textContent = count
            ? `${count} review${count !== 1 ? 's' : ''} · ★ ${avg.toFixed(2)} avg`
            : 'No reviews yet';

        const link = document.createElement('a');
        link.className = 'w-full py-2 px-4 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg transition-colors text-sm font-medium';
        link.href = `reviewer-profile.html?id=${encodeURIComponent(userId)}`;
        link.textContent = 'View Profile';

        inner.appendChild(makeAvatarEl(reviewer.name, reviewer.avatar));
        inner.appendChild(nameEl);
        inner.appendChild(statsEl);
        inner.appendChild(link);
        card.appendChild(inner);
        return card;
    }

    fetchAndRenderReviewers();
});
