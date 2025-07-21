// Firebase Firestore for dynamic ratings
import { ref, push, get, child, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { auth, db } from "./firebase.js";

// Get number of reviews for a media item (Realtime Database)
async function getReviewCount(mediaId) {
    const reviewsRef = ref(db, `reviews/${mediaId}`);
    const snapshot = await get(reviewsRef);
    if (snapshot.exists()) {
        return Object.keys(snapshot.val()).length;
    }
    return 0;
}

// Get average rating for a media item (Realtime Database)
async function getAverageRating(mediaId) {
    const reviewsRef = ref(db, `reviews/${mediaId}`);
    const snapshot = await get(reviewsRef);
    let total = 0;
    let count = 0;
    if (snapshot.exists()) {
        const reviews = snapshot.val();
        Object.values(reviews).forEach(data => {
            if (typeof data.rating === "number") {
                total += data.rating;
                count++;
            }
        });
    }
    return count > 0 ? (total / count).toFixed(1) : "N/A";
}
// Cards functionality for displaying popular content

// Sample data for popular content
const sampleData = {
    movies: [
        {
            id: 1,
            title: "The Shawshank Redemption",
            description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
            category: "movies",
            rating: 9.3,
            year: 1994,
            reviews: 142,
            image: "Card Photos/shawshank.jpg"
        },
        {
            id: 2,
            title: "The Godfather",
            description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
            category: "movies",
            rating: 9.2,
            year: 1972,
            reviews: 98,
            image: "cardimage.jpeg"
        },
        {
            id: 3,
            title: "Pulp Fiction",
            description: "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption.",
            category: "movies",
            rating: 8.9,
            year: 1994,
            reviews: 87,
            image: "cardimage.jpeg"
        }
    ],
    tv: [
        {
            id: 4,
            title: "Breaking Bad",
            description: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing drugs.",
            category: "tv",
            rating: 9.5,
            year: 2008,
            reviews: 203,
            image: "cardimage.jpeg"
        },
        {
            id: 5,
            title: "Game of Thrones",
            description: "Nine noble families fight for control over the lands of Westeros while an ancient enemy returns.",
            category: "tv",
            rating: 8.7,
            year: 2011,
            reviews: 156,
            image: "cardimage.jpeg"
        },
        {
            id: 6,
            title: "Stranger Things",
            description: "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces.",
            category: "tv",
            rating: 8.8,
            year: 2016,
            reviews: 134,
            image: "cardimage.jpeg"
        }
    ],
    music: [
        {
            id: 7,
            title: "Abbey Road",
            description: "The Beatles' penultimate studio album, featuring classics like 'Come Together' and 'Here Comes the Sun'.",
            category: "music",
            rating: 9.1,
            year: 1969,
            reviews: 89,
            image: "cardimage.jpeg"
        },
        {
            id: 8,
            title: "Dark Side of the Moon",
            description: "Pink Floyd's conceptual masterpiece exploring themes of conflict, greed, time, and mental illness.",
            category: "music",
            rating: 9.4,
            year: 1973,
            reviews: 76,
            image: "cardimage.jpeg"
        },
        {
            id: 9,
            title: "Thriller",
            description: "Michael Jackson's legendary album that became the best-selling album of all time.",
            category: "music",
            rating: 8.9,
            year: 1982,
            reviews: 112,
            image: "cardimage.jpeg"
        }
    ],
    games: [
        {
            id: 10,
            title: "The Legend of Zelda: Breath of the Wild",
            description: "An open-world adventure that redefines the Zelda franchise with innovative gameplay and stunning visuals.",
            category: "games",
            rating: 9.7,
            year: 2017,
            reviews: 234,
            image: "cardimage.jpeg"
        },
        {
            id: 11,
            title: "The Witcher 3: Wild Hunt",
            description: "A story-driven open world RPG set in a visually stunning fantasy universe full of meaningful choices.",
            category: "games",
            rating: 9.3,
            year: 2015,
            reviews: 189,
            image: "cardimage.jpeg"
        },
        {
            id: 12,
            title: "Red Dead Redemption 2",
            description: "An epic tale of life in America's unforgiving heartland featuring a desperado and the gang he rides with.",
            category: "games",
            rating: 9.1,
            year: 2018,
            reviews: 167,
            image: "cardimage.jpeg"
        }
    ],
    books: [
        {
            id: 13,
            title: "To Kill a Mockingbird",
            description: "A gripping tale of racial injustice and childhood innocence in the American South during the 1930s.",
            category: "books",
            rating: 8.8,
            year: 1960,
            reviews: 145,
            image: "cardimage.jpeg"
        },
        {
            id: 14,
            title: "1984",
            description: "George Orwell's dystopian masterpiece about totalitarianism, surveillance, and the power of truth.",
            category: "books",
            rating: 9.0,
            year: 1949,
            reviews: 198,
            image: "cardimage.jpeg"
        },
        {
            id: 15,
            title: "The Great Gatsby",
            description: "F. Scott Fitzgerald's classic tale of love, loss, and the American Dream in the Jazz Age.",
            category: "books",
            rating: 8.5,
            year: 1925,
            reviews: 123,
            image: "cardimage.jpeg"
        }
    ]
};

let currentFilter = 'all';
let allItems = [];

console.log('[cards.js] Script loaded');
document.addEventListener('DOMContentLoaded', function() {
    console.log('[cards.js] DOMContentLoaded');
    initCards();
    // Debug: log all click events to help trace event propagation
    document.addEventListener('click', function(e) {
        console.log('[DEBUG] Click event:', e.target);
    });
});

function initCards() {
    // Flatten all items
    allItems = Object.values(sampleData).flat();
    
    // Initialize tab functionality
    initTabFunctionality();
    
    // Load initial content
    loadCards('all');
}

function initTabFunctionality() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            
            // Update active tab
            tabBtns.forEach(tab => tab.classList.remove('active'));
            this.classList.add('active');
            
            // Filter cards
            filterCards(category);
        });
    });
}

