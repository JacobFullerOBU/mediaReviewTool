import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKGL7v8zhVHFsoV_AWwgAshiWmv8v84yA",
  authDomain: "mediareviews-3cf32.firebaseapp.com",
  // ...other config values from Firebase Console...
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const profileInfo = document.getElementById('profileInfo');
const userReviews = document.getElementById('userReviews');
const userFavorites = document.getElementById('userFavorites');
const profileTitle = document.getElementById('profileTitle');
const backHomeBtn = document.getElementById('backHomeBtn');

backHomeBtn.addEventListener('click', () => {
    window.location.href = '../index.html';
});

function renderProfile(user) {
    profileTitle.textContent = `${user.displayName || user.email}'s Profile`;
    profileInfo.innerHTML = `<strong>Email:</strong> ${user.email}`;
}

function showLoading(target) {
    target.innerHTML = '<li>Loading...</li>';
}

async function renderReviews(user) {
    showLoading(userReviews);
    const q = query(collection(db, "reviews"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    userReviews.innerHTML = '';
    if (querySnapshot.size === 0) {
        userReviews.innerHTML = '<li>No reviews yet.</li>';
        return;
    }
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        li.innerHTML = `<strong>${data.mediaId}</strong>: ${data.reviewText} <span style="color:#888">(Rating: ${data.rating})</span>`;
        userReviews.appendChild(li);
    });
}

async function renderFavorites(user) {
    showLoading(userFavorites);
    const q = query(collection(db, "favorites"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    userFavorites.innerHTML = '';
    if (querySnapshot.size === 0) {
        userFavorites.innerHTML = '<li>No favorites yet.</li>';
        return;
    }
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        li.innerHTML = `<strong>${data.mediaId}</strong>`;
        userFavorites.appendChild(li);
    });
}

// On load, check auth and render profile
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    renderProfile(user);
    await renderReviews(user);
    await renderFavorites(user);
});
