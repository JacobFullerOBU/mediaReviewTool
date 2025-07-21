import React, { useState, useMemo } from 'react';
import { Movie, FilterState } from '../types';
import { sampleMovies } from '../data/sampleMovies';
import MovieCard from './MovieCard';
import FilterPanel from './FilterPanel';
import './MoviesPage.css';

const MoviesPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    streamingServices: [],
    timePeriods: []
  });

  const filteredMovies = useMemo(() => {
    return sampleMovies.filter(movie => {
      // If no filters are selected, show all movies
      const genreMatch = filters.genres.length === 0 || 
        filters.genres.some(genre => movie.genre.includes(genre));
      
      const serviceMatch = filters.streamingServices.length === 0 || 
        filters.streamingServices.some(service => movie.streamingService.includes(service));
      
      const periodMatch = filters.timePeriods.length === 0 || 
        filters.timePeriods.includes(movie.timePeriod);
      
      return genreMatch && serviceMatch && periodMatch;
    });
  }, [filters]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({
      genres: [],
      streamingServices: [],
      timePeriods: []
    });
  };

  return (
    <div className="movies-page">
      <div className="container">
        <div className="page-header">
          <h2>Movie Reviews</h2>
          <p>Discover and review movies from various genres, streaming services, and time periods</p>
        </div>
        
        <FilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearAll={clearAllFilters}
        />
        
        <div className="movies-results">
          <div className="results-header">
            <h3>
              {filteredMovies.length} Movie{filteredMovies.length !== 1 ? 's' : ''} Found
            </h3>
          </div>
          
          <div className="movies-grid">
            {filteredMovies.map(movie => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
          
          {filteredMovies.length === 0 && (
            <div className="no-results">
              <p>No movies match your current filters.</p>
              <button className="btn btn-primary" onClick={clearAllFilters}>
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoviesPage;