import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Eye,
  Check,
  Power,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Sparkles,
  ExternalLink,
  Edit3,
  RotateCcw,
  Info,
  CheckCircle2,
  X,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { Banner } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Tooltip } from './Tooltip';

interface BannersManagementProps {
  banners: Banner[];
  onUpdateBanners: (banners: Banner[]) => void;
  onOpenPreview?: () => void;
}

export const BannersManagement: React.FC<BannersManagementProps> = ({
  banners,
  onUpdateBanners,
  onOpenPreview,
}) => {
  const { t, language } = useLanguage();

  // New Banner Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [badgeText, setBadgeText] = useState('แนะนำพิเศษ');
  const [actionUrl, setActionUrl] = useState('#');

  // Edit Banner State
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedItemHeight, setDraggedItemHeight] = useState<number | null>(null);

  // Status Notification / Feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Re-index orders sequentially
  const normalizeOrders = (list: Banner[]): Banner[] => {
    return list.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Measure element height for placeholder sizing
    const target = e.currentTarget;
    if (target) {
      setDraggedItemHeight(target.clientHeight);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDraggedItemHeight(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    const updated = [...banners];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    const reordered = normalizeOrders(updated);
    onUpdateBanners(reordered);
    showStatus(
      language === 'th'
        ? `จัดลำดับแบนเนอร์ใหม่: "${draggedItem.title}" อยู่ที่อันดับ #${targetIndex + 1} แล้ว`
        : `Reordered: "${draggedItem.title}" is now at position #${targetIndex + 1}`
    );
    handleDragEnd();
  };

  // 1-Click Move Handlers
  const handleMove = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const updated = [...banners];
    const [item] = updated.splice(index, 1);

    if (direction === 'up' && index > 0) {
      updated.splice(index - 1, 0, item);
    } else if (direction === 'down' && index < banners.length - 1) {
      updated.splice(index + 1, 0, item);
    } else if (direction === 'top') {
      updated.unshift(item);
    } else if (direction === 'bottom') {
      updated.push(item);
    } else {
      return;
    }

    const reordered = normalizeOrders(updated);
    onUpdateBanners(reordered);
    showStatus(
      language === 'th'
        ? `เปลี่ยนลำดับ "${item.title}" เรียบร้อยแล้ว`
        : `Moved "${item.title}" successfully`
    );
  };

  // Add Banner
  const handleAddBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) return;

    const newBanner: Banner = {
      id: `ban-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim(),
      imageUrl: imageUrl.trim(),
      badgeText: badgeText.trim() || undefined,
      actionUrl: actionUrl.trim() || '#',
      active: true,
      order: banners.length + 1,
    };

    const updated = normalizeOrders([...banners, newBanner]);
    onUpdateBanners(updated);
    setTitle('');
    setSubtitle('');
    setImageUrl('');
    setBadgeText('แนะนำพิเศษ');
    setActionUrl('#');
    showStatus(
      language === 'th'
        ? `เพิ่มแบนเนอร์ "${newBanner.title}" สำเร็จ (อันดับ #${updated.length})`
        : `Added banner "${newBanner.title}" successfully`
    );
  };

  // Toggle Banner Status
  const toggleBannerStatus = (id: string) => {
    const updated = banners.map((b) =>
      b.id === id ? { ...b, active: !b.active } : b
    );
    onUpdateBanners(updated);
    const target = banners.find((b) => b.id === id);
    if (target) {
      showStatus(
        target.active
          ? (language === 'th' ? `ปิดการแสดงผลแบนเนอร์ "${target.title}"` : `Disabled banner "${target.title}"`)
          : (language === 'th' ? `เปิดการแสดงผลแบนเนอร์ "${target.title}"` : `Enabled banner "${target.title}"`)
      );
    }
  };

  // Delete Banner
  const handleDeleteBanner = (id: string) => {
    const target = banners.find((b) => b.id === id);
    const filtered = banners.filter((b) => b.id !== id);
    const reordered = normalizeOrders(filtered);
    onUpdateBanners(reordered);
    showStatus(
      language === 'th'
        ? `ลบแบนเนอร์ "${target?.title || ''}" เรียบร้อยแล้ว`
        : `Deleted banner "${target?.title || ''}"`
    );
  };

  // Save Edited Banner
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;

    const updated = banners.map((b) =>
      b.id === editingBanner.id ? editingBanner : b
    );
    onUpdateBanners(updated);
    showStatus(
      language === 'th'
        ? `บันทึกการแก้ไขแบนเนอร์ "${editingBanner.title}" แล้ว`
        : `Saved edits for "${editingBanner.title}"`
    );
    setEditingBanner(null);
  };

  const activeBannersCount = banners.filter((b) => b.active).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529] tracking-tight">
            {t.banners.pageTitle}
          </h1>
          <p className="text-sm text-[#6C757D] mt-0.5">
            {t.banners.pageSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPreview && (
            <button
              type="button"
              onClick={onOpenPreview}
              className="bg-white hover:bg-slate-50 text-[#212529] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-300 shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#0D6EFD]" />
              <span>{t.header.previewSite}</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Status Notification Toast */}
      {statusMessage && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 bg-white text-[#212529] px-4 py-3 rounded-xl border border-emerald-200 shadow-lg flex items-center gap-2.5 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Summary Banner Bar & Drag Tip */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-[#495057]">
          <div className="w-8 h-8 rounded-lg bg-[#0D6EFD]/10 flex items-center justify-center shrink-0">
            <ArrowUpDown className="w-4 h-4 text-[#0D6EFD]" />
          </div>
          <div>
            <span className="font-semibold text-[#212529] block">
              {language === 'th' ? 'ระบบจัดลำดับแบบลากและวาง (Drag & Drop)' : 'Visual Drag-and-Drop Reordering'}
            </span>
            <span className="text-[#6C757D] text-[11px]">
              {language === 'th'
                ? 'ลากที่ปุ่มจับเพื่อสลับตำแหน่ง หรือใช้ปุ่มลูกศรเพื่อเลื่อนลำดับการแสดงผลในหน้าแรก'
                : 'Drag the grip handles to visually reorder homepage slides or use quick arrow controls.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <span className="bg-[#F8F9FA] border border-slate-200 px-3 py-1.5 rounded-lg text-[#495057] font-medium text-xs tabular-nums">
            {language === 'th' ? 'กำลังแสดงผล' : 'Active'}:{' '}
            <span className="text-emerald-700 font-bold">{activeBannersCount}</span> / {banners.length} {language === 'th' ? 'รายการ' : 'items'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Add New Banner */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 h-fit shadow-xs">
          <h2 className="text-base font-bold text-[#212529] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0D6EFD]" />
            {t.banners.addBannerBtn}
          </h2>

          <form onSubmit={handleAddBanner} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[#495057] font-medium mb-1">
                {t.banners.bannerTitle} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น หลานม่า (2024)"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
                required
              />
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1">
                {t.banners.bannerSubtitle}
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="คำบรรยายสั้นๆ สำหรับแบนเนอร์"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/15"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#495057] font-medium mb-1">
                  {t.banners.badgeText}
                </label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="เช่น แนะนำพิเศษ"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
                />
              </div>

              <div>
                <label className="block text-[#495057] font-medium mb-1">
                  {language === 'th' ? 'ลิงก์เป้าหมาย' : 'Target URL'}
                </label>
                <input
                  type="text"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="#"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#495057] font-medium mb-1">
                {t.banners.imageUrl} (16:9 แนวนอน) *
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] placeholder:text-slate-400 focus:outline-none focus:border-[#0D6EFD]"
                required
              />
            </div>

            {imageUrl.trim() && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mt-2">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                {badgeText && (
                  <span className="absolute top-2 left-2 bg-[#0D6EFD] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
                    {badgeText}
                  </span>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                  <div className="text-white font-semibold text-xs truncate">
                    {title || (language === 'th' ? 'ตัวอย่างชื่อแบนเนอร์' : 'Banner Title Preview')}
                  </div>
                  <div className="text-slate-200 text-[10px] truncate">
                    {subtitle || (language === 'th' ? 'คำบรรยายแบนเนอร์' : 'Subtitle Preview')}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t.banners.addBannerBtn}</span>
            </button>
          </form>
        </div>

        {/* Banners List with Drag and Drop */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-[#6C757D]">
            <span className="font-medium text-[#212529]">
              {language === 'th'
                ? `รายการแบนเนอร์ทั้งหมด (${banners.length})`
                : `All Banners (${banners.length})`}
            </span>
            <span className="text-[11px]">
              {language === 'th'
                ? 'เรียงจากบนลงล่าง (#1 = ภาพหลักบนหน้าแรก)'
                : 'Top to bottom (#1 = Hero Slide)'}
            </span>
          </div>

          {banners.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center border border-slate-200 text-[#6C757D] shadow-xs">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-[#212529]">
                {language === 'th' ? 'ยังไม่มีแบนเนอร์ในระบบ' : 'No banners available'}
              </p>
              <p className="text-xs text-[#6C757D] mt-1">
                {language === 'th'
                  ? 'เพิ่มแบนเนอร์ใหม่จากแบบฟอร์มด้านซ้าย'
                  : 'Add a new banner using the form on the left.'}
              </p>
            </div>
          ) : (
            banners.map((banner, index) => {
              const isDragged = draggedIndex === index;
              const isDragOver = dragOverIndex === index && draggedIndex !== index;
              const isFirst = index === 0;
              const isLast = index === banners.length - 1;

              return (
                <div
                  key={banner.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`relative bg-white rounded-xl overflow-hidden border transition-all duration-200 flex flex-col md:flex-row group ${
                    isDragged
                      ? 'opacity-40 scale-[0.98] border-dashed border-[#0D6EFD] shadow-md'
                      : isDragOver
                      ? 'border-[#0D6EFD] bg-blue-50/40 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {isDragOver && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-[#0D6EFD] z-20" />
                  )}

                  {/* Drag Handle & Order Bar */}
                  <div className="bg-[#F8F9FA] px-3 py-3 md:py-0 border-b md:border-b-0 md:border-r border-slate-200 flex md:flex-col items-center justify-between md:justify-center gap-2 shrink-0 select-none">
                    <Tooltip
                      content={
                        language === 'th'
                          ? 'คลิกค้างแล้วลากเพื่อสลับลำดับ'
                          : 'Click and drag to reorder'
                      }
                      position="right"
                    >
                      <div className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-[#6C757D] hover:text-[#212529] hover:bg-slate-200/60 transition flex items-center gap-1.5">
                        <GripVertical className="w-5 h-5" />
                      </div>
                    </Tooltip>

                    <div
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md text-center ${
                        isFirst
                          ? 'bg-[#0D6EFD] text-white'
                          : 'bg-slate-200 text-[#495057]'
                      }`}
                    >
                      #{index + 1}
                    </div>

                    <div className="flex md:flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={isFirst}
                        aria-label="เลื่อนขึ้น"
                        className="p-1 text-[#6C757D] hover:text-[#212529] disabled:opacity-30 hover:bg-slate-200/70 rounded cursor-pointer transition"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={isLast}
                        aria-label="เลื่อนลง"
                        className="p-1 text-[#6C757D] hover:text-[#212529] disabled:opacity-30 hover:bg-slate-200/70 rounded cursor-pointer transition"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Image */}
                  <div className="md:w-52 aspect-video relative overflow-hidden bg-slate-100 shrink-0">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {banner.badgeText && (
                      <span className="absolute top-2 left-2 bg-[#0D6EFD] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
                        {banner.badgeText}
                      </span>
                    )}
                  </div>

                  {/* Info & Action Controls */}
                  <div className="p-4 flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-[#212529] truncate">
                          {banner.title}
                        </h3>
                        <p className="text-xs text-[#6C757D] mt-0.5 line-clamp-2 leading-relaxed">
                          {banner.subtitle || (language === 'th' ? 'ไม่มีคำบรรยาย' : 'No description')}
                        </p>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium shrink-0 border ${
                          banner.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-[#6C757D] border-slate-200'
                        }`}
                      >
                        {banner.active
                          ? language === 'th' ? 'กำลังแสดง' : 'Active'
                          : language === 'th' ? 'ปิดการแสดง' : 'Inactive'}
                      </span>
                    </div>

                    {/* Bottom Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(index, 'top')}
                          disabled={isFirst}
                          className="px-2 py-1 text-[11px] text-[#495057] hover:text-[#212529] bg-[#F8F9FA] hover:bg-slate-100 border border-slate-200 rounded disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                        >
                          <ChevronsUp className="w-3 h-3" />
                          <span>{language === 'th' ? 'บนสุด' : 'Top'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, 'bottom')}
                          disabled={isLast}
                          className="px-2 py-1 text-[11px] text-[#495057] hover:text-[#212529] bg-[#F8F9FA] hover:bg-slate-100 border border-slate-200 rounded disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                        >
                          <ChevronsDown className="w-3 h-3" />
                          <span>{language === 'th' ? 'ล่างสุด' : 'Bottom'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingBanner(banner)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#212529] rounded-md transition flex items-center gap-1 cursor-pointer border border-slate-200"
                        >
                          <Edit3 className="w-3 h-3 text-[#0D6EFD]" />
                          <span>{language === 'th' ? 'แก้ไข' : 'Edit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleBannerStatus(banner.id)}
                          className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer border ${
                            banner.active
                              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>
                            {banner.active
                              ? language === 'th' ? 'ปิดใช้งาน' : 'Disable'
                              : language === 'th' ? 'เปิดใช้งาน' : 'Enable'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="px-2.5 py-1 bg-white hover:bg-red-50 text-[#DC3545] rounded-md transition flex items-center gap-1 cursor-pointer border border-[#DC3545]/40"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t.common.delete}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Banner Modal */}
      {editingBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-[#212529] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0D6EFD]" />
                <span>{language === 'th' ? 'แก้ไขข้อมูลแบนเนอร์' : 'Edit Banner Details'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingBanner(null)}
                aria-label="ปิด"
                className="text-[#6C757D] hover:text-[#212529] p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#495057] font-medium mb-1">
                  {t.banners.bannerTitle} *
                </label>
                <input
                  type="text"
                  value={editingBanner.title}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, title: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#495057] font-medium mb-1">
                  {t.banners.bannerSubtitle}
                </label>
                <input
                  type="text"
                  value={editingBanner.subtitle}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, subtitle: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#495057] font-medium mb-1">
                    {t.banners.badgeText}
                  </label>
                  <input
                    type="text"
                    value={editingBanner.badgeText || ''}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, badgeText: e.target.value })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  />
                </div>

                <div>
                  <label className="block text-[#495057] font-medium mb-1">
                    {language === 'th' ? 'ลิงก์เป้าหมาย' : 'Target URL'}
                  </label>
                  <input
                    type="text"
                    value={editingBanner.actionUrl || '#'}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, actionUrl: e.target.value })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#495057] font-medium mb-1">
                  {t.banners.imageUrl} *
                </label>
                <input
                  type="text"
                  value={editingBanner.imageUrl}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, imageUrl: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:border-[#0D6EFD]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-[#495057] border border-slate-300 transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-semibold transition cursor-pointer"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
