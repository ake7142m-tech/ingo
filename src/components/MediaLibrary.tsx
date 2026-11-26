import React, { useState, useEffect } from 'react';
import { ImagePlus, Upload, Copy, Check, Trash2, Search } from 'lucide-react';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  dimensions: string;
  size: string;
  date: string;
}

const STORAGE_KEY = 'freedom_media_items';

export const MediaLibrary: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore invalid storage
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mediaItems));
    } catch {
      // ignore storage quota errors
    }
  }, [mediaItems]);

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : URL.createObjectURL(file);
      const newItem: MediaItem = {
        id: `med-${Date.now()}`,
        name: file.name,
        url: dataUrl,
        dimensions: 'Original',
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        date: new Date().toISOString().split('T')[0],
      };
      setMediaItems((prev) => [newItem, ...prev]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDelete = (id: string) => {
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
  };

  const filtered = mediaItems.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529]">
            คลังรูปภาพ
          </h1>
          <p className="text-sm text-[#6C757D] mt-1">
            อัปโหลดและจัดการไฟล์รูปภาพโปสเตอร์และแบนเนอร์
          </p>
        </div>

        <label className="bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2 cursor-pointer transition whitespace-nowrap">
          <Upload className="w-4 h-4" />
          <span>อัปโหลดรูปภาพ</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาชื่อไฟล์รูปภาพ..."
          className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200/90 shadow-xs space-y-2">
          <ImagePlus className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-[#212529]">
            {mediaItems.length === 0
              ? 'ยังไม่มีไฟล์รูปภาพในคลังสื่อ'
              : 'ไม่พบไฟล์รูปภาพที่ตรงกับคำค้นหา'}
          </p>
          <p className="text-xs text-[#6C757D]">
            {mediaItems.length === 0
              ? 'อัปโหลดรูปภาพใหม่เพื่อเริ่มจัดเก็บและใช้งานในระบบ'
              : 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl overflow-hidden border border-slate-200/90 shadow-xs flex flex-col"
            >
              <div className="aspect-video relative bg-slate-100 overflow-hidden">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between text-xs">
                <div>
                  <p className="font-semibold text-[#212529] truncate" title={item.name}>
                    {item.name}
                  </p>
                  <div className="flex items-center justify-between text-[#6C757D] mt-1 tabular-nums">
                    <span>{item.size}</span>
                    <span>{item.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 mt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.url, item.id)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      copiedId === item.id
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-300 text-[#212529] hover:bg-slate-50'
                    }`}
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอกลิงก์</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 border border-red-200 text-[#DC3545] hover:bg-red-50 rounded-lg transition cursor-pointer"
                    aria-label={`ลบ ${item.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
