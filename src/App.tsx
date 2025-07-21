import React from 'react';
import MoviesPage from './components/MoviesPage';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="app-header">
        <div className="container">
          <h1>Media Review Tool</h1>
          <nav>
            <a href="#movies" className="nav-link active">Movies</a>
            <a href="#tv" className="nav-link">TV Shows</a>
            <a href="#music" className="nav-link">Music</a>
            <a href="#games" className="nav-link">Games</a>
            <a href="#books" className="nav-link">Books</a>
          </nav>
        </div>
      </header>
      <main>
        <MoviesPage />
      </main>
    </div>
  );
};

export default App;