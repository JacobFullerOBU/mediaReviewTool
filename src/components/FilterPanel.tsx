import React from 'react';
import { FilterState } from '../types';
import './FilterPanel.css';

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearAll: () => void;
}

const AVAILABLE_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 
  'Drama', 'Horror', 'Sci-Fi', 'Thriller'
];

const AVAILABLE_STREAMING_SERVICES = [
  'Netflix', 'Amazon Prime', 'Disney+', 'Hulu', 'HBO Max'
];

const AVAILABLE_TIME_PERIODS = [
  '2020s', '2010s', '2000s', '1990s', '1980s'
];

const FilterPanel: React.FC<FilterPanelProps> = ({ 
  filters, 
  onFilterChange, 
  onClearAll 
}) => {
  const handleGenreToggle = (genre: string) => {
    const newGenres = filters.genres.includes(genre)
      ? filters.genres.filter(g => g !== genre)
      : [...filters.genres, genre];
    
    onFilterChange({
      ...filters,
      genres: newGenres
    });
  };

  const handleServiceToggle = (service: string) => {
    const newServices = filters.streamingServices.includes(service)
      ? filters.streamingServices.filter(s => s !== service)
      : [...filters.streamingServices, service];
    
    onFilterChange({
      ...filters,
      streamingServices: newServices
    });
  };

  const handlePeriodToggle = (period: string) => {
    const newPeriods = filters.timePeriods.includes(period)
      ? filters.timePeriods.filter(p => p !== period)
      : [...filters.timePeriods, period];
    
    onFilterChange({
      ...filters,
      timePeriods: newPeriods
    });
  };

  const hasActiveFilters = filters.genres.length > 0 || 
    filters.streamingServices.length > 0 || 
    filters.timePeriods.length > 0;

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        {hasActiveFilters && (
          <button className="btn btn-secondary clear-all" onClick={onClearAll}>
            Clear All
          </button>
        )}
      </div>

      <div className="filter-groups">
        <div className="filter-group">
          <h4>Genres</h4>
          <div className="filter-options">
            {AVAILABLE_GENRES.map(genre => (
              <button
                key={genre}
                className={`filter-option ${filters.genres.includes(genre) ? 'active' : ''}`}
                onClick={() => handleGenreToggle(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h4>Streaming Services</h4>
          <div className="filter-options">
            {AVAILABLE_STREAMING_SERVICES.map(service => (
              <button
                key={service}
                className={`filter-option ${filters.streamingServices.includes(service) ? 'active' : ''}`}
                onClick={() => handleServiceToggle(service)}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h4>Time Periods</h4>
          <div className="filter-options">
            {AVAILABLE_TIME_PERIODS.map(period => (
              <button
                key={period}
                className={`filter-option ${filters.timePeriods.includes(period) ? 'active' : ''}`}
                onClick={() => handlePeriodToggle(period)}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;