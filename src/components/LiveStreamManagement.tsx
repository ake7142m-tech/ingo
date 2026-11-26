import React, { useState } from 'react';
import {
  Radio,
  Plus,
  Search,
  Tv,
  Users,
  Play,
  Edit2,
  Trash2,
  ExternalLink,
  Flame,
  Clock,
  MapPin,
  Trophy,
  Filter,
  CheckCircle2,
  AlertCircle,
  Server,
  Volume2,
  Share2,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Eye,
  Check,
  Bell,
  Send,
} from 'lucide-react';
import { LiveStream, StreamServer, LiveMatchStatus, LiveNotification } from '../types';
import { LiveStreamNotifyModal } from './LiveStreamNotifyModal';
import { useLanguage } from '../context/LanguageContext';

interface LiveStreamManagementProps {
  streams: LiveStream[];
  onAddStream: (stream: LiveStream) => void;
  onUpdateStream: (stream: LiveStream) => void;
  onDeleteStream: (id: string) => void;
  onOpenPlayer: (stream: LiveStream) => void;
  onSendNotification?: (notification: LiveNotification) => void;
}

const POPULAR_TEAMS = [
  { name: 'ลิเวอร์พูล', logo: '', color: '#C8102E' },
  { name: 'แมนเชสเตอร์ ซิตี้', logo: '', color: '#6CABDD' },
  { name: 'อาร์เซนอล', logo: '', color: '#EF0107' },
  { name: 'เชลซี', logo: '', color: '#034694' },
  { name: 'แมนเชสเตอร์ ยูไนเต็ด', logo: '', color: '#DA291C' },
  { name: 'ท็อตแนม ฮ็อตสเปอร์', logo: '', color: '#132257' },
  { name: 'เรอัล มาดริด', logo: '', color: '#FFFFFF' },
  { name: 'บาร์เซโลนา', logo: '', color: '#004D98' },
  { name: 'บาเยิร์น มิวนิค', logo: '', color: '#DC052D' },
  { name: 'บุรีรัมย์ ยูไนเต็ด', logo: '', color: '#002B66' },
  { name: 'เมืองทอง ยูไนเต็ด', logo: '', color: '#CC0000' },
];

