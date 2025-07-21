import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders books page', () => {
  render(<App />);
  const booksHeading = screen.getByText(/Book Reviews/i);
  expect(booksHeading).toBeInTheDocument();
});
