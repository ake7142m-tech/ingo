import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUniqueMovieId,
  buildV2DramasQuery,
  deduplicateByKey,
  deduplicateMovies,
  parseSeriesJeenError,
} from './movieDedupe';
import {
  SERIES_JEEN_BASE_URL,
  OPENAPI_SPEC_URL,
  transformAndDedupeDramas,
  transformSeriesJeenToMovie,
  SeriesJeenDramaItem,
} from '../services/seriesJeenService';
import { Movie } from '../types';

test('Series Jeen service targets API V2 base URL and OpenAPI spec', () => {
  assert.equal(SERIES_JEEN_BASE_URL, 'https://api-v2.seriesjeen.online');
  assert.equal(OPENAPI_SPEC_URL, 'https://api-v2.seriesjeen.online/openapi.json');
});

test('transformAndDedupeDramas eliminates duplicate sj-thaidub-ERl2 keys', () => {
  const duplicateApiItems: SeriesJeenDramaItem[] = [
    { drama_id: 'ERl2', title: 'มังกรหยก พากย์ไทย', episode_count: 40 },
    { drama_id: 'ERl2', title: 'มังกรหยก พากย์ไทย', episode_count: 40 },
    { drama_id: 'AB99', title: 'เทพยุทธ์เซียนกลอรี่', episode_count: 30 },
  ];

  const movies = transformAndDedupeDramas(duplicateApiItems, 'THAIDUB');
  const ids = movies.map((m) => m.id);
  assert.equal(movies.length, 2);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(movies[0].id, 'sj-thaidub-ERl2');
});

test('buildUniqueMovieId separates identical short IDs from different sub-platforms', () => {
  const idA = buildUniqueMovieId('THAIDUB', 'ERl2', 'shortmax');
  const idB = buildUniqueMovieId('THAIDUB', 'ERl2', 'dramabox');
  assert.notEqual(idA, idB);
  assert.equal(idA, 'sj-thaidub-shortmax-ERl2');
  assert.equal(idB, 'sj-thaidub-dramabox-ERl2');
});

test('transformSeriesJeenToMovie maps V2 DramaItem schema accurately', () => {
  const v2Drama: SeriesJeenDramaItem = {
    id: 1042,
    series_id: 'DR-1042',
    platform_id: 3,
    title: 'รักข้ามภพ',
    description: 'ซีรีส์จีนย้อนยุค',
    episode_count: 60,
    episodes_available: 45,
    genres: ['โรแมนติก', 'ย้อนยุค'],
    thai_dub: true,
    thai_sub: true,
    updated_at: '2026-11-20T10:00:00',
    poster: 'https://cdn.seriesjeen.online/poster-token',
  };

  const movie = transformSeriesJeenToMovie(v2Drama, 'ShortMax');
  assert.equal(movie.id, 'sj-shortmax-p3-1042');
  assert.equal(movie.code, '#DR-1042');
  assert.equal(movie.duration, '45/60 ตอน');
  assert.equal(movie.category, 'พากย์ไทย');
  assert.ok(movie.genres.includes('โรแมนติก'));
  assert.ok(movie.genres.includes('พากย์ไทย'));
  assert.ok(movie.genres.includes('ซับไทย'));
  assert.equal(movie.poster, 'https://cdn.seriesjeen.online/poster-token');
});

test('deduplicateMovies and deduplicateByKey preserve first-seen order without duplicates', () => {
  const sample = (id: string, title: string): Movie => ({
    id,
    code: `#${id}`,
    title,
    year: 2026,
    rating: 9,
    poster: '',
    category: 'ซีรีส์',
    genres: ['ดราม่า'],
    quality: '4K',
    status: 'active',
    views: 0,
    description: '',
    createdAt: '',
    updatedAt: '',
  });

  const merged = deduplicateMovies([
    sample('sj-thaidub-ERl2', 'First'),
    sample('sj-thaidub-ERl2', 'Duplicate'),
    sample('sj-shortmax-p1-10', 'Second'),
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'First');
  assert.equal(merged[1].id, 'sj-shortmax-p1-10');

  const uniquePlatforms = deduplicateByKey(
    [
      { id: 1, name: 'A' },
      { id: 1, name: 'A dup' },
      { id: 2, name: 'B' },
    ],
    (p) => p.id
  );
  assert.equal(uniquePlatforms.length, 2);
});

test('buildV2DramasQuery clamps page_size to 1..50 and validates sort/q/genre', () => {
  const qs = buildV2DramasQuery({
    page: 0,
    page_size: 99,
    q: '  มังกรหยก  ',
    genre: ' แอคชั่น ',
    sort: 'episodes',
  });
  const params = new URLSearchParams(qs);
  assert.equal(params.get('page'), '1');
  assert.equal(params.get('page_size'), '50');
  assert.equal(params.get('q'), 'มังกรหยก');
  assert.equal(params.get('genre'), 'แอคชั่น');
  assert.equal(params.get('sort'), 'episodes');
});

test('parseSeriesJeenError formats V2 structured errors cleanly', () => {
  const rateLimit = parseSeriesJeenError(
    429,
    JSON.stringify({ detail: { error: 'rate_limit_exceeded', scope: 'key' } }),
    '15'
  );
  assert.ok(rateLimit.includes('15'));

  const noAccess = parseSeriesJeenError(
    403,
    JSON.stringify({ detail: { error: 'no_access', platform_id: 2 } })
  );
  assert.ok(noAccess.includes('ไม่มีสิทธิ์'));

  const unauth = parseSeriesJeenError(401, JSON.stringify({ detail: 'Invalid API key' }));
  assert.ok(unauth.includes('Invalid API key'));
});