export const LiveStreamManagement: React.FC<LiveStreamManagementProps> = ({
  streams,
  onAddStream,
  onUpdateStream,
  onDeleteStream,
  onOpenPlayer,
  onSendNotification,
}) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<LiveStream | null>(null);

  // Modal State for Notify Users
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [notifyingStream, setNotifyingStream] = useState<LiveStream | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formLeague, setFormLeague] = useState('พรีเมียร์ลีก อังกฤษ (Premier League)');
  const [formCategory, setFormCategory] = useState<'football' | 'boxing' | 'motorsport' | 'basketball' | 'tv-channel' | 'special'>('football');
  const [formStatus, setFormStatus] = useState<LiveMatchStatus>('live');
  const [formHomeName, setFormHomeName] = useState('');
  const [formHomeLogo, setFormHomeLogo] = useState('');
  const [formHomeScore, setFormHomeScore] = useState<number>(0);
  const [formHomeColor, setFormHomeColor] = useState('#C8102E');

  const [formAwayName, setFormAwayName] = useState('');
  const [formAwayLogo, setFormAwayLogo] = useState('');
  const [formAwayScore, setFormAwayScore] = useState<number>(0);
  const [formAwayColor, setFormAwayColor] = useState('#6CABDD');

  const [formMatchTime, setFormMatchTime] = useState('');
  const [formMatchDate, setFormMatchDate] = useState('');
  const [formStadium, setFormStadium] = useState('');
  const [formRound, setFormRound] = useState('');
  const [formMinute, setFormMinute] = useState('');
  const [formResolution, setFormResolution] = useState('1080p 60FPS');
  const [formCommentary, setFormCommentary] = useState('');
  const [formChannel, setFormChannel] = useState('');
  const [formPinned, setFormPinned] = useState(false);

  // Server URLs
  const [formServers, setFormServers] = useState<StreamServer[]>([
    {
      id: 'srv-1',
      name: 'Server 1',
      quality: '1080p 60FPS',
      url: '',
    },
  ]);

  const handleOpenAddModal = () => {
    setEditingStream(null);
    setFormTitle('');
    setFormLeague('พรีเมียร์ลีก อังกฤษ (Premier League)');
    setFormCategory('football');
    setFormStatus('live');
    setFormHomeName('');
    setFormHomeLogo('');
    setFormHomeScore(0);
    setFormHomeColor('#C8102E');
    setFormAwayName('');
    setFormAwayLogo('');
    setFormAwayScore(0);
    setFormAwayColor('#6CABDD');
    setFormMatchTime('');
    setFormMatchDate('');
    setFormStadium('');
    setFormRound('');
    setFormMinute('');
    setFormResolution('1080p 60FPS');
    setFormCommentary('');
    setFormChannel('');
    setFormPinned(false);
    setFormServers([
      {
        id: 'srv-1',
        name: 'Server 1',
        quality: '1080p 60FPS',
        url: '',
      },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (stream: LiveStream) => {
    setEditingStream(stream);
    setFormTitle(stream.title);
    setFormLeague(stream.league);
    setFormCategory(stream.category);
    setFormStatus(stream.status);
    setFormHomeName(stream.homeTeam.name);
    setFormHomeLogo(stream.homeTeam.logo);
    setFormHomeScore(stream.homeTeam.score || 0);
    setFormHomeColor(stream.homeTeam.color || '#E50914');
    setFormAwayName(stream.awayTeam.name);
    setFormAwayLogo(stream.awayTeam.logo);
    setFormAwayScore(stream.awayTeam.score || 0);
    setFormAwayColor(stream.awayTeam.color || '#0071EB');
    setFormMatchTime(stream.matchTime);
    setFormMatchDate(stream.matchDate);
    setFormStadium(stream.stadium || '');
    setFormRound(stream.competitionRound || '');
    setFormMinute(stream.currentMinute || '');
    setFormResolution(stream.resolution || '4K UHD 60FPS');
    setFormCommentary(stream.commentary || 'พากย์ไทย');
    setFormChannel(stream.channelName || 'True Premier Football HD 1');
    setFormPinned(stream.pinned ?? true);
    setFormServers(stream.streamServers || []);
    setIsModalOpen(true);
  };

  const handleSaveStream = (e: React.FormEvent) => {
    e.preventDefault();

    const streamData: LiveStream = {
      id: editingStream ? editingStream.id : `live-${Date.now()}`,
      code: editingStream ? editingStream.code : `#LIVE-${Math.floor(100 + Math.random() * 900)}`,
      title: formTitle || `${formHomeName} พบ ${formAwayName}`,
      league: formLeague,
      category: formCategory,
      status: formStatus,
      homeTeam: {
        name: formHomeName,
        logo: formHomeLogo,
        score: formHomeScore,
        color: formHomeColor,
      },
      awayTeam: {
        name: formAwayName,
        logo: formAwayLogo,
        score: formAwayScore,
        color: formAwayColor,
      },
      matchTime: formMatchTime,
      matchDate: formMatchDate,
      stadium: formStadium,
      competitionRound: formRound,
      currentMinute: formMinute,
      streamServers: formServers.length > 0 ? formServers : [
        {
          id: 'srv-1',
          name: 'Server 1',
          quality: '1080p 60FPS',
          url: '',
        }
      ],
      currentViewers: editingStream ? editingStream.currentViewers : 0,
      thumbnail: editingStream ? editingStream.thumbnail : '',
      backdrop: editingStream ? editingStream.backdrop : '',
      resolution: formResolution,
      commentary: formCommentary,
      channelName: formChannel,
      pinned: formPinned,
      featured: true,
      chatEnabled: true,
      createdAt: editingStream ? editingStream.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingStream) {
      onUpdateStream(streamData);
    } else {
      onAddStream(streamData);
    }

    setIsModalOpen(false);
  };

  // Quick Score Update Handlers
  const handleQuickScoreChange = (stream: LiveStream, team: 'home' | 'away', delta: number) => {
    const updated: LiveStream = {
      ...stream,
      homeTeam: {
        ...stream.homeTeam,
        score: team === 'home' ? Math.max(0, (stream.homeTeam.score || 0) + delta) : stream.homeTeam.score,
      },
      awayTeam: {
        ...stream.awayTeam,
        score: team === 'away' ? Math.max(0, (stream.awayTeam.score || 0) + delta) : stream.awayTeam.score,
      },
      updatedAt: new Date().toISOString(),
    };
    onUpdateStream(updated);
  };

  const handleToggleStatus = (stream: LiveStream) => {
    const nextStatus: LiveMatchStatus = stream.status === 'live' ? 'ended' : stream.status === 'upcoming' ? 'live' : 'upcoming';
    const updated: LiveStream = {
      ...stream,
      status: nextStatus,
      currentMinute: nextStatus === 'live' ? "1' (เริ่มเกม)" : nextStatus === 'ended' ? 'จบการแข่งขัน' : 'เร็วๆ นี้',
      updatedAt: new Date().toISOString(),
    };
    onUpdateStream(updated);
  };

  const handleOpenNotifyModal = (stream: LiveStream) => {
    setNotifyingStream(stream);
    setIsNotifyModalOpen(true);
  };

  const handleSendNotificationInternal = (notification: LiveNotification) => {
    if (onSendNotification) {
      onSendNotification(notification);
    }
  };

  // Filtering
  const filteredStreams = streams.filter((s) => {
    const matchSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.league.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'live' && s.status === 'live') ||
      (selectedCategory === 'upcoming' && s.status === 'upcoming') ||
      (selectedCategory === 'ended' && s.status === 'ended') ||
      s.category === selectedCategory;

    const matchLeague =
      selectedLeague === 'all' || s.league.includes(selectedLeague);

    return matchSearch && matchCategory && matchLeague;
  });

  const totalLiveMatches = streams.filter((s) => s.status === 'live').length;
  const totalLiveViewers = streams
    .filter((s) => s.status === 'live')
    .reduce((acc, curr) => acc + (curr.currentViewers || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529] tracking-tight">
            {t.liveStream.title}
          </h1>
          <p className="text-sm text-[#6C757D] mt-0.5">
            {t.liveStream.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {streams.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const activeStream = streams.find((s) => s.status === 'live') || streams[0];
                if (activeStream) handleOpenNotifyModal(activeStream);
              }}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#212529] border border-slate-300 font-medium text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Bell className="w-4 h-4 text-[#0D6EFD]" />
              <span>{t.liveStream.notifyUsers}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold text-sm rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.liveStream.addLiveStream}</span>
          </button>
        </div>
      </div>

      {/* Top KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-[#6C757D] font-medium">{t.liveStream.liveNowMatches}</div>
          <div className="text-2xl font-bold text-[#212529] mt-1 tabular-nums">{totalLiveMatches}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-[#6C757D] font-medium">{t.liveStream.liveViewersRealtime}</div>
          <div className="text-2xl font-bold text-[#212529] mt-1 tabular-nums">{totalLiveViewers.toLocaleString()}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-[#6C757D] font-medium">{language === 'th' ? 'รายการทั้งหมด' : 'Total Streams'}</div>
          <div className="text-2xl font-bold text-[#212529] mt-1 tabular-nums">{streams.length}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-[#6C757D] font-medium">{t.liveStream.streamingServers}</div>
          <div className="text-base font-bold text-emerald-700 mt-2">{t.liveStream.serversOnline}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6C757D]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.liveStream.searchPlaceholder}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
            >
              <option value="all">{t.liveStream.allLeagues}</option>
              <option value="พรีเมียร์ลีก">{language === 'th' ? 'พรีเมียร์ลีก อังกฤษ (EPL)' : 'Premier League (EPL)'}</option>
              <option value="แชมเปียนส์ลีก">{language === 'th' ? 'ยูฟ่า แชมเปียนส์ลีก (UCL)' : 'UEFA Champions League (UCL)'}</option>
              <option value="ไทยลีก">{language === 'th' ? 'รีโว่ ไทยลีก (Thai League)' : 'Thai League'}</option>
              <option value="ช่องกีฬา">{language === 'th' ? 'ช่องสด 24 ชม.' : '24H Live Channels'}</option>
            </select>

            <div className="flex items-center bg-[#F8F9FA] p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-xs font-medium rounded cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-[#212529] shadow-xs' : 'text-[#6C757D] hover:text-[#212529]'
                }`}
              >
                {t.liveStream.viewModeGrid}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-medium rounded cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-[#212529] shadow-xs' : 'text-[#6C757D] hover:text-[#212529]'
                }`}
              >
                {t.liveStream.viewModeTable}
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {[
            { id: 'all', label: t.common.all },
            { id: 'live', label: 'LIVE' },
            { id: 'upcoming', label: language === 'th' ? 'เร็วๆ นี้' : 'Upcoming' },
            { id: 'ended', label: language === 'th' ? 'จบการแข่งขัน' : 'Ended' },
            { id: 'football', label: language === 'th' ? 'ฟุตบอล' : 'Football' },
            { id: 'tv-channel', label: language === 'th' ? 'ช่องสด 24H' : '24H TV' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer border ${
                selectedCategory === cat.id
                  ? 'bg-[#0D6EFD] text-white border-[#0D6EFD]'
                  : 'bg-white text-[#6C757D] hover:text-[#212529] border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredStreams.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <Radio className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-[#212529]">
            {streams.length === 0
              ? (language === 'th' ? 'ยังไม่มีรายการถ่ายทอดสดในระบบ' : 'No live streams configured yet')
              : (language === 'th' ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'No matching live streams')}
          </h3>
          <p className="text-xs text-[#6C757D]">
            {streams.length === 0
              ? (language === 'th' ? 'คลิกเพิ่มคู่ถ่ายทอดสดเพื่อสร้างสตรีมรายการแรก' : 'Click add live stream to create your first broadcast')
              : (language === 'th' ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองหมวดหมู่' : 'Try adjusting your search or category filter')}
          </p>
          {streams.length === 0 && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.liveStream.addLiveStream}</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStreams.map((stream) => {
            const isLive = stream.status === 'live';
            const isUpcoming = stream.status === 'upcoming';

            return (
              <div
                key={stream.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col"
              >
                <div className="px-4 py-3 bg-[#F8F9FA] border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-[#212529] truncate">
                      {stream.league}
                    </span>
                    <span className="text-[11px] text-[#6C757D] font-mono shrink-0">{stream.code}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(stream)}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                      isLive
                        ? 'bg-red-50 text-[#DC3545] border-red-200'
                        : isUpcoming
                        ? 'bg-blue-50 text-[#0D6EFD] border-blue-200'
                        : 'bg-slate-100 text-[#6C757D] border-slate-200'
                    }`}
                  >
                    <span>{isLive ? 'LIVE' : isUpcoming ? (language === 'th' ? 'เร็วๆ นี้' : 'Upcoming') : (language === 'th' ? 'จบแล้ว' : 'Full Time')}</span>
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#6C757D]">
                    <span className="font-medium text-[#495057]">{stream.competitionRound || 'แมตช์เดย์'}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {stream.matchTime}
                    </span>
                  </div>

                  <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex flex-col items-center text-center flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#212529] truncate w-full">{stream.homeTeam.name}</div>
                      <div className="text-[10px] text-[#6C757D]">เจ้าบ้าน</div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleQuickScoreChange(stream, 'home', -1)}
                          aria-label="ลดสกอร์เจ้าบ้าน"
                          className="w-6 h-6 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[#212529] text-xs flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-lg font-bold text-[#212529] w-6 text-center tabular-nums">
                          {stream.homeTeam.score ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickScoreChange(stream, 'home', 1)}
                          aria-label="เพิ่มสกอร์เจ้าบ้าน"
                          className="w-6 h-6 rounded bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center px-2">
                      <span className="text-[#6C757D] text-xs font-bold uppercase mb-1">VS</span>
                      <div className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-semibold text-[#495057]">
                        {stream.currentMinute || (isLive ? "สด" : stream.matchTime)}
                      </div>
                    </div>

                    <div className="flex flex-col items-center text-center flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#212529] truncate w-full">{stream.awayTeam.name}</div>
                      <div className="text-[10px] text-[#6C757D]">ทีมเยือน</div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleQuickScoreChange(stream, 'away', -1)}
                          aria-label="ลดสกอร์ทีมเยือน"
                          className="w-6 h-6 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[#212529] text-xs flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-lg font-bold text-[#212529] w-6 text-center tabular-nums">
                          {stream.awayTeam.score ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickScoreChange(stream, 'away', 1)}
                          aria-label="เพิ่มสกอร์ทีมเยือน"
                          className="w-6 h-6 rounded bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#6C757D] px-1">
                    <span>{stream.streamServers.length} เซิร์ฟเวอร์ ({stream.resolution})</span>
                    <span className="font-medium text-[#212529] tabular-nums">{(stream.currentViewers || 0).toLocaleString()} ผู้ชม</span>
                  </div>
                </div>

                <div className="p-3 bg-[#F8F9FA] border-t border-slate-200 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenPlayer(stream)}
                    className="flex-1 py-2 rounded-lg bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>เปิดสตรีมสด</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenNotifyModal(stream)}
                    aria-label="ส่งการแจ้งเตือน"
                    className="p-2 rounded-lg bg-white hover:bg-slate-50 text-[#495057] transition cursor-pointer border border-slate-300"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(stream)}
                    aria-label="แก้ไขสตรีม"
                    className="p-2 rounded-lg bg-white hover:bg-slate-50 text-[#495057] transition cursor-pointer border border-slate-300"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteStream(stream.id)}
                    aria-label="ลบสตรีม"
                    className="p-2 rounded-lg bg-white hover:bg-red-50 text-[#DC3545] transition cursor-pointer border border-[#DC3545]/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#212529]">
              <thead className="bg-[#F8F9FA] text-[#212529] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">คู่แข่งขัน</th>
                  <th className="px-4 py-3">ลีก / รายการ</th>
                  <th className="px-4 py-3 text-center">สกอร์สด</th>
                  <th className="px-4 py-3 text-center">สถานะ</th>
                  <th className="px-4 py-3">เวลาแข่งขัน</th>
                  <th className="px-4 py-3">เซิร์ฟเวอร์</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStreams.map((stream) => (
                  <tr key={stream.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[#212529] text-sm">{stream.title}</div>
                      <div className="text-[11px] text-[#6C757D]">{stream.stadium || stream.channelName}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[#495057]">{stream.league}</td>
                    <td className="px-4 py-3.5 text-center font-bold text-sm tabular-nums">
                      {stream.homeTeam.score ?? 0} - {stream.awayTeam.score ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          stream.status === 'live'
                            ? 'bg-red-50 text-[#DC3545] border-red-200'
                            : stream.status === 'upcoming'
                            ? 'bg-blue-50 text-[#0D6EFD] border-blue-200'
                            : 'bg-slate-100 text-[#6C757D] border-slate-200'
                        }`}
                      >
                        {stream.status === 'live' ? 'LIVE' : stream.status === 'upcoming' ? (language === 'th' ? 'เร็วๆ นี้' : 'Upcoming') : (language === 'th' ? 'จบแล้ว' : 'Full Time')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#495057]">{stream.matchTime}</td>
                    <td className="px-4 py-3.5 text-[#6C757D]">
                      {stream.streamServers.length} ช่องทาง ({stream.resolution})
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPlayer(stream)}
                          aria-label="เปิดดูสด"
                          className="p-1.5 bg-[#0D6EFD] text-white rounded hover:bg-[#0B5ED7] transition cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(stream)}
                          aria-label="แก้ไข"
                          className="p-1.5 bg-white text-[#495057] border border-slate-200 rounded hover:bg-slate-50 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteStream(stream.id)}
                          aria-label="ลบ"
                          className="p-1.5 bg-white text-[#DC3545] border border-[#DC3545]/40 rounded hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-8">
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#212529]">
                {editingStream ? 'แก้ไขคู่ถ่ายทอดสด' : 'เพิ่มคู่ถ่ายทอดสด / สตรีมกีฬา'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="ปิด"
                className="text-[#6C757D] hover:text-[#212529] p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStream} className="p-5 space-y-4 text-xs sm:text-sm max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-[#F8F9FA] rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-[#495057]">เลือกทีมยอดนิยมแบบด่วน:</div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TEAMS.map((team) => (
                    <button
                      key={team.name}
                      type="button"
                      onClick={() => {
                        if (!formHomeName) {
                          setFormHomeName(team.name);
                          setFormHomeLogo(team.logo);
                          setFormHomeColor(team.color);
                        } else {
                          setFormAwayName(team.name);
                          setFormAwayLogo(team.logo);
                          setFormAwayColor(team.color);
                        }
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[#212529] text-xs rounded-md border border-slate-200 transition cursor-pointer"
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#495057] font-medium mb-1">ชื่อการถ่ายทอดสด *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="เช่น ลิเวอร์พูล พบ แมนฯ ซิตี้"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#495057] font-medium mb-1">ลีก / รายการแข่งขัน *</label>
                  <select
                    value={formLeague}
                    onChange={(e) => setFormLeague(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  >
                    <option value="พรีเมียร์ลีก อังกฤษ (Premier League)">พรีเมียร์ลีก อังกฤษ (Premier League)</option>
                    <option value="ยูฟ่า แชมเปียนส์ลีก (UEFA Champions League)">ยูฟ่า แชมเปียนส์ลีก (UEFA Champions League)</option>
                    <option value="ลาลีกา สเปน (La Liga)">ลาลีกา สเปน (La Liga)</option>
                    <option value="บุนเดสลีกา เยอรมัน (Bundesliga)">บุนเดสลีกา เยอรมัน (Bundesliga)</option>
                    <option value="รีโว่ ไทยลีก (Thai League 1)">รีโว่ ไทยลีก (Thai League 1)</option>
                    <option value="ช่องกีฬาพรีเมียม 24 ชั่วโมง">ช่องกีฬาพรีเมียม 24 ชั่วโมง</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F8F9FA] rounded-xl border border-slate-200">
                <div className="space-y-2.5">
                  <div className="font-semibold text-[#212529]">ทีมเจ้าบ้าน (Home)</div>
                  <input
                    type="text"
                    value={formHomeName}
                    onChange={(e) => setFormHomeName(e.target.value)}
                    placeholder="ชื่อทีมเหย้า"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[#212529]"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      value={formHomeScore}
                      onChange={(e) => setFormHomeScore(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[#212529]"
                    />
                    <input
                      type="color"
                      value={formHomeColor}
                      onChange={(e) => setFormHomeColor(e.target.value)}
                      className="w-full h-8 bg-white border border-slate-300 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="font-semibold text-[#212529]">ทีมเยือน (Away)</div>
                  <input
                    type="text"
                    value={formAwayName}
                    onChange={(e) => setFormAwayName(e.target.value)}
                    placeholder="ชื่อทีมเยือน"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[#212529]"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      value={formAwayScore}
                      onChange={(e) => setFormAwayScore(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[#212529]"
                    />
                    <input
                      type="color"
                      value={formAwayColor}
                      onChange={(e) => setFormAwayColor(e.target.value)}
                      className="w-full h-8 bg-white border border-slate-300 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#495057] font-medium mb-1">สถานะสตรีม</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as LiveMatchStatus)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529]"
                  >
                    <option value="live">กำลังถ่ายทอดสด (LIVE)</option>
                    <option value="upcoming">เร็วๆ นี้ (Upcoming)</option>
                    <option value="ended">จบการแข่งขัน (Ended)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#495057] font-medium mb-1">เวลาสตรีม</label>
                  <input
                    type="text"
                    value={formMatchTime}
                    onChange={(e) => setFormMatchTime(e.target.value)}
                    placeholder="เช่น 22:30 น."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529]"
                  />
                </div>
                <div>
                  <label className="block text-[#495057] font-medium mb-1">นาทีการแข่งขัน</label>
                  <input
                    type="text"
                    value={formMinute}
                    onChange={(e) => setFormMinute(e.target.value)}
                    placeholder="เช่น 78'"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529]"
                  />
                </div>
              </div>

              {/* Stream Servers Configuration */}
              <div className="p-4 bg-[#F8F9FA] rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#212529]">เซิร์ฟเวอร์สตรีมมิ่ง (Stream URLs)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormServers([
                        ...formServers,
                        {
                          id: `srv-${Date.now()}`,
                          name: `Server ${formServers.length + 1}`,
                          quality: '1080p 60FPS',
                          url: '',
                          isBackup: true,
                        },
                      ]);
                    }}
                    className="text-xs text-[#0D6EFD] hover:underline font-semibold cursor-pointer"
                  >
                    + เพิ่มเซิร์ฟเวอร์
                  </button>
                </div>

                {formServers.map((srv, idx) => (
                  <div key={srv.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={srv.name}
                        onChange={(e) => {
                          const updated = [...formServers];
                          updated[idx].name = e.target.value;
                          setFormServers(updated);
                        }}
                        placeholder="ชื่อ Server"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-[#212529]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={srv.quality}
                        onChange={(e) => {
                          const updated = [...formServers];
                          updated[idx].quality = e.target.value;
                          setFormServers(updated);
                        }}
                        placeholder="1080p"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-[#212529]"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={srv.url}
                        onChange={(e) => {
                          const updated = [...formServers];
                          updated[idx].url = e.target.value;
                          setFormServers(updated);
                        }}
                        placeholder="URL สตรีม (m3u8, mp4, iframe)"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-[#212529] font-mono"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-center">
                      {formServers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormServers(formServers.filter((_, i) => i !== idx))}
                          aria-label="ลบเซิร์ฟเวอร์"
                          className="text-[#DC3545] hover:bg-red-50 p-1 rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-[#495057] border border-slate-300 rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold rounded-lg transition cursor-pointer"
                >
                  {editingStream ? 'บันทึกการแก้ไข' : 'เพิ่มคู่ถ่ายทอดสด'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Push Notification Modal */}
      <LiveStreamNotifyModal
        isOpen={isNotifyModalOpen}
        onClose={() => {
          setIsNotifyModalOpen(false);
          setNotifyingStream(null);
        }}
        stream={notifyingStream}
        onSendNotification={handleSendNotificationInternal}
      />
    </div>
  );
};
