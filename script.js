// Sample game data
const games = [
    {
        id: 1,
        title: "The Legend of Zelda: Breath of the Wild",
        genre: "adventure",
        platform: "nintendo",
        rating: 5,
        description: "An open-world adventure game where you explore the vast kingdom of Hyrule.",
        image: "🗡️"
    },
    {
        id: 2,
        title: "Call of Duty: Modern Warfare",
        genre: "action",
        platform: "pc",
        rating: 4,
        description: "A first-person shooter with intense multiplayer battles and campaign mode.",
        image: "🔫"
    },
    {
        id: 3,
        title: "FIFA 24",
        genre: "sports",
        platform: "playstation",
        rating: 4,
        description: "The latest football simulation game with updated teams and players.",
        image: "⚽"
    },
    {
        id: 4,
        title: "The Witcher 3: Wild Hunt",
        genre: "rpg",
        platform: "pc",
        rating: 5,
        description: "A story-driven open world RPG set in a fantasy universe.",
        image: "🐺"
    },
    {
        id: 5,
        title: "Gran Turismo 7",
        genre: "racing",
        platform: "playstation",
        rating: 4,
        description: "The ultimate driving simulator with stunning graphics and realistic physics.",
        image: "🏎️"
    },
    {
        id: 6,
        title: "Halo Infinite",
        genre: "action",
        platform: "xbox",
        rating: 4,
        description: "Master Chief returns in this epic sci-fi first-person shooter.",
        image: "🚀"
    },
    {
        id: 7,
        title: "Stardew Valley",
        genre: "simulation",
        platform: "pc",
        rating: 5,
        description: "A charming farming simulation game with RPG elements.",
        image: "🌾"
    },
    {
        id: 8,
        title: "Super Mario Odyssey",
        genre: "adventure",
        platform: "nintendo",
        rating: 5,
        description: "Join Mario on a globe-trotting 3D adventure to rescue Princess Peach.",
        image: "🍄"
    },
    {
        id: 9,
        title: "Forza Horizon 5",
        genre: "racing",
        platform: "xbox",
        rating: 4,
        description: "An open-world racing game set in the vibrant landscapes of Mexico.",
        image: "🏁"
    },
    {
        id: 10,
        title: "Among Us",
        genre: "strategy",
        platform: "mobile",
        rating: 4,
        description: "A multiplayer social deduction game where teamwork and betrayal collide.",
        image: "👾"
    },
    {
        id: 11,
        title: "Tetris Effect",
        genre: "puzzle",
        platform: "pc",
        rating: 4,
        description: "The classic puzzle game enhanced with stunning visuals and music.",
        image: "🧩"
    },
    {
        id: 12,
        title: "Street Fighter 6",
        genre: "fighting",
        platform: "playstation",
        rating: 4,
        description: "The latest installment in the legendary fighting game series.",
        image: "👊"
    }
];

// DOM elements
const gameSearch = document.getElementById('gameSearch');
const searchBtn = document.getElementById('searchBtn');
const genreFilter = document.getElementById('genreFilter');
const platformFilter = document.getElementById('platformFilter');
const ratingFilter = document.getElementById('ratingFilter');
const clearFiltersBtn = document.getElementById('clearFilters');
const gamesGrid = document.getElementById('gamesGrid');

// Current filtered games
let filteredGames = [...games];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    displayGames(games);
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    gameSearch.addEventListener('input', handleSearch);
    searchBtn.addEventListener('click', handleSearch);
    genreFilter.addEventListener('change', applyFilters);
    platformFilter.addEventListener('change', applyFilters);
    ratingFilter.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', clearAllFilters);
    
    // Allow Enter key to trigger search
    gameSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

// Handle search functionality
function handleSearch() {
    applyFilters();
}

// Apply all filters and search
function applyFilters() {
    const searchTerm = gameSearch.value.toLowerCase().trim();
    const selectedGenre = genreFilter.value;
    const selectedPlatform = platformFilter.value;
    const selectedRating = ratingFilter.value;
    
    filteredGames = games.filter(game => {
        // Search filter
        const matchesSearch = searchTerm === '' || 
            game.title.toLowerCase().includes(searchTerm) ||
            game.description.toLowerCase().includes(searchTerm);
        
        // Genre filter
        const matchesGenre = selectedGenre === '' || game.genre === selectedGenre;
        
        // Platform filter
        const matchesPlatform = selectedPlatform === '' || game.platform === selectedPlatform;
        
        // Rating filter
        const matchesRating = selectedRating === '' || game.rating >= parseInt(selectedRating);
        
        return matchesSearch && matchesGenre && matchesPlatform && matchesRating;
    });
    
    displayGames(filteredGames);
}

// Clear all filters and search
function clearAllFilters() {
    gameSearch.value = '';
    genreFilter.value = '';
    platformFilter.value = '';
    ratingFilter.value = '';
    filteredGames = [...games];
    displayGames(filteredGames);
}

// Display games in the grid
function displayGames(gamesToDisplay) {
    if (gamesToDisplay.length === 0) {
        gamesGrid.innerHTML = `
            <div class="no-results">
                <p>No games found matching your criteria.</p>
                <p>Try adjusting your search or filters.</p>
            </div>
        `;
        return;
    }
    
    gamesGrid.innerHTML = gamesToDisplay.map(game => `
        <div class="game-card" data-game-id="${game.id}">
            <div class="game-image">${game.image}</div>
            <div class="game-info">
                <h3 class="game-title">${game.title}</h3>
                <p class="game-genre">Genre: ${capitalizeFirstLetter(game.genre)}</p>
                <p class="game-platform">Platform: ${capitalizeFirstLetter(game.platform)}</p>
                <div class="game-rating">
                    <span class="stars">${generateStars(game.rating)}</span>
                    <span class="rating-text">(${game.rating}/5)</span>
                </div>
                <p class="game-description">${game.description}</p>
            </div>
        </div>
    `).join('');
}

// Generate star rating display
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
}

// Capitalize first letter of a string
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Add some interactivity to game cards
document.addEventListener('click', function(e) {
    const gameCard = e.target.closest('.game-card');
    if (gameCard) {
        const gameId = parseInt(gameCard.dataset.gameId);
        const game = games.find(g => g.id === gameId);
        if (game) {
            showGameDetails(game);
        }
    }
});

// Show game details (placeholder for future enhancement)
function showGameDetails(game) {
    alert(`Game: ${game.title}\nGenre: ${capitalizeFirstLetter(game.genre)}\nPlatform: ${capitalizeFirstLetter(game.platform)}\nRating: ${game.rating}/5\n\n${game.description}`);
}

// Add some visual feedback for interactions
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects and animations through JavaScript if needed
    console.log('Games page loaded successfully!');
    console.log(`Displaying ${games.length} games initially`);
});