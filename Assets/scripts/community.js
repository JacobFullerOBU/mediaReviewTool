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
            const genres = document.getElementById('regGenres').value;
            const avatarUrl = document.getElementById('regAvatarUrl').value;
            
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
                    genres,
                    avatar: avatarUrl,
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
            const snapshot = await get(ref(db, 'reviewers'));
            
            if (snapshot.exists()) {
                const reviewers = snapshot.val();
                communityContainer.innerHTML = ''; // Clear loading
                
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
                
                Object.entries(reviewers).forEach(([userId, reviewer]) => {
                    if (reviewer && reviewer.name) {
                        const card = document.createElement('div');
                        card.className = 'bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/20 group';
                        
                        const avatar = reviewer.avatar || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
                        
                        card.innerHTML = `
                            <div class="p-6 flex flex-col items-center text-center">
                                <img src="${avatar}" alt="${reviewer.name}" class="w-24 h-24 rounded-full object-cover border-4 border-slate-700 group-hover:border-indigo-500 transition-colors mb-4">
                                <h3 class="text-xl font-bold text-white mb-1">${reviewer.name}</h3>
                                <p class="text-indigo-400 text-sm mb-4">${reviewer.genres || 'General Reviewer'}</p>
                                <a href="reviewer-profile.html?id=${userId}" class="w-full py-2 px-4 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg transition-colors text-sm font-medium">View Profile</a>
                            </div>
                        `;
                        grid.appendChild(card);
                    }
                });
                
                communityContainer.appendChild(grid);
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

    fetchAndRenderReviewers();
});
