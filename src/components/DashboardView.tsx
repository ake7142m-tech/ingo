import React, { useState } from 'react';
import { Check, CloudDownload, Copy, Film, Link2, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AdminMenuTab, Movie } from '../types';
import { DashboardStats, getRecentMovies } from '../utils/dashboardStats';
import { getMovieLinkCount } from '../utils/movieLinks';

interface DashboardViewProps {
  stats: DashboardStats;
  movies: Movie[];
  onAddMovie: () => void;
  onEditMovie: (movie: Movie) => void;
  onDeleteMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie) => void;
  onNavigateTab: (tab: AdminMenuTab) => void;
  onOpenApiSync?: () => void;
  onFetchMovieLinks?: (movie: Movie) => Promise<Movie | null>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  movies,
  onAddMovie,
  onEditMovie,
  onDeleteMovie,
  onPlayMovie,
  onNavigateTab,
  onOpenApiSync,
  onFetchMovieLinks,
}) => {
  const recentMovies = getRecentMovies(movies, 10);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  const statCards: Array<{
    label: string;
    value: number;
    targetTab: AdminMenuTab;
  }> = [
    { label: 'ผู้ดูแลระบบ', value: stats.adminCount, targetTab: 'admins' },
    { label: 'หนังทั้งหมด', value: stats.totalMovies, targetTab: 'movies' },
    { label: 'เผยแพร่แล้ว', value: stats.publishedMovies, targetTab: 'movies' },
    { label: 'ฉบับร่าง', value: stats.draftMovies, targetTab: 'movies' },
    { label: 'หมวดหมู่หนัง', value: stats.categoryCount, targetTab: 'categories' },
    { label: 'สมาชิก', value: stats.memberCount, targetTab: 'members' },
  ];

  const getStatusLabel = (status: Movie['status']) => {
    if (status === 'active') return { text: 'เผยแพร่แล้ว', className: 'text-emerald-700 font-medium' };
    if (status === 'draft') return { text: 'ฉบับร่าง', className: 'text-amber-700 font-medium' };
    return { text: 'เก็บถาวร', className: 'text-slate-500 font-medium' };
  };

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

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529] leading-tight">
            แดชบอร์ดหนัง
          </h1>
          <p className="text-sm sm:text-[15px] text-[#6C757D] mt-1">
            ภาพรวมคลังหนังและสถานะการเผยแพร่
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenApiSync && (
            <button
              type="button"
              onClick={onOpenApiSync}
              className="bg-white hover:bg-slate-50 text-[#212529] border border-slate-300 font-medium text-sm px-3.5 py-2.5 rounded-lg inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <CloudDownload className="w-4 h-4 text-[#0D6EFD]" />
              <span>ดึงจาก API V2</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddMovie}
            className="bg-[#0D6EFD] hover:bg-[#0B5ED7] active:bg-[#0A58CA] text-white font-medium text-sm px-4 py-2.5 rounded-lg inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
            <span>เพิ่มหนัง</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigateTab(card.targetTab)}
            className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors p-4 sm:p-5 text-left flex flex-col justify-between min-h-[104px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/40"
          >
            <span className="text-sm text-[#6C757D] font-normal">{card.label}</span>
            <span className="text-3xl font-bold text-[#212529] tabular-nums mt-2 leading-none">
              {card.value.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Recent Movies Table Card */}
      <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#212529]">หนังที่เพิ่มล่าสุด</h2>
          {movies.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('movies')}
              className="text-xs font-medium text-[#0D6EFD] hover:text-[#0B5ED7] hover:underline cursor-pointer whitespace-nowrap"
            >
              ดูคลังหนังทั้งหมด ({movies.length.toLocaleString()})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[#212529] text-[13px] sm:text-sm font-bold">
                <th className="py-3 pl-3.5 pr-2 sm:px-5 whitespace-nowrap">โปสเตอร์</th>
                <th className="py-3 px-2 sm:px-4 whitespace-nowrap">ชื่อหนัง</th>
                <th className="py-3 px-2 sm:px-4 whitespace-nowrap">หมวดหมู่</th>
                <th className="py-3 px-2 sm:px-4 whitespace-nowrap">สถานะ</th>
                <th className="py-3 pl-2 pr-3.5 sm:px-5 whitespace-nowrap text-right">วันฉาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {recentMovies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center text-[#6C757D] text-sm sm:text-base">
                    <span>ยังไม่มีหนังในคลัง </span>
                    <button
                      type="button"
                      onClick={onAddMovie}
                      className="text-[#0D6EFD] hover:text-[#0B5ED7] underline underline-offset-2 font-medium cursor-pointer"
                    >
                      เพิ่มหนังเรื่องแรก
                    </button>
                  </td>
                </tr>
              ) : (
                recentMovies.map((movie) => {
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
                        <div className="font-semibold text-[#212529] max-w-[220px] sm:max-w-xs truncate">
                          {movie.title}
                        </div>
                        <div className="text-xs text-[#6C757D] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono">{movie.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>{movie.quality}</span>
                          <span aria-hidden="true">·</span>
                          {linkCount > 0 ? (
                            <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              มีลิงก์วิดีโอ ({linkCount} ตอน)
                            </span>
                          ) : movie.v2DramaId && onFetchMovieLinks ? (
                            <button
                              type="button"
                              onClick={() => handleFetchLinks(movie)}
                              disabled={isFetching}
                              className="text-[#0D6EFD] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
                              <span>{isFetching ? 'กำลังดึงลิงก์...' : 'ดึงลิงก์วิดีโอ'}</span>
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
                        <span className={`text-xs sm:text-sm ${statusMeta.className}`}>
                          {statusMeta.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[#495057] tabular-nums mr-1">{movie.year}</span>
                          {movie.streamUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopyStreamUrl(movie)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                              aria-label={`คัดลอกลิงก์วิดีโอ ${movie.title}`}
                              title="คัดลอกลิงก์วิดีโอ"
                            >
                              {copiedId === movie.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onPlayMovie(movie)}
                            className="p-1.5 text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            aria-label={`เล่น ${movie.title}`}
                            title="เล่นภาพยนตร์"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditMovie(movie)}
                            className="p-1.5 text-slate-500 hover:text-[#212529] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            aria-label={`แก้ไข ${movie.title}`}
                            title="แก้ไข"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMovie(movie)}
                            className="p-1.5 text-slate-500 hover:text-[#DC3545] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            aria-label={`ลบ ${movie.title}`}
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
