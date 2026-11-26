import React, { useState } from 'react';
import {
  Settings,
  Globe,
  FileText,
  HelpCircle,
  PlaySquare,
  LayoutTemplate,
  Network,
  Save,
  Check,
  Plus,
  Trash2,
  Database,
  Key,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Code2,
  Send,
  Copy,
  Terminal,
} from 'lucide-react';
import { SiteSettings, SeoConfig, FAQItem, VideoAd, AdminMenuTab } from '../types';
import {
  validateSeriesJeenKey,
  getStoredSeriesJeenKey,
  setStoredSeriesJeenKey,
  SERIES_JEEN_BASE_URL,
  OPENAPI_SPEC_URL,
} from '../services/seriesJeenService';
import { useLanguage } from '../context/LanguageContext';

interface SettingsManagementProps {
  initialTab?: AdminMenuTab;
  settings: SiteSettings;
  seo: SeoConfig;
  faqs: FAQItem[];
  videoAds: VideoAd[];
  onUpdateSettings: (settings: SiteSettings) => void;
  onUpdateSeo: (seo: SeoConfig) => void;
  onUpdateFaqs: (faqs: FAQItem[]) => void;
  onUpdateVideoAds: (ads: VideoAd[]) => void;
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({
  initialTab = 'settings',
  settings,
  seo,
  faqs,
  videoAds,
  onUpdateSettings,
  onUpdateSeo,
  onUpdateFaqs,
  onUpdateVideoAds,
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>(
    initialTab === 'seo'
      ? 'seo'
      : initialTab === 'faqs'
      ? 'faqs'
      : initialTab === 'video-ads'
      ? 'ads'
      : initialTab === 'header-menu' || initialTab === 'footer-menu'
      ? 'menus'
      : 'general'
  );

  const [siteName, setSiteName] = useState(settings.siteName);
  const [siteTagline, setSiteTagline] = useState(settings.siteTagline);
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);
  const [apiKey, setApiKey] = useState(settings.apiKey || getStoredSeriesJeenKey());

  const [metaTitle, setMetaTitle] = useState(seo.metaTitle);
  const [metaDescription, setMetaDescription] = useState(seo.metaDescription);
  const [metaKeywords, setMetaKeywords] = useState(seo.metaKeywords);

  const [savedNotice, setSavedNotice] = useState(false);

  // Series Open API Testing state
  const [validatingApi, setValidatingApi] = useState(false);
  const [apiAuthResult, setApiAuthResult] = useState<{
    tested: boolean;
    valid: boolean;
    message: string;
    code: number;
    profile?: any;
  }>({
    tested: false,
    valid: false,
    message: '',
    code: 0,
  });

  // OpenAPI Sandbox State
  const [customEndpoint, setCustomEndpoint] = useState<string>('/health');
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<{
    status?: number;
    statusText?: string;
    latency?: number;
    data?: any;
    error?: string;
    timestamp?: string;
  } | null>(null);
  const [copiedSpec, setCopiedSpec] = useState(false);

  // New FAQ form state
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  const triggerSaveNotice = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredSeriesJeenKey(apiKey);
    onUpdateSettings({
      ...settings,
      siteName,
      siteTagline,
      supportEmail,
      maintenanceMode,
      apiKey,
    });
    triggerSaveNotice();
  };

  const handleTestApiKey = async () => {
    setValidatingApi(true);
    const res = await validateSeriesJeenKey(apiKey);
    setApiAuthResult({
      tested: true,
      valid: res.success,
      message: res.message,
      code: res.statusCode,
      profile: res.profile,
    });
    if (res.success) {
      setStoredSeriesJeenKey(apiKey);
    }
    setValidatingApi(false);
  };

