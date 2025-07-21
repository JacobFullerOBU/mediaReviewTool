import React from 'react';
import { Movie } from '../types';
import './MovieCard.css';

interface MovieCardProps {
  movie: Movie;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  return (
    <div className="movie-card">
      <div className="movie-image">
        <img src={movie.imageUrl} alt={movie.title} />
        <div className="movie-rating">
          <span>★ {movie.rating}</span>
        </div>
      </div>
      
      <div className="movie-content">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-year">{movie.year}</p>
        
        <div className="movie-genres">
          {movie.genre.map(genre => (
            <span key={genre} className="genre-tag">{genre}</span>
          ))}
        </div>
        
        <p className="movie-description">{movie.description}</p>
        
        <div className="movie-streaming">
          <span className="streaming-label">Available on:</span>
          <div className="streaming-services">
            {movie.streamingService.map(service => (
              <span key={service} className="service-tag">{service}</span>
            ))}
          </div>
        </div>
        
        <div className="movie-actions">
          <button className="btn btn-primary">Read Reviews</button>
          <button className="btn btn-secondary">Write Review</button>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;