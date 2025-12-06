// scripts/community.js

// Mock current user data. In a real app, this would come from your auth system.
let currentUser = {
    id: 99,
    username: 'CurrentUser',
    following: [1, 4] // Initially following Cassie and Mandy
};

async function fetchReviewers() {
    try {
        const response = await fetch('Community/reviewers.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Could not fetch reviewers:", error);
        return [];
    }
}

function createReviewerCard(reviewer) {
    const isFollowing = currentUser.following.includes(reviewer.id);
    const card = document.createElement('div');
    card.className = 'bg-slate-800 rounded-lg p-6 flex flex-col items-center text-center border border-slate-700 hover:border-indigo-500 transition-all';
    card.innerHTML = `
        <img src="${reviewer.avatar}" alt="${reviewer.username}" class="w-24 h-24 rounded-full mb-4 border-4 border-slate-700">
        <h3 class="text-xl font-bold text-white">${reviewer.username}</h3>
        <p class="text-sm text-slate-400 mb-2">${reviewer.followers.toLocaleString()} Followers</p>
        <p class="text-slate-300 text-sm mb-4 h-16">${reviewer.bio}</p>
        <button class="follow-btn w-full py-2 rounded-lg text-sm font-semibold transition-all ${isFollowing ? 'bg-slate-700 hover:bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-700'}" data-reviewer-id="${reviewer.id}">
            ${isFollowing ? 'Unfollow' : 'Follow'}
        </button>
    `;

    const followBtn = card.querySelector('.follow-btn');
    followBtn.addEventListener('click', () => toggleFollow(reviewer, followBtn));

    return card;
}

function toggleFollow(reviewer, button) {
    const reviewerId = reviewer.id;
    const isFollowing = currentUser.following.includes(reviewerId);

    if (isFollowing) {
        currentUser.following = currentUser.following.filter(id => id !== reviewerId);
        reviewer.followers--;
        button.textContent = 'Follow';
        button.classList.remove('bg-slate-700', 'hover:bg-slate-600');
        button.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    } else {
        currentUser.following.push(reviewerId);
        reviewer.followers++;
        button.textContent = 'Unfollow';
        button.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        button.classList.add('bg-slate-700', 'hover:bg-slate-600');
    }

    const followersCountEl = button.parentElement.querySelector('.text-sm.text-slate-400');
    followersCountEl.textContent = `${reviewer.followers.toLocaleString()} Followers`;
}

async function displayReviewers() {
    const reviewersContainer = document.getElementById('reviewers-container');
    if (!reviewersContainer) return;

    const reviewers = await fetchReviewers();
    reviewersContainer.innerHTML = '';
    reviewers.forEach(reviewer => reviewersContainer.appendChild(createReviewerCard(reviewer)));
}

window.displayReviewers = displayReviewers;
window.getCurrentUser = () => currentUser;