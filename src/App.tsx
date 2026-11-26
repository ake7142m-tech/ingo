import React, { useState, useEffect, useMemo } from 'react';
import {
  INITIAL_MOVIES,
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_GENRES,
  INITIAL_BANNERS,
  INITIAL_FAQS,
  INITIAL_SEO,
  INITIAL_VIDEO_ADS,
  INITIAL_SETTINGS,
  INITIAL_LIVE_STREAMS,
} from './data/initialData';
import {
  Movie,
  User,
  Category,
  Genre,
  Banner,
  FAQItem,
  SeoConfig,
  VideoAd,
  SiteSettings,
  AdminMenuTab,
  LiveStream,
  LiveNotification,
  Member,
  PaymentMethod,
} from './types';
import { LoginView } from './components/LoginView';
import { StudioTopNav } from './components/StudioTopNav';
import { DashboardView } from './components/DashboardView';
import { MoviesManagement } from './components/MoviesManagement';
import { MovieFormModal } from './components/MovieFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ApiSyncModal } from './components/ApiSyncModal';
import { PreviewWebsiteModal } from './components/PreviewWebsiteModal';
import { CategoriesManagement } from './components/CategoriesManagement';
import { UsersManagement } from './components/UsersManagement';
import { MembersManagement } from './components/MembersManagement';
import { PaymentsManagement } from './components/PaymentsManagement';
import { BannersManagement } from './components/BannersManagement';
import { SettingsManagement } from './components/SettingsManagement';
import { MediaLibrary } from './components/MediaLibrary';
import { LiveStreamManagement } from './components/LiveStreamManagement';
import { LiveStreamPlayerModal } from './components/LiveStreamPlayerModal';
import { MovieCinemaPlayerModal } from './components/MovieCinemaPlayerModal';
import { EdgeOneHlsStudio } from './components/EdgeOneHlsStudio';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { purgeLegacyPresetStorage, sanitizeUserAvatar } from './utils/presetCleanup';
import { computeDashboardStats } from './utils/dashboardStats';
import { deduplicateMovies } from './utils/movieDedupe';
import { fetchAndAttachV2MovieLinks } from './services/seriesJeenService';

if (typeof window !== 'undefined' && window.localStorage) {
  purgeLegacyPresetStorage(window.localStorage);
}

