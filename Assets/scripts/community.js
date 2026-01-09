
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getDatabase, ref, set, get } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';
import { app } from './firebase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const auth = getAuth(app);
    const db = getDatabase(app);

    const communityContainer = document.getElementById('community-container');
    const becomeReviewerBtn = document.getElementById('becomeReviewerBtn');
    const registrationModal = document.getElementById('registrationModal');
    const closeModalBtn = registrationModal.querySelector('.close');
    const registrationForm = document.getElementById('registrationForm');

    if (becomeReviewerBtn) {
        becomeReviewerBtn.onclick = () => {
            registrationModal.classList.remove('hidden');
        };
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            registrationModal.classList.add('hidden');
        };
    }

    if (registrationForm) {
        registrationForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const genres = document.getElementById('regGenres').value;
            const avatarUrl = document.getElementById('regAvatarUrl').value;
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const userId = userCredential.user.uid;
                
                await set(ref(db, 'reviewers/' + userId), {
                    name,
                    email,
                    genres,
                    avatar: avatarUrl,
                    createdAt: new Date().toISOString()
                });
                
                alert('Reviewer account created!');
                registrationModal.classList.add('hidden');
                fetchAndRenderReviewers();
            } catch (err) {
                alert('Registration failed: ' + err.message);
            }
        };
    }

    async function fetchAndRenderReviewers() {
        if (communityContainer) {
            communityContainer.innerHTML = '<h3 class="text-white text-2xl font-bold mb-4">Community Reviewers</h3>';
            try {
                const snapshot = await get(ref(db, 'reviewers'));
                console.log("Firebase snapshot:", snapshot.val()); // Log the snapshot
                if (snapshot.exists()) {
                    const reviewers = snapshot.val();
                    const reviewersGrid = document.createElement('div');
                    reviewersGrid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
                    Object.entries(reviewers).forEach(([userId, reviewer]) => {
                        if (reviewer && reviewer.name) {
                            const reviewerCard = document.createElement('div');
                            reviewerCard.className = 'bg-slate-800 rounded-lg overflow-hidden shadow-lg hover:shadow-indigo-500/50 transition-all duration-300';
                            reviewerCard.innerHTML = `
                                <a href="reviewer-profile.html?id=${userId}" class="block">
                                    <img src="${reviewer.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg'}" alt="${reviewer.name || 'Anonymous'}" class="w-full h-48 object-cover">
                                    <div class="p-4">
                                        <h3 class="text-lg font-bold text-white">${reviewer.name || 'Anonymous'}</h3>
                                        <p class="text-sm text-slate-400 mt-1">${reviewer.bio || 'No bio provided.'}</p>
                                    </div>
                                </a>
                            `;
                            reviewersGrid.appendChild(reviewerCard);
                        }
                    });
                    if (reviewersGrid.hasChildNodes()) {
                        communityContainer.appendChild(reviewersGrid);
                    } else {
                        communityContainer.innerHTML += '<p class="text-slate-400">No reviewers with valid data found.</p>';
                    }
                } else {
                    communityContainer.innerHTML += '<p class="text-slate-400">No reviewers have signed up yet. Be the first to create a profile!</p>';
                }
            } catch (err) {
                communityContainer.innerHTML += '<p class="text-red-500">Error loading reviewers. Check the console for more details.</p>';
                console.error('Error fetching reviewers:', err);
            }
        }
    }

    fetchAndRenderReviewers();
});
