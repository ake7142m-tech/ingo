import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  X,
  Globe,
  Film,
  Database,
  Search,
  Key,
  ShieldCheck,
  Tv,
  Activity,
  Check,
  AlertTriangle,
  Lock,
  ArrowUpDown,
  Link2,
} from 'lucide-react';
import { Movie } from '../types';
import {
  SERIES_JEEN_BASE_URL,
  getStoredSeriesJeenKey,
  setStoredSeriesJeenKey,
  validateSeriesJeenKey,
  checkApiHealth,
  fetchPlatformsV2,
  fetchPlatformDramasV2,
  fetchAndAttachV2MovieLinks,
  transformAndDedupeDramas,
  SeriesJeenHealth,
  SeriesJeenPlatformItem,
  SeriesJeenMeAccess,
  SeriesJeenUserProfile,
  V2DramaSort,
} from '../services/seriesJeenService';
import { deduplicateByKey } from '../utils/movieDedupe';
import { useLanguage } from '../context/LanguageContext';
import { realApiEventService } from '../services/realApiEventService';

interface ApiSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: (newMovies: Movie[]) => void;
}

export const ApiSyncModal: React.FC<ApiSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const { language: appLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'browse' | 'search' | 'auth'>('browse');
  const [apiKey, setApiKey] = useState(getStoredSeriesJeenKey());

  // V2 Server health (no auth required)
  const [serverHealth, setServerHealth] = useState<SeriesJeenHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // V2 Platforms from GET /api/platforms
  const [platforms, setPlatforms] = useState<SeriesJeenPlatformItem[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'access'>('all');
  const [selectedPlatformId, setSelectedPlatformId] = useState<number | null>(null);

  // V2 Dramas list pagination, sorting, filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState<V2DramaSort>('latest');
  const [genreFilter, setGenreFilter] = useState('');
  const pageSize = 20;

  // V2 Auth status (/api/me)
  const [authStatus, setAuthStatus] = useState<{
    tested: boolean;
    valid: boolean;
    message: string;
    code: number;
    profile?: SeriesJeenUserProfile;
  }>({
    tested: false,
    valid: false,
    message: '',
    code: 0,
  });

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchLinksOnImport, setFetchLinksOnImport] = useState(true);
  const [episodesBatchSize, setEpisodesBatchSize] = useState<number>(10);
  const [importStatusText, setImportStatusText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchedMovies, setFetchedMovies] = useState<Movie[]>([]);
  const [selectedMovieIds, setSelectedMovieIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === selectedPlatformId) || null,
    [platforms, selectedPlatformId]
  );

  const filteredPlatforms = useMemo(() => {
    const unique = deduplicateByKey<SeriesJeenPlatformItem>(platforms, (p) => p.id);
    if (platformFilter === 'access') {
      return unique.filter((p) => p.has_access);
    }
    return unique;
  }, [platforms, platformFilter]);

  // Initial load on modal open
  useEffect(() => {
    if (!isOpen) return;
    const stored = getStoredSeriesJeenKey();
    setApiKey(stored);
    setSyncing(false);
    setIsCompleted(false);
    setErrorMessage(null);
    loadServerHealth();
    if (stored) {
      bootstrapV2Catalog(stored);
    } else {
      setPlatforms([]);
      setFetchedMovies([]);
      setSelectedMovieIds([]);
      setSelectedPlatformId(null);
    }
  }, [isOpen]);

  const loadServerHealth = async () => {
    setLoadingHealth(true);
    try {
      const health = await checkApiHealth();
      setServerHealth(health);
    } catch {
      setServerHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  const loadDramasForPlatform = async (
    platformId: number,
    platformName: string,
    targetPage: number = 1,
    options: { q?: string; genre?: string; sort?: V2DramaSort; keyToUse?: string } = {}
  ) => {
    const token = options.keyToUse !== undefined ? options.keyToUse : apiKey;
    const activeSort = options.sort ?? sortBy;
    const activeGenre = options.genre !== undefined ? options.genre : genreFilter;

    setSelectedPlatformId(platformId);
    setPage(targetPage);
    setLoading(true);
    setErrorMessage(null);

    const start = performance.now();
    try {
      const res = await fetchPlatformDramasV2(
        platformId,
        {
          page: targetPage,
          page_size: pageSize,
          q: options.q,
          genre: activeGenre || undefined,
          sort: activeSort,
        },
        token
      );

      const latency = Math.round(performance.now() - start);
      const converted = transformAndDedupeDramas(res.items, platformName);
      setFetchedMovies(converted);
      setSelectedMovieIds(converted.map((m) => m.id));
      setTotalItems(res.total);
      setTotalPages(Math.max(1, res.total_pages || 1));

      realApiEventService.recordApiQuery(
        `${SERIES_JEEN_BASE_URL}/api/platforms/${platformId}/dramas?page=${targetPage}&page_size=${pageSize}`,
        'GET',
        200,
        latency,
        converted.length * 1400,
        `Loaded ${converted.length} V2 dramas from ${platformName}.`
      );
    } catch (err: unknown) {
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setFetchedMovies([]);
      setSelectedMovieIds([]);
      setTotalItems(0);
      setTotalPages(1);

      realApiEventService.recordApiQuery(
        `${SERIES_JEEN_BASE_URL}/api/platforms/${platformId}/dramas`,
        'GET',
        msg.includes('401') ? 401 : 500,
        latency,
        200,
        `Series Jeen API V2 error: ${msg}`
      );
    } finally {
      setLoading(false);
    }
  };

  const bootstrapV2Catalog = async (tokenToUse: string) => {
    setLoadingPlatforms(true);
    setErrorMessage(null);
    const start = performance.now();
    try {
      const res = await fetchPlatformsV2(tokenToUse);
      const uniquePlatforms = deduplicateByKey(res.items, (p) => p.id);
      setPlatforms(uniquePlatforms);

      const latency = Math.round(performance.now() - start);
      realApiEventService.recordApiQuery(
        `${SERIES_JEEN_BASE_URL}/api/platforms`,
        'GET',
        200,
        latency,
        uniquePlatforms.length * 250,
        `Loaded ${uniquePlatforms.length} V2 platforms.`
      );

      const preferred =
        uniquePlatforms.find((p) => p.has_access && p.drama_count > 0) ||
        uniquePlatforms.find((p) => p.has_access) ||
        uniquePlatforms[0];

      if (preferred) {
        await loadDramasForPlatform(preferred.id, preferred.name, 1, { keyToUse: tokenToUse });
      } else {
        setFetchedMovies([]);
        setSelectedMovieIds([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setPlatforms([]);
      setFetchedMovies([]);
      setSelectedMovieIds([]);
    } finally {
      setLoadingPlatforms(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (!apiKey.trim()) {
      setActiveTab('auth');
      setErrorMessage('กรุณากรอก API Key เพื่อค้นหาใน Series Jeen API V2');
      return;
    }

    const targetPlatform = selectedPlatform || platforms[0];
    if (!targetPlatform) {
      await bootstrapV2Catalog(apiKey);
      return;
    }

    await loadDramasForPlatform(targetPlatform.id, targetPlatform.name, 1, {
      q: searchQuery.trim(),
    });
  };

  const handleTestApiKey = async () => {
    setLoading(true);
    setErrorMessage(null);
    const start = performance.now();
    const result = await validateSeriesJeenKey(apiKey);
    const latency = Math.round(performance.now() - start);

    setAuthStatus({
      tested: true,
      valid: result.success,
      message: result.message,
      code: result.statusCode,
      profile: result.profile,
    });

    realApiEventService.recordApiQuery(
      `${SERIES_JEEN_BASE_URL}/api/me`,
      'GET',
      result.statusCode,
      latency,
      1200,
      `API V2 Key validation: ${result.message}`
    );

    if (result.success) {
      setStoredSeriesJeenKey(apiKey);
      await bootstrapV2Catalog(apiKey);
    }

    setLoading(false);
  };

  const handleToggleSelectMovie = (id: string) => {
    setSelectedMovieIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedMovieIds.length === fetchedMovies.length) {
      setSelectedMovieIds([]);
    } else {
      setSelectedMovieIds(fetchedMovies.map((m) => m.id));
    }
  };

  const handleStartImport = async () => {
    const selectedSet = new Set(selectedMovieIds);
    const toImport = fetchedMovies.filter((m) => selectedSet.has(m.id));
    if (toImport.length === 0) return;

    setSyncing(true);
    setIsCompleted(false);
    setErrorMessage(null);

    const enrichedMovies: Movie[] = [];
    let linkedCount = 0;
    let firstLinkError: string | null = null;

    for (let i = 0; i < toImport.length; i++) {
      const movie = toImport[i];
      if (fetchLinksOnImport && movie.v2DramaId) {
        setImportStatusText(
          `กำลังดึงลิงก์วิดีโอ (${i + 1}/${toImport.length}): ${movie.title}`
        );
        try {
          const { movie: withLinks } = await fetchAndAttachV2MovieLinks(movie, {
            maxEpisodes: episodesBatchSize,
            apiKey,
          });
          enrichedMovies.push(withLinks);
          linkedCount++;
        } catch (err: unknown) {
          if (!firstLinkError) {
            firstLinkError = err instanceof Error ? err.message : String(err);
          }
          enrichedMovies.push(movie);
        }
      } else {
        setImportStatusText(`กำลังนำเข้า (${i + 1}/${toImport.length})...`);
        enrichedMovies.push(movie);
      }
    }

    setSyncing(false);
    setIsCompleted(true);
    setImportStatusText(
      fetchLinksOnImport
        ? `นำเข้า ${enrichedMovies.length} เรื่องแล้ว (ได้ลิงก์วิดีโอ ${linkedCount} เรื่อง)`
        : `นำเข้า ${enrichedMovies.length} เรื่องเรียบร้อยแล้ว`
    );
    if (firstLinkError && linkedCount < toImport.length) {
      setErrorMessage(`บางรายการดึงลิงก์วิดีโอไม่สำเร็จ: ${firstLinkError}`);
    }

    realApiEventService.recordApiQuery(
      `${SERIES_JEEN_BASE_URL}/api/dramas/episodes`,
      'GET',
      200,
      120,
      enrichedMovies.length * 2400,
      `Imported ${enrichedMovies.length} V2 titles (${linkedCount} with direct CDN video links).`
    );

    onSyncComplete(enrichedMovies);
  };

  if (!isOpen) return null;

  const hasKey = apiKey.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="นำเข้าซีรีส์จาก API V2"
    >
      <div className="bg-white border border-slate-200 w-full max-w-5xl rounded-xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0D6EFD]/10 text-[#0D6EFD] flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#212529] truncate">
                  {appLanguage === 'th' ? 'นำเข้าซีรีส์จาก API V2' : 'Import Series from API V2'}
                </h2>
                <span className="bg-slate-100 text-[#495057] text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200">
                  api-v2.seriesjeen.online
                </span>
                {serverHealth?.status === 'ok' && (
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-200">
                    v{serverHealth.version} ออนไลน์
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6C757D] mt-0.5 truncate">
                {appLanguage === 'th'
                  ? 'เชื่อมต่อ Series Jeen API V2 — รายการ ค้นหา และรายละเอียดไม่กินโควตา'
                  : 'Connected to Series Jeen API V2 — catalog, search & details consume zero quota'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างนำเข้าซีรีส์"
            className="p-2 hover:bg-slate-100 rounded-lg text-[#6C757D] hover:text-[#212529] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-slate-200 bg-[#F8F9FA] flex items-center justify-between overflow-x-auto">
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'browse'
                  ? 'border-[#0D6EFD] text-[#0D6EFD] bg-white'
                  : 'border-transparent text-[#6C757D] hover:text-[#212529]'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>{appLanguage === 'th' ? 'แพลตฟอร์มและรายการ' : 'Platforms & Catalog'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'search'
                  ? 'border-[#0D6EFD] text-[#0D6EFD] bg-white'
                  : 'border-transparent text-[#6C757D] hover:text-[#212529]'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>{appLanguage === 'th' ? 'ค้นหาชื่อเรื่อง' : 'Search API V2'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'auth'
                  ? 'border-[#0D6EFD] text-[#0D6EFD] bg-white'
                  : 'border-transparent text-[#6C757D] hover:text-[#212529]'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>{appLanguage === 'th' ? 'ตั้งค่า API Key' : 'API Key & Quota'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#F8F9FA]">
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3.5 py-2.5 text-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              {activeTab !== 'auth' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('auth')}
                  className="text-[#0D6EFD] font-semibold hover:underline shrink-0 cursor-pointer"
                >
                  ตั้งค่า API Key
                </button>
              )}
            </div>
          )}

          {/* TAB 1: BROWSE PLATFORMS */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {!hasKey ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3 shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-[#0D6EFD]/10 text-[#0D6EFD] flex items-center justify-center mx-auto">
                    <Key className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#212529]">
                    เชื่อมต่อด้วย Series Jeen API Key (V2)
                  </h3>
                  <p className="text-xs text-[#6C757D] max-w-md mx-auto leading-relaxed">
                    Series Jeen API V2 ใช้ API Key เดิมหรือคีย์ย่อยในรูปแบบ Bearer Token
                    การดึงรายชื่อแพลตฟอร์ม รายการเรื่อง ค้นหา และรายละเอียดไม่กินโควตาต่อวัน
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('auth')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>กรอก API Key เพื่อเริ่มดึงข้อมูล</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Platform Selector */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <label className="block text-xs font-semibold text-[#212529]">
                        {appLanguage === 'th'
                          ? `แพลตฟอร์มใน API V2 (${platforms.length} แพลตฟอร์ม)`
                          : `V2 Platforms (${platforms.length})`}
                      </label>

                      <div className="flex items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setPlatformFilter('all')}
                          className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer border ${
                            platformFilter === 'all'
                              ? 'bg-[#0D6EFD] text-white border-[#0D6EFD]'
                              : 'bg-white text-[#6C757D] hover:text-[#212529] border-slate-200'
                          }`}
                        >
                          ทั้งหมด ({platforms.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlatformFilter('access')}
                          className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer border ${
                            platformFilter === 'access'
                              ? 'bg-[#0D6EFD] text-white border-[#0D6EFD]'
                              : 'bg-white text-[#6C757D] hover:text-[#212529] border-slate-200'
                          }`}
                        >
                          ที่มีสิทธิ์ใช้งาน ({platforms.filter((p) => p.has_access).length})
                        </button>
                      </div>
                    </div>

                    {loadingPlatforms ? (
                      <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#6C757D]">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#0D6EFD]" />
                        <span>กำลังโหลดรายชื่อแพลตฟอร์มจาก API V2...</span>
                      </div>
                    ) : filteredPlatforms.length === 0 ? (
                      <div className="py-5 text-center text-xs text-[#6C757D]">
                        ไม่พบแพลตฟอร์มที่ตรงกับตัวกรอง
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-0.5">
                        {filteredPlatforms.map((plat) => {
                          const isSelected = selectedPlatformId === plat.id;
                          return (
                            <button
                              key={plat.id}
                              type="button"
                              onClick={() => loadDramasForPlatform(plat.id, plat.name, 1)}
                              className={`px-3 py-2 rounded-lg text-xs text-left border transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#0D6EFD] text-white border-[#0D6EFD] shadow-xs'
                                  : 'bg-[#F8F9FA] text-[#212529] border-slate-200 hover:border-[#0D6EFD]/50 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold truncate">{plat.name}</span>
                                {!plat.has_access && (
                                  <Lock
                                    className={`w-3 h-3 shrink-0 ${
                                      isSelected ? 'text-white/80' : 'text-slate-400'
                                    }`}
                                  />
                                )}
                              </div>
                              <div
                                className={`text-[10px] flex items-center justify-between ${
                                  isSelected ? 'text-white/85' : 'text-[#6C757D]'
                                }`}
                              >
                                <span>{plat.drama_count.toLocaleString('en-US')} เรื่อง</span>
                                {plat.has_access && (
                                  <span
                                    className={`px-1 py-0.2 rounded font-medium ${
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    พร้อมใช้
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Controls bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPlatform) {
                            loadDramasForPlatform(selectedPlatform.id, selectedPlatform.name, page);
                          } else {
                            bootstrapV2Catalog(apiKey);
                          }
                        }}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-[#212529] border border-slate-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>{appLanguage === 'th' ? 'รีเฟรช' : 'Refresh'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#6C757D]" />
                        <select
                          aria-label="เรียงลำดับซีรีส์"
                          value={sortBy}
                          onChange={(e) => {
                            const nextSort = e.target.value as V2DramaSort;
                            setSortBy(nextSort);
                            if (selectedPlatform) {
                              loadDramasForPlatform(selectedPlatform.id, selectedPlatform.name, 1, {
                                sort: nextSort,
                              });
                            }
                          }}
                          className="bg-white border border-slate-300 rounded-lg text-xs px-2.5 py-1.5 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                        >
                          <option value="latest">อัปเดตล่าสุด</option>
                          <option value="title">เรียงตามชื่อเรื่อง</option>
                          <option value="episodes">จำนวนตอนมากสุด</option>
                        </select>
                      </div>

                      <div className="text-xs text-[#6C757D] ml-1">
                        หน้า <span className="text-[#212529] font-semibold">{page}</span> /{' '}
                        {totalPages}
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPlatform && page > 1) {
                              loadDramasForPlatform(selectedPlatform.id, selectedPlatform.name, page - 1);
                            }
                          }}
                          disabled={page <= 1 || loading || !selectedPlatform}
                          aria-label="หน้าก่อนหน้า"
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#212529] border border-slate-200 rounded text-xs disabled:opacity-40 cursor-pointer"
                        >
                          &larr;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPlatform && page < totalPages) {
                              loadDramasForPlatform(selectedPlatform.id, selectedPlatform.name, page + 1);
                            }
                          }}
                          disabled={loading || page >= totalPages || !selectedPlatform}
                          aria-label="หน้าถัดไป"
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#212529] border border-slate-200 rounded text-xs disabled:opacity-40 cursor-pointer"
                        >
                          &rarr;
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#6C757D]">
                        แสดง {fetchedMovies.length} จาก {totalItems.toLocaleString('en-US')} เรื่อง
                        (เลือก {selectedMovieIds.length})
                      </span>
                      {fetchedMovies.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-xs text-[#0D6EFD] hover:underline font-medium cursor-pointer"
                        >
                          {selectedMovieIds.length === fetchedMovies.length
                            ? 'ยกเลิกทั้งหมด'
                            : 'เลือกทั้งหมด'}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: SEARCH V2 */}
          {activeTab === 'search' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6C757D]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="พิมพ์ชื่อเรื่อง (q) เพื่อค้นหาใน Series Jeen API V2..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-[#212529] text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
                  />
                </div>
                <input
                  type="text"
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  placeholder="แนว (ไม่บังคับ)"
                  className="sm:w-36 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
                />
                {platforms.length > 0 && (
                  <select
                    aria-label="เลือกแพลตฟอร์มสำหรับค้นหา"
                    value={selectedPlatformId ?? platforms[0].id}
                    onChange={(e) => setSelectedPlatformId(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg text-xs px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  >
                    {deduplicateByKey<SeriesJeenPlatformItem>(platforms, (p) => p.id).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.drama_count})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>ค้นหา</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: API KEY & V2 QUOTA / HEALTH */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#0D6EFD]" />
                    <h3 className="text-sm font-bold text-[#212529]">
                      Series Jeen API V2 Key (Bearer Token)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#6C757D]">
                    api-v2.seriesjeen.online/api/me
                  </span>
                </div>

                <p className="text-xs text-[#6C757D] leading-relaxed">
                  ใช้ API Key เดิมหรือคีย์ย่อย (Sub-key) ใน header <code className="font-mono text-[#212529]">Authorization: Bearer &lt;key&gt;</code> —
                  เส้นรายการ ค้นหา รายละเอียด และ <code className="font-mono text-[#212529]">/api/me</code> ไม่กินโควตาและไม่นับ IP
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="วาง Series Jeen API Key หรือ Sub-key ของคุณที่นี่..."
                    className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-[#212529] text-xs font-mono focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
                  />
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={loading || !apiKey.trim()}
                    className="px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>ตรวจสอบสิทธิ์ V2</span>
                  </button>
                </div>

                {authStatus.tested && (
                  <div
                    className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                      authStatus.valid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {authStatus.valid ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    )}
                    <div className="space-y-1.5 flex-1">
                      <div className="font-semibold">{authStatus.message}</div>
                      {authStatus.profile && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div className="bg-white/80 rounded-md p-2 border border-emerald-200/70">
                            <div className="text-[10px] text-[#6C757D]">โควตา V2 วันนี้</div>
                            <div className="font-mono font-bold text-[#212529]">
                              {authStatus.profile.daily_quota
                                ? `${authStatus.profile.daily_quota.remaining.toLocaleString('en-US')} / ${authStatus.profile.daily_quota.limit.toLocaleString('en-US')}`
                                : 'พร้อมใช้งาน'}
                            </div>
                          </div>
                          <div className="bg-white/80 rounded-md p-2 border border-emerald-200/70">
                            <div className="text-[10px] text-[#6C757D]">IP วันนี้</div>
                            <div className="font-mono font-bold text-[#212529]">
                              {authStatus.profile.daily_ip
                                ? `${authStatus.profile.daily_ip.used} / ${authStatus.profile.daily_ip.limit}`
                                : '-'}
                            </div>
                          </div>
                          <div className="bg-white/80 rounded-md p-2 border border-emerald-200/70">
                            <div className="text-[10px] text-[#6C757D]">Rate Limit</div>
                            <div className="font-mono font-bold text-[#212529]">
                              {authStatus.profile.limits?.rate_limit_per_minute
                                ? `${authStatus.profile.limits.rate_limit_per_minute} req/นาที`
                                : authStatus.profile.key?.type || '-'}
                            </div>
                          </div>
                        </div>
                      )}
                      {authStatus.profile?.access && authStatus.profile.access.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1.5">
                          {deduplicateByKey<SeriesJeenMeAccess>(authStatus.profile.access, (a) => a.platform_id).map((acc) => (
                            <span
                              key={acc.platform_id}
                              className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-[11px] text-[#212529]"
                            >
                              {acc.platform_name} (เหลือ {acc.days_remaining} วัน)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* V2 Server Health Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0D6EFD]" />
                    <h3 className="text-sm font-bold text-[#212529]">
                      สถานะเซิร์ฟเวอร์ API V2 (/health)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={loadServerHealth}
                    disabled={loadingHealth}
                    className="text-xs text-[#0D6EFD] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingHealth ? 'animate-spin' : ''}`} />
                    <span>ตรวจสอบใหม่</span>
                  </button>
                </div>

                {serverHealth ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 bg-[#F8F9FA] border border-slate-200 rounded-lg">
                      <div className="text-[11px] text-[#6C757D]">สถานะระบบ</div>
                      <div className="font-semibold text-emerald-700 mt-0.5 uppercase">
                        {serverHealth.status} (v{serverHealth.version})
                      </div>
                    </div>
                    <div className="p-3 bg-[#F8F9FA] border border-slate-200 rounded-lg">
                      <div className="text-[11px] text-[#6C757D]">ฐานข้อมูล</div>
                      <div className="font-semibold text-[#212529] mt-0.5">
                        {serverHealth.db?.connected ? 'เชื่อมต่อปกติ' : 'ไม่พร้อมใช้งาน'}
                      </div>
                    </div>
                    <div className="p-3 bg-[#F8F9FA] border border-slate-200 rounded-lg">
                      <div className="text-[11px] text-[#6C757D]">แพลตฟอร์มที่โหลด</div>
                      <div className="font-semibold text-[#212529] mt-0.5">
                        {platforms.length > 0 ? `${platforms.length} แพลตฟอร์ม` : 'รอยืนยัน API Key'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#6C757D]">
                    {loadingHealth ? 'กำลังตรวจสอบสถานะเซิร์ฟเวอร์...' : 'ไม่สามารถติดต่อ /health ได้'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* DRAMA CARDS GRID */}
          {activeTab !== 'auth' && hasKey && (
            <div>
              {loading ? (
                <div className="py-16 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-7 h-7 text-[#0D6EFD] animate-spin" />
                  <p className="text-sm text-[#6C757D] font-medium">
                    กำลังดึงข้อมูลจาก Series Jeen API V2...
                  </p>
                </div>
              ) : fetchedMovies.length === 0 ? (
                <div className="py-14 bg-white text-center text-[#6C757D] space-y-2 border border-slate-200 rounded-xl p-8">
                  <Tv className="w-9 h-9 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-[#212529]">
                    ยังไม่มีรายการซีรีส์ที่ดึงมา
                  </p>
                  <p className="text-xs text-[#6C757D] max-w-md mx-auto">
                    เลือกแพลตฟอร์มที่มีสิทธิ์ใช้งาน หรือตรวจสอบ API Key ในแท็บ &quot;ตั้งค่า API Key&quot;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {fetchedMovies.map((movie) => {
                    const isSelected = selectedMovieIds.includes(movie.id);
                    return (
                      <button
                        type="button"
                        key={movie.id}
                        onClick={() => handleToggleSelectMovie(movie.id)}
                        className={`group text-left relative rounded-xl overflow-hidden border cursor-pointer transition-all bg-white ${
                          isSelected
                            ? 'border-[#0D6EFD] ring-2 ring-[#0D6EFD]/25'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Poster */}
                        <div className="aspect-[2/3] w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
                          {movie.poster ? (
                            <img
                              src={movie.poster}
                              alt={movie.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Film className="w-8 h-8 text-slate-300" />
                          )}

                          {/* Checkbox overlay */}
                          <div className="absolute top-2 right-2 z-10">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#0D6EFD] text-white shadow-xs'
                                  : 'bg-white/90 text-transparent border border-slate-300'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>

                          {/* Episode / Audio badge */}
                          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                            <span className="bg-slate-900/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              {movie.duration || 'พร้อมดู'}
                            </span>
                            <span className="bg-[#0D6EFD] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              {movie.category}
                            </span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-2.5 space-y-1">
                          <h4 className="text-xs font-semibold text-[#212529] line-clamp-1">
                            {movie.title}
                          </h4>
                          <p className="text-[11px] text-[#6C757D] line-clamp-2">
                            {movie.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white space-y-2.5">
          {hasKey && activeTab !== 'auth' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
              <label className="inline-flex items-center gap-2 text-[#212529] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fetchLinksOnImport}
                  onChange={(e) => setFetchLinksOnImport(e.target.checked)}
                  disabled={syncing}
                  className="w-4 h-4 rounded border-slate-300 text-[#0D6EFD] focus:ring-[#0D6EFD]"
                />
                <Link2 className="w-3.5 h-3.5 text-[#0D6EFD]" />
                <span>ดึงลิงก์วิดีโอ CDN พร้อมซับอัตโนมัติขณะนำเข้า</span>
              </label>

              {fetchLinksOnImport && (
                <div className="flex items-center gap-2 text-[11px] text-[#6C757D]">
                  <span>จำนวนตอนต่อเรื่อง:</span>
                  <select
                    aria-label="จำนวนตอนที่จะดึงลิงก์วิดีโอ"
                    value={episodesBatchSize}
                    onChange={(e) => setEpisodesBatchSize(Number(e.target.value))}
                    disabled={syncing}
                    className="bg-[#F8F9FA] border border-slate-300 rounded-md px-2 py-1 text-xs text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  >
                    <option value={1}>ตอนที่ 1 (1 โควตา/เรื่อง)</option>
                    <option value={10}>ตอนที่ 1–10 (1 โควตา/เรื่อง)</option>
                    <option value={20}>ตอนที่ 1–20 (1 โควตา/เรื่อง)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#6C757D]">
              {syncing ? (
                <span className="text-[#0D6EFD] font-medium">{importStatusText || 'กำลังนำเข้า...'}</span>
              ) : isCompleted ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {importStatusText || 'นำเข้าข้อมูลเข้าสู่คลังหนังเสร็จสิ้นแล้ว'}
                </span>
              ) : (
                <span>
                  พร้อมนำเข้า: <strong className="text-[#212529]">{selectedMovieIds.length}</strong>{' '}
                  เรื่อง
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-[#495057] border border-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              <button
                type="button"
                onClick={handleStartImport}
                disabled={syncing || selectedMovieIds.length === 0}
                className="px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-45 flex items-center gap-2 cursor-pointer"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังดึงลิงก์และนำเข้า...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>
                      {fetchLinksOnImport
                        ? `นำเข้า ${selectedMovieIds.length} เรื่องพร้อมลิงก์`
                        : `นำเข้า ${selectedMovieIds.length} เรื่องสู่คลัง`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
