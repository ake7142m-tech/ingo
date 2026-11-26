import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_MOVIES,
  INITIAL_CATEGORIES,
  INITIAL_GENRES,
  INITIAL_BANNERS,
  INITIAL_FAQS,
  INITIAL_SEO,
  INITIAL_VIDEO_ADS,
  INITIAL_LIVE_STREAMS,
  INITIAL_USERS,
  INITIAL_SETTINGS,
} from '../data/initialData';
import {
  PRESET_PURGE_FLAG_KEY,
  LEGACY_PRESET_STORAGE_KEYS,
  isLegacyPresetImageUrl,
  sanitizeUserAvatar,
  purgeLegacyPresetStorage,
  StorageLike,
} from './presetCleanup';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

test('all initial preset content collections are empty', () => {
  assert.equal(INITIAL_MOVIES.length, 0);
  assert.equal(INITIAL_CATEGORIES.length, 0);
  assert.equal(INITIAL_GENRES.length, 0);
  assert.equal(INITIAL_BANNERS.length, 0);
  assert.equal(INITIAL_FAQS.length, 0);
  assert.equal(INITIAL_VIDEO_ADS.length, 0);
  assert.equal(INITIAL_LIVE_STREAMS.length, 0);
});

test('initial users, SEO, and settings contain zero legacy preset image URLs or fake keys', () => {
  assert.equal(INITIAL_SEO.ogImage, '');
  assert.equal(INITIAL_SETTINGS.apiKey, '');
  for (const user of INITIAL_USERS) {
    assert.equal(isLegacyPresetImageUrl(user.avatar), false);
    assert.equal(user.avatar, '');
  }
});

test('purgeLegacyPresetStorage clears old cached preset keys once and preserves future user data', () => {
  const storage = createMemoryStorage({
    movieflix_movies: JSON.stringify([{ id: 'mov-1', title: 'Old Preset' }]),
    movieflix_banners: JSON.stringify([{ id: 'ban-1', title: 'Old Banner' }]),
    movieflix_live_streams: JSON.stringify([{ id: 'live-pl-1' }]),
    movieflix_notifications: JSON.stringify([{ id: 'notif-1' }]),
    freedom_dual_sessions: JSON.stringify([
      {
        id: 'user-admin',
        username: 'admin',
        name: 'Admin',
        role: 'admin',
        email: 'admin@freedom.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
    ]),
  });

  const purgedFirstRun = purgeLegacyPresetStorage(storage);
  assert.equal(purgedFirstRun, true);
  assert.equal(storage.getItem(PRESET_PURGE_FLAG_KEY), 'true');

  for (const key of LEGACY_PRESET_STORAGE_KEYS) {
    assert.equal(storage.getItem(key), null);
  }

  const cleanedSessions = JSON.parse(storage.getItem('freedom_dual_sessions') || '[]');
  assert.equal(cleanedSessions.length, 1);
  assert.equal(cleanedSessions[0].avatar, '');

  // Simulate user adding a brand-new movie after purge
  storage.setItem('movieflix_movies', JSON.stringify([{ id: 'movie-999', title: 'User Film' }]));

  // Second run must NOT wipe user-added data
  const purgedSecondRun = purgeLegacyPresetStorage(storage);
  assert.equal(purgedSecondRun, false);
  const keptMovies = JSON.parse(storage.getItem('movieflix_movies') || '[]');
  assert.equal(keptMovies.length, 1);
  assert.equal(keptMovies[0].id, 'movie-999');
});

test('sanitizeUserAvatar strips unsplash URLs while preserving custom non-preset avatars', () => {
  const cleaned = sanitizeUserAvatar({
    id: '1',
    username: 'admin',
    name: 'Admin',
    role: 'admin',
    email: 'a@b.com',
    avatar: 'https://images.unsplash.com/photo-123',
  });
  assert.equal(cleaned.avatar, '');

  const custom = sanitizeUserAvatar({
    id: '2',
    username: 'editor',
    name: 'Editor',
    role: 'staff',
    email: 'e@b.com',
    avatar: 'https://cdn.example.com/my-avatar.png',
  });
  assert.equal(custom.avatar, 'https://cdn.example.com/my-avatar.png');
});