  const handleRunSandbox = async () => {
    setTestingEndpoint(true);
    setSandboxResult(null);
    const endpointToCall = customEndpoint.trim().startsWith('/')
      ? customEndpoint.trim()
      : `/${customEndpoint.trim()}`;
    const url = `${SERIES_JEEN_BASE_URL}${endpointToCall}`;
    const start = performance.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const res = await fetch(url, { headers });
      const latency = Math.round(performance.now() - start);
      let data: any;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      setSandboxResult({
        status: res.status,
        statusText: res.statusText,
        latency,
        data,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      setSandboxResult({
        status: 0,
        statusText: 'Network Error',
        latency,
        error: err.message || 'Cannot reach server',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  const handleCopySpecUrl = () => {
    navigator.clipboard.writeText(OPENAPI_SPEC_URL);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  const handleSaveSeo = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSeo({
      ...seo,
      metaTitle,
      metaDescription,
      metaKeywords,
    });
    triggerSaveNotice();
  };

  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQ.trim() || !newFaqA.trim()) return;

    const newFaq: FAQItem = {
      id: `faq-${Date.now()}`,
      question: newFaqQ.trim(),
      answer: newFaqA.trim(),
      category: language === 'th' ? 'ทั่วไป' : 'General',
      order: faqs.length + 1,
    };
    onUpdateFaqs([...faqs, newFaq]);
    setNewFaqQ('');
    setNewFaqA('');
  };

  const handleDeleteFaq = (id: string) => {
    onUpdateFaqs(faqs.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529] tracking-tight">
            {t.settings.title}
          </h1>
          <p className="text-sm text-[#6C757D] mt-0.5">
            {t.settings.subtitle}
          </p>
        </div>

        {savedNotice && (
          <div className="bg-emerald-50 text-emerald-700 px-3.5 py-2 rounded-lg border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{t.common.saved}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-xs sm:text-sm">
        {[
          { id: 'general', label: t.settings.tabGeneral, icon: Settings },
          { id: 'api', label: 'Series Open API', icon: Database },
          { id: 'seo', label: t.settings.tabSeo, icon: FileText },
          { id: 'faqs', label: t.settings.tabFaq, icon: HelpCircle },
          { id: 'ads', label: t.settings.tabAds, icon: PlaySquare },
          { id: 'menus', label: t.settings.tabMenus, icon: LayoutTemplate },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'api' && activeTab === 'tmdb');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-2 cursor-pointer border ${
                isActive
                  ? 'bg-[#0D6EFD] text-white border-[#0D6EFD] shadow-xs'
                  : 'bg-white text-[#495057] border-slate-200 hover:bg-slate-50 hover:text-[#212529]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="bg-white rounded-xl p-6 border border-slate-200 space-y-5 shadow-xs max-w-2xl text-xs sm:text-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                {t.settings.siteName}
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
              />
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                {t.settings.siteTagline}
              </label>
              <input
                type="text"
                value={siteTagline}
                onChange={(e) => setSiteTagline(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
              />
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                {t.settings.supportEmail}
              </label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
              />
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                Series Jeen API V2 Key (api-v2.seriesjeen.online)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง Series Jeen API Key หรือ Sub-key ของคุณที่นี่..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] font-mono focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="maintenanceCheck"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#0D6EFD] focus:ring-[#0D6EFD]"
              />
              <label htmlFor="maintenanceCheck" className="text-[#495057] cursor-pointer">
                {t.settings.maintenanceMode}
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t.common.save}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Series Open API Specification & Sandbox */}
      {(activeTab === 'api' || activeTab === 'tmdb') && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-5 shadow-xs max-w-4xl text-xs sm:text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-[#212529] flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0D6EFD]" />
                <span>Series Jeen API V2 Gateway (OpenAPI 3.1.0)</span>
              </h2>
              <p className="text-[#6C757D] mt-1">
                {language === 'th'
                  ? 'เชื่อมต่อ https://api-v2.seriesjeen.online ด้วย API Key เดิมหรือคีย์ย่อย'
                  : 'OpenAPI 3.1.0 client for https://api-v2.seriesjeen.online.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySpecUrl}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-[#212529] rounded-lg text-xs flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
              >
                {copiedSpec ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSpec ? 'คัดลอกลิงก์แล้ว' : 'คัดลอก openapi.json URL'}</span>
              </button>
              <a
                href={OPENAPI_SPEC_URL}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-[#0D6EFD] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 hover:bg-[#0B5ED7] transition"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>OpenAPI Schema</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* API Key Input & Validate */}
          <div className="space-y-3 bg-[#F8F9FA] p-4 rounded-xl border border-slate-200">
            <label className="block text-[#212529] font-semibold flex flex-wrap items-center justify-between gap-1">
              <span>Series Open API Key (Bearer Token)</span>
              <span className="text-[11px] text-[#6C757D] font-normal">ไม่ต้องพิมพ์คำว่า Bearer นำหน้า</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง Series Open API Key..."
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] font-mono focus:outline-none focus:border-[#0D6EFD]"
              />
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={validatingApi}
                className="bg-[#0D6EFD] hover:bg-[#0B5ED7] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${validatingApi ? 'animate-spin' : ''}`} />
                <span>{validatingApi ? (language === 'th' ? 'กำลังตรวจสอบ...' : 'Validating...') : t.settings.validateKeyBtn}</span>
              </button>
            </div>

            {apiAuthResult.tested && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 mt-2 text-xs ${
                  apiAuthResult.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {apiAuthResult.valid ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {apiAuthResult.valid
                      ? (language === 'th' ? 'สิทธิ์การเชื่อมต่อถูกต้อง' : 'API Key is Valid')
                      : (language === 'th' ? 'การตรวจสอบไม่ผ่าน' : 'Authentication Failed')}{' '}
                    (HTTP {apiAuthResult.code})
                  </div>
                  <p className="mt-0.5">{apiAuthResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Interactive OpenAPI Sandbox Tester */}
          <div className="bg-[#F8F9FA] p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#212529] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#0D6EFD]" />
                <span>ทดสอบคำขอ API (Sandbox)</span>
              </span>
              <span className="text-[11px] text-[#6C757D] font-mono">
                {SERIES_JEEN_BASE_URL}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'GET /health', path: '/health' },
                { label: 'GET /api/me', path: '/api/me' },
                { label: 'GET /api/platforms', path: '/api/platforms' },
                { label: 'GET /api/platforms/1/dramas', path: '/api/platforms/1/dramas?page=1&page_size=5' },
              ].map((preset) => (
                <button
                  key={preset.path}
                  type="button"
                  onClick={() => setCustomEndpoint(preset.path)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition border cursor-pointer ${
                    customEndpoint === preset.path
                      ? 'bg-[#0D6EFD] text-white border-[#0D6EFD] font-semibold'
                      : 'bg-white text-[#495057] hover:text-[#212529] border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden">
                <span className="px-3 py-2 text-xs font-bold text-emerald-700 bg-slate-50 border-r border-slate-200 font-mono">
                  GET
                </span>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="/health หรือ /api/platforms..."
                  className="flex-1 bg-transparent px-3 py-2 text-[#212529] font-mono text-xs focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleRunSandbox}
                disabled={testingEndpoint}
                className="bg-[#0D6EFD] hover:bg-[#0B5ED7] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer text-xs shrink-0"
              >
                {testingEndpoint ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{testingEndpoint ? 'กำลังส่ง...' : 'ส่งคำขอ'}</span>
              </button>
            </div>

            {sandboxResult && (
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded border ${
                        sandboxResult.status === 200
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      HTTP {sandboxResult.status} {sandboxResult.statusText}
                    </span>
                    <span className="text-[#6C757D]">
                      {sandboxResult.latency}ms
                    </span>
                  </div>
                  <span className="text-[#6C757D]">{sandboxResult.timestamp}</span>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  <pre className="text-[#212529] text-[11px] leading-relaxed">
                    {sandboxResult.error
                      ? JSON.stringify({ error: sandboxResult.error }, null, 2)
                      : JSON.stringify(sandboxResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveGeneral}
              className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold px-5 py-2.5 rounded-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t.common.save}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: SEO Configuration */}
      {activeTab === 'seo' && (
        <form onSubmit={handleSaveSeo} className="bg-white rounded-xl p-6 border border-slate-200 space-y-5 shadow-xs max-w-2xl text-xs sm:text-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                {t.settings.metaTitle}
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
              />
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                {t.settings.metaDescription}
              </label>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
              />
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1.5">
                {t.settings.metaKeywords}
              </label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold px-5 py-2.5 rounded-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t.common.save}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 4: FAQs Management */}
      {activeTab === 'faqs' && (
        <div className="space-y-5 max-w-3xl">
          <form onSubmit={handleAddFaq} className="bg-white rounded-xl p-5 border border-slate-200 space-y-3 shadow-xs">
            <h3 className="font-bold text-sm text-[#212529] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#0D6EFD]" />
              {t.settings.addFaqBtn}
            </h3>
            <div className="space-y-2.5">
              <input
                type="text"
                value={newFaqQ}
                onChange={(e) => setNewFaqQ(e.target.value)}
                placeholder={language === 'th' ? 'ระบุคำถาม...' : 'Enter question...'}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
              />
              <textarea
                rows={2}
                value={newFaqA}
                onChange={(e) => setNewFaqA(e.target.value)}
                placeholder={language === 'th' ? 'ระบุคำตอบ...' : 'Enter answer...'}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
              />
            </div>
            <button
              type="submit"
              className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.settings.addFaqBtn}</span>
            </button>
          </form>

          <div className="space-y-3">
            {faqs.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-[#6C757D] text-xs shadow-xs">
                {language === 'th'
                  ? 'ยังไม่มีคำถามที่พบบ่อยในระบบ สามารถเพิ่มรายการใหม่ได้จากแบบฟอร์มด้านบน'
                  : 'No FAQs configured yet. Add one using the form above.'}
              </div>
            ) : (
              faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="bg-white rounded-xl p-4 border border-slate-200 flex items-start justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="font-semibold text-[#212529] flex items-center gap-2">
                      <span className="text-[#0D6EFD]">Q:</span>
                      <span>{faq.question}</span>
                    </div>
                    <div className="text-[#6C757D] flex items-start gap-2 pt-0.5">
                      <span className="text-emerald-700 font-semibold">A:</span>
                      <span>{faq.answer}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteFaq(faq.id)}
                    aria-label={`ลบคำถาม ${faq.question}`}
                    className="p-1.5 text-[#6C757D] hover:text-[#DC3545] hover:bg-red-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Video Ads */}
      {activeTab === 'ads' && (
        <div className="space-y-4 max-w-3xl">
          <h3 className="font-bold text-sm text-[#212529]">
            {language === 'th' ? 'รายการวิดีโอโฆษณาที่ติดตั้งในระบบ' : 'Installed Video Advertisements'}
          </h3>

          <div className="space-y-3">
            {videoAds.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-[#6C757D] text-xs shadow-xs">
                {language === 'th'
                  ? 'ยังไม่มีวิดีโอโฆษณาที่ติดตั้งในระบบ'
                  : 'No video advertisements installed yet.'}
              </div>
            ) : (
              videoAds.map((ad) => (
                <div
                  key={ad.id}
                  className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-[#212529]">{ad.title}</span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                        ad.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-[#6C757D] border-slate-200'
                      }`}
                    >
                      {ad.active ? (language === 'th' ? 'เปิดใช้งาน' : 'Active') : (language === 'th' ? 'ปิดชั่วคราว' : 'Disabled')}
                    </span>
                  </div>

                  <div className="text-xs text-[#6C757D] space-y-1">
                    <div>
                      {language === 'th' ? 'สปอนเซอร์:' : 'Sponsor:'} <strong className="text-[#212529]">{ad.sponsorName}</strong>
                    </div>
                    <div>
                      {language === 'th' ? 'ตำแหน่ง:' : 'Placement:'} <span className="text-[#0D6EFD] uppercase font-medium">{ad.placement}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Header & Footer Menus */}
      {activeTab === 'menus' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3 shadow-xs">
            <h3 className="font-bold text-sm text-[#212529] flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-[#0D6EFD]" />
              {language === 'th' ? 'ลิงก์เมนูส่วนหัว (Header Navigation)' : 'Header Navigation Links'}
            </h3>
            <ul className="text-xs text-[#212529] space-y-2">
              {[
                { label: language === 'th' ? 'หน้าแรก' : 'Home', path: '/home' },
                { label: language === 'th' ? 'คลังหนังทั้งหมด' : 'All Movies', path: '/movies' },
                { label: language === 'th' ? 'ซีรีส์ & หนังชุด' : 'Series & TV Shows', path: '/series' },
                { label: language === 'th' ? 'มาใหม่ & ยอดนิยม' : 'Trending & Popular', path: '/popular' },
              ].map((item) => (
                <li key={item.path} className="p-2.5 bg-[#F8F9FA] rounded-lg flex justify-between items-center border border-slate-200">
                  <span>{item.label}</span>
                  <span className="text-[#6C757D] font-mono">{item.path}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3 shadow-xs">
            <h3 className="font-bold text-sm text-[#212529] flex items-center gap-2">
              <Network className="w-4 h-4 text-[#0D6EFD]" />
              {language === 'th' ? 'ลิงก์เมนูส่วนท้าย (Footer Sitemap)' : 'Footer Sitemap Links'}
            </h3>
            <ul className="text-xs text-[#212529] space-y-2">
              {[
                { label: language === 'th' ? 'คำถามที่พบบ่อย' : 'FAQ', path: '/faq' },
                { label: language === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy', path: '/privacy' },
                { label: language === 'th' ? 'ข้อกำหนดการใช้งาน' : 'Terms of Service', path: '/terms' },
                { label: language === 'th' ? 'ติดต่อผู้ดูแลระบบ' : 'Contact Support', path: '/contact' },
              ].map((item) => (
                <li key={item.path} className="p-2.5 bg-[#F8F9FA] rounded-lg flex justify-between items-center border border-slate-200">
                  <span>{item.label}</span>
                  <span className="text-[#6C757D] font-mono">{item.path}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
