import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Category, Genre } from '../types';

interface CategoriesManagementProps {
  categories: Category[];
  genres: Genre[];
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateGenres: (genres: Genre[]) => void;
}

export const CategoriesManagement: React.FC<CategoriesManagementProps> = ({
  categories,
  genres,
  onUpdateCategories,
  onUpdateGenres,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'genres'>('categories');
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [newGenName, setNewGenName] = useState('');
  const [newGenColor, setNewGenColor] = useState('#0D6EFD');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      slug: newCatSlug.trim() || newCatName.trim().toLowerCase().replace(/\s+/g, '-'),
      count: 0,
      description: newCatDesc.trim() || undefined,
    };
    onUpdateCategories([...categories, newCat]);
    setNewCatName('');
    setNewCatSlug('');
    setNewCatDesc('');
  };

  const handleDeleteCategory = (id: string) => {
    onUpdateCategories(categories.filter((c) => c.id !== id));
  };

  const handleAddGenre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenName.trim()) return;
    const newGen: Genre = {
      id: `gen-${Date.now()}`,
      name: newGenName.trim(),
      slug: newGenName.trim().toLowerCase().replace(/\s+/g, '-'),
      color: newGenColor,
    };
    onUpdateGenres([...genres, newGen]);
    setNewGenName('');
  };

  const handleDeleteGenre = (id: string) => {
    onUpdateGenres(genres.filter((g) => g.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529]">
            หมวดหมู่ / แนวหนัง
          </h1>
          <p className="text-sm text-[#6C757D] mt-1">
            จัดระเบียบหมวดหมู่หลักและแท็กแนวภาพยนตร์ในคลัง
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('categories')}
            className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeSubTab === 'categories'
                ? 'bg-white text-[#212529] shadow-xs'
                : 'text-[#6C757D] hover:text-[#212529]'
            }`}
          >
            หมวดหมู่หนัง ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('genres')}
            className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeSubTab === 'genres'
                ? 'bg-white text-[#212529] shadow-xs'
                : 'text-[#6C757D] hover:text-[#212529]'
            }`}
          >
            แนวหนัง ({genres.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'categories' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Category Form */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs h-fit">
            <h2 className="text-base font-bold text-[#212529] mb-4">เพิ่มหมวดหมู่ใหม่</h2>

            <form onSubmit={handleAddCategory} className="space-y-4 text-sm">
              <div>
                <label htmlFor="cat-name" className="block text-[#495057] font-medium mb-1">
                  ชื่อหมวดหมู่ *
                </label>
                <input
                  id="cat-name"
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="เช่น หนังไทย, หนังแอคชั่น"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
                  required
                />
              </div>

              <div>
                <label htmlFor="cat-slug" className="block text-[#495057] font-medium mb-1">
                  Slug (URL)
                </label>
                <input
                  id="cat-slug"
                  type="text"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  placeholder="เช่น thai-movies, action"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
                />
              </div>

              <div>
                <label htmlFor="cat-desc" className="block text-[#495057] font-medium mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  id="cat-desc"
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="คำอธิบายสั้นๆ..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium py-2.5 px-4 rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>บันทึกหมวดหมู่</span>
              </button>
            </form>
          </div>

          {/* Categories List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h2 className="text-base font-bold text-[#212529]">รายการหมวดหมู่ทั้งหมด</h2>
            </div>

            <div className="divide-y divide-slate-200">
              {categories.length === 0 ? (
                <div className="py-12 px-4 text-center text-[#6C757D] text-sm">
                  ยังไม่มีหมวดหมู่ในระบบ เริ่มสร้างหมวดหมู่แรกจากแบบฟอร์มด้านซ้าย
                </div>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-sm text-[#212529] flex items-center gap-2">
                        <span>{cat.name}</span>
                        <span className="font-mono text-xs text-[#6C757D]">/{cat.slug}</span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-[#6C757D] mt-0.5">{cat.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#6C757D] tabular-nums">
                        {cat.count.toLocaleString()} รายการ
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-slate-400 hover:text-[#DC3545] hover:bg-red-50 rounded-md transition cursor-pointer"
                        aria-label={`ลบหมวดหมู่ ${cat.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs h-fit">
            <h2 className="text-base font-bold text-[#212529] mb-4">เพิ่มแนวภาพยนตร์</h2>

            <form onSubmit={handleAddGenre} className="space-y-4 text-sm">
              <div>
                <label htmlFor="gen-name" className="block text-[#495057] font-medium mb-1">
                  ชื่อแนวหนัง *
                </label>
                <input
                  id="gen-name"
                  type="text"
                  value={newGenName}
                  onChange={(e) => setNewGenName(e.target.value)}
                  placeholder="เช่น ไซไฟ, คอมเมดี้, สยองขวัญ"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
                  required
                />
              </div>

              <div>
                <label htmlFor="gen-color" className="block text-[#495057] font-medium mb-1">
                  สีประจำแนว
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="gen-color"
                    type="color"
                    value={newGenColor}
                    onChange={(e) => setNewGenColor(e.target.value)}
                    className="w-9 h-9 bg-transparent border border-slate-200 rounded cursor-pointer"
                  />
                  <span className="font-mono text-xs text-[#6C757D]">{newGenColor}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium py-2.5 px-4 rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มแนวภาพยนตร์</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h2 className="text-base font-bold text-[#212529]">แนวภาพยนตร์ทั้งหมด</h2>
            </div>

            <div className="p-5">
              {genres.length === 0 ? (
                <div className="py-10 text-center text-[#6C757D] text-sm">
                  ยังไม่มีแนวภาพยนตร์ในระบบ เริ่มเพิ่มแนวภาพยนตร์จากแบบฟอร์มด้านซ้าย
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {genres.map((gen) => (
                    <div
                      key={gen.id}
                      className="flex items-center gap-2 px-3 py-2 bg-[#F8F9FA] rounded-lg border border-slate-200 text-xs text-[#212529]"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: gen.color }}
                      />
                      <span className="font-medium">{gen.name}</span>
                      <span className="text-[11px] text-[#6C757D] font-mono">({gen.slug})</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteGenre(gen.id)}
                        aria-label={`ลบแนว ${gen.name}`}
                        className="text-slate-400 hover:text-[#DC3545] ml-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
