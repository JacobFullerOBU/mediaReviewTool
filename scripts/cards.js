// Firebase Firestore for dynamic ratings
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKGL7v8zhVHFsoV_AWwgAshiWmv8v84yA",
  authDomain: "mediareviews-3cf32.firebaseapp.com",
  // ...other config values from Firebase Console...
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get number of reviews for a media item
async function getReviewCount(mediaId) {
    const q = query(collection(db, "reviews"), where("mediaId", "==", mediaId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
}

// Get average rating for a media item
async function getAverageRating(mediaId) {
    const q = query(collection(db, "reviews"), where("mediaId", "==", mediaId));
    const querySnapshot = await getDocs(q);
    let total = 0;
    let count = 0;
    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (typeof data.rating === "number") {
            total += data.rating;
            count++;
        }
    });
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
            image: "https://via.placeholder.com/300x200/4a90e2/ffffff?text=Movie"
        },
        {
            id: 2,
            title: "The Godfather",
            description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
            category: "movies",
            rating: 9.2,
            year: 1972,
            reviews: 98,
            image: "https://via.placeholder.com/300x200/4a90e2/ffffff?text=Movie"
        },
        {
            id: 3,
            title: "Pulp Fiction",
            description: "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption.",
            category: "movies",
            rating: 8.9,
            year: 1994,
            reviews: 87,
            image: "https://via.placeholder.com/300x200/4a90e2/ffffff?text=Movie"
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
            image: "https://via.placeholder.com/300x200/e74c3c/ffffff?text=TV+Show"
        },
        {
            id: 5,
            title: "Game of Thrones",
            description: "Nine noble families fight for control over the lands of Westeros while an ancient enemy returns.",
            category: "tv",
            rating: 8.7,
            year: 2011,
            reviews: 156,
            image: "https://via.placeholder.com/300x200/e74c3c/ffffff?text=TV+Show"
        },
        {
            id: 6,
            title: "Stranger Things",
            description: "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces.",
            category: "tv",
            rating: 8.8,
            year: 2016,
            reviews: 134,
            image: "https://via.placeholder.com/300x200/e74c3c/ffffff?text=TV+Show"
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
            image: "https://via.placeholder.com/300x200/f39c12/ffffff?text=Album"
        },
        {
            id: 8,
            title: "Dark Side of the Moon",
            description: "Pink Floyd's conceptual masterpiece exploring themes of conflict, greed, time, and mental illness.",
            category: "music",
            rating: 9.4,
            year: 1973,
            reviews: 76,
            image: "https://via.placeholder.com/300x200/f39c12/ffffff?text=Album"
        },
        {
            id: 9,
            title: "Thriller",
            description: "Michael Jackson's legendary album that became the best-selling album of all time.",
            category: "music",
            rating: 8.9,
            year: 1982,
            reviews: 112,
            image: "https://via.placeholder.com/300x200/f39c12/ffffff?text=Album"
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
            image: "https://via.placeholder.com/300x200/9b59b6/ffffff?text=Game"
        },
        {
            id: 11,
            title: "The Witcher 3: Wild Hunt",
            description: "A story-driven open world RPG set in a visually stunning fantasy universe full of meaningful choices.",
            category: "games",
            rating: 9.3,
            year: 2015,
            reviews: 189,
            image: "https://via.placeholder.com/300x200/9b59b6/ffffff?text=Game"
        },
        {
            id: 12,
            title: "Red Dead Redemption 2",
            description: "An epic tale of life in America's unforgiving heartland featuring a desperado and the gang he rides with.",
            category: "games",
            rating: 9.1,
            year: 2018,
            reviews: 167,
            image: "https://via.placeholder.com/300x200/9b59b6/ffffff?text=Game"
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
            image: "https://via.placeholder.com/300x200/27ae60/ffffff?text=Book"
        },
        {
            id: 14,
            title: "1984",
            description: "George Orwell's dystopian masterpiece about totalitarianism, surveillance, and the power of truth.",
            category: "books",
            rating: 9.0,
            year: 1949,
            reviews: 198,
            image: "https://via.placeholder.com/300x200/27ae60/ffffff?text=Book"
        },
        {
            id: 15,
            title: "The Great Gatsby",
            description: "F. Scott Fitzgerald's classic tale of love, loss, and the American Dream in the Jazz Age.",
            category: "books",
            rating: 8.5,
            year: 1925,
            reviews: 123,
            image: "https://via.placeholder.com/300x200/27ae60/ffffff?text=Book"
        }
    ]
};

let currentFilter = 'all';
let allItems = [];

document.addEventListener('DOMContentLoaded', function() {
    initCards();
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

function loadCards(category) {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    
    // Show loading state
    showLoadingState(container);
    
    // Simulate loading delay
    setTimeout(() => {
        let itemsToShow = allItems;
        
        if (category !== 'all') {
            itemsToShow = allItems.filter(item => item.category === category);
        }
        
        renderCards(container, itemsToShow);
    }, 500);
}

function showLoadingState(container) {
    container.innerHTML = '<div class="loading">Loading content...</div>';
}

function renderCards(container, items) {
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No content found</h3>
                <p>Try selecting a different category or check back later.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => createCardHTML(item)).join('');

    // Dynamically update ratings from Firestore
    items.forEach(async item => {
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
        }
    });

    // Add click listeners to cards
    addCardListeners();
}

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
            </div>
        </div>
    `;
}

function addCardListeners() {
    const cards = document.querySelectorAll('.media-card');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            const itemId = this.dataset.id;
            const item = allItems.find(item => item.id == itemId);
            if (item) {
                showItemDetails(item);
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

function showItemDetails(item) {
    // Create a simple modal to show item details
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>${item.title}</h2>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                    <img src="${item.image}" alt="${item.title}" style="width: 150px; height: 100px; object-fit: cover; border-radius: 8px;">
                    <div>
                        <p><strong>Category:</strong> ${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</p>
                        <p><strong>Year:</strong> ${item.year}</p>
                        <p><strong>Rating:</strong> ★ ${item.rating}</p>
                        <p><strong>Reviews:</strong> ${item.reviews}</p>
                    </div>
                </div>
                <p><strong>Description:</strong></p>
                <p>${item.description}</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary">Write a Review</button>
                    <button class="btn btn-login" style="margin-left: 10px;">Add to Favorites</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add close functionality
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
}

// Export function for use by other modules
window.filterCards = filterCards;