export interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string[];
  streamingService: string[];
  rating: number;
  description: string;
  imageUrl: string;
  timePeriod: string;
}

export interface FilterState {
  genres: string[];
  streamingServices: string[];
  timePeriods: string[];
}