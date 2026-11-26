import { Category, Member, Movie, User } from '../types';

export interface DashboardStats {
  adminCount: number;
  totalMovies: number;
  publishedMovies: number;
  draftMovies: number;
  categoryCount: number;
  memberCount: number;
}

/**
 * Compute real-time KPI counts for the Film Studio Admin dashboard.
 */
export function computeDashboardStats(params: {
  users: User[];
  movies: Movie[];
  categories: Category[];
  members: Member[];
}): DashboardStats {
  const { users, movies, categories, members } = params;

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const totalMovies = movies.length;
  const publishedMovies = movies.filter((m) => m.status === 'active').length;
  const draftMovies = movies.filter((m) => m.status === 'draft').length;
  const categoryCount = categories.length;
  const memberCount = members.length;

  return {
    adminCount,
    totalMovies,
    publishedMovies,
    draftMovies,
    categoryCount,
    memberCount,
  };
}

/**
 * Return the most recently added movies sorted by createdAt descending.
 */
export function getRecentMovies(movies: Movie[], limit = 10): Movie[] {
  return [...movies]
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    })
    .slice(0, Math.max(0, limit));
}
