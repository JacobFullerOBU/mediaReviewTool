// Main JavaScript functionality for the Media Review Tool

document.addEventListener('DOMContentLoaded', async function() {
    initAppUI();

    // Suggestions logic (Firestore)
    const suggestionForm = document.getElementById('suggestionForm');
    const suggestionText = document.getElementById('suggestionText');
    const suggestionsUl = document.getElementById('suggestionsUl');

    async function fetchSuggestionsRealtime() {
        const { db } = await import('./firebase.js');
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js');
        const suggestionsRef = ref(db, 'suggestions');
        const snapshot = await get(suggestionsRef);
        if (!snapshot.exists()) return [];
        // Get last 10 suggestions, sorted by timestamp descending
        const allSuggestions = Object.values(snapshot.val());
        return allSuggestions
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10)
            .map(s => s.text);
    }

    async function renderSuggestions() {
        suggestionsUl.innerHTML = '';
        let suggestions = [];
        try {
            suggestions = await fetchSuggestionsRealtime();
        } catch {}
        suggestions.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            suggestionsUl.appendChild(li);
        });
    }
    renderSuggestions();

    if (suggestionForm) {
        suggestionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const value = suggestionText.value.trim();
            if (!value) return;
            try {
                // Use Realtime Database for suggestions
                const { db } = await import('./firebase.js');
                const { push, ref } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js');
                await push(ref(db, 'suggestions'), {
                    text: value,
                    timestamp: new Date().toISOString(),
                    userId: auth.currentUser ? auth.currentUser.uid : null
                });
                showPopupMessage('Suggestion submitted successfully!');
            } catch (err) {
                alert("Failed to submit suggestion: " + err.message);
                return;
            }
            // Optionally, update UI (renderSuggestions will need to be updated to read from Realtime DB)
            suggestionText.value = '';
        // Show a temporary popup message
        function showPopupMessage(msg) {
            let popup = document.createElement('div');
            popup.textContent = msg;
            popup.style.position = 'fixed';
            popup.style.top = '32px';
            popup.style.left = '50%';
            popup.style.transform = 'translateX(-50%)';
            popup.style.background = 'linear-gradient(90deg, #8ec5fc 0%, #e0c3fc 100%)';
            popup.style.color = '#333';
            popup.style.fontWeight = 'bold';
            popup.style.padding = '16px 32px';
            popup.style.borderRadius = '12px';
            popup.style.boxShadow = '0 2px 16px #8ec5fc55';
            popup.style.zIndex = '9999';
            popup.style.fontSize = '1.2em';
            document.body.appendChild(popup);
            setTimeout(() => {
                popup.style.transition = 'opacity 0.5s';
                popup.style.opacity = '0';
                setTimeout(() => popup.remove(), 500);
            }, 1800);
        }
        });
    }
});

function initAppUI() {
    // Initialize mobile navigation
    initMobileNav();
    
    // Initialize smooth scrolling
    initSmoothScrolling();
    
    // Initialize explore button
    initExploreButton();
    
    console.log('Media Review Tool initialized successfully');
}

// Mobile Navigation
function initMobileNav() {
    const hamburger = document.getElementById('mobile-menu-button');
    const navMenu = document.getElementById('mobile-menu');
    
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