export default function App() {
  const { language, toggleLanguage } = useLanguage();

  // Session state
  const [dualSessions, setDualSessions] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('freedom_dual_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: User) => sanitizeUserAvatar(u));
        }
      }
    } catch {
      // ignore invalid storage
    }
    return [INITIAL_USERS[0], INITIAL_USERS[1]];
  });

  const [activeUserId, setActiveUserId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('freedom_active_user_id');
      if (savedId) return savedId;
    } catch {
      // ignore
    }
    return INITIAL_USERS[0]?.id || 'user-admin';
  });

  const currentUser: User | null = useMemo(() => {
    if (dualSessions.length === 0) return null;
    return dualSessions.find((u) => u.id === activeUserId) || dualSessions[0] || null;
  }, [dualSessions, activeUserId]);

  useEffect(() => {
    if (dualSessions.length > 0) {
      localStorage.setItem('freedom_dual_sessions', JSON.stringify(dualSessions));
    } else {
      localStorage.removeItem('freedom_dual_sessions');
    }
  }, [dualSessions]);

  useEffect(() => {
    if (activeUserId) {
      localStorage.setItem('freedom_active_user_id', activeUserId);
    }
  }, [activeUserId]);


  // Data Stores
  const [movies, setMovies] = useState<Movie[]>(() => {
    try {
      const local = localStorage.getItem('movieflix_movies');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return deduplicateMovies(parsed);
      }
    } catch {
      // ignore
    }
    return deduplicateMovies(INITIAL_MOVIES);
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const local = localStorage.getItem('freedom_categories');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CATEGORIES;
  });

  const [genres, setGenres] = useState<Genre[]>(() => {
    try {
      const local = localStorage.getItem('freedom_genres');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_GENRES;
  });

  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const local = localStorage.getItem('freedom_members');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    try {
      const local = localStorage.getItem('freedom_payment_methods');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [banners, setBanners] = useState<Banner[]>(() => {
    try {
      const local = localStorage.getItem('movieflix_banners');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_BANNERS;
  });

  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [faqs, setFaqs] = useState<FAQItem[]>(INITIAL_FAQS);
  const [seo, setSeo] = useState<SeoConfig>(INITIAL_SEO);
  const [videoAds, setVideoAds] = useState<VideoAd[]>(INITIAL_VIDEO_ADS);
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SETTINGS);

  const [liveStreams, setLiveStreams] = useState<LiveStream[]>(() => {
    try {
      const local = localStorage.getItem('movieflix_live_streams');
      if (local) return JSON.parse(local);
    } catch {
      // ignore
    }
    return INITIAL_LIVE_STREAMS;
  });

  const [notifications, setNotifications] = useState<LiveNotification[]>(() => {
    try {
      const local = localStorage.getItem('movieflix_notifications');
      if (local) return JSON.parse(local);
    } catch {
      // ignore
    }
    return [];
  });

  // Navigation & Modals
  const [currentTab, setCurrentTab] = useState<AdminMenuTab>('dashboard');
  const [isMovieFormOpen, setIsMovieFormOpen] = useState(false);
  const [movieToEdit, setMovieToEdit] = useState<Movie | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [movieToDelete, setMovieToDelete] = useState<Movie | null>(null);
  const [isApiSyncOpen, setIsApiSyncOpen] = useState(false);
  const [isPreviewWebsiteOpen, setIsPreviewWebsiteOpen] = useState(false);
  const [isLivePlayerOpen, setIsLivePlayerOpen] = useState(false);
  const [selectedLiveStream, setSelectedLiveStream] = useState<LiveStream | null>(null);
  const [isMovieCinemaOpen, setIsMovieCinemaOpen] = useState(false);
  const [selectedMovieForPlayback, setSelectedMovieForPlayback] = useState<Movie | null>(null);
  const [isEdgeOneStudioOpen, setIsEdgeOneStudioOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Persist stores
  useEffect(() => {
    localStorage.setItem('movieflix_movies', JSON.stringify(movies));
  }, [movies]);

  useEffect(() => {
    localStorage.setItem('freedom_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('freedom_genres', JSON.stringify(genres));
  }, [genres]);

  useEffect(() => {
    localStorage.setItem('freedom_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('freedom_payment_methods', JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  useEffect(() => {
    localStorage.setItem('movieflix_live_streams', JSON.stringify(liveStreams));
  }, [liveStreams]);

  useEffect(() => {
    localStorage.setItem('movieflix_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('movieflix_banners', JSON.stringify(banners));
  }, [banners]);

  const dashboardStats = useMemo(
    () =>
      computeDashboardStats({
        users,
        movies,
        categories,
        members,
      }),
    [users, movies, categories, members]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) return setIsCommandPaletteOpen(false);
        if (isShortcutsOpen) return setIsShortcutsOpen(false);
        if (isMovieFormOpen) setIsMovieFormOpen(false);
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
        if (isApiSyncOpen) setIsApiSyncOpen(false);
        if (isPreviewWebsiteOpen) setIsPreviewWebsiteOpen(false);
        if (isLivePlayerOpen) setIsLivePlayerOpen(false);
        if (isMovieCinemaOpen) setIsMovieCinemaOpen(false);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'k') {
          e.preventDefault();
          setIsCommandPaletteOpen((prev) => !prev);
        } else if (key === 'n') {
          e.preventDefault();
          setMovieToEdit(null);
          setIsMovieFormOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsOpen,
    isMovieFormOpen,
    isDeleteModalOpen,
    isApiSyncOpen,
    isPreviewWebsiteOpen,
    isLivePlayerOpen,
    isMovieCinemaOpen,
    toggleLanguage,
  ]);

  // Handlers
  const handleAddLiveStream = (stream: LiveStream) => {
    setLiveStreams([stream, ...liveStreams]);
    showToast(`เพิ่มสตรีมสด "${stream.title}" แล้ว`);
  };

  const handleUpdateLiveStream = (stream: LiveStream) => {
    setLiveStreams(liveStreams.map((s) => (s.id === stream.id ? stream : s)));
    showToast(`อัปเดตสตรีม "${stream.title}" แล้ว`);
  };

  const handleDeleteLiveStream = (id: string) => {
    setLiveStreams(liveStreams.filter((s) => s.id !== id));
    showToast('ลบรายการถ่ายทอดสดแล้ว');
  };

  const handlePlayLiveStream = (stream: LiveStream) => {
    setSelectedLiveStream(stream);
    setIsLivePlayerOpen(true);
  };

  const handlePlayMovie = (movie: Movie) => {
    setSelectedMovieForPlayback(movie);
    setIsMovieCinemaOpen(true);
  };

  const handleSendLiveNotification = (notification: LiveNotification) => {
    setNotifications([notification, ...notifications]);
    showToast(`ส่งการแจ้งเตือน "${notification.title}" สำเร็จ`);
  };

  const handleSwitchActiveUser = (userId: string) => {
    setActiveUserId(userId);
    const target = users.find((u) => u.id === userId);
    if (target) {
      if (!dualSessions.some((s) => s.id === target.id)) {
        setDualSessions((prev) => [target, ...prev.slice(0, 1)]);
      }
      showToast(`สลับไปยังบัญชี ${target.username}`);
    }
  };

  const handleToggleDualUser = () => {
    const nextUser = dualSessions.find((u) => u.id !== currentUser?.id) || INITIAL_USERS[0];
    setActiveUserId(nextUser.id);
    showToast(`สลับไปยังบัญชี ${nextUser.username}`);
  };

  const handleLogoutAll = () => {
    setDualSessions([]);
    localStorage.removeItem('freedom_dual_sessions');
    localStorage.removeItem('freedom_active_user_id');
    localStorage.removeItem('movieflix_user');
    sessionStorage.removeItem('movieflix_user');
  };

  const handleLoginSuccess = (user: User, isDualLogin?: boolean) => {
    if (isDualLogin) {
      setDualSessions([INITIAL_USERS[0], INITIAL_USERS[1]]);
      setActiveUserId(INITIAL_USERS[0].id);
    } else {
      setDualSessions([user]);
      setActiveUserId(user.id);
    }
    showToast(`เข้าสู่ระบบในฐานะ ${user.name}`);
  };

  const handleOpenAddMovieModal = () => {
    setMovieToEdit(null);
    setIsMovieFormOpen(true);
  };

  const handleOpenEditMovieModal = (movie: Movie) => {
    setMovieToEdit(movie);
    setIsMovieFormOpen(true);
  };

  const handleSaveMovie = (movieData: Partial<Movie>) => {
    if (movieToEdit) {
      const updated = movies.map((m) =>
        m.id === movieToEdit.id
          ? { ...m, ...movieData, updatedAt: new Date().toISOString() }
          : m
      );
      setMovies(deduplicateMovies(updated));
      showToast(`บันทึกการแก้ไข "${movieData.title}" แล้ว`);
    } else {
      const newMovie: Movie = {
        id: `movie-${Date.now()}`,
        title: movieData.title || 'ไม่มีชื่อภาพยนตร์',
        titleEn: movieData.titleEn,
        code: movieData.code || `#${Math.floor(1000 + Math.random() * 9000)}`,
        rating: movieData.rating || 7.5,
        year: movieData.year || new Date().getFullYear(),
        category: movieData.category || '',
        genres: movieData.genres || [],
        quality: movieData.quality || 'HD',
        views: 0,
        status: movieData.status || 'active',
        description: movieData.description || '',
        poster: movieData.poster || '',
        backdrop: movieData.backdrop || '',
        streamUrl: movieData.streamUrl || '',
        trailerUrl: movieData.trailerUrl,
        duration: movieData.duration || '',
        director: movieData.director || '',
        cast: movieData.cast || [],
        featured: movieData.featured,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMovies(deduplicateMovies([newMovie, ...movies]));
      showToast(`เพิ่มหนัง "${newMovie.title}" สำเร็จ`);
    }
    setIsMovieFormOpen(false);
  };

  const handleOpenDeleteModal = (movie: Movie) => {
    setMovieToDelete(movie);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (movieToDelete) {
      setMovies(movies.filter((m) => m.id !== movieToDelete.id));
      showToast(`ลบหนัง "${movieToDelete.title}" แล้ว`);
      setIsDeleteModalOpen(false);
      setMovieToDelete(null);
    }
  };

  const handleApiSyncComplete = (syncedMovies: Movie[]) => {
    const merged = deduplicateMovies([...syncedMovies, ...movies]);
    setMovies(merged);
    const withLinksCount = syncedMovies.filter((m) => Boolean(m.streamUrl)).length;
    showToast(
      language === 'th'
        ? withLinksCount > 0
          ? `นำเข้า ${syncedMovies.length} เรื่อง (พร้อมลิงก์วิดีโอ ${withLinksCount} เรื่อง)`
          : `นำเข้าซีรีส์/หนัง ${syncedMovies.length} รายการสำเร็จ`
        : `Imported ${syncedMovies.length} titles`
    );
  };

  const handleFetchMovieLinks = async (
    targetMovie: Movie,
    ep?: string
  ): Promise<Movie | null> => {
    try {
      const { movie: enriched, links } = await fetchAndAttachV2MovieLinks(targetMovie, {
        ep,
        maxEpisodes: 10,
      });
      setMovies((prev) =>
        deduplicateMovies(prev.map((m) => (m.id === enriched.id ? enriched : m)))
      );
      setSelectedMovieForPlayback((prev) => (prev?.id === enriched.id ? enriched : prev));
      showToast(`ดึงลิงก์วิดีโอ "${enriched.title}" สำเร็จ (${links.length} ตอน)`);
      return enriched;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`ดึงลิงก์ไม่สำเร็จ: ${msg}`);
      throw err;
    }
  };

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onGoToPublicSite={() => setIsPreviewWebsiteOpen(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans flex flex-col selection:bg-[#0D6EFD] selection:text-white">
      {/* Top Navigation Bar with Hamburger Dropdown & Logout */}
      <StudioTopNav
        currentTab={currentTab}
        currentUser={currentUser}
        onSelectTab={setCurrentTab}
        onOpenApiSync={() => setIsApiSyncOpen(true)}
        onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
        onLogout={handleLogoutAll}
      />

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            stats={dashboardStats}
            movies={movies}
            onAddMovie={handleOpenAddMovieModal}
            onEditMovie={handleOpenEditMovieModal}
            onDeleteMovie={handleOpenDeleteModal}
            onPlayMovie={handlePlayMovie}
            onNavigateTab={setCurrentTab}
            onOpenApiSync={() => setIsApiSyncOpen(true)}
            onFetchMovieLinks={handleFetchMovieLinks}
          />
        )}

        {currentTab === 'movies' && (
          <MoviesManagement
            movies={movies}
            onAddMovie={handleOpenAddMovieModal}
            onEditMovie={handleOpenEditMovieModal}
            onDeleteMovie={handleOpenDeleteModal}
            onOpenApiSync={() => setIsApiSyncOpen(true)}
            onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
            onPlayMovie={handlePlayMovie}
            onFetchMovieLinks={handleFetchMovieLinks}
          />
        )}

        {(currentTab === 'categories' || currentTab === 'genres') && (
          <CategoriesManagement
            categories={categories}
            genres={genres}
            onUpdateCategories={setCategories}
            onUpdateGenres={setGenres}
          />
        )}

        {currentTab === 'members' && (
          <MembersManagement members={members} onUpdateMembers={setMembers} />
        )}

        {currentTab === 'payments' && (
          <PaymentsManagement
            methods={paymentMethods}
            onUpdateMethods={setPaymentMethods}
          />
        )}

        {(currentTab === 'admins' || currentTab === 'users') && (
          <UsersManagement
            users={users}
            currentUser={currentUser}
            dualSessions={dualSessions}
            onUpdateUsers={setUsers}
            onSwitchUser={(u) => handleSwitchActiveUser(u.id)}
            onToggleDualUser={handleToggleDualUser}
            onSetDualSessions={setDualSessions}
          />
        )}

        {(currentTab === 'home-banners' || currentTab === 'banner-templates') && (
          <BannersManagement
            banners={banners}
            onUpdateBanners={setBanners}
            onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
          />
        )}

        {(currentTab === 'settings' ||
          currentTab === 'seo' ||
          currentTab === 'faqs' ||
          currentTab === 'video-ads' ||
          currentTab === 'header-menu' ||
          currentTab === 'footer-menu') && (
          <SettingsManagement
            initialTab={currentTab}
            settings={settings}
            seo={seo}
            faqs={faqs}
            videoAds={videoAds}
            onUpdateSettings={setSettings}
            onUpdateSeo={setSeo}
            onUpdateFaqs={setFaqs}
            onUpdateVideoAds={setVideoAds}
          />
        )}

        {currentTab === 'media-library' && <MediaLibrary />}

        {currentTab === 'live-streams' && (
          <LiveStreamManagement
            streams={liveStreams}
            onAddStream={handleAddLiveStream}
            onUpdateStream={handleUpdateLiveStream}
            onDeleteStream={handleDeleteLiveStream}
            onOpenPlayer={handlePlayLiveStream}
            onSendNotification={handleSendLiveNotification}
          />
        )}
      </main>

      {/* Clean Light Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-white text-[#212529] px-4 py-3 rounded-xl border border-slate-200 shadow-lg flex items-center gap-2.5 text-sm fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        movies={movies}
        onSelectTab={setCurrentTab}
        onOpenAddMovie={handleOpenAddMovieModal}
        onOpenPreview={() => setIsPreviewWebsiteOpen(true)}
        onOpenApiSync={() => setIsApiSyncOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onToggleDualUser={handleToggleDualUser}
        onPlayMovie={handlePlayMovie}
        onToggleSidebar={() => {}}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <MovieFormModal
        isOpen={isMovieFormOpen}
        onClose={() => setIsMovieFormOpen(false)}
        onSave={handleSaveMovie}
        movieToEdit={movieToEdit}
        availableCategories={categories.map((c) => c.name)}
        availableGenres={genres.map((g) => g.name)}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        movie={movieToDelete}
      />

      <ApiSyncModal
        isOpen={isApiSyncOpen}
        onClose={() => setIsApiSyncOpen(false)}
        onSyncComplete={handleApiSyncComplete}
      />

      <MovieCinemaPlayerModal
        isOpen={isMovieCinemaOpen}
        onClose={() => {
          setIsMovieCinemaOpen(false);
          setSelectedMovieForPlayback(null);
        }}
        movie={selectedMovieForPlayback}
        allMovies={movies}
        onSelectOtherMovie={(m) => setSelectedMovieForPlayback(m)}
        onFetchMovieLinks={handleFetchMovieLinks}
      />

      <LiveStreamPlayerModal
        isOpen={isLivePlayerOpen}
        onClose={() => {
          setIsLivePlayerOpen(false);
          setSelectedLiveStream(null);
        }}
        stream={selectedLiveStream}
        otherStreams={liveStreams}
        onSelectOtherStream={(stream) => setSelectedLiveStream(stream)}
      />

      <PreviewWebsiteModal
        isOpen={isPreviewWebsiteOpen}
        onClose={() => setIsPreviewWebsiteOpen(false)}
        movies={movies}
        banners={banners}
        liveStreams={liveStreams}
        notifications={notifications}
      />

      <EdgeOneHlsStudio
        isOpen={isEdgeOneStudioOpen}
        onClose={() => setIsEdgeOneStudioOpen(false)}
      />
    </div>
  );
}
