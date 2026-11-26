import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Settings,
  Server,
  Film,
  Star,
  Clock,
  Sparkles,
  Subtitles,
  AudioWaveform,
  Tv,
  Share2,
  Check,
  ChevronRight,
  ListPlus,
  Heart,
  PictureInPicture,
  RefreshCw,
  Copy,
  Link2,
} from 'lucide-react';
import { Movie, MovieSubtitleLink } from '../types';
import { isLinkExpired } from '../utils/movieLinks';

interface MovieCinemaPlayerModalProps {
  movie: Movie | null;
  allMovies?: Movie[];
  isOpen: boolean;
  onClose: () => void;
  onSelectOtherMovie?: (movie: Movie) => void;
  onFetchMovieLinks?: (movie: Movie, ep?: string) => Promise<Movie | null>;
}

interface MovieServer {
  id: string;
  name: string;
  quality: string;
  url: string;
  audio: string;
  sub: string;
  episode?: number;
  urlExpiresAt?: string;
  subtitles?: MovieSubtitleLink[];
}

export const MovieCinemaPlayerModal: React.FC<MovieCinemaPlayerModalProps> = ({
  movie,
  allMovies = [],
  isOpen,
  onClose,
  onSelectOtherMovie,
  onFetchMovieLinks,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [fetchingLinks, setFetchingLinks] = useState(false);
  const [linkFetchError, setLinkFetchError] = useState<string | null>(null);

  // Build servers/episodes list from V2 episodeLinks or primary streamUrl
  const servers: MovieServer[] = React.useMemo(() => {
    if (!movie) return [];
    const list: MovieServer[] = [];

    if (Array.isArray(movie.episodeLinks) && movie.episodeLinks.length > 0) {
      movie.episodeLinks.forEach((ep) => {
        const label =
          ep.totalParts > 1
            ? `ตอนที่ ${ep.episode} (พาร์ท ${ep.part}/${ep.totalParts})`
            : `ตอนที่ ${ep.episode}`;
        const resolution = ep.height ? `${ep.height}p` : movie.quality || 'HD';
        list.push({
          id: `ep-${ep.episode}-${ep.part}`,
          name: label,
          quality: resolution,
          url: ep.url,
          audio: movie.category || 'ต้นฉบับ',
          sub: ep.subtitles && ep.subtitles.length > 0 ? `${ep.subtitles.length} ภาษาซับ` : '-',
          episode: ep.episode,
          urlExpiresAt: ep.urlExpiresAt,
          subtitles: ep.subtitles,
        });
      });
    } else if (movie.streamUrl) {
      list.push({
        id: 'srv-master',
        name: 'Server 1 - Primary Stream',
        quality: movie.quality || '4K UHD',
        url: movie.streamUrl,
        audio: 'พากย์ไทย',
        sub: 'ซับไทย',
        urlExpiresAt: movie.streamUrlExpiresAt,
      });
    }

    if (movie.trailerUrl && movie.trailerUrl !== movie.streamUrl) {
      list.push({
        id: 'srv-trailer',
        name: 'Trailer / สำรอง',
        quality: 'HD',
        url: movie.trailerUrl,
        audio: 'เสียงต้นฉบับ',
        sub: '-',
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'srv-empty',
        name: 'ยังไม่มีลิงก์วิดีโอ',
        quality: movie.quality || 'HD',
        url: '',
        audio: '-',
        sub: '-',
      });
    }
    return list;
  }, [movie]);

  const [selectedServer, setSelectedServer] = useState<MovieServer>(
    servers[0] || {
      id: 'srv-empty',
      name: 'ยังไม่ได้ตั้งค่าลิงก์สตรีม',
      quality: 'HD',
      url: '',
      audio: '-',
      sub: '-',
    }
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedAudio, setSelectedAudio] = useState('th'); // 'th' | 'en'
  const [selectedSubtitle, setSelectedSubtitle] = useState('th'); // 'th' | 'en' | 'off'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<'info' | 'servers' | 'playlist'>('info');

  // Reset states when movie changes & auto-fetch V2 video links if missing or expired
  useEffect(() => {
    if (servers.length > 0) {
      setSelectedServer(servers[0]);
    }
    setCurrentTime(0);
    setIsPlaying(true);
    setIsSettingsOpen(false);
    setLinkFetchError(null);

    if (
      isOpen &&
      movie?.v2DramaId &&
      onFetchMovieLinks &&
      (!movie.streamUrl || isLinkExpired(movie.streamUrlExpiresAt))
    ) {
      setFetchingLinks(true);
      onFetchMovieLinks(movie)
        .catch((err: unknown) => {
          setLinkFetchError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setFetchingLinks(false));
    }
  }, [isOpen, movie?.id, movie?.streamUrl, servers.length]);

  // Handle Video Time Updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (!duration || isNaN(duration)) {
        setDuration(videoRef.current.duration || 0);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      videoRef.current.playbackRate = playbackSpeed;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      const nextTime = Math.min(Math.max(0, videoRef.current.currentTime + seconds), duration || 9999);
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setIsSettingsOpen(false);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTogglePiP = async () => {
    try {
      if (videoRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsSettingsOpen(false);
      }
    }, 3500);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkip(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(-10);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, duration]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleCopyLink = () => {
    const targetUrl = selectedServer.url || movie?.streamUrl || window.location.href;
    navigator.clipboard?.writeText(targetUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualFetchLinks = async (epParam?: string) => {
    if (!movie || !onFetchMovieLinks || fetchingLinks) return;
    setFetchingLinks(true);
    setLinkFetchError(null);
    try {
      await onFetchMovieLinks(movie, epParam);
    } catch (err: unknown) {
      setLinkFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingLinks(false);
    }
  };

  if (!isOpen || !movie) return null;

  const otherMovies = allMovies.filter((m) => m && m.id !== movie.id).slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-xl animate-fade-in overflow-y-auto"
      onMouseMove={handleMouseMove}
    >
      {/* Ambient Cinema Lighting Glow effect behind the container */}
      {ambientGlow && (
        <div
          className="absolute inset-0 pointer-events-none opacity-25 blur-3xl transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 40%, #E50914 0%, #1e1b4b 50%, transparent 80%)`,
          }}
        />
      )}

      <div
        ref={containerRef}
        className="relative w-full max-w-7xl bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#181818] border-b border-white/10 shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 bg-[#E50914] text-white px-2.5 py-0.5 rounded text-xs font-black tracking-wider uppercase shadow-md shadow-[#E50914]/20">
              <Film className="w-3.5 h-3.5" />
              <span>MOVIEFLIX PLAYER</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-white truncate flex items-center gap-2">
                <span>{movie.title}</span>
                {movie.year && (
                  <span className="text-xs font-normal text-gray-400">({movie.year})</span>
                )}
                <span className="bg-white/10 text-yellow-400 text-[11px] font-bold px-1.5 py-0.2 rounded border border-white/10 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  {movie.rating.toFixed(1)}
                </span>
                <span className="bg-[#E50914]/20 text-[#E50914] text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-[#E50914]/30">
                  {movie.quality}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAmbientGlow(!ambientGlow)}
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer ${
                ambientGlow
                  ? 'bg-[#E50914]/20 text-[#E50914] border-[#E50914]/40'
                  : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
              }`}
              title="สลับโหมดแสงเรืองรอบโรงภาพยนตร์ (Ambient Glow)"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Cinema Glow</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer border border-white/5"
              title="แชร์ลิงก์ภาพยนตร์"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-[#E50914] text-gray-300 hover:text-white transition cursor-pointer"
              title="ปิดเครื่องเล่น"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Video Player on Left, Side Panel on Right */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Video Player Canvas */}
          <div className="flex-1 flex flex-col bg-black relative justify-center items-center overflow-hidden group select-none">
            {selectedServer.url ? (
              <video
                ref={videoRef}
                key={selectedServer.url}
                src={selectedServer.url}
                crossOrigin="anonymous"
                className="w-full h-full max-h-[70vh] lg:max-h-full object-contain bg-black cursor-pointer"
                autoPlay
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onClick={handleTogglePlay}
              >
                {selectedSubtitle !== 'off' &&
                  selectedServer.subtitles?.map((sub, idx) => (
                    <track
                      key={`${sub.url}-${idx}`}
                      kind="subtitles"
                      src={sub.url}
                      srcLang={sub.language || 'th'}
                      label={sub.label || sub.language || 'Subtitle'}
                      default={sub.isDefault || idx === 0}
                    />
                  ))}
              </video>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-gray-400 p-8 text-center min-h-[320px]">
                {fetchingLinks ? (
                  <>
                    <RefreshCw className="w-10 h-10 text-[#0D6EFD] animate-spin" />
                    <p className="text-sm font-medium text-white">
                      กำลังดึงลิงก์วิดีโอจาก Series Jeen API V2...
                    </p>
                  </>
                ) : (
                  <>
                    <Film className="w-12 h-12 opacity-30" />
                    <p className="text-sm font-medium text-white">ยังไม่ได้กำหนดลิงก์วิดีโอสตรีม</p>
                    {linkFetchError && (
                      <p className="text-xs text-amber-400 max-w-sm">{linkFetchError}</p>
                    )}
                    {movie.v2DramaId && onFetchMovieLinks ? (
                      <button
                        type="button"
                        onClick={() => handleManualFetchLinks()}
                        className="px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>ดึงลิงก์วิดีโอจาก API V2</span>
                      </button>
                    ) : (
                      <p className="text-xs text-gray-500">
                        กรุณาแก้ไขภาพยนตร์เพื่อเพิ่ม URL วิดีโอสตรีม (.mp4 / .m3u8)
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Center Big Play Button when paused */}
            {!isPlaying && (
              <button
                onClick={handleTogglePlay}
                className="absolute z-30 p-6 rounded-full bg-[#E50914]/90 hover:bg-[#E50914] text-white hover:scale-110 transition shadow-2xl cursor-pointer"
              >
                <Play className="w-10 h-10 fill-white translate-x-1" />
              </button>
            )}

            {/* Top Video Overlay: Current Server & Quality Badge */}
            <div
              className={`absolute top-4 left-4 z-30 flex items-center gap-2 transition-opacity duration-300 pointer-events-none ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <span className="bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-md border border-white/10 flex items-center gap-1.5 shadow-lg">
                <Server className="w-3.5 h-3.5 text-[#E50914]" />
                {selectedServer.name}
              </span>
              <span className="bg-[#E50914]/90 text-white text-xs font-extrabold px-2 py-1 rounded-md shadow-lg">
                {selectedServer.quality}
              </span>
              <span className="bg-black/60 text-gray-300 text-xs px-2.5 py-1 rounded-md border border-white/10 hidden sm:inline-block">
                {selectedAudio === 'th' ? '🔊 พากย์ไทย 5.1' : '🔊 Sound Track (ENG)'}
              </span>
            </div>

            {/* Bottom Custom Netflix-Style Control Bar */}
            <div
              className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 sm:px-6 py-4 flex flex-col gap-2.5 z-30 transition-opacity duration-300 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress Scrubber */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-300 min-w-[45px]">
                  {formatTime(currentTime)}
                </span>
                <div className="relative flex-1 group/slider flex items-center">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-[#E50914] h-1.5 bg-white/25 rounded-lg cursor-pointer transition-all hover:h-2.5"
                  />
                </div>
                <span className="text-xs font-mono text-gray-400 min-w-[45px]">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between text-white text-xs sm:text-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Play/Pause */}
                  <button
                    onClick={handleTogglePlay}
                    className="p-1.5 hover:text-[#E50914] transition cursor-pointer"
                    title={isPlaying ? 'หยุดชั่วคราว (Space)' : 'เล่นต่อ (Space)'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                  </button>

                  {/* Skip Rewind 10s */}
                  <button
                    onClick={() => handleSkip(-10)}
                    className="p-1.5 hover:text-[#E50914] transition cursor-pointer text-gray-300 hover:text-white"
                    title="ย้อนกลับ 10 วินาที (Left Arrow)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Skip Forward 10s */}
                  <button
                    onClick={() => handleSkip(10)}
                    className="p-1.5 hover:text-[#E50914] transition cursor-pointer text-gray-300 hover:text-white"
                    title="ไปข้างหน้า 10 วินาที (Right Arrow)"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2 group/vol">
                    <button
                      onClick={handleToggleMute}
                      className="p-1.5 hover:text-[#E50914] transition cursor-pointer"
                      title={isMuted ? 'เปิดเสียง (M)' : 'ปิดเสียง (M)'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5 text-red-400" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-24 accent-[#E50914] h-1 bg-white/30 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Audio & Subtitle Quick Tags */}
                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={() => setSelectedAudio(selectedAudio === 'th' ? 'en' : 'th')}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-gray-200 transition cursor-pointer flex items-center gap-1 border border-white/10"
                      title="สลับภาษาเสียงพากย์"
                    >
                      <AudioWaveform className="w-3.5 h-3.5 text-[#E50914]" />
                      <span>{selectedAudio === 'th' ? 'TH พากย์ไทย' : 'ENG Soundtrack'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (selectedSubtitle === 'th') setSelectedSubtitle('en');
                        else if (selectedSubtitle === 'en') setSelectedSubtitle('off');
                        else setSelectedSubtitle('th');
                      }}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-gray-200 transition cursor-pointer flex items-center gap-1 border border-white/10"
                      title="สลับคำบรรยาย (Subtitles)"
                    >
                      <Subtitles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>
                        {selectedSubtitle === 'th'
                          ? 'ซับไทย (TH)'
                          : selectedSubtitle === 'en'
                          ? 'Sub (ENG)'
                          : 'ปิดซับ'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Playback Speed selector */}
                  <div className="relative">
                    <button
                      onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-gray-200 transition cursor-pointer flex items-center gap-1 border border-white/10"
                      title="ตั้งค่าความเร็วและคุณภาพ"
                    >
                      <Settings className="w-3.5 h-3.5 text-gray-300" />
                      <span>{playbackSpeed}x</span>
                    </button>

                    {/* Settings Dropdown Popover */}
                    {isSettingsOpen && (
                      <div className="absolute right-0 bottom-full mb-3 w-48 bg-[#1F1F1F] border border-white/15 rounded-xl shadow-2xl p-2.5 z-40 text-xs space-y-2">
                        <div className="font-bold text-gray-300 pb-1 border-b border-white/10 flex items-center justify-between">
                          <span>ความเร็วการเล่น (Speed)</span>
                          <span className="text-[#E50914]">{playbackSpeed}x</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                            <button
                              key={spd}
                              onClick={() => handleSpeedChange(spd)}
                              className={`py-1 rounded text-center transition cursor-pointer ${
                                playbackSpeed === spd
                                  ? 'bg-[#E50914] text-white font-bold'
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Picture-in-Picture */}
                  <button
                    onClick={handleTogglePiP}
                    className="p-1.5 hover:text-[#E50914] transition cursor-pointer text-gray-300 hover:text-white hidden sm:block"
                    title="เล่นหน้าต่างลอย (Picture in Picture)"
                  >
                    <PictureInPicture className="w-5 h-5" />
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={handleToggleFullscreen}
                    className="p-1.5 hover:text-[#E50914] transition cursor-pointer text-gray-300 hover:text-white"
                    title="เต็มหน้าจอ (F)"
                  >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Panel: Movie Details & Stream Server Selector */}
          <div className="w-full lg:w-96 bg-[#161616] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shrink-0">
            {/* Tabs Header */}
            <div className="flex border-b border-white/10 bg-[#1A1A1A]">
              <button
                onClick={() => setActiveSideTab('info')}
                className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSideTab === 'info'
                    ? 'text-[#E50914] border-b-2 border-[#E50914] bg-[#E50914]/5'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>เรื่องย่อ & นักแสดง</span>
              </button>

              <button
                onClick={() => setActiveSideTab('servers')}
                className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSideTab === 'servers'
                    ? 'text-[#E50914] border-b-2 border-[#E50914] bg-[#E50914]/5'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>ตอน & ลิงก์ ({servers.length})</span>
              </button>

              <button
                onClick={() => setActiveSideTab('playlist')}
                className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSideTab === 'playlist'
                    ? 'text-[#E50914] border-b-2 border-[#E50914] bg-[#E50914]/5'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>หนังแนะนำ</span>
              </button>
            </div>

            {/* Tab 1: Movie Info */}
            {activeSideTab === 'info' && (
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <h3 className="font-bold text-lg text-white leading-snug">{movie.title}</h3>
                  {movie.titleEn && <p className="text-xs text-gray-400 mt-0.5">{movie.titleEn}</p>}
                </div>

                {/* Rating & Details Pill */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-md font-bold flex items-center gap-1 border border-yellow-500/30">
                    <Star className="w-3.5 h-3.5 fill-yellow-400" />
                    <span>{movie.rating.toFixed(1)} / 10</span>
                  </div>
                  <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-md font-medium">
                    ปี {movie.year}
                  </span>
                  <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-md font-medium">
                    {movie.duration || '115 นาที'}
                  </span>
                  <span className="bg-[#E50914]/20 text-[#E50914] px-2 py-1 rounded-md font-bold border border-[#E50914]/30">
                    {movie.quality}
                  </span>
                </div>

                {/* Genres */}
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres.map((g) => (
                    <span
                      key={g}
                      className="bg-white/5 border border-white/10 text-gray-300 px-2.5 py-0.5 rounded-full text-[11px]"
                    >
                      {g}
                    </span>
                  ))}
                </div>

                {/* Synopsis */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    เรื่องย่อ (Synopsis)
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed bg-[#1F1F1F] p-3 rounded-xl border border-white/5">
                    {movie.description || 'ไม่มีข้อมูลเรื่องย่อสำหรับภาพยนตร์เรื่องนี้'}
                  </p>
                </div>

                {/* Cast & Director */}
                <div className="space-y-2 text-xs border-t border-white/10 pt-3">
                  {movie.director && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 font-semibold min-w-[70px]">ผู้กำกับ:</span>
                      <span className="text-white font-medium">{movie.director}</span>
                    </div>
                  )}
                  {movie.cast && movie.cast.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 font-semibold min-w-[70px]">นักแสดง:</span>
                      <span className="text-gray-300">{movie.cast.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 font-semibold min-w-[70px]">รหัสหนัง:</span>
                    <span className="text-gray-400 font-mono">{movie.code}</span>
                  </div>
                </div>

                {/* Favorite Toggle Button */}
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border ${
                    isFavorite
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{isFavorite ? 'บันทึกในรายการโปรดแล้ว' : 'เพิ่มในรายการโปรด'}</span>
                </button>
              </div>
            )}

            {/* Tab 2: Episodes & Video Links */}
            {activeSideTab === 'servers' && (
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
                {movie.v2DramaId && onFetchMovieLinks && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <span className="text-xs text-gray-300 font-medium">
                      ลิงก์วิดีโอ CDN (API V2)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleManualFetchLinks()}
                      disabled={fetchingLinks}
                      className="px-2.5 py-1 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[11px] font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${fetchingLinks ? 'animate-spin' : ''}`} />
                      <span>{fetchingLinks ? 'กำลังดึง...' : 'รีเฟรชลิงก์ใหม่'}</span>
                    </button>
                  </div>
                )}

                {selectedServer.url && (
                  <div className="p-2.5 bg-black/40 border border-white/10 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>ลิงก์วิดีโอปัจจุบัน:</span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก URL'}</span>
                      </button>
                    </div>
                    <div className="text-[10px] font-mono text-gray-300 break-all line-clamp-2">
                      {selectedServer.url}
                    </div>
                  </div>
                )}

                {servers.map((srv) => {
                  const isCurrent = selectedServer.id === srv.id;
                  return (
                    <div
                      key={srv.id}
                      onClick={() => {
                        setSelectedServer(srv);
                        setIsPlaying(true);
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1 ${
                        isCurrent
                          ? 'bg-[#E50914]/15 border-[#E50914] text-white shadow-lg shadow-[#E50914]/10'
                          : 'bg-[#1F1F1F] border-white/5 text-gray-300 hover:bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs flex items-center gap-2">
                          <Server
                            className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#E50914]' : 'text-gray-400'}`}
                          />
                          <span>{srv.name}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isCurrent
                              ? 'bg-[#E50914] text-white'
                              : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {srv.quality}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                        <span>{srv.audio}</span>
                        <span>{srv.sub}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Playlist & Recommended */}
            {activeSideTab === 'playlist' && (
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
                <div className="text-xs text-gray-400 pb-1">ภาพยนตร์น่ารับชมต่อ:</div>

                {otherMovies.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-8">
                    ไม่มีภาพยนตร์แนะนำเพิ่มเติม
                  </div>
                ) : (
                  otherMovies.map((other) => (
                    <div
                      key={other.id}
                      onClick={() => {
                        if (onSelectOtherMovie) onSelectOtherMovie(other);
                      }}
                      className="flex items-center gap-3 p-2 rounded-xl bg-[#1F1F1F] hover:bg-white/10 border border-white/5 transition cursor-pointer group"
                    >
                      <div className="w-14 h-20 rounded-lg overflow-hidden bg-black/50 shrink-0 relative flex items-center justify-center">
                        {other.poster ? (
                          <img
                            src={other.poster}
                            alt={other.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <Film className="w-5 h-5 text-gray-600" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Play className="w-5 h-5 fill-white text-white" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-white truncate group-hover:text-[#E50914] transition">
                          {other.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                          <span className="text-yellow-400 font-bold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-current" />
                            {other.rating.toFixed(1)}
                          </span>
                          <span>•</span>
                          <span>{other.year}</span>
                          <span>•</span>
                          <span className="text-[#E50914] font-semibold">{other.quality}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-1 mt-1">
                          {other.category}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