function filterCards(category) {
    currentFilter = category;
    loadCards(category);
}

// Export function for use by other modules
window.filterCards = filterCards;

async function loadCards(category) {
    const container = document.getElementById('cardsContainer');
    if (!container) return;

    // Show loading state
    showLoadingState(container);

    // Simulate loading delay
    setTimeout(async () => {
        let itemsToShow = allItems;

        if (category !== 'all') {
            itemsToShow = allItems.filter(item => item.category === category);
        }

        await renderCards(container, itemsToShow);
    }, 500);
}

function showLoadingState(container) {
    container.innerHTML = '<div class="loading">Loading content...</div>';
}

async function renderCards(container, items) {
    try {
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No content found</h3>
                    <p>Try selecting a different category or check back later.</p>
                </div>
            `;
            console.log('[cards.js] No items to render');
            return;
        }

        container.innerHTML = items.map(item => createCardHTML(item)).join('');
        console.log(`[cards.js] Rendered ${items.length} cards`);
        // Debug: confirm cards exist in DOM
        const renderedCards = container.querySelectorAll('.media-card');
        console.log('[DEBUG] Cards in DOM:', renderedCards.length);

        // Dynamically update ratings, review count, and latest review from Firestore
        for (const item of items) {
            const card = container.querySelector(`.media-card[data-id='${item.id}']`);
            if (card) {
                const ratingElem = card.querySelector('.card-rating');
                if (ratingElem) {
                    ratingElem.textContent = '★ ' + await getAverageRating(item.id);
                }
                const reviewsElem = card.querySelector('.card-reviews');
                if (reviewsElem) {
                    const count = await getReviewCount(item.id);
                    reviewsElem.textContent = `${count} reviews`;
                }
                // Show latest review (Realtime Database)
                const latestReviewElem = card.querySelector('.card-latest-review');
                if (latestReviewElem) {
                    const reviewsRef = ref(db, `reviews/${item.id}`);
                    const snapshot = await get(reviewsRef);
                    let latest = null;
                    if (snapshot.exists()) {
                        const reviews = Object.values(snapshot.val());
                        reviews.forEach(data => {
                            if (!latest || new Date(data.timestamp) > new Date(latest.timestamp)) {
                                latest = data;
                            }
                        });
                    }
                    latestReviewElem.textContent = latest && latest.reviewText ? `"${latest.reviewText}"` : '';
                }
            }
        }

        // Add click listeners to cards
        addCardListeners();
    } catch (err) {
        container.innerHTML = `<div class="error-state"><h3>Error loading cards</h3><p>${err.message}</p></div>`;
        console.error('[cards.js] Error rendering cards:', err);
    }
}

// Helper function to generate card HTML
function createCardHTML(item) {
    return `
        <div class="media-card" data-id="${item.id}" data-category="${item.category}">
            <div class="card-image" style="background-image: url('${item.image}')">
                <div class="card-category">${item.category}</div>
                <div class="card-rating">★ ${item.rating}</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${item.title}</h3>
                <p class="card-description">${item.description}</p>
                <div class="card-meta">
                    <span class="card-year">${item.year}</span>
                    <span class="card-reviews">${item.reviews} reviews</span>
                </div>
                <div class="card-latest-review" style="margin-top:8px; font-style:italic; color:#555;"></div>
            </div>
        </div>
    `;
}

// ...existing code...
function addCardListeners() {
    const cards = document.querySelectorAll('.media-card');
    console.log('[DEBUG] Attaching listeners to cards:', cards.length);
    cards.forEach(card => {
        const itemId = card.dataset.id;
        const item = allItems.find(item => item.id == itemId);
        // Attach click listeners directly to child elements
        const imageElem = card.querySelector('.card-image');
        const titleElem = card.querySelector('.card-title');
        if (imageElem) {
            imageElem.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[DEBUG] Card-image clicked:', item);
                if (item) showItemDetails(item);
            });
        }
        if (titleElem) {
            titleElem.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[DEBUG] Card-title clicked:', item);
                if (item) showItemDetails(item);
            });
        }
        // Optionally, keep card click for non-button area
        card.addEventListener('click', function(e) {
            if (!e.target.classList.contains('btn')) {
                console.log('[DEBUG] Card (background) clicked:', item);
                if (item) showItemDetails(item);
            }
        });
        // Add hover effects
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}


async function showItemDetails(item) {
    console.log('[DEBUG] showItemDetails called for:', item);
    // Fetch dynamic rating and review count
    const avgRating = await getAverageRating(item.id);
    const reviewCount = await getReviewCount(item.id);

    // Create a simple modal to show item details
    console.log('[DEBUG] Creating modal for item:', item);
    const modal = document.createElement('div');
    modal.className = 'modal show';
    // Force modal to be visible for debugging
    modal.style.zIndex = '9999';
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(255,0,0,0.2)'; // Red tint for debug
    modal.style.border = '4px solid red';
    // Fetch all reviews for this media item
    let reviewsHtml = '';
    try {
        const reviewsRef = ref(db, `reviews/${item.id}`);
        const snapshot = await get(reviewsRef);
        if (snapshot.exists()) {
            const reviews = Object.values(snapshot.val());
            reviewsHtml = `<div style="margin-top:24px;"><h3>All Reviews</h3>`;
            reviewsHtml += reviews.map(r => `
                <div class="review-block" style="border-bottom:1px solid #eee; margin-bottom:12px; padding-bottom:8px;">
                    <div><strong>Rating:</strong> ★ ${r.rating} <span style="color:#888; font-size:0.9em;">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</span></div>
                    <div style="margin-top:4px;"><strong>Review:</strong> ${r.reviewText}</div>
                </div>
            `).join('');
            reviewsHtml += `</div>`;
        } else {
            reviewsHtml = `<div style="margin-top:24px; color:#888;">No reviews yet.</div>`;
        }
    } catch (err) {
        reviewsHtml = `<div style="margin-top:24px; color:red;">Error loading reviews.</div>`;
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; margin: 40px auto; background: #fff; border: 2px solid #333;">
            <div class="modal-header">
                <h2>${item.title}</h2>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <p><strong>Category:</strong> ${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</p>
                    <p><strong>Year:</strong> ${item.year}</p>
                    <p><strong>Rating:</strong> ★ <span id="modalRating">${avgRating}</span></p>
                    <p><strong>Reviews:</strong> <span id="modalReviewCount">${reviewCount}</span> reviews</p>
                </div>
                <p><strong>Description:</strong></p>
                <p>${item.description}</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" id="writeReviewBtn">Write a Review</button>
                    <button class="btn btn-login" style="margin-left: 10px;">Add to Favorites</button>
                </div>
                <div id="reviewFormContainer" style="display:none; margin-top:20px;">
                    <form id="reviewForm">
                        <label for="reviewText">Your Review:</label><br>
                        <textarea id="reviewText" rows="3" style="width:100%;"></textarea><br>
                        <label for="reviewRating">Rating (1-10):</label>
                        <input type="number" id="reviewRating" min="1" max="10" required style="width:60px;">
                        <button type="submit" class="btn btn-primary" style="margin-left:10px;">Submit</button>
                    </form>
                    <div id="reviewError" style="color:red; margin-top:8px;"></div>
                </div>
                ${reviewsHtml}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    console.log('[DEBUG] Modal appended to body:', modal);
    // Add close functionality only once
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Restore body scroll when modal is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node === modal) {
                        document.body.style.overflow = 'auto';
                        observer.disconnect();
                    }
                });
            }
        });
    });
    observer.observe(document.body, { childList: true });

    // Review button logic
    const writeReviewBtn = modal.querySelector('#writeReviewBtn');
    const reviewFormContainer = modal.querySelector('#reviewFormContainer');
    writeReviewBtn.addEventListener('click', () => {
        reviewFormContainer.style.display = 'block';
    });

    // Handle review submission (Realtime Database)
    const reviewForm = modal.querySelector('#reviewForm');
    reviewForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const reviewText = modal.querySelector('#reviewText').value.trim();
        const reviewRating = parseInt(modal.querySelector('#reviewRating').value);
        const reviewError = modal.querySelector('#reviewError');
        reviewError.textContent = '';

        if (!reviewText || isNaN(reviewRating) || reviewRating < 1 || reviewRating > 10) {
            reviewError.textContent = 'Please enter a review and a rating between 1 and 10.';
            return;
        }

        // Check if user is logged in
        const user = auth.currentUser;
        if (!user) {
            reviewError.textContent = 'You must be logged in to submit a review.';
            return;
        }

        try {
            const reviewsRef = ref(db, `reviews/${item.id}`);
            await push(reviewsRef, {
                userId: user.uid,
                mediaId: item.id,
                reviewText,
                rating: reviewRating,
                timestamp: new Date().toISOString()
            });
            reviewError.style.color = 'green';
            reviewError.textContent = 'Review submitted!';

            // Update modal rating and review count
            const newAvgRating = await getAverageRating(item.id);
            const newReviewCount = await getReviewCount(item.id);
            modal.querySelector('#modalRating').textContent = newAvgRating;
            modal.querySelector('#modalReviewCount').textContent = newReviewCount;

            // Optionally, clear form
            reviewForm.reset();
            setTimeout(() => {
                reviewError.textContent = '';
                reviewError.style.color = 'red';
                reviewFormContainer.style.display = 'none';
            }, 1200);
        } catch (err) {
            reviewError.textContent = 'Error submitting review: ' + (err.message || err);
        }
    });
}

// Export function for use by other modules
window.filterCards = filterCards;