import React, { useState, useEffect } from 'react';
import {
  X,
  Film,
  Image as ImageIcon,
  Star,
  Check,
  AlertCircle,
  Search,
  RefreshCw,
  Database,
  ArrowDownRight,
} from 'lucide-react';
import { Movie, MovieQuality, MovieStatus } from '../types';
import { searchTMDBMovies } from '../services/tmdbService';
import { useLanguage } from '../context/LanguageContext';

interface MovieFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (movieData: Partial<Movie>) => void;
  movieToEdit?: Movie | null;
  availableCategories: string[];
  availableGenres: string[];
}

export const MovieFormModal: React.FC<MovieFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  movieToEdit,
  availableCategories,
  availableGenres,
}) => {
  const { t, language } = useLanguage();
  const isEditMode = !!movieToEdit;

  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [code, setCode] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [rating, setRating] = useState(7.0);
  const [poster, setPoster] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [category, setCategory] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [quality, setQuality] = useState<MovieQuality>('4K');
  const [status, setStatus] = useState<MovieStatus>('active');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [director, setDirector] = useState('');
  const [castString, setCastString] = useState('');
  const [featured, setFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTmdbSearch, setShowTmdbSearch] = useState(false);
  const [tmdbSearchInput, setTmdbSearchInput] = useState('');
  const [tmdbSearching, setTmdbSearching] = useState(false);
  const [tmdbSearchResults, setTmdbSearchResults] = useState<Movie[]>([]);

  useEffect(() => {
    if (movieToEdit) {
      setTitle(movieToEdit.title);
      setTitleEn(movieToEdit.titleEn || '');
      setCode(movieToEdit.code);
      setYear(movieToEdit.year);
      setRating(movieToEdit.rating);
      setPoster(movieToEdit.poster);
      setBackdrop(movieToEdit.backdrop || '');
      setStreamUrl(movieToEdit.streamUrl || '');
      setCategory(movieToEdit.category);
      setSelectedGenres(movieToEdit.genres || []);
      setQuality(movieToEdit.quality);
      setStatus(movieToEdit.status);
      setDuration(movieToEdit.duration || '');
      setDescription(movieToEdit.description || '');
      setDirector(movieToEdit.director || '');
      setCastString((movieToEdit.cast || []).join(', '));
      setFeatured(!!movieToEdit.featured);
    } else {
      setTitle('');
      setTitleEn('');
      setCode(`#${Math.floor(100 + Math.random() * 9000)}`);
      setYear(new Date().getFullYear());
      setRating(7.0);
      setPoster('');
      setBackdrop('');
      setStreamUrl('');
      setCategory(availableCategories[0] || '');
      setSelectedGenres([]);
      setQuality('4K');
      setStatus('active');
      setDuration('');
      setDescription('');
      setDirector('');
      setCastString('');
      setFeatured(false);
    }
    setError(null);
    setShowTmdbSearch(false);
    setTmdbSearchResults([]);
  }, [movieToEdit, isOpen, availableCategories]);

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleTmdbSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmdbSearchInput.trim()) return;

    setTmdbSearching(true);
    try {
      const results = await searchTMDBMovies(tmdbSearchInput.trim(), language === 'en' ? 'en-US' : 'th-TH');
      setTmdbSearchResults(results);
    } catch (err: any) {
      setError(err?.message || 'ค้นหา TMDB ล้มเหลว');
    } finally {
      setTmdbSearching(false);
    }
  };

  const handleApplyTmdbMovie = (tmdbMovie: Movie) => {
    setTitle(tmdbMovie.title);
    setTitleEn(tmdbMovie.titleEn || '');
    setYear(tmdbMovie.year);
    setRating(tmdbMovie.rating);
    setPoster(tmdbMovie.poster);
    if (tmdbMovie.backdrop) setBackdrop(tmdbMovie.backdrop);
    setDuration(tmdbMovie.duration || '');
    setDescription(tmdbMovie.description || '');
    if (tmdbMovie.director) setDirector(tmdbMovie.director);
    if (tmdbMovie.cast && tmdbMovie.cast.length > 0) setCastString(tmdbMovie.cast.join(', '));
    if (tmdbMovie.genres && tmdbMovie.genres.length > 0) setSelectedGenres(tmdbMovie.genres);
    if (tmdbMovie.category) setCategory(tmdbMovie.category);

    setShowTmdbSearch(false);
    setTmdbSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('กรุณาระบุชื่อหนัง');
      return;
    }

    const castArray = castString
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    onSave({
      title: title.trim(),
      titleEn: titleEn.trim() || undefined,
      code: code.trim() || `#${Math.floor(100 + Math.random() * 9000)}`,
      year: Number(year) || new Date().getFullYear(),
      rating: Number(rating) || 7.0,
      poster: poster.trim(),
      backdrop: backdrop.trim() || undefined,
      streamUrl: streamUrl.trim(),
      category: category.trim(),
      genres: selectedGenres,
      quality,
      status,
      duration: duration.trim(),
      description: description.trim(),
      director: director.trim() || undefined,
      cast: castArray,
      featured,
    });

    onClose();
  };

  const inputClass =
    'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-[#212529] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD] transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-form-title"
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl my-8 fade-in flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg text-[#0D6EFD] flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 id="movie-form-title" className="text-lg font-bold text-[#212529]">
                {isEditMode ? 'แก้ไขข้อมูลหนัง' : 'เพิ่มหนังใหม่'}
              </h2>
              <p className="text-xs text-[#6C757D]">
                {isEditMode
                  ? `กำลังแก้ไข ${movieToEdit?.title}`
                  : 'กรอกรายละเอียดภาพยนตร์ หรือดึงข้อมูลจาก TMDB'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 text-slate-400 hover:text-[#212529] hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TMDB Quick Fill Bar */}
        <div className="bg-[#F8F9FA] border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[#6C757D]">
            ดึงรายละเอียดภาพยนตร์อัตโนมัติจาก The Movie Database (TMDB)
          </span>
          <button
            type="button"
            onClick={() => setShowTmdbSearch(!showTmdbSearch)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-[#0D6EFD] border border-slate-300 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{showTmdbSearch ? 'ซ่อนการค้นหา TMDB' : 'ดึงข้อมูลจาก TMDB'}</span>
          </button>
        </div>

        {/* TMDB Search Panel */}
        {showTmdbSearch && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
            <form onSubmit={handleTmdbSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tmdbSearchInput}
                  onChange={(e) => setTmdbSearchInput(e.target.value)}
                  placeholder="พิมพ์ชื่อเรื่องเพื่อค้นหาใน TMDB..."
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                />
              </div>
              <button
                type="submit"
                disabled={tmdbSearching || !tmdbSearchInput.trim()}
                className="px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${tmdbSearching ? 'animate-spin' : ''}`} />
                <span>{tmdbSearching ? 'กำลังค้นหา...' : 'ค้นหา'}</span>
              </button>
            </form>

            {tmdbSearchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                {tmdbSearchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleApplyTmdbMovie(item)}
                    className="p-2 rounded-lg bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-[#0D6EFD] flex items-center gap-3 cursor-pointer transition text-left"
                  >
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-14 object-cover rounded bg-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-slate-100 flex items-center justify-center shrink-0">
                        <Film className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-[#212529] truncate">{item.title}</div>
                      <div className="text-[11px] text-[#6C757D] mt-0.5">
                        ★ {item.rating} · {item.year}
                      </div>
                    </div>
                    <ArrowDownRight className="w-4 h-4 text-[#0D6EFD] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#DC3545] text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Poster Preview */}
            <div className="space-y-3">
              <label htmlFor="movie-poster" className="block text-xs font-semibold text-[#495057]">
                {t.movieForm.posterUrl}
              </label>
              <div className="aspect-[2/3] bg-[#F8F9FA] rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
                {poster.trim() ? (
                  <img
                    src={poster}
                    alt="ตัวอย่างโปสเตอร์"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                    <ImageIcon className="w-9 h-9 opacity-50" />
                    <span className="text-xs">ยังไม่มีรูปโปสเตอร์</span>
                  </div>
                )}
              </div>

              <input
                id="movie-poster"
                type="text"
                value={poster}
                onChange={(e) => setPoster(e.target.value)}
                placeholder="https://... Poster URL"
                className={`${inputClass} text-xs`}
              />

              <div>
                <label htmlFor="movie-backdrop" className="block text-xs font-medium text-[#6C757D] mb-1">
                  {t.movieForm.backdropUrl}
                </label>
                <input
                  id="movie-backdrop"
                  type="text"
                  value={backdrop}
                  onChange={(e) => setBackdrop(e.target.value)}
                  placeholder="https://... Backdrop URL"
                  className={`${inputClass} text-xs`}
                />
              </div>
            </div>

            {/* Right Column: Fields */}
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="movie-title" className="block text-xs font-medium text-[#495057] mb-1">
                    ชื่อหนัง *
                  </label>
                  <input
                    id="movie-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="กรอกชื่อภาพยนตร์"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="movie-title-en" className="block text-xs font-medium text-[#495057] mb-1">
                    ชื่อภาษาอังกฤษ (ถ้ามี)
                  </label>
                  <input
                    id="movie-title-en"
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder="Original Title"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="movie-code" className="block text-xs font-medium text-[#495057] mb-1">
                    รหัสหนัง
                  </label>
                  <input
                    id="movie-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="#584"
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div>
                  <label htmlFor="movie-year" className="block text-xs font-medium text-[#495057] mb-1">
                    ปีที่ฉาย
                  </label>
                  <input
                    id="movie-year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={1950}
                    max={2035}
                    className={`${inputClass} tabular-nums`}
                  />
                </div>

                <div>
                  <label htmlFor="movie-rating" className="block text-xs font-medium text-[#495057] mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>คะแนน (0-10)</span>
                  </label>
                  <input
                    id="movie-rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="movie-category" className="block text-xs font-medium text-[#495057] mb-1">
                    หมวดหมู่
                  </label>
                  {availableCategories.length > 0 ? (
                    <select
                      id="movie-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">-- เลือกหมวดหมู่ --</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="movie-category"
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="เช่น แอคชั่น, ดราม่า"
                      className={inputClass}
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="movie-quality" className="block text-xs font-medium text-[#495057] mb-1">
                    ความละเอียด
                  </label>
                  <select
                    id="movie-quality"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as MovieQuality)}
                    className={inputClass}
                  >
                    <option value="4K">4K Ultra HD</option>
                    <option value="FHD">Full HD 1080p</option>
                    <option value="HD">HD 720p</option>
                    <option value="CAM">CAM</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="movie-status" className="block text-xs font-medium text-[#495057] mb-1">
                    สถานะ
                  </label>
                  <select
                    id="movie-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MovieStatus)}
                    className={inputClass}
                  >
                    <option value="active">เผยแพร่แล้ว</option>
                    <option value="draft">ฉบับร่าง</option>
                    <option value="archived">เก็บถาวร</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="movie-stream-url" className="block text-xs font-medium text-[#495057] mb-1">
                  ลิงก์วิดีโอสตรีม (.mp4 / .m3u8)
                </label>
                <input
                  id="movie-stream-url"
                  type="text"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://.../stream.m3u8"
                  className={`${inputClass} font-mono text-xs`}
                />
              </div>

              {availableGenres.length > 0 && (
                <div>
                  <span className="block text-xs font-medium text-[#495057] mb-1.5">
                    แนวภาพยนตร์
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableGenres.map((g) => {
                      const isSelected = selectedGenres.includes(g);
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition inline-flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-[#0D6EFD] text-white border-[#0D6EFD]'
                              : 'bg-white text-[#495057] border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{g}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="movie-duration" className="block text-xs font-medium text-[#495057] mb-1">
                    ความยาว / ผู้กำกับ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      id="movie-duration"
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="120 นาที"
                      className={`${inputClass} text-xs`}
                    />
                    <input
                      type="text"
                      value={director}
                      onChange={(e) => setDirector(e.target.value)}
                      placeholder="ผู้กำกับ"
                      className={`${inputClass} text-xs`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="movie-cast" className="block text-xs font-medium text-[#495057] mb-1">
                    นักแสดงนำ (คั่นด้วยจุลภาค)
                  </label>
                  <input
                    id="movie-cast"
                    type="text"
                    value={castString}
                    onChange={(e) => setCastString(e.target.value)}
                    placeholder="ชื่อนักแสดง..."
                    className={`${inputClass} text-xs`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="movie-desc" className="block text-xs font-medium text-[#495057] mb-1">
                  เรื่องย่อ
                </label>
                <textarea
                  id="movie-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="กรอกเนื้อเรื่องย่อของภาพยนตร์..."
                  className={inputClass}
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#495057] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-[#0D6EFD]"
                />
                <span>แสดงเป็นภาพยนตร์แนะนำหน้าแรก</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[#495057] hover:text-[#212529] border border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium px-5 py-2 rounded-lg text-sm transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกหนัง'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
