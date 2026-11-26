import React, { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  CloudDownload,
  CreditCard,
  Eye,
  Film,
  Gauge,
  Image as ImageIcon,
  Menu,
  Radio,
  Settings,
  Shield,
  UserCircle2,
  Users,
} from 'lucide-react';
import { AdminMenuTab, User } from '../types';

interface StudioTopNavProps {
  currentTab: AdminMenuTab;
  currentUser: User;
  onSelectTab: (tab: AdminMenuTab) => void;
  onOpenApiSync: () => void;
  onOpenPreview: () => void;
  onLogout: () => void;
}

export const StudioTopNav: React.FC<StudioTopNavProps> = ({
  currentTab,
  currentUser,
  onSelectTab,
  onOpenApiSync,
  onOpenPreview,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const primaryMenuItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'dashboard',
      label: 'แดชบอร์ด',
      icon: Gauge,
      active: currentTab === 'dashboard',
      onClick: () => {
        onSelectTab('dashboard');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'movies',
      label: 'คลังหนัง',
      icon: Film,
      active: currentTab === 'movies',
      onClick: () => {
        onSelectTab('movies');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'categories',
      label: 'หมวดหมู่ / แนวหนัง',
      icon: Clapperboard,
      active: currentTab === 'categories' || currentTab === 'genres',
      onClick: () => {
        onSelectTab('categories');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'members',
      label: 'สมาชิก',
      icon: Users,
      active: currentTab === 'members',
      onClick: () => {
        onSelectTab('members');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'payments',
      label: 'วิธีชำระเงิน',
      icon: CreditCard,
      active: currentTab === 'payments',
      onClick: () => {
        onSelectTab('payments');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'admins',
      label: 'ผู้ดูแลระบบ',
      icon: Shield,
      active: currentTab === 'admins' || currentTab === 'users',
      onClick: () => {
        onSelectTab('admins');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'api-import',
      label: 'นำเข้าซีรีส์จาก API',
      icon: CloudDownload,
      active: false,
      onClick: () => {
        setIsMenuOpen(false);
        onOpenApiSync();
      },
    },
  ];

  const secondaryMenuItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'live-streams',
      label: 'ถ่ายทอดสด',
      icon: Radio,
      active: currentTab === 'live-streams',
      onClick: () => {
        onSelectTab('live-streams');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'banners',
      label: 'แบนเนอร์หน้าหลัก',
      icon: ImageIcon,
      active: currentTab === 'home-banners' || currentTab === 'banner-templates',
      onClick: () => {
        onSelectTab('home-banners');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'media',
      label: 'คลังรูปภาพ',
      icon: ImageIcon,
      active: currentTab === 'media-library',
      onClick: () => {
        onSelectTab('media-library');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'settings',
      label: 'ตั้งค่าเว็บไซต์',
      icon: Settings,
      active:
        currentTab === 'settings' ||
        currentTab === 'seo' ||
        currentTab === 'faqs' ||
        currentTab === 'video-ads' ||
        currentTab === 'header-menu' ||
        currentTab === 'footer-menu',
      onClick: () => {
        onSelectTab('settings');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'preview',
      label: 'ดูตัวอย่างหน้าเว็บ',
      icon: Eye,
      active: false,
      onClick: () => {
        setIsMenuOpen(false);
        onOpenPreview();
      },
    },
  ];

  const displayAccountName =
    currentUser.role === 'admin' ? 'Administrator' : currentUser.name || currentUser.username;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Hamburger menu button + floating dropdown menu */}
        <div ref={menuContainerRef} className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="เปิดเมนูนำทาง"
            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isMenuOpen
                ? 'bg-[#6C757D] border-[#6C757D] text-white'
                : 'bg-white border-slate-300 text-[#495057] hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Floating Dropdown Menu (matches reference screenshots 2 & 4) */}
          {isMenuOpen && (
            <nav
              role="menu"
              aria-label="เมนูหลักผู้ดูแลระบบ"
              className="absolute left-0 top-12 w-60 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50 fade-in"
            >
              <div className="space-y-0.5">
                {primaryMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={item.onClick}
                      className={`w-full px-4 py-2.5 text-left text-[15px] flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                        item.active
                          ? 'bg-blue-50/80 text-[#0D6EFD] font-semibold'
                          : 'text-[#212529] hover:bg-slate-50 font-normal'
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${
                          item.active ? 'text-[#0D6EFD]' : 'text-[#495057]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="my-1.5 border-t border-slate-100" />

              <div className="space-y-0.5">
                {secondaryMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={item.onClick}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                        item.active
                          ? 'bg-blue-50/80 text-[#0D6EFD] font-semibold'
                          : 'text-[#6C757D] hover:text-[#212529] hover:bg-slate-50 font-normal'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          item.active ? 'text-[#0D6EFD]' : 'text-[#6C757D]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>

        {/* Right: User label + red-outlined Logout button */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('admins')}
            className="inline-flex items-center gap-2 text-sm text-[#6C757D] hover:text-[#212529] transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserCircle2 className="w-5 h-5 text-[#6C757D]" />
            <span className="font-normal">{displayAccountName}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-lg border border-[#DC3545] text-[#DC3545] bg-white hover:bg-[#DC3545] hover:text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>
  );
};
