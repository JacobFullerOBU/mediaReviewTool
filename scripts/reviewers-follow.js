import { auth, db } from './firebase.js';
import { ref, get, set, remove } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';

// Reviewer data (static for demo, replace with dynamic data as needed)
const reviewers = [
  { id: 'alex_johnson', name: 'Alex Johnson', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', genres: 'Movies, TV, Music', stats: 'Reviews: 245 | Avg Rating: 8.7' },
  { id: 'maria_lee', name: 'Maria Lee', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', genres: 'Books, Movies, Games', stats: 'Reviews: 198 | Avg Rating: 9.1' },
  { id: 'chris_patel', name: 'Chris Patel', avatar: 'https://randomuser.me/api/portraits/men/65.jpg', genres: 'TV, Music, Games', stats: 'Reviews: 172 | Avg Rating: 8.4' }
];

// Utility: Get current user's following list
async function getFollowingList() {
  if (!auth.currentUser) return [];
  const userId = auth.currentUser.uid;
  const followingRef = ref(db, `following/${userId}`);
  const snapshot = await get(followingRef);
  return snapshot.exists() ? Object.keys(snapshot.val()) : [];
}

// Utility: Add reviewer to following list
async function followReviewer(reviewerId) {
  if (!auth.currentUser) {
    alert('You must be logged in to follow reviewers.');
    return;
  }
  const userId = auth.currentUser.uid;
  const reviewerRef = ref(db, `following/${userId}/${reviewerId}`);
  await set(reviewerRef, { followedAt: new Date().toISOString() });
}

// Utility: Remove reviewer from following list
async function unfollowReviewer(reviewerId) {
  if (!auth.currentUser) {
    alert('You must be logged in to unfollow reviewers.');
    return;
  }
  const userId = auth.currentUser.uid;
  const reviewerRef = ref(db, `following/${userId}/${reviewerId}`);
  await remove(reviewerRef);
}

// Attach follow/unfollow logic to buttons
async function setupFollowButtons() {
  const following = await getFollowingList();
  reviewers.forEach(reviewer => {
    document.querySelectorAll(`[data-reviewer-id='${reviewer.id}']`).forEach(btn => {
      btn.textContent = following.includes(reviewer.id) ? 'Unfollow' : 'Follow';
      btn.onclick = async () => {
        if (btn.textContent === 'Follow') {
          await followReviewer(reviewer.id);
          btn.textContent = 'Unfollow';
        } else {
          await unfollowReviewer(reviewer.id);
          btn.textContent = 'Follow';
        }
      };
    });
  });
}

// Wait for auth state and then setup buttons
window.addEventListener('DOMContentLoaded', () => setTimeout(setupFollowButtons, 500));
