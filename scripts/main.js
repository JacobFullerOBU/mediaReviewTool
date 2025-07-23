// Add logic for the Surprise Me! (Randomize) button
document.addEventListener('DOMContentLoaded', function() {
    const randomizeBtn = document.getElementById('randomizeBtn');
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', async function() {
            // Wait for cards.js to finish loading globals
            function waitForGlobals() {
                return new Promise(resolve => {
                    let tries = 0;
                    function check() {
                        if (window.showMovieModal && window.books && window.tv && window.music && window.games) {
                            resolve();
                        } else if (++tries < 40) {
                            setTimeout(check, 100);
                        } else {
                            resolve();
                        }
                    }
                    check();
                });
            }
            await waitForGlobals();
            // Fetch all media arrays
            let movies = [];
            if (window.fetchMovies) {
                try { movies = await window.fetchMovies(); } catch {}
            }
            const booksArr = window.books || [];
            const tvArr = window.tv || [];
            const musicArr = window.music || [];
            const gamesArr = window.games || [];
            const allMedia = [...movies, ...tvArr, ...musicArr, ...gamesArr, ...booksArr];
            if (allMedia.length === 0) {
                alert('No media found to randomize.');
                return;
            }
            const randomItem = allMedia[Math.floor(Math.random() * allMedia.length)];
            if (window.showMovieModal) {
                window.showMovieModal(randomItem);
            } else {
                alert('Random media:\n' +
                    'Title: ' + (randomItem.title || randomItem.id) + '\n' +
                    (randomItem.year ? 'Year: ' + randomItem.year + '\n' : '') +
                    (randomItem.genre ? 'Genre: ' + randomItem.genre + '\n' : '') +
                    (randomItem.director ? 'Director: ' + randomItem.director + '\n' : '') +
                    (randomItem.actors ? 'Cast: ' + randomItem.actors + '\n' : '') +
                    (randomItem.description ? 'Description: ' + randomItem.description + '\n' : '')
                );
            }
        });
    }
});
// Firebase Firestore setup and user review functions
import { collection, addDoc, query, where, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth } from "./firebase.js";

// Use the shared Firebase app from firebase.js
const db = getFirestore();

// Save a review for the current user
export async function postReview(mediaId, reviewText, rating) {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to post a review.");
        return;
    }
    try {
        await addDoc(collection(db, "reviews"), {
            userId: user.uid,
            mediaId,
            reviewText,
            rating,
            timestamp: new Date().toISOString()
        });
        alert("Review posted!");
    } catch (error) {
        alert("Failed to post review: " + error.message);
    }
}

// Get all reviews for the current user
export async function getUserReviews() {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(collection(db, "reviews"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
}
// Main JavaScript functionality for the Media Review Tool


document.addEventListener('DOMContentLoaded', function() {
    initAppUI();
});

function initAppUI() {
    // Initialize mobile navigation
    initMobileNav();
    
    // Initialize smooth scrolling
    initSmoothScrolling();
    
    // Initialize explore button
    initExploreButton();
    
    // Initialize category navigation
    initCategoryNavigation();
    
    console.log('Media Review Tool initialized successfully');
}

// Mobile Navigation
function initMobileNav() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close mobile menu when clicking on nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }
}

// Smooth Scrolling
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// Explore Button
function initExploreButton() {
    const exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', function() {
            const popularSection = document.querySelector('.popular-content');
            if (popularSection) {
                popularSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    }
}

// Category Navigation
function initCategoryNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-category]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.dataset.category;
            if (category) {
                // Filter cards by category
                filterCardsByCategory(category);
                
                // Update active tab
                updateActiveTab(category);
                
                // Scroll to popular content section
                const popularSection = document.querySelector('.popular-content');
                if (popularSection) {
                    popularSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// Filter cards by category
function filterCardsByCategory(category) {
    // Update active tab button
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });
    
    // Filter cards (this will be handled by cards.js)
    if (window.filterCards) {
        window.filterCards(category);
    }
}

// Update active tab
function updateActiveTab(category) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });
}

// Utility function to show loading state
function showLoading(element) {
    if (element) {
        element.innerHTML = '<div class="loading">Loading content...</div>';
    }
}

// Utility function to show error message
function showError(element, message) {
    if (element) {
        element.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

// Debounce function for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}