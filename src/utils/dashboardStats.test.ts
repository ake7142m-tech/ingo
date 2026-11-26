import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboardStats, getRecentMovies } from './dashboardStats';
import { INITIAL_CATEGORIES, INITIAL_MOVIES, INITIAL_USERS } from '../data/initialData';
import type { Movie } from '../types';

const makeMovie = (overrides: Partial<Movie>): Movie => ({
  id: 'm-1',
  code: '#100',
  title: 'Sample',
  year: 2026,
  rating: 8.0,
  poster: '',
  category: 'แอคชั่น',
  genres: [],
  quality: '4K',
  status: 'active',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

test('computeDashboardStats returns 1 admin and 0 across all content on clean initial data', () => {
  const stats = computeDashboardStats({
    users: INITIAL_USERS,
    movies: INITIAL_MOVIES,
    categories: INITIAL_CATEGORIES,
    members: [],
  });

  assert.deepEqual(stats, {
    adminCount: 1,
    totalMovies: 0,
    publishedMovies: 0,
    draftMovies: 0,
    categoryCount: 0,
    memberCount: 0,
  });
});

test('computeDashboardStats tallies published vs draft movies, categories, and members accurately', () => {
  const stats = computeDashboardStats({
    users: [
      ...INITIAL_USERS,
      { id: 'u-3', username: 'admin2', name: 'Admin Two', role: 'admin' },
    ],
    movies: [
      makeMovie({ id: 'm-1', status: 'active' }),
      makeMovie({ id: 'm-2', status: 'draft' }),
      makeMovie({ id: 'm-3', status: 'archived' }),
      makeMovie({ id: 'm-4', status: 'active' }),
    ],
    categories: [
      { id: 'c-1', name: 'Action', slug: 'action', count: 2 },
      { id: 'c-2', name: 'Drama', slug: 'drama', count: 1 },
    ],
    members: [
      { id: 'mem-1', name: 'Somchai', email: 's@example.com', plan: 'vip', status: 'active', joinedAt: '2026-01-01' },
    ],
  });

  assert.equal(stats.adminCount, 2);
  assert.equal(stats.totalMovies, 4);
  assert.equal(stats.publishedMovies, 2);
  assert.equal(stats.draftMovies, 1);
  assert.equal(stats.categoryCount, 2);
  assert.equal(stats.memberCount, 1);
});

test('getRecentMovies sorts newest first and enforces limit', () => {
  const list = [
    makeMovie({ id: 'old', title: 'Old', createdAt: '2026-01-01T00:00:00.000Z' }),
    makeMovie({ id: 'newest', title: 'Newest', createdAt: '2026-03-01T00:00:00.000Z' }),
    makeMovie({ id: 'mid', title: 'Mid', createdAt: '2026-02-01T00:00:00.000Z' }),
  ];

  const topTwo = getRecentMovies(list, 2);
  assert.deepEqual(
    topTwo.map((m) => m.id),
    ['newest', 'mid']
  );
});
