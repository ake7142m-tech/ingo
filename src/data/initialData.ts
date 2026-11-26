import { Movie, User, Category, Genre, Banner, FAQItem, SeoConfig, VideoAd, SiteSettings, LiveStream } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    name: 'ผู้ดูแลระบบสูงสุด (Super Admin)',
    role: 'admin',
    email: 'admin@freedom.com',
    avatar: '',
    password: 'Admin123',
  },
  {
    id: 'user-staff',
    username: 'staff',
    name: 'พนักงานดูแลเนื้อหา (Staff Editor)',
    role: 'staff',
    email: 'staff@freedom.com',
    avatar: '',
    password: 'Staff456',
  },
];

export const INITIAL_MOVIES: Movie[] = [];

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_GENRES: Genre[] = [];

export const INITIAL_BANNERS: Banner[] = [];

export const INITIAL_FAQS: FAQItem[] = [];

export const INITIAL_SEO: SeoConfig = {
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  ogImage: '',
  canonicalUrl: '',
  googleAnalyticsId: '',
};

export const INITIAL_VIDEO_ADS: VideoAd[] = [];

export const INITIAL_SETTINGS: SiteSettings = {
  siteName: 'FREEDOM',
  siteTagline: '',
  logoText: 'FREEDOM',
  supportEmail: '',
  maintenanceMode: false,
  autoSyncApi: false,
  apiProvider: '',
  apiKey: '',
  copyrightText: '',
  allowGuestPreview: true,
};

export const INITIAL_LIVE_STREAMS: LiveStream[] = [];
