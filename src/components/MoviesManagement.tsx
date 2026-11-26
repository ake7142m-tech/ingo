import React, { useState, useMemo } from 'react';
import {
  Search,
  CloudDownload,
  Plus,
  Star,
  Pencil,
  Trash2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Film,
  Play,
  RotateCcw,
  Link2,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Movie } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { getMovieLinkCount } from '../utils/movieLinks';

interface MoviesManagementProps {
  movies: Movie[];
  onAddMovie: () => void;
  onEditMovie: (movie: Movie) => void;
  onDeleteMovie: (movie: Movie) => void;
  onOpenApiSync: () => void;
  onOpenPreview: () => void;
  onPlayMovie?: (movie: Movie) => void;
  onFetchMovieLinks?: (movie: Movie) => Promise<Movie | null>;
}

type SortOption = 'latest' | 'rating-desc' | 'rating-asc' | 'year-desc' | 'year-asc' | 'title-az';

export const MoviesManagement: React.FC<MoviesManagementProps> = ({
  movies,
  onAddMovie,
  onEditMovie,
  onDeleteMovie,
  onOpenApiSync,
  onPlayMovie,
  onFetchMovieLinks,
}) => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuality, setSelectedQuality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  const handleCopyStreamUrl = (movie: Movie) => {
    if (!movie.streamUrl) return;
    navigator.clipboard?.writeText(movie.streamUrl).catch(() => {});
    setCopiedId(movie.id);
    setTimeout(() => setCopiedId((prev) => (prev === movie.id ? null : prev)), 2000);
  };

  const handleFetchLinks = async (movie: Movie) => {
    if (!onFetchMovieLinks || fetchingId) return;
    setFetchingId(movie.id);
    try {
      await onFetchMovieLinks(movie);
    } finally {
      setFetchingId(null);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(movies.map((m) => m.category).filter(Boolean));
    return Array.from(set);
  }, [movies]);

  const years = useMemo(() => {
    const set = new Set<number>(movies.map((m) => m.year));
    return Array.from(set).sort((a: number, b: number) => b - a);
  }, [movies]);

  const filteredMovies = useMemo(() => {
    return movies
      .filter((movie) => {
        const matchesSearch =
          movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (movie.titleEn && movie.titleEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
          movie.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          movie.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory =
          selectedCategory === 'all' || movie.category === selectedCategory;

        const matchesYear =
          selectedYear === 'all' || movie.year.toString() === selectedYear;

        const matchesQuality =
          selectedQuality === 'all' || movie.quality === selectedQuality;

        return matchesSearch && matchesCategory && matchesYear && matchesQuality;
      })
      .sort((a, b) => {
        if (sortBy === 'latest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'rating-desc') return b.rating - a.rating;
        if (sortBy === 'rating-asc') return a.rating - b.rating;
        if (sortBy === 'year-desc') return b.year - a.year;
        if (sortBy === 'year-asc') return a.year - b.year;
        if (sortBy === 'title-az') {
          const titleA = language === 'en' && a.titleEn ? a.titleEn : a.title;
          const titleB = language === 'en' && b.titleEn ? b.titleEn : b.title;
          return titleA.localeCompare(titleB, language === 'en' ? 'en' : 'th');
        }
        return 0;
      });
  }, [movies, searchQuery, selectedCategory, selectedYear, selectedQuality, sortBy, language]);

  const getStatusLabel = (status: Movie['status']) => {
    if (status === 'active') return { text: 'เผยแพร่แล้ว', className: 'text-emerald-700 font-medium' };
    if (status === 'draft') return { text: 'ฉบับร่าง', className: 'text-amber-700 font-medium' };
    return { text: 'เก็บถาวร', className: 'text-slate-500 font-medium' };
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529]">
            คลังหนัง
          </h1>
          <p className="text-sm text-[#6C757D] mt-1">
            จัดการรายการภาพยนตร์ สถานะการเผยแพร่ และนำเข้าข้อมูลจาก API
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenApiSync}
            className="bg-white hover:bg-slate-50 text-[#212529] border border-slate-300 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <CloudDownload className="w-4 h-4 text-[#495057]" />
            <span>นำเข้าจาก API</span>
          </button>

          <button
            type="button"
            onClick={onAddMovie}
            className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มหนัง</span>
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.movies.searchPlaceholder}
              className="w-full bg-[#F8F9FA] border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-[#212529] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-[#212529] cursor-pointer"
              >
                ล้าง
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#212529] shadow-xs'
                  : 'text-slate-600 hover:text-[#212529]'
              }`}
              title={t.movies.viewTable}
            >
              <List className="w-3.5 h-3.5" />
              <span>ตาราง</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#212529] shadow-xs'
                  : 'text-slate-600 hover:text-[#212529]'
              }`}
              title={t.movies.viewGrid}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>การ์ด</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#6C757D] text-xs inline-flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> ตัวกรอง:
            </span>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
            >
              <option value="all">ปีทั้งหมด</option>
              {years.map((yr) => (
                <option key={yr} value={yr.toString()}>
                  {yr}
                </option>
              ))}
            </select>

            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
            >
              <option value="all">ทุกความละเอียด</option>
              <option value="4K">4K Ultra HD</option>
              <option value="FHD">Full HD (1080p)</option>
              <option value="HD">HD (720p)</option>
              <option value="CAM">CAM</option>
            </select>

            {(selectedCategory !== 'all' || selectedYear !== 'all' || selectedQuality !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedYear('all');
                  setSelectedQuality('all');
                }}
                className="text-xs text-[#DC3545] hover:underline px-1 cursor-pointer inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>รีเซ็ตตัวกรอง</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[#6C757D] text-xs">เรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
            >
              <option value="latest">ล่าสุด</option>
              <option value="rating-desc">เรตติ้งสูงสุด</option>
              <option value="year-desc">ปีล่าสุด</option>
              <option value="title-az">ชื่อ A-Z</option>
            </select>

            <span className="text-[#6C757D] text-xs tabular-nums pl-1">
              แสดง {filteredMovies.length.toLocaleString()} จาก{' '}
              <strong className="text-[#212529]">{movies.length.toLocaleString()}</strong> เรื่อง
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredMovies.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200/90 shadow-xs space-y-2.5">
          <Film className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm sm:text-base text-[#6C757D]">
            {movies.length === 0 ? (
              <>
                <span>ยังไม่มีหนังในคลัง </span>
                <button
                  type="button"
                  onClick={onAddMovie}
                  className="text-[#0D6EFD] hover:text-[#0B5ED7] underline underline-offset-2 font-medium cursor-pointer"
                >
                  เพิ่มหนังเรื่องแรก
                </button>
              </>
            ) : (
              'ไม่พบภาพยนตร์ที่ตรงกับตัวกรอง'
            )}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200/90 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[#212529] font-bold">
                  <th className="py-3 px-4 sm:px-5 whitespace-nowrap">โปสเตอร์</th>
                  <th className="py-3 px-4 whitespace-nowrap">ชื่อหนัง</th>
                  <th className="py-3 px-4 whitespace-nowrap">หมวดหมู่</th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานะ</th>
                  <th className="py-3 px-4 whitespace-nowrap">วันฉาย</th>
                  <th className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMovies.map((movie) => {
                  const statusMeta = getStatusLabel(movie.status);
                  const linkCount = getMovieLinkCount(movie);
                  const isFetching = fetchingId === movie.id;
                  return (
                    <tr key={movie.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 sm:px-5">
                        <div className="w-10 h-14 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          {movie.poster ? (
                            <img
                              src={movie.poster}
                              alt={movie.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Film className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#212529] max-w-xs truncate">
                          {movie.title}
                        </div>
                        <div className="text-xs text-[#6C757D] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono">{movie.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>{movie.quality}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {movie.rating.toFixed(1)}
                          </span>
                          <span aria-hidden="true">·</span>
                          {linkCount > 0 ? (
                            <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              มีลิงก์ ({linkCount} ตอน)
                            </span>
                          ) : movie.v2DramaId && onFetchMovieLinks ? (
                            <button
                              type="button"
                              onClick={() => handleFetchLinks(movie)}
                              disabled={isFetching}
                              className="text-[#0D6EFD] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
                              <span>{isFetching ? 'กำลังดึง...' : 'ดึงลิงก์วิดีโอ'}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">ยังไม่มีลิงก์</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#495057] whitespace-nowrap">
                        {movie.category || 'ไม่ระบุ'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={statusMeta.className}>{statusMeta.text}</span>
                      </td>
                      <td className="py-3 px-4 text-[#495057] tabular-nums whitespace-nowrap">
                        {movie.year}
                      </td>
                      <td className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {movie.streamUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopyStreamUrl(movie)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                              aria-label={`คัดลอกลิงก์วิดีโอ ${movie.title}`}
                              title="คัดลอกลิงก์วิดีโอ"
                            >
                              {copiedId === movie.id ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {onPlayMovie && (
                            <button
                              type="button"
                              onClick={() => onPlayMovie(movie)}
                              className="p-1.5 text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 rounded-md transition cursor-pointer"
                              aria-label={`เล่น ${movie.title}`}
                              title="เล่นภาพยนตร์"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditMovie(movie)}
                            className="p-1.5 text-slate-500 hover:text-[#212529] hover:bg-slate-100 rounded-md transition cursor-pointer"
                            aria-label={`แก้ไข ${movie.title}`}
                            title="แก้ไข"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMovie(movie)}
                            className="p-1.5 text-slate-500 hover:text-[#DC3545] hover:bg-red-50 rounded-md transition cursor-pointer"
                            aria-label={`ลบ ${movie.title}`}
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMovies.map((movie) => {
            const statusMeta = getStatusLabel(movie.status);
            return (
              <div
                key={movie.id}
                className="bg-white rounded-xl overflow-hidden border border-slate-200/90 shadow-xs flex flex-col group hover:border-slate-300 transition-colors"
              >
                <div className="aspect-[2/3] relative overflow-hidden bg-slate-100 flex items-center justify-center">
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                      <Film className="w-8 h-8 opacity-50" />
                      <span className="text-xs line-clamp-2">{movie.title}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-[#212529] truncate" title={movie.title}>
                      {movie.title}
                    </h3>
                    <div className="text-xs text-[#6C757D] mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="tabular-nums">{movie.year}</span>
                      <span aria-hidden="true">·</span>
                      <span>{movie.quality}</span>
                      <span aria-hidden="true">·</span>
                      <span className={statusMeta.className}>{statusMeta.text}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    {onPlayMovie && (
                      <button
                        type="button"
                        onClick={() => onPlayMovie(movie)}
                        className="flex-1 py-1.5 px-2 text-xs font-medium text-[#0D6EFD] bg-blue-50 hover:bg-blue-100 rounded-md transition cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>เล่น</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditMovie(movie)}
                      className="p-1.5 text-slate-600 hover:text-[#212529] border border-slate-200 hover:bg-slate-50 rounded-md transition cursor-pointer"
                      aria-label={`แก้ไข ${movie.title}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMovie(movie)}
                      className="p-1.5 text-[#DC3545] border border-red-200 hover:bg-red-50 rounded-md transition cursor-pointer"
                      aria-label={`ลบ ${movie.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
