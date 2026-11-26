import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEpisodeRangeParam,
  extractEpisodeLinksFromV2Response,
  getMovieLinkCount,
  isLinkExpired,
  mergeEpisodeLinksIntoMovie,
} from './movieLinks';
import { Movie } from '../types';

test('buildEpisodeRangeParam formats single episode and capped ranges accurately', () => {
  assert.equal(buildEpisodeRangeParam(1, 10), '1');
  assert.equal(buildEpisodeRangeParam(6, 10), '1-6');
  assert.equal(buildEpisodeRangeParam(60, 10), '1-10');
  assert.equal(buildEpisodeRangeParam(60, 10, 11), '11-20');
  assert.equal(buildEpisodeRangeParam(15, 10, 11), '11-15');
});

test('extractEpisodeLinksFromV2Response flattens, sorts, deduplicates, and preserves subtitles', () => {
  const links = extractEpisodeLinksFromV2Response({
    drama_id: 501,
    title: 'ซีรีส์ทดสอบ',
    episode_count: 20,
    episodes: [
      {
        episode: 2,
        parts: [
          {
            part: 1,
            of: 1,
            url: 'https://cdn.seriesjeen.online/token-ep2',
            url_expires_at: '2026-11-27T00:00:00Z',
            duration_sec: 120,
            subtitles: [],
          },
        ],
      },
      {
        episode: 1,
        parts: [
          {
            part: 1,
            of: 1,
            url: 'https://cdn.seriesjeen.online/token-ep1',
            url_expires_at: '2026-11-27T00:00:00Z',
            duration_sec: 115,
            subtitles: [
              {
                language: 'th',
                language_tag: 'th-TH',
                label: 'ไทย',
                format: 'webvtt',
                default: true,
                url: 'https://cdn.seriesjeen.online/sub-ep1-th.vtt',
              },
            ],
          },
          {
            // duplicate part should be ignored
            part: 1,
            of: 1,
            url: 'https://cdn.seriesjeen.online/token-ep1-dup',
          },
        ],
      },
    ],
  });

  assert.equal(links.length, 2);
  assert.equal(links[0].episode, 1);
  assert.equal(links[0].url, 'https://cdn.seriesjeen.online/token-ep1');
  assert.equal(links[0].subtitles?.length, 1);
  assert.equal(links[0].subtitles?.[0].url, 'https://cdn.seriesjeen.online/sub-ep1-th.vtt');
  assert.equal(links[1].episode, 2);
});

test('mergeEpisodeLinksIntoMovie sets primary streamUrl and refreshes existing episodes', () => {
  const baseMovie: Movie = {
    id: 'sj-shortmax-p1-501',
    code: '#SJ-501',
    title: 'ทดสอบ',
    year: 2026,
    rating: 9,
    poster: '',
    category: 'พากย์ไทย',
    genres: ['พากย์ไทย'],
    quality: '4K',
    status: 'active',
    description: '',
    streamUrl: '',
    v2DramaId: 501,
    createdAt: '2026-11-25T00:00:00Z',
    updatedAt: '2026-11-25T00:00:00Z',
  };

  const firstMerged = mergeEpisodeLinksIntoMovie(baseMovie, [
    { episode: 1, part: 1, totalParts: 1, url: 'https://cdn.seriesjeen.online/old-ep1', urlExpiresAt: '2026-11-26T00:00:00Z' },
    { episode: 2, part: 1, totalParts: 1, url: 'https://cdn.seriesjeen.online/old-ep2', urlExpiresAt: '2026-11-26T00:00:00Z' },
  ]);

  assert.equal(firstMerged.streamUrl, 'https://cdn.seriesjeen.online/old-ep1');
  assert.equal(getMovieLinkCount(firstMerged), 2);

  // Refresh episode 1 with newer CDN URL
  const refreshed = mergeEpisodeLinksIntoMovie(firstMerged, [
    { episode: 1, part: 1, totalParts: 1, url: 'https://cdn.seriesjeen.online/new-ep1', urlExpiresAt: '2026-11-28T00:00:00Z' },
  ]);

  assert.equal(refreshed.streamUrl, 'https://cdn.seriesjeen.online/new-ep1');
  assert.equal(refreshed.episodeLinks?.length, 2);
  assert.equal(refreshed.episodeLinks?.[1].url, 'https://cdn.seriesjeen.online/old-ep2');
});

test('isLinkExpired respects expiry timestamps and 2-minute safety buffer', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  assert.equal(isLinkExpired('2026-11-26T11:59:00Z', now), true);
  assert.equal(isLinkExpired('2026-11-26T12:01:00Z', now), true); // within 2-min buffer
  assert.equal(isLinkExpired('2026-11-26T13:00:00Z', now), false);
  assert.equal(isLinkExpired(undefined, now), false);
});
