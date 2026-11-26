/**
 * Re-exports & Bridges to Series Jeen API V2 (https://api-v2.seriesjeen.online)
 */

export * from './seriesJeenService';

import {
  getStoredSeriesJeenKey,
  setStoredSeriesJeenKey,
  validateSeriesJeenKey,
  fetchPlatformDramas,
  searchPlatformDramas,
  fetchThaiDubList,
  fetchDramaDetailV2,
  transformSeriesJeenToMovie,
  transformAndDedupeDramas,
} from './seriesJeenService';
import { Movie } from '../types';

export const validateTMDBKey = validateSeriesJeenKey;
export const getStoredApiKey = getStoredSeriesJeenKey;
export const setStoredApiKey = setStoredSeriesJeenKey;

export const fetchTMDBMovies = async (
  endpoint: 'popular' | 'now_playing' | 'top_rated' | 'upcoming',
  page: number = 1,
  _language: string = 'th-TH',
  apiKeyInput?: string
): Promise<{ movies: Movie[]; rawData: unknown }> => {
  if (endpoint === 'popular') {
    const res = await fetchThaiDubList({ page, page_size: 20 }, apiKeyInput);
    const movies = transformAndDedupeDramas(res.list, res.platformName || 'SeriesJeenV2');
    return { movies, rawData: res };
  }

  const sort = endpoint === 'top_rated' ? 'episodes' : endpoint === 'upcoming' ? 'title' : 'latest';
  const res = await fetchPlatformDramas(1, { page, page_size: 20, sort }, apiKeyInput);
  const movies = transformAndDedupeDramas(res.list, 'SeriesJeenV2');
  return { movies, rawData: res };
};

export const searchTMDBMovies = async (
  query: string,
  _language: string = 'th-TH',
  apiKeyInput?: string
): Promise<Movie[]> => {
  try {
    const res = await fetchThaiDubList({ keyword: query, page_size: 20 }, apiKeyInput);
    if (res.list && res.list.length > 0) {
      return transformAndDedupeDramas(res.list, res.platformName || 'SeriesJeenV2');
    }
  } catch {
    // fallback search on platform 1
  }
  const dramas = await searchPlatformDramas(1, query, 1, apiKeyInput);
  return transformAndDedupeDramas(dramas, 'SeriesJeenV2');
};

export const getTMDBMovieDetails = async (
  id: number | string,
  _language: string = 'th-TH',
  apiKeyInput?: string
): Promise<Movie | null> => {
  try {
    const drama = await fetchDramaDetailV2(id, apiKeyInput);
    if (drama) {
      return transformSeriesJeenToMovie(drama, 'SeriesJeenV2');
    }
  } catch {
    // ignore not found
  }
  return null;
};
