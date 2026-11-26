import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Movie } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  movie: Movie | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  movie,
}) => {
  const { t, language } = useLanguage();
  if (!isOpen || !movie) return null;

  const displayTitle = language === 'en' && movie.titleEn ? movie.titleEn : movie.title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl fade-in p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-11 h-11 rounded-full bg-red-50 text-[#DC3545] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="text-slate-400 hover:text-[#212529] p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-lg font-bold text-[#212529] mb-2">{t.deleteConfirm.title}</h3>
        <p className="text-sm text-[#6C757D] mb-4">
          คุณต้องการลบภาพยนตร์ <strong className="text-[#212529]">"{displayTitle}"</strong> ({movie.code}) ออกจากคลังหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>

        <div className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-xl mb-6 border border-slate-200">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={displayTitle}
              referrerPolicy="no-referrer"
              className="w-12 h-16 object-cover rounded-md"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-16 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-mono">
              {movie.code}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-[#212529] text-sm truncate">{displayTitle}</div>
            <div className="text-xs text-[#6C757D] mt-0.5">
              ปี {movie.year} · {movie.category || 'ไม่ระบุหมวดหมู่'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#495057] hover:text-[#212529] border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-[#DC3545] hover:bg-[#BB2D3B] text-white font-medium px-4 py-2 rounded-lg text-sm transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteConfirm.confirm}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
