// Sample music data for demonstration
const musicDatabase = [
    {
        title: "Bohemian Rhapsody",
        artist: "Queen",
        genre: "rock",
        era: "1970s",
        year: 1975
    },
    {
        title: "Billie Jean",
        artist: "Michael Jackson",
        genre: "pop",
        era: "1980s",
        year: 1983
    },
    {
        title: "Lose Yourself",
        artist: "Eminem",
        genre: "hip-hop",
        era: "2000s",
        year: 2002
    },
    {
        title: "Take Five",
        artist: "Dave Brubeck",
        genre: "jazz",
        era: "1960s",
        year: 1959
    },
    {
        title: "Symphony No. 9",
        artist: "Ludwig van Beethoven",
        genre: "classical",
        era: "1800s",
        year: 1824
    },
    {
        title: "One More Time",
        artist: "Daft Punk",
        genre: "electronic",
        era: "2000s",
        year: 2000
    },
    {
        title: "Sweet Child O' Mine",
        artist: "Guns N' Roses",
        genre: "rock",
        era: "1980s",
        year: 1987
    },
    {
        title: "Blinding Lights",
        artist: "The Weeknd",
        genre: "pop",
        era: "2020s",
        year: 2019
    },
    {
        title: "Old Town Road",
        artist: "Lil Nas X",
        genre: "country",
        era: "2010s",
        year: 2019
    },
    {
        title: "Respect",
        artist: "Aretha Franklin",
        genre: "r&b",
        era: "1960s",
        year: 1967
    },
    {
        title: "Somebody That I Used to Know",
        artist: "Gotye",
        genre: "indie",
        era: "2010s",
        year: 2011
    },
    {
        title: "Master of Puppets",
        artist: "Metallica",
        genre: "metal",
        era: "1980s",
        year: 1986
    }
];

class MusicReviewTool {
    constructor() {
        this.currentResults = [...musicDatabase];
        this.initializeEventListeners();
        this.displayResults(this.currentResults);
    }

    initializeEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');

        searchBtn.addEventListener('click', () => this.handleSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Filter functionality
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');

        applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        clearFiltersBtn.addEventListener('click', () => this.clearFilters());

        // Real-time filter updates
        const filterCheckboxes = document.querySelectorAll('.filter-options input[type="checkbox"]');
        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });
    }

    handleSearch() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        
        if (searchTerm === '') {
            this.currentResults = [...musicDatabase];
        } else {
            this.currentResults = musicDatabase.filter(item => 
                item.title.toLowerCase().includes(searchTerm) ||
                item.artist.toLowerCase().includes(searchTerm)
            );
        }

        this.applyFilters();
    }

    applyFilters() {
        const selectedGenres = this.getSelectedFilters('genreFilters');
        const selectedEras = this.getSelectedFilters('eraFilters');

        let filteredResults = [...this.currentResults];

        // Apply genre filters
        if (selectedGenres.length > 0) {
            filteredResults = filteredResults.filter(item => 
                selectedGenres.includes(item.genre)
            );
        }

        // Apply era filters
        if (selectedEras.length > 0) {
            filteredResults = filteredResults.filter(item => 
                selectedEras.includes(item.era)
            );
        }

        this.displayResults(filteredResults);
    }

    getSelectedFilters(containerId) {
        const container = document.getElementById(containerId);
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    }

    clearFilters() {
        // Clear all checkboxes
        const checkboxes = document.querySelectorAll('.filter-options input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Clear search input
        document.getElementById('searchInput').value = '';

        // Reset results
        this.currentResults = [...musicDatabase];
        this.displayResults(this.currentResults);
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('searchResults');

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No results found. Try adjusting your search or filters.</p>';
            return;
        }

        const resultsHTML = results.map(item => `
            <div class="result-item">
                <div class="result-title">${item.title}</div>
                <div class="result-artist">by ${item.artist}</div>
                <div class="result-tags">
                    <span class="tag genre">${this.capitalizeFirst(item.genre)}</span>
                    <span class="tag era">${item.era}</span>
                    <span class="tag">${item.year}</span>
                </div>
            </div>
        `).join('');

        resultsContainer.innerHTML = resultsHTML;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MusicReviewTool();
});

// Add some helpful console messages for development
console.log('Music Review Tool loaded successfully!');
console.log('Available sample data:', musicDatabase.length, 'tracks');