import React from 'react';
import { render, screen } from '@testing-library/react';
import BooksPage from './BooksPage';

describe('BooksPage', () => {
  test('renders book reviews heading', () => {
    render(<BooksPage />);
    const heading = screen.getByText(/Book Reviews/i);
    expect(heading).toBeInTheDocument();
  });

  test('displays sample books', () => {
    render(<BooksPage />);
    
    // Check for sample book titles
    expect(screen.getByText('The Lord of the Rings')).toBeInTheDocument();
    expect(screen.getByText('To Kill a Mockingbird')).toBeInTheDocument();
    expect(screen.getByText('1984')).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });

  test('displays book authors', () => {
    render(<BooksPage />);
    
    expect(screen.getByText('by J.R.R. Tolkien')).toBeInTheDocument();
    expect(screen.getByText('by Harper Lee')).toBeInTheDocument();
    expect(screen.getByText('by George Orwell')).toBeInTheDocument();
    expect(screen.getByText('by Jane Austen')).toBeInTheDocument();
  });

  test('displays statistics section', () => {
    render(<BooksPage />);
    
    expect(screen.getByText('Books Reviewed')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
    expect(screen.getByText('Genres Covered')).toBeInTheDocument();
  });

  test('displays add review section', () => {
    render(<BooksPage />);
    
    expect(screen.getByText('Share Your Book Review')).toBeInTheDocument();
    expect(screen.getByText('Add Book Review')).toBeInTheDocument();
  });

  test('displays star ratings', () => {
    render(<BooksPage />);
    
    // Check that stars are rendered (★ and ☆ characters)
    const stars = screen.getAllByText(/[★☆]/);
    expect(stars.length).toBeGreaterThan(0);
  });
});