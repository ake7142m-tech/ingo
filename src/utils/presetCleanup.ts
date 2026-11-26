import { User } from '../types';

export const PRESET_PURGE_FLAG_KEY = 'freedom_preset_purged_v1';

export const LEGACY_PRESET_STORAGE_KEYS = [
  'movieflix_movies',
  'movieflix_banners',
  'movieflix_live_streams',
  'movieflix_notifications',
  'movieflix_categories',
  'movieflix_genres',
  'movieflix_faqs',
  'movieflix_video_ads',
  'freedom_media_items',
] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const isLegacyPresetImageUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return (
    url.includes('images.unsplash.com') ||
    url.includes('via.placeholder.com')
  );
};

export const sanitizeUserAvatar = (user: User): User => {
  if (!user.avatar || isLegacyPresetImageUrl(user.avatar)) {
    return { ...user, avatar: '' };
  }
  return user;
};

/**
 * Runs once per browser profile to purge previously cached pre-seeded demo data
 * and strip legacy preset image URLs from active sessions.
 * Returns true if a purge occurred during this call.
 */
export const purgeLegacyPresetStorage = (storage: StorageLike): boolean => {
  try {
    if (storage.getItem(PRESET_PURGE_FLAG_KEY) === 'true') {
      return false;
    }

    for (const key of LEGACY_PRESET_STORAGE_KEYS) {
      storage.removeItem(key);
    }

    const rawSessions = storage.getItem('freedom_dual_sessions');
    if (rawSessions) {
      try {
        const parsed = JSON.parse(rawSessions);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.map((u: User) => sanitizeUserAvatar(u));
          storage.setItem('freedom_dual_sessions', JSON.stringify(cleaned));
        }
      } catch {
        storage.removeItem('freedom_dual_sessions');
      }
    }

    storage.setItem(PRESET_PURGE_FLAG_KEY, 'true');
    return true;
  } catch {
    return false;
  }
};
