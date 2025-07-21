import React, { useState } from 'react';
import './BooksPage.css';

interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  rating: number;
  review: string;
  coverImage?: string;
}

const BooksPage: React.FC = () => {
  // Sample book data - in a real app this would come from an API
  const [books] = useState<Book[]>([
    {
      id: 1,
      title: "The Lord of the Rings",
      author: "J.R.R. Tolkien",
      genre: "Fantasy",
      rating: 5,
      review: "An epic fantasy masterpiece that has stood the test of time. Tolkien's world-building is unparalleled."
    },
    {
      id: 2,
      title: "To Kill a Mockingbird",
      author: "Harper Lee",
      genre: "Fiction",
      rating: 4.5,
      review: "A powerful story about justice, morality, and coming of age in the American South."
    },
    {
      id: 3,
      title: "1984",
      author: "George Orwell",
      genre: "Dystopian Fiction",
      rating: 4.8,
      review: "A chilling and prophetic vision of totalitarianism that remains relevant today."
    },
    {
      id: 4,
      title: "Pride and Prejudice",
      author: "Jane Austen",
      genre: "Romance",
      rating: 4.3,
      review: "Austen's wit and social commentary shine in this timeless romance novel."
    }
  ]);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star filled">★</span>);
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">★</span>);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }
    
    return stars;
  };

  return (
    <div className="books-page">
      <header className="books-header">
        <h1>📚 Book Reviews</h1>
        <p>Discover and share reviews for your favorite books</p>
      </header>

      <main className="books-content">
        <section className="books-stats">
          <div className="stat-card">
            <h3>{books.length}</h3>
            <p>Books Reviewed</p>
          </div>
          <div className="stat-card">
            <h3>{(books.reduce((sum, book) => sum + book.rating, 0) / books.length).toFixed(1)}</h3>
            <p>Average Rating</p>
          </div>
          <div className="stat-card">
            <h3>{new Set(books.map(book => book.genre)).size}</h3>
            <p>Genres Covered</p>
          </div>
        </section>

        <section className="books-grid">
          {books.map(book => (
            <div key={book.id} className="book-card">
              <div className="book-header">
                <h3 className="book-title">{book.title}</h3>
                <div className="book-rating">
                  {renderStars(book.rating)}
                  <span className="rating-number">({book.rating})</span>
                </div>
              </div>
              <div className="book-meta">
                <p className="book-author">by {book.author}</p>
                <span className="book-genre">{book.genre}</span>
              </div>
              <div className="book-review">
                <p>"{book.review}"</p>
              </div>
            </div>
          ))}
        </section>

        <section className="add-review-section">
          <div className="add-review-prompt">
            <h2>Share Your Book Review</h2>
            <p>Have you read a great book recently? Share your thoughts with the community!</p>
            <button className="add-review-btn">Add Book Review</button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default BooksPage;